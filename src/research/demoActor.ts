import type { ScexActor } from '../data/scexTracking'
import { DEMO_HANDLE } from './demoConfig'
/** Public metadata from the verified 20 September snapshot, used only for demo entry. */
export const DEMO_ACTOR: ScexActor = {
  id: 'recorded-demo-nbaluong', handle: DEMO_HANDLE, displayName: 'nbaluong', kind: 'kol',
  followers: 32323, postsVolume: 36, volumeScore: 100, qualityScore: 74.7,
  sentiment: 'neutral', notes: 'Recorded snapshot · 20 September 2026',
}
