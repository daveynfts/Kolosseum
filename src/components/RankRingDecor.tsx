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
}

/**
 * LoL Season-2017 style summoner borders (hextech):
 * multi-layer metallic ring + crest gem + side plates for high tiers.
 * Inspired by the 2017 ranked icon frames (not official assets).
 *
 * Gold      — warm gold double ring, top gem, small red corner flags
 * Platinum  — cyan dual ring, top + bottom gems
 * Diamond   — blue multi-ring, 3 gems (top/L/R), segmented outer
 * Master    — deep indigo, thick ring, large top gem + wing plates
 * Challenger— gold dual ring, large top gem, bold side plates + outer halo
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

  // Accent metals per rank (hextech palette from 2017 frames)
  const accent =
    rank === 'challenger'
      ? '#f0d78c'
      : rank === 'master'
        ? '#a5b4fc'
        : rank === 'diamond'
          ? '#c4b5fd'
          : rank === 'platinum'
            ? '#a5f3fc'
            : '#fcd34d'
  const metalDark =
    rank === 'challenger'
      ? '#b45309'
      : rank === 'master'
        ? '#312e81'
        : rank === 'diamond'
          ? '#1e3a5f'
          : rank === 'platinum'
            ? '#0e7490'
            : '#92400e'
  const gemCore =
    rank === 'challenger'
      ? '#38bdf8'
      : rank === 'master'
        ? '#34d399'
        : rank === 'diamond'
          ? '#e9d5ff'
          : rank === 'platinum'
            ? '#67e8f9'
            : '#fde68a'

  const r0 = baseR * 0.955
  const r1 = baseR * 1.04
  const r2 = baseR * 1.1
  const rOuter = baseR * outer

  return (
    <group>
      {/* Inner dark metal band (depth like 2017 frames) */}
      <mesh position={[0, 0, z - 0.001]} renderOrder={2}>
        <ringGeometry args={[r0, r1, segs]} />
        <meshBasicMaterial {...mat(metalDark, opacity * 0.75)} />
      </mesh>

      {/* Main colored metallic rim */}
      <mesh position={[0, 0, z]} renderOrder={3}>
        <ringGeometry args={[r1 * 0.98, r2, segs]} />
        <meshBasicMaterial {...mat(color, opacity)} />
      </mesh>

      {/* Bright outer highlight edge */}
      <mesh position={[0, 0, z + 0.001]} renderOrder={3}>
        <ringGeometry args={[r2 * 0.99, rOuter * 0.92, segs]} />
        <meshBasicMaterial {...mat(accent, opacity * 0.55)} />
      </mesh>

      {/* ——— GOLD: red triangular banners L/R of top ——— */}
      {rank === 'gold' && (
        <>
          <Gem
            x={0}
            y={baseR * 1.14}
            z={z + 0.003}
            size={baseR * 0.11}
            color={gemCore}
            glow={accent}
            opacity={opacity}
            side={side}
          />
          {/* Red corner flags (small wedges via short arcs) */}
          {[-1, 1].map((dir) => (
            <mesh
              key={dir}
              position={[0, 0, z + 0.002]}
              renderOrder={4}
            >
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
        </>
      )}

      {/* ——— PLATINUM: dual gem top + bottom ——— */}
      {rank === 'platinum' && (
        <>
          <mesh position={[0, 0, z + 0.001]} renderOrder={3}>
            <ringGeometry args={[baseR * 1.12, rOuter, segs]} />
            <meshBasicMaterial {...mat(color, opacity * 0.7)} />
          </mesh>
          <Gem
            x={0}
            y={baseR * 1.16}
            z={z + 0.003}
            size={baseR * 0.1}
            color={gemCore}
            glow={accent}
            opacity={opacity}
            side={side}
          />
          <Gem
            x={0}
            y={-baseR * 1.16}
            z={z + 0.003}
            size={baseR * 0.08}
            color={gemCore}
            glow={accent}
            opacity={opacity * 0.9}
            side={side}
          />
        </>
      )}

      {/* ——— DIAMOND: multi-layer + 3 gems + side orbs ——— */}
      {rank === 'diamond' && (
        <>
          {/* Segmented outer hextech arcs */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const start = (i / 6) * Math.PI * 2 + 0.08
            const len = Math.PI / 3 - 0.16
            return (
              <mesh key={i} position={[0, 0, z + 0.001]} renderOrder={3}>
                <ringGeometry
                  args={[baseR * 1.13, rOuter, 16, 1, start, len]}
                />
                <meshBasicMaterial {...mat(accent, opacity * 0.8)} />
              </mesh>
            )
          })}
          <Gem
            x={0}
            y={baseR * 1.18}
            z={z + 0.004}
            size={baseR * 0.12}
            color={gemCore}
            glow={color}
            opacity={opacity}
            side={side}
          />
          {/* Side gem orbs */}
          {[-1, 1].map((dir) => (
            <mesh
              key={dir}
              position={[dir * baseR * 1.18, 0, z + 0.003]}
              renderOrder={5}
            >
              <circleGeometry args={[baseR * 0.07, 12]} />
              <meshBasicMaterial {...mat(gemCore, opacity * 0.9)} />
            </mesh>
          ))}
        </>
      )}

      {/* ——— MASTER: thick outer + wing plates + large top gem ——— */}
      {rank === 'master' && (
        <>
          <mesh position={[0, 0, z + 0.001]} renderOrder={3}>
            <ringGeometry args={[baseR * 1.12, rOuter, segs]} />
            <meshBasicMaterial {...mat(color, opacity * 0.85)} />
          </mesh>
          {/* Wing / plate arcs left & right */}
          {[-1, 1].map((dir) => (
            <mesh key={dir} position={[0, 0, z + 0.002]} renderOrder={4}>
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
              <meshBasicMaterial {...mat(accent, opacity * 0.55)} />
            </mesh>
          ))}
          <Gem
            x={0}
            y={baseR * 1.2}
            z={z + 0.004}
            size={baseR * 0.14}
            color={gemCore}
            glow={accent}
            opacity={opacity}
            side={side}
            plate
          />
        </>
      )}

      {/* ——— CHALLENGER: dual gold rings + side armor plates + top crest ——— */}
      {rank === 'challenger' && (
        <>
          {/* Second gold band */}
          <mesh position={[0, 0, z + 0.001]} renderOrder={3}>
            <ringGeometry args={[baseR * 1.12, rOuter, segs]} />
            <meshBasicMaterial {...mat(color, opacity * 0.9)} />
          </mesh>
          {/* Soft outer halo */}
          <mesh position={[0, 0, z - 0.002]} renderOrder={1}>
            <ringGeometry
              args={[rOuter * 0.98, baseR * (outer + 0.12), segs]}
            />
            <meshBasicMaterial {...mat(accent, opacity * 0.28)} />
          </mesh>
          {/* Bold side plates (armor) */}
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
                <meshBasicMaterial {...mat(metalDark, opacity * 0.7)} />
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
                <meshBasicMaterial {...mat(accent, opacity * 0.75)} />
              </mesh>
            </group>
          ))}
          <Gem
            x={0}
            y={baseR * 1.22}
            z={z + 0.005}
            size={baseR * 0.15}
            color={gemCore}
            glow={accent}
            opacity={opacity}
            side={side}
            plate
          />
          {/* Tiny bottom accent pip */}
          <mesh position={[0, -baseR * 1.14, z + 0.003]} renderOrder={5}>
            <circleGeometry args={[baseR * 0.05, 10]} />
            <meshBasicMaterial {...mat(gemCore, opacity * 0.7)} />
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
  opacity: number
  side: THREE.Side
  plate?: boolean
}) {
  return (
    <group position={[x, y, z]}>
      {/* Soft glow behind gem */}
      <mesh renderOrder={4}>
        <circleGeometry args={[size * 1.55, 16]} />
        <meshBasicMaterial
          color={glow}
          transparent
          opacity={opacity * 0.35}
          depthWrite={false}
          depthTest
          side={side}
          toneMapped={false}
        />
      </mesh>
      {/* Hextech plate under gem (Master / Challenger crest) */}
      {plate && (
        <mesh position={[0, -size * 0.15, -0.001]} renderOrder={4}>
          <circleGeometry args={[size * 1.35, 6]} />
          <meshBasicMaterial
            color={glow}
            transparent
            opacity={opacity * 0.55}
            depthWrite={false}
            depthTest
            side={side}
            toneMapped={false}
          />
        </mesh>
      )}
      {/* Diamond-shaped gem body (rotated square) */}
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
      {/* Bright core */}
      <mesh renderOrder={7}>
        <circleGeometry args={[size * 0.35, 10]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={opacity * 0.85}
          depthWrite={false}
          depthTest
          side={side}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
