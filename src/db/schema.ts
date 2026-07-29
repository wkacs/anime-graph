import {
  pgTable, pgView, serial, integer, text, timestamp, jsonb, real,
  uniqueIndex, index, primaryKey, customType,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export type TagEntry = { name: string; rank: number }
export type RelationEntry = { type: string; anilistId: number; title: string }

// Postgres full-text type — no built-in Drizzle helper.
const tsvector = customType<{ data: string }>({
  dataType() { return 'tsvector' },
})

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(), // scrypt: salt:hash hex
  tier: text('tier').notNull().default('free'), // free | paid
  // nullable: a nyílt regisztráció előtti fiókoknak (id=1) nincs e-mailje
  email: text('email'),
  emailVerifiedAt: timestamp('email_verified_at'), // null = nem megerősített
  // jelszó-resetnél nő → a régi session-tokenek érvénytelenné válnak
  tokenVersion: integer('token_version').notNull().default(0),
  locale: text('locale').notNull().default('en'), // en | hu
  bio: text('bio'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// E-mail-megerősítés és jelszó-visszaállítás tokenjei. A nyers token CSAK a
// linkbe kerül; itt kizárólag a sha256-hash-e él, hogy egy adatbázis-szivárgás
// ne jelentsen fiók-átvételt.
export const authTokens = pgTable('auth_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // verify | reset
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('auth_tokens_hash_unique').on(t.tokenHash),
  index('auth_tokens_user_kind').on(t.userId, t.kind),
])

// GLOBAL catalog: one row per AniList title, shared across all users.
export const title = pgTable('title', {
  id: serial('id').primaryKey(),
  anilistId: integer('anilist_id').notNull(),
  malId: integer('mal_id'),
  slug: text('slug').notNull(),
  mediaType: text('media_type').notNull().default('ANIME'), // ANIME | MANGA
  titleRomaji: text('title_romaji').notNull(),
  titleEnglish: text('title_english'),
  titleNative: text('title_native'),
  coverUrl: text('cover_url'),
  bannerUrl: text('banner_url'),
  genres: text('genres').array().notNull().default([]),
  tags: jsonb('tags').$type<TagEntry[]>().notNull().default([]),
  studio: text('studio'),
  season: text('season'),
  year: integer('year'),
  episodes: integer('episodes'),
  durationMin: integer('duration_min'),
  format: text('format'),
  chapters: integer('chapters'),
  volumes: integer('volumes'),
  description: text('description'),
  relations: jsonb('relations').$type<RelationEntry[]>().notNull().default([]),
  trailerSite: text('trailer_site'),
  trailerId: text('trailer_id'),
  isAdult: integer('is_adult').notNull().default(0), // AniList isAdult; 0/1 for existing Postgres compatibility
  avgScore: integer('avg_score'),               // AniList average (external)
  communityScore: real('community_score'),        // our bayesian score, null until computed
  communityCount: integer('community_count').notNull().default(0),
  popularity: integer('popularity').notNull().default(0), // # of user_title rows
  syncedAt: timestamp('synced_at'),
  searchVector: tsvector('search_vector').generatedAlwaysAs(
    sql`to_tsvector('simple', coalesce(title_romaji,'') || ' ' || coalesce(title_english,'') || ' ' || coalesce(title_native,''))`,
  ),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('title_anilist_type_unique').on(t.anilistId, t.mediaType),
  // slug is unique per media type: AniList ANIME and MANGA id spaces overlap,
  // so `<romaji>-<anilistId>` can collide across types — scope uniqueness by mediaType.
  uniqueIndex('title_slug_unique').on(t.mediaType, t.slug),
  index('title_search_gin').using('gin', t.searchVector),
])

// PER-USER list. id is preserved from the pre-split `anime` table so the
// six FK tables (opinions, taste_memory, favorite_characters, duels,
// episode_log, anime_staff) that reference it stay valid.
export const userTitle = pgTable('user_title', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(1),
  titleId: integer('title_id').notNull().references(() => title.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('planned'), // watching | completed | dropped | planned
  progress: integer('progress').notNull().default(0),
  myScore: integer('my_score'),
  elo: real('elo').notNull().default(1200),
  rewatchCount: integer('rewatch_count').notNull().default(0),
  watchedAt: timestamp('watched_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('user_title_user_title_unique').on(t.userId, t.titleId),
])

// COMPATIBILITY VIEW: same flat column shape the old `anime` table had, so the
// ~70 read-only call sites keep working. SELECT-ONLY — writes go via anime-write.ts.
// CRITICAL: `.notNull()` must mirror the OLD `anime` table's nullability exactly,
// or `$inferSelect` (AnimeSelect) infers every column as `T | null` and ~90 read
// call sites that expect non-null (titleRomaji: string, genres: string[], …) break.
export const anime = pgView('anime', {
  id: integer('id').notNull(),
  userId: integer('user_id').notNull(),
  anilistId: integer('anilist_id').notNull(),
  titleRomaji: text('title_romaji').notNull(),
  titleEnglish: text('title_english'),
  titleNative: text('title_native'),
  coverUrl: text('cover_url'),
  bannerUrl: text('banner_url'),
  genres: text('genres').array().notNull(),
  tags: jsonb('tags').$type<TagEntry[]>().notNull(),
  studio: text('studio'),
  season: text('season'),
  year: integer('year'),
  episodes: integer('episodes'),
  durationMin: integer('duration_min'),
  format: text('format'),
  mediaType: text('media_type').notNull(),
  chapters: integer('chapters'),
  volumes: integer('volumes'),
  description: text('description'),
  relations: jsonb('relations').$type<RelationEntry[]>().notNull(),
  trailerSite: text('trailer_site'),
  trailerId: text('trailer_id'),
  avgScore: integer('avg_score'),
  status: text('status').notNull(),
  progress: integer('progress').notNull(),
  myScore: integer('my_score'),
  elo: real('elo').notNull(),
  rewatchCount: integer('rewatch_count').notNull(),
  watchedAt: timestamp('watched_at'),
  createdAt: timestamp('created_at').notNull(),
  titleId: integer('title_id').notNull(),
}).existing()

export const opinions = pgTable('opinions', {
  id: serial('id').primaryKey(),
  animeId: integer('anime_id').notNull().unique()
    .references(() => anime.id, { onDelete: 'cascade' }),
  rawText: text('raw_text').notNull(),
  extractStatus: text('extract_status').notNull().default('pending'), // pending | done | failed
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const tasteMemory = pgTable('taste_memory', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(1),
  animeId: integer('anime_id')
    .references(() => anime.id, { onDelete: 'cascade' }), // null = global
  kind: text('kind').notNull(), // like | dislike | note
  text: text('text').notNull(),
  source: text('source').notNull(), // opinion | settings | duel
  weight: real('weight').notNull().default(1),
  // a tény abban a nyelvben él, amiben kinyertük — a meglévő sorok magyarok
  lang: text('lang').notNull().default('hu'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Gépi ízlés-jelek: az extract kötött szókészletű kimenete. NEM keverjük a
// taste_memory-ba, mert annak sorai megjelennek a felületen (TasteCard, ProfileReveal),
// ezek viszont csak a rangsoroló vektort táplálják.
export const tasteSignal = pgTable('taste_signal', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  titleId: integer('title_id').notNull().references(() => title.id, { onDelete: 'cascade' }),
  feature: text('feature').notNull(),
  polarity: integer('polarity').notNull(), // 1 | -1
  strength: real('strength').notNull().default(1), // 0..1
  source: text('source').notNull(), // opinion | backfill
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('taste_signal_user').on(t.userId),
  uniqueIndex('taste_signal_unique').on(t.userId, t.titleId, t.feature),
])

export const settings = pgTable('settings', {
  userId: integer('user_id').notNull().default(1),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.key] }),
])

export const favoriteCharacters = pgTable('favorite_characters', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(1),
  charId: integer('char_id').notNull(), // AniList character id
  name: text('name').notNull(),
  image: text('image'),
  vaId: integer('va_id'),
  vaName: text('va_name'),
  vaImage: text('va_image'),
  animeId: integer('anime_id').notNull()
    .references(() => anime.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('favchar_user_char_unique').on(t.userId, t.charId),
])

export const duels = pgTable('duels', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(1),
  winnerId: integer('winner_id').notNull()
    .references(() => anime.id, { onDelete: 'cascade' }),
  loserId: integer('loser_id').notNull()
    .references(() => anime.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// one row per watched episode — feeds the activity heatmap
export const episodeLog = pgTable('episode_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(1),
  animeId: integer('anime_id').notNull()
    .references(() => anime.id, { onDelete: 'cascade' }),
  episode: integer('episode').notNull(),
  watchedAt: timestamp('watched_at').notNull().defaultNow(),
})

export const recommendations = pgTable('recommendations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(1),
  kind: text('kind').notNull(), // recommend | vibe | seasonal | digest | profile
  input: jsonb('input').notNull(),
  result: jsonb('result').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// minden AI-hívás egy sor — a valós költség-visszamérés alapja árazás előtt
export const aiUsageLog = pgTable('ai_usage_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  estCostUsd: real('est_cost_usd').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('ai_usage_user_day').on(t.userId, t.createdAt),
])

// Személyes watchlist. Egy valódi közös lista később külön csoport-
// és tagsági modellen keresztül kap majd jogosultságokat.
export const watchlistItems = pgTable('watchlist_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  anilistId: integer('anilist_id').notNull(),
  mediaType: text('media_type').notNull().default('ANIME'),
  title: text('title').notNull(),
  coverUrl: text('cover_url'),
  watchedEpisodes: integer('watched_episodes').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('watchlist_items_user_anilist_unique').on(t.userId, t.anilistId),
  index('watchlist_items_user_created_at').on(t.userId, t.createdAt),
])

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// push-dedup: egy (anime, epizód) párra egyszer megy ki értesítés
export const notifiedAiring = pgTable('notified_airing', {
  id: serial('id').primaryKey(),
  anilistId: integer('anilist_id').notNull(),
  episode: integer('episode').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('notified_airing_unique').on(t.anilistId, t.episode),
])

export const animeStaff = pgTable('anime_staff', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(1),
  animeId: integer('anime_id').notNull()
    .references(() => anime.id, { onDelete: 'cascade' }),
  staffId: integer('staff_id').notNull(), // AniList staff id
  name: text('name').notNull(),
  image: text('image'),
  role: text('role').notNull(), // elsőre csak 'Director'
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('anime_staff_unique').on(t.userId, t.animeId, t.staffId),
])

// AniList "users who liked X" jel, batch-cache-elve (heti sync) — nem élő per-request
export const titleRecommendations = pgTable('title_recommendations', {
  id: serial('id').primaryKey(),
  anilistId: integer('anilist_id').notNull(),       // a forrás-cím
  recAnilistId: integer('rec_anilist_id').notNull(), // az ajánlott cím
  rating: integer('rating').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('title_rec_unique').on(t.anilistId, t.recAnilistId),
])

// alacsony-frekvenciás külső hívások (seasonal/airing) TTL-cache-e
export const apiCache = pgTable('api_cache', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// D3: kétirányú lista-szinkron — per-user OAuth-tokenek a külső szolgáltatókhoz (MAL/AniList)
export const syncAccounts = pgTable('sync_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  provider: text('provider').notNull(), // 'mal' | 'anilist'
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  externalUsername: text('external_username'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('sync_account_user_provider').on(t.userId, t.provider),
])

export type TitleInsert = typeof title.$inferInsert
export type UserTitleInsert = typeof userTitle.$inferInsert
// AnimeSelect stays available for read call sites via the compat view.
export type AnimeSelect = typeof anime.$inferSelect
