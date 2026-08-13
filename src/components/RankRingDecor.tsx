import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { KolRank } from '../types'
import { RANK_RING_WIDTH } from '../types'

interface Props {
  baseR: number
  rank: KolRank
  color: string
  opacity: number
  segs?: number
  dimmed?: boolean
  z?: number
  frontSide?: boolean
  /** Slow rotating metal sheen (safe on 2.5D — only ring meshes) */
  animate?: boolean
  renderOrder?: number
  /** 0 = back of cloud — quieter metal */
  depth?: number
}

/**
 * Single hairline watch-bezel (dark lip + metal + bright edge).
 * Challenger adds one thin outer wire with a gap — no stacked neon rings.
 */
export function RankRingDecor({
  baseR,
  rank,
  color,
  opacity,
  segs = 96,
  dimmed = false,
  z = 0.012,
  frontSide = true,
  animate = true,
  renderOrder = 2,
  depth = 0.65,
}: Props) {
  const side = frontSide ? THREE.FrontSide : THREE.DoubleSide
  const outer = RANK_RING_WIDTH[rank]
  const sheenRef = useRef<THREE.Group>(null)
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  const quiet = rank === 'gold' || rank === 'platinum'
  const depthMul = 0.55 + depth * 0.45

  const sheenSpeed =
    rank === 'challenger'
      ? 0.38
      : rank === 'master'
        ? 0.32
        : rank === 'diamond'
          ? 0.28
          : 0.2

  useFrame((state) => {
    if (!animate || dimmed) return
    if (sheenRef.current) {
      sheenRef.current.rotation.z = state.clock.elapsedTime * sheenSpeed + phase
    }
  })

  const mat = (c: string, o: number) => ({
    color: c,
    transparent: true as const,
    opacity: o,
    depthWrite: false,
    depthTest: true,
    side,
    toneMapped: false as const,
  })

  const metalDark =
    rank === 'challenger'
      ? '#3f2a0c'
      : rank === 'master'
        ? '#1e1b4b'
        : rank === 'diamond'
          ? '#0c4a6e'
          : rank === 'platinum'
            ? '#134e4a'
            : '#422006'
  const metalBright =
    rank === 'challenger'
      ? '#fde68a'
      : rank === 'master'
        ? '#c7d2fe'
        : rank === 'diamond'
          ? '#bae6fd'
          : rank === 'platinum'
            ? '#99f6e4'
            : '#fcd34d'

  const rLip = baseR * 0.986
  const rBezelIn = baseR * 1.002
  const rBezelOut = rank === 'challenger' ? baseR * 1.048 : baseR * outer
  const rEdge = rBezelOut * 1.012
  const rOuter = baseR * outer
  const ro = renderOrder
  const op = opacity * depthMul

  if (dimmed) {
    return (
      <mesh position={[0, 0, z]} renderOrder={ro}>
        <ringGeometry args={[rLip, rBezelOut, segs]} />
        <meshBasicMaterial {...mat(color, opacity * 0.4)} />
      </mesh>
    )
  }

  return (
    <group>
      {/* Inner dark lip — separates portrait from metal */}
      <mesh position={[0, 0, z - 0.001]} renderOrder={ro}>
        <ringGeometry args={[rLip, rBezelIn, segs]} />
        <meshBasicMaterial {...mat(metalDark, op * 0.9)} />
      </mesh>
      {/* Color band */}
      <mesh position={[0, 0, z]} renderOrder={ro}>
        <ringGeometry args={[rBezelIn, rBezelOut, segs]} />
        <meshBasicMaterial {...mat(color, op * (quiet ? 0.78 : 0.92))} />
      </mesh>
      {/* Bright outer hairline */}
      <mesh position={[0, 0, z + 0.001]} renderOrder={ro}>
        <ringGeometry args={[rBezelOut * 0.985, rEdge, segs]} />
        <meshBasicMaterial
          {...mat(metalBright, op * (quiet ? 0.35 : 0.55))}
        />
      </mesh>

      <group ref={sheenRef} position={[0, 0, z + 0.002]}>
        <mesh renderOrder={ro + 2}>
          <ringGeometry
            args={[rBezelIn, rBezelOut * 0.98, 36, 1, 0, quiet ? 0.42 : 0.62]}
          />
          <meshBasicMaterial {...mat('#ffffff', op * (quiet ? 0.22 : 0.38))} />
        </mesh>
        <mesh renderOrder={ro + 2}>
          <ringGeometry
            args={[
              rBezelIn,
              rBezelOut * 0.96,
              24,
              1,
              Math.PI + 0.35,
              0.28,
            ]}
          />
          <meshBasicMaterial {...mat(metalBright, op * 0.22)} />
        </mesh>
      </group>

      {rank === 'challenger' && (
        <mesh position={[0, 0, z]} renderOrder={ro}>
          <ringGeometry args={[baseR * 1.085, rOuter, segs]} />
          <meshBasicMaterial {...mat(metalBright, op * 0.62)} />
        </mesh>
      )}
    </group>
  )
}
