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
}

/**
 * Watch-bezel metal rings with a slow specular sweep.
 * Challenger gets a double bezel; Gold / Platinum stay quiet.
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
  animate = true,
  renderOrder = 2,
}: Props) {
  const side = frontSide ? THREE.FrontSide : THREE.DoubleSide
  const outer = RANK_RING_WIDTH[rank]
  const sheenRef = useRef<THREE.Group>(null)
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])

  // Higher ranks shimmer a bit faster / brighter
  const sheenSpeed =
    rank === 'challenger'
      ? 0.55
      : rank === 'master'
        ? 0.42
        : rank === 'diamond'
          ? 0.38
          : rank === 'platinum'
            ? 0.28
            : 0.22

  useFrame((state) => {
    if (!animate || dimmed) return
    const t = state.clock.elapsedTime
    if (sheenRef.current) {
      sheenRef.current.rotation.z = t * sheenSpeed + phase
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

  if (dimmed) {
    return (
      <mesh position={[0, 0, z]} renderOrder={renderOrder}>
        <ringGeometry args={[baseR * 0.97, baseR * outer * 0.98, segs]} />
        <meshBasicMaterial {...mat(color, opacity * 0.5)} />
      </mesh>
    )
  }

  // Hextech metal palette
  const accent =
    rank === 'challenger'
      ? '#f5e6b8'
      : rank === 'master'
        ? '#c7d2fe'
        : rank === 'diamond'
          ? '#e0e7ff'
          : rank === 'platinum'
            ? '#ccfbf1'
            : '#fde68a'
  const metalDark =
    rank === 'challenger'
      ? '#78350f'
      : rank === 'master'
        ? '#1e1b4b'
        : rank === 'diamond'
          ? '#0c4a6e'
          : rank === 'platinum'
            ? '#134e4a'
            : '#78350f'
  const metalMid =
    rank === 'challenger'
      ? '#b45309'
      : rank === 'master'
        ? '#4338ca'
        : rank === 'diamond'
          ? '#1d4ed8'
          : rank === 'platinum'
            ? '#0f766e'
            : '#a16207'
  const metalBright =
    rank === 'challenger'
      ? '#fbbf24'
      : rank === 'master'
        ? '#818cf8'
        : rank === 'diamond'
          ? '#38bdf8'
          : rank === 'platinum'
            ? '#2dd4bf'
            : '#f59e0b'
  const specular = '#ffffff'
  const quiet = rank === 'gold' || rank === 'platinum'
  const rInner = baseR * 0.97
  const rStack = rank === 'challenger' ? baseR * 1.08 : baseR * outer * 0.98
  const rMid = rInner + (rStack - rInner) * 0.42
  const rOuter = baseR * outer
  const sheenArc =
    rank === 'challenger'
      ? 0.72
      : rank === 'master'
        ? 0.58
        : rank === 'diamond'
          ? 0.52
          : 0.38
  const sheenOp = quiet ? 0.28 : rank === 'challenger' ? 0.5 : 0.4
  const ro = renderOrder

  return (
    <group>
      <mesh position={[0, 0, z - 0.002]} renderOrder={ro}>
        <ringGeometry args={[rInner, rMid, segs]} />
        <meshBasicMaterial {...mat(metalDark, opacity * (quiet ? 0.7 : 0.88))} />
      </mesh>
      <mesh position={[0, 0, z]} renderOrder={ro}>
        <ringGeometry args={[rMid * 0.99, rStack * 0.92, segs]} />
        <meshBasicMaterial {...mat(color, opacity * (quiet ? 0.75 : 0.95))} />
      </mesh>
      <mesh position={[0, 0, z + 0.001]} renderOrder={ro}>
        <ringGeometry args={[rStack * 0.91, rStack, segs]} />
        <meshBasicMaterial
          {...mat(quiet ? accent : metalBright, opacity * (quiet ? 0.45 : 0.7))}
        />
      </mesh>

      <group ref={sheenRef} position={[0, 0, z + 0.0025]}>
        <mesh renderOrder={ro + 2}>
          <ringGeometry
            args={[rMid, rStack * 0.98, 28, 1, 0, sheenArc]}
          />
          <meshBasicMaterial {...mat(specular, opacity * sheenOp)} />
        </mesh>
        <mesh renderOrder={ro + 2}>
          <ringGeometry
            args={[
              rMid,
              rStack * 0.94,
              20,
              1,
              Math.PI + 0.25,
              sheenArc * 0.45,
            ]}
          />
          <meshBasicMaterial {...mat(accent, opacity * sheenOp * 0.45)} />
        </mesh>
      </group>

      {rank === 'platinum' && (
        <mesh position={[0, 0, z + 0.002]} renderOrder={ro + 1}>
          <ringGeometry args={[baseR * 1.015, baseR * 1.03, segs]} />
          <meshBasicMaterial {...mat(specular, opacity * 0.28)} />
        </mesh>
      )}

      {rank === 'diamond' && (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const start = (i / 6) * Math.PI * 2 + 0.1
            const len = Math.PI / 3 - 0.22
            return (
              <mesh
                key={i}
                position={[0, 0, z + 0.0015]}
                renderOrder={ro + 1}
              >
                <ringGeometry
                  args={[rStack * 0.94, rStack, 12, 1, start, len]}
                />
                <meshBasicMaterial {...mat(specular, opacity * 0.28)} />
              </mesh>
            )
          })}
        </>
      )}

      {rank === 'challenger' && (
        <>
          <mesh position={[0, 0, z]} renderOrder={ro}>
            <ringGeometry args={[baseR * 1.125, rOuter * 0.94, segs]} />
            <meshBasicMaterial {...mat(metalMid, opacity * 0.9)} />
          </mesh>
          <mesh position={[0, 0, z + 0.001]} renderOrder={ro + 1}>
            <ringGeometry args={[rOuter * 0.93, rOuter, segs]} />
            <meshBasicMaterial {...mat(accent, opacity * 0.85)} />
          </mesh>
        </>
      )}
    </group>
  )
}
