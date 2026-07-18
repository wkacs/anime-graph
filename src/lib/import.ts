export function mapAnilistStatus(s: string): string {
  switch (s) {
    case 'CURRENT':
    case 'REPEATING':
      return 'watching'
    case 'COMPLETED':
      return 'completed'
    case 'DROPPED':
      return 'dropped'
    case 'PLANNING':
    case 'PAUSED':
    default:
      return 'planned'
  }
}

const MAL_STATUS: Record<string, string> = {
  'Watching': 'watching',
  'Completed': 'completed',
  'Plan to Watch': 'planned',
  'On-Hold': 'planned',
  'Dropped': 'dropped',
}

export function mapMalStatus(s: string): string {
  return MAL_STATUS[s] ?? 'planned'
}

export type MalEntry = {
  malId: number
  status: string
  score: number | null
  progress: number
  finishedAt: string | null
}

const stripCdata = (s: string) => s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? stripCdata(m[1]) : null
}

// MAL export XML (malappinfo format) — no XML dependency, the format is flat and stable
export function parseMalXml(xml: string): MalEntry[] {
  const blocks = xml.match(/<anime>[\s\S]*?<\/anime>/g) ?? []
  const entries: MalEntry[] = []
  for (const block of blocks) {
    const malId = Number(tag(block, 'series_animedb_id'))
    if (!Number.isInteger(malId) || malId <= 0) continue
    const scoreRaw = Number(tag(block, 'my_score') ?? 0)
    const finish = tag(block, 'my_finish_date')
    entries.push({
      malId,
      status: mapMalStatus(tag(block, 'my_status') ?? ''),
      score: scoreRaw >= 1 && scoreRaw <= 10 ? scoreRaw : null,
      progress: Math.max(0, Number(tag(block, 'my_watched_episodes') ?? 0) || 0),
      finishedAt: finish && /^\d{4}-\d{2}-\d{2}$/.test(finish) && finish !== '0000-00-00' ? finish : null,
    })
  }
  return entries
}
