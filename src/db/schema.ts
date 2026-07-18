import {
  pgTable, serial, integer, text, timestamp, jsonb, real,
} from 'drizzle-orm/pg-core'

export type TagEntry = { name: string; rank: number }
export type RelationEntry = { type: string; anilistId: number; title: string }

export const anime = pgTable('anime', {
  id: serial('id').primaryKey(),
  anilistId: integer('anilist_id').notNull().unique(),
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
  relations: jsonb('relations').$type<RelationEntry[]>().notNull().default([]),
  trailerSite: text('trailer_site'),
  trailerId: text('trailer_id'),
  avgScore: integer('avg_score'),
  // user-owned fields
  status: text('status').notNull().default('planned'), // watching | completed | dropped | planned
  progress: integer('progress').notNull().default(0),
  myScore: integer('my_score'),
  elo: real('elo').notNull().default(1200),
  watchedAt: timestamp('watched_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

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
  animeId: integer('anime_id')
    .references(() => anime.id, { onDelete: 'cascade' }), // null = global
  kind: text('kind').notNull(), // like | dislike | note
  text: text('text').notNull(),
  source: text('source').notNull(), // opinion | settings | duel
  weight: real('weight').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
})

export const duels = pgTable('duels', {
  id: serial('id').primaryKey(),
  winnerId: integer('winner_id').notNull()
    .references(() => anime.id, { onDelete: 'cascade' }),
  loserId: integer('loser_id').notNull()
    .references(() => anime.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const recommendations = pgTable('recommendations', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(), // recommend | vibe | seasonal
  input: jsonb('input').notNull(),
  result: jsonb('result').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type AnimeSelect = typeof anime.$inferSelect
export type AnimeInsert = typeof anime.$inferInsert
