import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getStarTexture } from '../lib/starTexture'

/**
 * Deep-space backdrop with soft circular stars (not square points):
 * - Multi-shell star field (soft glow + diffraction spikes)
 * - Volumetric nebula dust
 * - Slow galactic rotation + subtle twinkle
 */
export function CosmicBackground({ lite = false }: { lite?: boolean }) {
  return (
    <group renderOrder={-20}>
      {/* Distant micro dust — tiny soft cores */}
      <StarShell
        count={lite ? 1800 : 2800}
        rMin={50}
        rMax={120}
        size={lite ? 0.22 : 0.28}
        opacity={0.72}
        speed={0.006}
        kind="core"
      />
      {/* Main field — soft circular glow */}
      <StarShell
        count={lite ? 1600 : 2600}
        rMin={38}
        rMax={100}
        size={lite ? 0.55 : 0.7}
        opacity={0.9}
        speed={0.01}
        kind="soft"
        twinkle
      />
      {/* Bright foreground gems — diffraction spikes */}
      <StarShell
        count={lite ? 120 : 220}
        rMin={42}
        rMax={88}
        size={lite ? 1.1 : 1.45}
        opacity={0.95}
        speed={-0.005}
        kind="spike"
        bright
        twinkle
      />
      {/* Warm mid-layer accents */}
      <StarShell
        count={lite ? 280 : 420}
        rMin={45}
        rMax={95}
        size={lite ? 0.75 : 0.95}
        opacity={0.55}
        speed={0.004}
        kind="soft"
        warm
      />
      <VolumetricDust
        count={lite ? 700 : 1100}
        center={[-22, 4, -30]}
        radius={14}
        colorA="#4c1d95"
        colorB="#818cf8"
        size={lite ? 1.4 : 1.8}
        opacity={lite ? 0.2 : 0.26}
      />
      <VolumetricDust
        count={lite ? 550 : 900}
        center={[20, -6, -34]}
        radius={12}
        colorA="#0e7490"
        colorB="#22d3ee"
        size={lite ? 1.2 : 1.55}
        opacity={lite ? 0.16 : 0.22}
      />
      <VolumetricDust
        count={lite ? 400 : 650}
        center={[4, 14, -40]}
        radius={16}
        colorA="#701a3a"
        colorB="#c4b5fd"
        size={lite ? 1.5 : 2.0}
        opacity={lite ? 0.1 : 0.14}
      />
      <GalacticBand lite={lite} />
    </group>
  )
}

function seeded(i: number, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function StarShell({
  count,
  rMin,
  rMax,
  size,
  opacity,
  speed,
  kind = 'soft',
  bright = false,
  warm = false,
  twinkle = false,
}: {
  count: number
  rMin: number
  rMax: number
  size: number
  opacity: number
  speed: number
  kind?: 'soft' | 'spike' | 'core'
  bright?: boolean
  warm?: boolean
  twinkle?: boolean
}) {
  const ref = useRef<THREE.Points>(null)
  const matRef = useRef<THREE.PointsMaterial>(null)
  const map = useMemo(() => getStarTexture(kind), [kind])
  const baseOpacity = opacity

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const palette = warm
      ? [
          new THREE.Color('#fef3c7'),
          new THREE.Color('#fde68a'),
          new THREE.Color('#fdba74'),
          new THREE.Color('#fecdd3'),
          new THREE.Color('#e0e7ff'),
        ]
      : bright
        ? [
            new THREE.Color('#ffffff'),
            new THREE.Color('#e0f2fe'),
            new THREE.Color('#fef9c3'),
            new THREE.Color('#ddd6fe'),
            new THREE.Color('#bae6fd'),
          ]
        : [
            new THREE.Color('#f8fafc'),
            new THREE.Color('#cbd5e1'),
            new THREE.Color('#a5b4fc'),
            new THREE.Color('#7dd3fc'),
            new THREE.Color('#e9d5ff'),
            new THREE.Color('#bfdbfe'),
          ]
    for (let i = 0; i < count; i++) {
      const u = seeded(i, 1)
      const v = seeded(i, 2)
      const w = seeded(i, 3)
      // Slight clustering (not perfectly uniform sphere)
      const cluster = seeded(i, 9) > 0.82 ? 0.55 + seeded(i, 10) * 0.35 : 1
      const r = (rMin + u * (rMax - rMin)) * cluster
      const theta = v * Math.PI * 2
      const phi = Math.acos(2 * w - 1)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.88
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      const c = palette[Math.floor(seeded(i, 5) * palette.length) % palette.length]
      const b = bright
        ? 0.75 + seeded(i, 4) * 0.35
        : 0.4 + seeded(i, 4) * 0.65
      col[i * 3] = c.r * b
      col[i * 3 + 1] = c.g * b
      col[i * 3 + 2] = c.b * b
    }
    return { positions: pos, colors: col }
  }, [count, rMin, rMax, bright, warm])

  useFrame((state, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed
    if (twinkle && matRef.current) {
      const t = state.clock.elapsedTime
      // Soft independent-looking pulse (hash-ish phase via speed)
      const phase = Math.sin(t * 1.7 + speed * 40) * 0.5 + 0.5
      const phase2 = Math.sin(t * 2.3 - speed * 25) * 0.5 + 0.5
      matRef.current.opacity =
        baseOpacity * (0.78 + phase * 0.16 + phase2 * 0.08)
    }
  })

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        map={map}
        size={size}
        vertexColors
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
        depthTest
        fog={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        alphaTest={0.01}
      />
    </points>
  )
}

/** Soft volumetric dust — circular blobs, not squares */
function VolumetricDust({
  count,
  center,
  radius,
  colorA,
  colorB,
  size,
  opacity,
}: {
  count: number
  center: [number, number, number]
  radius: number
  colorA: string
  colorB: string
  size: number
  opacity: number
}) {
  const ref = useRef<THREE.Points>(null)
  const map = useMemo(() => getStarTexture('dust'), [])
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const ca = new THREE.Color(colorA)
    const cb = new THREE.Color(colorB)
    for (let i = 0; i < count; i++) {
      const u1 = Math.max(1e-6, seeded(i, 10))
      const u2 = seeded(i, 11)
      const u3 = seeded(i, 12)
      const g1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      const g2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2)
      const g3 =
        Math.sqrt(-2 * Math.log(Math.max(1e-6, u3))) *
        Math.cos(2 * Math.PI * seeded(i, 13))
      const fall = 0.35 + seeded(i, 14) * 0.65
      pos[i * 3] = center[0] + g1 * radius * 0.55 * fall
      pos[i * 3 + 1] = center[1] + g2 * radius * 0.4 * fall
      pos[i * 3 + 2] = center[2] + g3 * radius * 0.55 * fall
      const t = seeded(i, 15)
      const c = ca.clone().lerp(cb, t)
      const b = 0.35 + seeded(i, 16) * 0.65
      col[i * 3] = c.r * b
      col[i * 3 + 1] = c.g * b
      col[i * 3 + 2] = c.b * b
    }
    return { positions: pos, colors: col }
  }, [count, center, radius, colorA, colorB])

  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * 0.012
    ref.current.rotation.x += dt * 0.0035
  })

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        map={map}
        size={size}
        vertexColors
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
        fog={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        alphaTest={0.02}
      />
    </points>
  )
}

/** Thin elongated dust band — milky-way feel */
function GalacticBand({ lite }: { lite: boolean }) {
  const ref = useRef<THREE.Points>(null)
  const map = useMemo(() => getStarTexture('dust'), [])
  const count = lite ? 1400 : 2100
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const c1 = new THREE.Color('#6366f1')
    const c2 = new THREE.Color('#e0e7ff')
    const c3 = new THREE.Color('#22d3ee')
    for (let i = 0; i < count; i++) {
      const a = seeded(i, 20) * Math.PI * 2
      const R = 48 + (seeded(i, 21) - 0.5) * 18
      const tube = (seeded(i, 22) - 0.5) * 6
      const y = (seeded(i, 23) - 0.5) * 4.5
      const x0 = Math.cos(a) * R + Math.cos(a) * tube * 0.3
      const z0 = Math.sin(a) * R + Math.sin(a) * tube * 0.3
      const tilt = 0.42
      pos[i * 3] = x0
      pos[i * 3 + 1] = y * Math.cos(tilt) - z0 * Math.sin(tilt) * 0.25
      pos[i * 3 + 2] = z0 * Math.cos(tilt) + y * Math.sin(tilt) * 0.15
      const t = seeded(i, 24)
      const c =
        t < 0.55
          ? c1.clone().lerp(c2, t / 0.55)
          : c2.clone().lerp(c3, (t - 0.55) / 0.45)
      const b = 0.22 + seeded(i, 25) * 0.55
      col[i * 3] = c.r * b
      col[i * 3 + 1] = c.g * b
      col[i * 3 + 2] = c.b * b
    }
    return { positions: pos, colors: col }
  }, [count])

  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * 0.005
  })

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        map={map}
        size={lite ? 0.95 : 1.2}
        vertexColors
        transparent
        opacity={lite ? 0.22 : 0.28}
        sizeAttenuation
        depthWrite={false}
        fog={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        alphaTest={0.02}
      />
    </points>
  )
}
