import type { ScexQuadrant, ScexSentiment } from '../data/scexTracking'

export const ARENA_ZONES: Record<
  ScexQuadrant,
  { title: string; hint: string; corner: 'tl' | 'tr' | 'bl' | 'br' }
> = {
  nurture: {
    title: 'Emerging',
    hint: 'High credibility · fewer mentions',
    corner: 'tl',
  },
  stars: {
    title: 'Leading voices',
    hint: 'Frequent mentions · high credibility',
    corner: 'tr',
  },
  ignore: {
    title: 'Low activity',
    hint: 'Fewer mentions · lower credibility',
    corner: 'bl',
  },
  noise: {
    title: 'Needs review',
    hint: 'Frequent mentions · lower credibility',
    corner: 'br',
  },
}

export function arenaQuadrantTitle(quadrant?: ScexQuadrant | null): string {
  return quadrant ? ARENA_ZONES[quadrant]?.title || quadrant : ''
}

export function arenaSentimentLabel(sentiment: ScexSentiment | string): string {
  switch (sentiment) {
    case 'bullish': return 'Positive'
    case 'bearish': return 'Negative'
    case 'neutral': return 'Neutral'
    case 'shill': return 'Promotional'
    case 'scam': return 'Scam warning'
    default: return sentiment
  }
}
