import { and, desc, eq, ilike, sql, type SQL } from 'drizzle-orm'
import { title } from '@/db/schema'
import type { BrowseFilters } from './browse'

export function browseSortColumn(sort: string): 'popularity' | 'score' | 'year' {
  if (sort === 'SCORE_DESC') return 'score'
  if (sort === 'START_DATE_DESC') return 'year'
  return 'popularity'
}

export function browseWhere(f: BrowseFilters): SQL {
  const parts: SQL[] = [eq(title.mediaType, f.type)]
  if (f.genre) parts.push(sql`${f.genre} = ANY(${title.genres})`)
  if (f.format) parts.push(eq(title.format, f.format))
  if (f.year) parts.push(eq(title.year, f.year))
  if (f.minScore) parts.push(sql`coalesce(${title.communityScore} * 10, ${title.avgScore}, 0) >= ${f.minScore}`)
  if (f.search) parts.push(ilike(title.titleRomaji, `%${f.search}%`))
  return and(...parts)!
}

export function browseOrder(sort: string) {
  const col = browseSortColumn(sort)
  if (col === 'score') return desc(sql`coalesce(${title.communityScore} * 10, ${title.avgScore}, 0)`)
  if (col === 'year') return desc(sql`coalesce(${title.year}, 0)`)
  return desc(title.popularity)
}
