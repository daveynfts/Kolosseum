import { describe, expect, it } from 'vitest'
import { combatPose, COMBAT_HITS, COMBAT_LOOP } from './combatTimeline'

describe('combat choreography', () => {
  it('joins the loop without a pose discontinuity', () => {
    for (const side of [-1, 1]) {
      const start = combatPose(0, side), end = combatPose(COMBAT_LOOP - .00001, side)
      for (const key of ['wind', 'swing', 'block', 'recoil', 'lunge', 'approach', 'bounce'] as const) {
        expect(end[key]).toBeCloseTo(start[key], 3)
      }
      expect(combatPose(COMBAT_LOOP, side)).toEqual(start)
    }
  })
  it('aligns every strike effect with a lunging attacker and guarding defender', () => {
    for (const hit of COMBAT_HITS) {
      const attack = combatPose(hit.time, hit.side), defend = combatPose(hit.time, -hit.side)
      expect(attack.lunge).toBe(1)
      expect(attack.trail).toBe(1)
      expect(defend.block).toBeGreaterThan(.95)
      expect(combatPose(hit.time + .1, -hit.side).recoil).toBeCloseTo(1)
    }
  })
})
