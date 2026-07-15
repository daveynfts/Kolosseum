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
}

/**
 * LoL Season-2017 style summoner borders with metallic sheen:
 * multi-layer bevel (dark → mid → bright), specular arcs, gem facets.
 * Inspired by 2017 ranked frames — not official assets.
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
}: Props) {
  const side = frontSide ? THREE.FrontSide : THREE.DoubleSide
  const outer = RANK_RING_WIDTH[rank]
  const sheenRef = useRef<THREE.Group>(null)
  const gemPulseRef = useRef<THREE.Group>(null)
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
    if (gemPulseRef.current) {
      const pulse = 1 + Math.sin(t * 2.2 + phase) * 0.06
      gemPulseRef.current.scale.setScalar(pulse)
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
      <mesh position={[0, 0, z]} renderOrder={2}>
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
  const gemCore =
    rank === 'challenger'
      ? '#7dd3fc'
      : rank === 'master'
        ? '#6ee7b7'
        : rank === 'diamond'
          ? '#e9d5ff'
          : rank === 'platinum'
            ? '#99f6e4'
            : '#fef3c7'

  const r0 = baseR * 0.95
  const r1 = baseR * 1.02
  const r2 = baseR * 1.07
  const r3 = baseR * 1.12
  const rOuter = baseR * outer

  // Specular arc length — higher tier = longer/brighter sheen
  const sheenArc =
    rank === 'challenger'
      ? 0.85
      : rank === 'master'
        ? 0.7
        : rank === 'diamond'
          ? 0.65
          : rank === 'platinum'
            ? 0.55
            : 0.45
  const sheenOp =
    rank === 'challenger'
      ? 0.55
      : rank === 'master'
        ? 0.48
        : rank === 'diamond'
          ? 0.45
          : 0.38

  return (
    <group>
      {/* ——— Beveled metal stack (dark → mid → color → bright) ——— */}
      <mesh position={[0, 0, z - 0.002]} renderOrder={2}>
        <ringGeometry args={[r0, r1, segs]} />
        <meshBasicMaterial {...mat(metalDark, opacity * 0.9)} />
      </mesh>
      <mesh position={[0, 0, z - 0.001]} renderOrder={2}>
        <ringGeometry args={[r1 * 0.99, r2, segs]} />
        <meshBasicMaterial {...mat(metalMid, opacity * 0.85)} />
      </mesh>
      <mesh position={[0, 0, z]} renderOrder={3}>
        <ringGeometry args={[r2 * 0.98, r3, segs]} />
        <meshBasicMaterial {...mat(color, opacity)} />
      </mesh>
      <mesh position={[0, 0, z + 0.001]} renderOrder={3}>
        <ringGeometry args={[r3 * 0.99, rOuter * 0.88, segs]} />
        <meshBasicMaterial {...mat(metalBright, opacity * 0.7)} />
      </mesh>
      {/* Outer polish rim */}
      <mesh position={[0, 0, z + 0.0015]} renderOrder={3}>
        <ringGeometry args={[rOuter * 0.88, rOuter * 0.95, segs]} />
        <meshBasicMaterial {...mat(accent, opacity * 0.65)} />
      </mesh>

      {/* ——— Specular sheen arcs (rotate = metallic light sweep) ——— */}
      <group ref={sheenRef} position={[0, 0, z + 0.0025]}>
        {/* Primary bright highlight */}
        <mesh renderOrder={6}>
          <ringGeometry
            args={[r1, rOuter * 0.94, 32, 1, 0, sheenArc]}
          />
          <meshBasicMaterial {...mat(specular, opacity * sheenOp)} />
        </mesh>
        {/* Softer secondary highlight opposite side */}
        <mesh renderOrder={6}>
          <ringGeometry
            args={[
              r2,
              rOuter * 0.9,
              24,
              1,
              Math.PI + 0.2,
              sheenArc * 0.55,
            ]}
          />
          <meshBasicMaterial {...mat(accent, opacity * sheenOp * 0.55)} />
        </mesh>
        {/* Thin hot edge glint */}
        <mesh renderOrder={7}>
          <ringGeometry
            args={[rOuter * 0.9, rOuter * 0.96, 20, 1, 0.15, sheenArc * 0.4]}
          />
          <meshBasicMaterial {...mat(specular, opacity * sheenOp * 0.7)} />
        </mesh>
      </group>

      {/* ——— Rank ornaments ——— */}
      {rank === 'gold' && (
        <>
          <group ref={gemPulseRef}>
            <Gem
              x={0}
              y={baseR * 1.14}
              z={z + 0.004}
              size={baseR * 0.11}
              color={gemCore}
              glow={accent}
              metal={metalBright}
              opacity={opacity}
              side={side}
            />
          </group>
          {[-1, 1].map((dir) => (
            <mesh key={dir} position={[0, 0, z + 0.002]} renderOrder={4}>
              <ringGeometry
                args={[
                  baseR * 1.08,
                  baseR * 1.2,
                  10,
                  1,
                  Math.PI / 2 + dir * 0.55 - 0.18,
                  0.36,
                ]}
              />
              <meshBasicMaterial {...mat('#b91c1c', opacity * 0.85)} />
            </mesh>
          ))}
          {/* Flag metal edge */}
          {[-1, 1].map((dir) => (
            <mesh key={`fe-${dir}`} position={[0, 0, z + 0.0025]} renderOrder={4}>
              <ringGeometry
                args={[
                  baseR * 1.18,
                  baseR * 1.22,
                  8,
                  1,
                  Math.PI / 2 + dir * 0.55 - 0.12,
                  0.24,
                ]}
              />
              <meshBasicMaterial {...mat(accent, opacity * 0.5)} />
            </mesh>
          ))}
        </>
      )}

      {rank === 'platinum' && (
        <>
          <mesh position={[0, 0, z + 0.001]} renderOrder={3}>
            <ringGeometry args={[baseR * 1.12, rOuter, segs]} />
            <meshBasicMaterial {...mat(color, opacity * 0.55)} />
          </mesh>
          {/* Chrome inner hairline */}
          <mesh position={[0, 0, z + 0.002]} renderOrder={4}>
            <ringGeometry args={[baseR * 1.05, baseR * 1.07, segs]} />
            <meshBasicMaterial {...mat(specular, opacity * 0.35)} />
          </mesh>
          <group ref={gemPulseRef}>
            <Gem
              x={0}
              y={baseR * 1.16}
              z={z + 0.004}
              size={baseR * 0.1}
              color={gemCore}
              glow={accent}
              metal={metalBright}
              opacity={opacity}
              side={side}
            />
            <Gem
              x={0}
              y={-baseR * 1.16}
              z={z + 0.004}
              size={baseR * 0.08}
              color={gemCore}
              glow={accent}
              metal={metalBright}
              opacity={opacity * 0.9}
              side={side}
            />
          </group>
        </>
      )}

      {rank === 'diamond' && (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const start = (i / 6) * Math.PI * 2 + 0.08
            const len = Math.PI / 3 - 0.16
            return (
              <group key={i}>
                <mesh position={[0, 0, z + 0.001]} renderOrder={3}>
                  <ringGeometry
                    args={[baseR * 1.13, rOuter, 16, 1, start, len]}
                  />
                  <meshBasicMaterial {...mat(metalBright, opacity * 0.75)} />
                </mesh>
                {/* Metal bevel on each segment */}
                <mesh position={[0, 0, z + 0.0015]} renderOrder={4}>
                  <ringGeometry
                    args={[
                      rOuter * 0.92,
                      rOuter,
                      10,
                      1,
                      start + 0.05,
                      len * 0.35,
                    ]}
                  />
                  <meshBasicMaterial {...mat(specular, opacity * 0.4)} />
                </mesh>
              </group>
            )
          })}
          <group ref={gemPulseRef}>
            <Gem
              x={0}
              y={baseR * 1.18}
              z={z + 0.005}
              size={baseR * 0.12}
              color={gemCore}
              glow={color}
              metal={accent}
              opacity={opacity}
              side={side}
            />
          </group>
          {[-1, 1].map((dir) => (
            <mesh
              key={dir}
              position={[dir * baseR * 1.18, 0, z + 0.004]}
              renderOrder={5}
            >
              <circleGeometry args={[baseR * 0.075, 12]} />
              <meshBasicMaterial {...mat(gemCore, opacity * 0.9)} />
            </mesh>
          ))}
          {[-1, 1].map((dir) => (
            <mesh
              key={`sg-${dir}`}
              position={[dir * baseR * 1.18, 0, z + 0.005]}
              renderOrder={6}
            >
              <circleGeometry args={[baseR * 0.03, 10]} />
              <meshBasicMaterial {...mat(specular, opacity * 0.85)} />
            </mesh>
          ))}
        </>
      )}

      {rank === 'master' && (
        <>
          <mesh position={[0, 0, z + 0.001]} renderOrder={3}>
            <ringGeometry args={[baseR * 1.12, rOuter, segs]} />
            <meshBasicMaterial {...mat(color, opacity * 0.7)} />
          </mesh>
          {[-1, 1].map((dir) => (
            <group key={dir}>
              <mesh position={[0, 0, z + 0.002]} renderOrder={4}>
                <ringGeometry
                  args={[
                    baseR * 1.08,
                    baseR * 1.22,
                    14,
                    1,
                    dir > 0 ? -0.55 : Math.PI - 0.55,
                    1.1,
                  ]}
                />
                <meshBasicMaterial {...mat(metalMid, opacity * 0.65)} />
              </mesh>
              {/* Wing metal highlight */}
              <mesh position={[0, 0, z + 0.003]} renderOrder={4}>
                <ringGeometry
                  args={[
                    baseR * 1.14,
                    baseR * 1.2,
                    12,
                    1,
                    dir > 0 ? -0.35 : Math.PI - 0.35,
                    0.55,
                  ]}
                />
                <meshBasicMaterial {...mat(accent, opacity * 0.55)} />
              </mesh>
            </group>
          ))}
          <group ref={gemPulseRef}>
            <Gem
              x={0}
              y={baseR * 1.2}
              z={z + 0.005}
              size={baseR * 0.14}
              color={gemCore}
              glow={accent}
              metal={metalBright}
              opacity={opacity}
              side={side}
              plate
            />
          </group>
        </>
      )}

      {rank === 'challenger' && (
        <>
          <mesh position={[0, 0, z + 0.001]} renderOrder={3}>
            <ringGeometry args={[baseR * 1.12, rOuter, segs]} />
            <meshBasicMaterial {...mat(color, opacity * 0.75)} />
          </mesh>
          {/* Warm gold bloom */}
          <mesh position={[0, 0, z - 0.003]} renderOrder={1}>
            <ringGeometry
              args={[rOuter * 0.96, baseR * (outer + 0.14), segs]}
            />
            <meshBasicMaterial {...mat(accent, opacity * 0.32)} />
          </mesh>
          {[-1, 1].map((dir) => (
            <group key={dir}>
              <mesh position={[0, 0, z + 0.002]} renderOrder={4}>
                <ringGeometry
                  args={[
                    baseR * 1.05,
                    baseR * 1.24,
                    16,
                    1,
                    dir > 0 ? -0.7 : Math.PI - 0.7,
                    1.4,
                  ]}
                />
                <meshBasicMaterial {...mat(metalDark, opacity * 0.75)} />
              </mesh>
              <mesh position={[0, 0, z + 0.003]} renderOrder={4}>
                <ringGeometry
                  args={[
                    baseR * 1.1,
                    baseR * 1.2,
                    12,
                    1,
                    dir > 0 ? -0.45 : Math.PI - 0.45,
                    0.9,
                  ]}
                />
                <meshBasicMaterial {...mat(metalBright, opacity * 0.8)} />
              </mesh>
              {/* Armor specular stroke */}
              <mesh position={[0, 0, z + 0.0035]} renderOrder={5}>
                <ringGeometry
                  args={[
                    baseR * 1.16,
                    baseR * 1.19,
                    10,
                    1,
                    dir > 0 ? -0.3 : Math.PI - 0.3,
                    0.45,
                  ]}
                />
                <meshBasicMaterial {...mat(specular, opacity * 0.45)} />
              </mesh>
            </group>
          ))}
          <group ref={gemPulseRef}>
            <Gem
              x={0}
              y={baseR * 1.22}
              z={z + 0.006}
              size={baseR * 0.15}
              color={gemCore}
              glow={accent}
              metal={metalBright}
              opacity={opacity}
              side={side}
              plate
            />
          </group>
          <mesh position={[0, -baseR * 1.14, z + 0.004]} renderOrder={5}>
            <circleGeometry args={[baseR * 0.055, 10]} />
            <meshBasicMaterial {...mat(gemCore, opacity * 0.75)} />
          </mesh>
          <mesh position={[0, -baseR * 1.14, z + 0.005]} renderOrder={6}>
            <circleGeometry args={[baseR * 0.022, 8]} />
            <meshBasicMaterial {...mat(specular, opacity * 0.8)} />
          </mesh>
        </>
      )}
    </group>
  )
}

function Gem({
  x,
  y,
  z,
  size,
  color,
  glow,
  metal,
  opacity,
  side,
  plate = false,
}: {
  x: number
  y: number
  z: number
  size: number
  color: string
  glow: string
  metal: string
  opacity: number
  side: THREE.Side
  plate?: boolean
}) {
  return (
    <group position={[x, y, z]}>
      {/* Glow aura */}
      <mesh renderOrder={4}>
        <circleGeometry args={[size * 1.7, 16]} />
        <meshBasicMaterial
          color={glow}
          transparent
          opacity={opacity * 0.32}
          depthWrite={false}
          depthTest
          side={side}
          toneMapped={false}
        />
      </mesh>
      {/* Metal bezel under gem */}
      <mesh renderOrder={5}>
        <circleGeometry args={[size * 1.25, 16]} />
        <meshBasicMaterial
          color={metal}
          transparent
          opacity={opacity * 0.7}
          depthWrite={false}
          depthTest
          side={side}
          toneMapped={false}
        />
      </mesh>
      {plate && (
        <mesh position={[0, -size * 0.12, -0.001]} renderOrder={4}>
          <circleGeometry args={[size * 1.4, 6]} />
          <meshBasicMaterial
            color={metal}
            transparent
            opacity={opacity * 0.5}
            depthWrite={false}
            depthTest
            side={side}
            toneMapped={false}
          />
        </mesh>
      )}
      {/* Gem body */}
      <mesh rotation={[0, 0, Math.PI / 4]} renderOrder={6}>
        <planeGeometry args={[size * 1.15, size * 1.15]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * 0.95}
          depthWrite={false}
          depthTest
          side={side}
          toneMapped={false}
        />
      </mesh>
      {/* Facet highlight (upper-left shine) */}
      <mesh
        position={[-size * 0.12, size * 0.14, 0.001]}
        rotation={[0, 0, Math.PI / 4]}
        renderOrder={7}
      >
        <planeGeometry args={[size * 0.45, size * 0.45]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={opacity * 0.55}
          depthWrite={false}
          depthTest
          side={side}
          toneMapped={false}
        />
      </mesh>
      {/* Hot core */}
      <mesh renderOrder={8}>
        <circleGeometry args={[size * 0.32, 10]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={opacity * 0.9}
          depthWrite={false}
          depthTest
          side={side}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
