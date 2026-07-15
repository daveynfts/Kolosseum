import * as THREE from 'three'
import type { KolRank } from '../types'
import { RANK_RING_WIDTH } from '../types'

interface Props {
  baseR: number
  rank: KolRank
  color: string
  opacity: number
  segs?: number
  /** When dimmed, only a faint solid ring */
  dimmed?: boolean
  /** Start z for layering */
  z?: number
  frontSide?: boolean
}

/**
 * Rank-specific outer border patterns for map-level tier scan.
 * High ranks = denser ornament; low ranks = simple ring.
 *
 * Challenger — double ring + 5 orbit pips
 * Master     — solid + 4 arc dashes
 * Diamond    — solid + 4 cardinal ticks
 * Platinum   — solid + sparse dashes
 * Gold       — single thin ring
 */
export function RankRingDecor({
  baseR,
  rank,
  color,
  opacity,
  segs = 48,
  dimmed = false,
  z = 0.012,
  frontSide = true,
}: Props) {
  const side = frontSide ? THREE.FrontSide : THREE.DoubleSide
  const outer = RANK_RING_WIDTH[rank]
  const mat = {
    color,
    transparent: true as const,
    depthWrite: false,
    depthTest: true,
    side,
    toneMapped: false as const,
  }

  if (dimmed) {
    return (
      <mesh position={[0, 0, z]} renderOrder={2}>
        <ringGeometry args={[baseR * 0.97, baseR * outer * 0.98, segs]} />
        <meshBasicMaterial {...mat} opacity={opacity * 0.55} />
      </mesh>
    )
  }

  // Shared solid core ring (all ranks)
  const solidInner = baseR * 0.96
  const solidOuter = baseR * (rank === 'gold' ? 1.08 : rank === 'platinum' ? 1.1 : 1.12)

  return (
    <group>
      {/* Core solid border */}
      <mesh position={[0, 0, z]} renderOrder={2}>
        <ringGeometry args={[solidInner, solidOuter, segs]} />
        <meshBasicMaterial
          {...mat}
          opacity={opacity}
        />
      </mesh>

      {rank === 'challenger' && (
        <>
          {/* Second outer band */}
          <mesh position={[0, 0, z + 0.001]} renderOrder={2}>
            <ringGeometry
              args={[baseR * 1.14, baseR * outer, segs]}
            />
            <meshBasicMaterial {...mat} opacity={opacity * 0.85} />
          </mesh>
          {/* Soft halo rim */}
          <mesh position={[0, 0, z - 0.002]} renderOrder={1}>
            <ringGeometry
              args={[baseR * outer, baseR * (outer + 0.1), segs]}
            />
            <meshBasicMaterial {...mat} opacity={opacity * 0.35} />
          </mesh>
          {/* 5 orbit pips — crown / star cue */}
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2
            const rr = baseR * (outer + 0.06)
            const pr = baseR * 0.09
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * rr, Math.sin(a) * rr, z + 0.002]}
                renderOrder={4}
              >
                <circleGeometry args={[pr, 12]} />
                <meshBasicMaterial {...mat} opacity={opacity * 0.95} />
              </mesh>
            )
          })}
        </>
      )}

      {rank === 'master' && (
        <>
          {/* Outer dashed arcs (4 segments) */}
          {[0, 1, 2, 3].map((i) => {
            const thetaStart = (i / 4) * Math.PI * 2 + 0.12
            const thetaLength = Math.PI * 0.5 - 0.28
            return (
              <mesh key={i} position={[0, 0, z + 0.001]} renderOrder={2}>
                <ringGeometry
                  args={[
                    baseR * 1.13,
                    baseR * outer,
                    24,
                    1,
                    thetaStart,
                    thetaLength,
                  ]}
                />
                <meshBasicMaterial {...mat} opacity={opacity * 0.9} />
              </mesh>
            )
          })}
        </>
      )}

      {rank === 'diamond' && (
        <>
          {/* 4 cardinal ticks (N/E/S/W) — faceted cue */}
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2
            const tipR = baseR * (outer + 0.05)
            const tickW = baseR * 0.055
            const thetaStart = a - 0.14
            const thetaLength = 0.28
            return (
              <group key={i}>
                <mesh position={[0, 0, z + 0.001]} renderOrder={3}>
                  <ringGeometry
                    args={[
                      baseR * 1.12,
                      baseR * outer,
                      12,
                      1,
                      thetaStart,
                      thetaLength,
                    ]}
                  />
                  <meshBasicMaterial {...mat} opacity={opacity * 0.95} />
                </mesh>
                <mesh
                  position={[Math.cos(a) * tipR, Math.sin(a) * tipR, z + 0.002]}
                  renderOrder={4}
                >
                  <circleGeometry args={[tickW, 8]} />
                  <meshBasicMaterial {...mat} opacity={opacity} />
                </mesh>
              </group>
            )
          })}
        </>
      )}

      {rank === 'platinum' && (
        <>
          {/* Sparse outer dashes (6) */}
          {Array.from({ length: 6 }, (_, i) => {
            const thetaStart = (i / 6) * Math.PI * 2 + 0.08
            const thetaLength = Math.PI / 6 - 0.14
            return (
              <mesh key={i} position={[0, 0, z + 0.001]} renderOrder={2}>
                <ringGeometry
                  args={[
                    baseR * 1.11,
                    baseR * outer,
                    16,
                    1,
                    thetaStart,
                    thetaLength,
                  ]}
                />
                <meshBasicMaterial {...mat} opacity={opacity * 0.75} />
              </mesh>
            )
          })}
        </>
      )}

      {/* Gold: solid only — intentionally plain for low tier */}
    </group>
  )
}
