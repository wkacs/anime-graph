import type { AiringInfo } from './anilist'

export function pickUpcoming(airing: AiringInfo[], nowSec: number, windowMin: number): AiringInfo[] {
  return airing.filter((a) => a.airingAt > nowSec && a.airingAt <= nowSec + windowMin * 60)
}

export function buildAiringPayload(title: string, episode: number): { title: string; body: string; url: string } {
  return {
    title: `${title} — hamarosan adásban`,
    body: `EP ${episode} a következő órában érkezik 🎬`,
    url: '/',
  }
}
