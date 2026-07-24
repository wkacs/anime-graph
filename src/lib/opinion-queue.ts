// Vélemény-váró sor: saját címek, amikhez nincs (sikeres) vélemény.
// planned kimarad (arról nincs mit véleményezni); a failed extract visszakerül.
export type OpinionQueueInput = {
  id: number
  titleRomaji: string
  coverUrl: string | null
  status: string
  myScore: number | null
  createdAt: string
  hasOpinion: boolean
  extractStatus: string | null
}

const STATUS_ORDER: Record<string, number> = { completed: 0, watching: 1, dropped: 2 }

export function opinionQueue(rows: OpinionQueueInput[]): OpinionQueueInput[] {
  return rows
    .filter((r) => r.status in STATUS_ORDER)
    .filter((r) => !r.hasOpinion || r.extractStatus === 'failed')
    .sort((a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      || (b.myScore ?? -1) - (a.myScore ?? -1)
      || b.createdAt.localeCompare(a.createdAt))
}
