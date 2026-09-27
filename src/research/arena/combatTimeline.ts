export const COMBAT_LOOP = 6
export const COMBAT_HITS = [
  { time: 1.25, side: -1 },
  { time: 2.35, side: 1 },
  { time: 3.2, side: -1 },
  { time: 4.35, side: 1 },
] as const

const ease = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t) }
const bump = (t: number, start: number, peak: number, end: number) => t < peak ? ease((t - start) / (peak - start)) : 1 - ease((t - peak) / (end - peak))

/** One shared clock drives anticipation, sword contact, recoil and effects. */
export function combatPose(seconds: number, side: number) {
  const t = ((seconds % COMBAT_LOOP) + COMBAT_LOOP) % COMBAT_LOOP
  let wind = 0, swing = 0, recoil = 0, block = 0, lunge = 0, trail = 0
  for (const hit of COMBAT_HITS) {
    if (hit.side === side) {
      wind += bump(t, hit.time - .48, hit.time - .14, hit.time + .04)
      swing += bump(t, hit.time - .14, hit.time + .04, hit.time + .42)
      lunge += bump(t, hit.time - .19, hit.time, hit.time + .45)
      trail += bump(t, hit.time - .13, hit.time, hit.time + .18)
    } else {
      block += bump(t, hit.time - .25, hit.time - .02, hit.time + .3)
      recoil += bump(t, hit.time, hit.time + .1, hit.time + .48)
    }
  }
  const approach = ease(t / .65) * (1 - ease((t - 4.9) / .85))
  const bounce = Math.sin(t * Math.PI * 4) * .025
  return { t, wind, swing, recoil, block, lunge, trail, approach, bounce }
}
