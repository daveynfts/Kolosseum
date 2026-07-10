import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Realistic deep-space 3D backdrop:
 * - Spherical star field (shells)
 * - Volumetric nebula dust as 3D point clouds (no flat circles/planes)
 * - Slow galactic rotation
 */
export function CosmicBackground({ lite = false }: { lite?: boolean }) {
  return (
    <group renderOrder={-20}>
      <StarShell
        count={lite ? 2200 : 3500}
        rMin={40}
        rMax={95}
        size={lite ? 0.28 : 0.34}
        opacity={0.85}
        speed={0.008}
      />
      <StarShell
        count={lite ? 900 : 1400}
        rMin={55}
        rMax={110}
        size={lite ? 0.5 : 0.62}
        opacity={0.55}
        speed={-0.004}
        bright
      />
      <VolumetricDust
        count={lite ? 900 : 1400}
        center={[-22, 4, -30]}
        radius={14}
        colorA="#4c1d95"
        colorB="#6366f1"
        size={0.55}
        opacity={lite ? 0.22 : 0.28}
      />
      <VolumetricDust
        count={lite ? 700 : 1100}
        center={[20, -6, -34]}
        radius={12}
        colorA="#0e7490"
        colorB="#22d3ee"
        size={0.5}
        opacity={lite ? 0.18 : 0.24}
      />
      <VolumetricDust
        count={lite ? 500 : 800}
        center={[4, 14, -40]}
        radius={16}
        colorA="#701a3a"
        colorB="#a78bfa"
        size={0.65}
        opacity={lite ? 0.12 : 0.16}
      />
      {/* Distant milky-way band as elongated 3D particle cloud */}
      <GalacticBand lite={lite} />
      <Stars
        radius={130}
        depth={70}
        count={lite ? 2000 : 3200}
        factor={lite ? 2.8 : 3.4}
        saturation={0}
        fade
        speed={lite ? 0.12 : 0.18}
      />
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
  bright = false,
}: {
  count: number
  rMin: number
  rMax: number
  size: number
  opacity: number
  speed: number
  bright?: boolean
}) {
  const ref = useRef<THREE.Points>(null)
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const palette = bright
      ? [
          new THREE.Color('#ffffff'),
          new THREE.Color('#e0f2fe'),
          new THREE.Color('#fef3c7'),
          new THREE.Color('#ddd6fe'),
        ]
      : [
          new THREE.Color('#f8fafc'),
          new THREE.Color('#cbd5e1'),
          new THREE.Color('#a5b4fc'),
          new THREE.Color('#bae6fd'),
          new THREE.Color('#e9d5ff'),
        ]
    for (let i = 0; i < count; i++) {
      const u = seeded(i, 1)
      const v = seeded(i, 2)
      const w = seeded(i, 3)
      const r = rMin + u * (rMax - rMin)
      const theta = v * Math.PI * 2
      const phi = Math.acos(2 * w - 1)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.88
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      const c = palette[i % palette.length]
      const b = bright ? 0.7 + seeded(i, 4) * 0.3 : 0.45 + seeded(i, 4) * 0.55
      col[i * 3] = c.r * b
      col[i * 3 + 1] = c.g * b
      col[i * 3 + 2] = c.b * b
    }
    return { positions: pos, colors: col }
  }, [count, rMin, rMax, bright])

  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * speed
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
        size={size}
        vertexColors
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
        fog={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

/** 3D Gaussian dust cloud — volumetric feel, no flat discs */
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
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const ca = new THREE.Color(colorA)
    const cb = new THREE.Color(colorB)
    for (let i = 0; i < count; i++) {
      // Box-Muller-ish → denser core
      const u1 = Math.max(1e-6, seeded(i, 10))
      const u2 = seeded(i, 11)
      const u3 = seeded(i, 12)
      const g1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      const g2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2)
      const g3 = Math.sqrt(-2 * Math.log(Math.max(1e-6, u3))) * Math.cos(2 * Math.PI * seeded(i, 13))
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
    ref.current.rotation.y += dt * 0.015
    ref.current.rotation.x += dt * 0.004
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
        size={size}
        vertexColors
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
        fog={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

/** Thin elongated dust band through the sphere — milky-way feel in 3D */
function GalacticBand({ lite }: { lite: boolean }) {
  const ref = useRef<THREE.Points>(null)
  const count = lite ? 1600 : 2400
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const c1 = new THREE.Color('#818cf8')
    const c2 = new THREE.Color('#e0e7ff')
    for (let i = 0; i < count; i++) {
      const a = seeded(i, 20) * Math.PI * 2
      // torus-like band radius
      const R = 48 + (seeded(i, 21) - 0.5) * 18
      const tube = (seeded(i, 22) - 0.5) * 6
      const y = (seeded(i, 23) - 0.5) * 4.5
      // tilt band
      const x0 = Math.cos(a) * R + Math.cos(a) * tube * 0.3
      const z0 = Math.sin(a) * R + Math.sin(a) * tube * 0.3
      const tilt = 0.42
      pos[i * 3] = x0
      pos[i * 3 + 1] = y * Math.cos(tilt) - z0 * Math.sin(tilt) * 0.25
      pos[i * 3 + 2] = z0 * Math.cos(tilt) + y * Math.sin(tilt) * 0.15
      const t = seeded(i, 24)
      const c = c1.clone().lerp(c2, t)
      const b = 0.25 + seeded(i, 25) * 0.55
      col[i * 3] = c.r * b
      col[i * 3 + 1] = c.g * b
      col[i * 3 + 2] = c.b * b
    }
    return { positions: pos, colors: col }
  }, [count])

  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * 0.006
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
        size={lite ? 0.4 : 0.48}
        vertexColors
        transparent
        opacity={lite ? 0.28 : 0.34}
        sizeAttenuation
        depthWrite={false}
        fog={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}
