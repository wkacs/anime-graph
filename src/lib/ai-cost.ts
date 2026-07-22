// USD / 1000 token. A free tier most 0 — de a tokent MÉGIS logoljuk (WS2),
// hogy paid-modellre váltáskor a historikus volumen valós költséget vetítsen.
export const AI_COST_PER_1K_TOKENS: Record<string, { prompt: number; completion: number }> = {
  'glm-4.7-flash': { prompt: 0, completion: 0 },
  'deepseek/deepseek-chat-v3-0324:free': { prompt: 0, completion: 0 },
  // jövőbeli fizetős modell ára ide, pl.:
  // 'glm-4-plus': { prompt: 0.001, completion: 0.001 },
  '__test-paid': { prompt: 0.001, completion: 0.002 }, // csak teszthez
}

export function estimateCost(model: string, promptTok: number, completionTok: number): number {
  const price = AI_COST_PER_1K_TOKENS[model]
  if (!price) return 0
  return (promptTok / 1000) * price.prompt + (completionTok / 1000) * price.completion
}
