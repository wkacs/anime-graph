import {
  pgTable, serial, integer, text, timestamp, jsonb, real,
  uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core'

export type TagEntry = { name: string; rank: number }
export type RelationEntry = { type: string; anilistId: number; title: string }

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(), // scrypt: salt:hash hex
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// user_id oszlopok default 1-gyel: a multi-tenant váltás előtti adatok
// az elsőként regisztrált (owner) fiókhoz tartoznak
export const anime = pgTable('anime', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(1),
  anilistId: integer('anilist_id').notNull(),
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
  mediaType: text('media_type').notNull().default('ANIME'), // ANIME | MANGA
  chapters: integer('chapters'),
  volumes: integer('volumes'),
  description: text('description'), // AniList description (nyers HTML, strip megjelenítéskor)
  relations: jsonb('relations').$type<RelationEntry[]>().notNull().default([]),
  trailerSite: text('trailer_site'),
  trailerId: text('trailer_id'),
  avgScore: integer('avg_score'),
  // user-owned fields
  status: text('status').notNull().default('planned'), // watching | completed | dropped | planned
  progress: integer('progress').notNull().default(0),
  myScore: integer('my_score'),
  elo: real('elo').notNull().default(1200),
  rewatchCount: integer('rewatch_count').notNull().default(0),
  watchedAt: timestamp('watched_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('anime_user_anilist_unique').on(t.userId, t.anilistId),
])

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
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

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

// egy globális közös "együtt nézzük" lista az instance-nek (housemates-modell)
export const watchlistItems = pgTable('watchlist_items', {
  id: serial('id').primaryKey(),
  anilistId: integer('anilist_id').notNull().unique(),
  mediaType: text('media_type').notNull().default('ANIME'),
  title: text('title').notNull(),
  coverUrl: text('cover_url'),
  addedBy: integer('added_by').notNull(),
  watchedEpisodes: integer('watched_episodes').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

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

export type AnimeSelect = typeof anime.$inferSelect
export type AnimeInsert = typeof anime.$inferInsert
