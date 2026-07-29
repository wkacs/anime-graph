export const INPUT_LIMITS = {
  password: 128,
  tasteText: 4_000,
  opinion: 8_000,
  vibePrompt: 1_200,
  nlSearch: 600,
  recommendExplainPayload: 8_000,
  maxVibeAnimeIds: 20,
  maxVibeChipIds: 30,
  maxRecommendPicks: 10,
} as const

export function exceedsTextLimit(value: string, limit: number): boolean {
  return value.length > limit
}

export function isBoundedStringList(value: unknown, maxItems: number, maxItemLength: number): value is string[] {
  return Array.isArray(value)
    && value.length <= maxItems
    && value.every((item) => typeof item === 'string' && item.length <= maxItemLength)
}
