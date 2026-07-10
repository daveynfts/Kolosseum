import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Simplified Vietnam mainland outline (lon, lat).
 * Cosmic constellation backdrop — fog disabled so it stays visible.
 */
const VN_OUTLINE: [number, number][] = [
  [102.15, 22.55],
  [103.0, 22.9],
  [104.5, 23.35],
  [105.85, 23.25],
  [106.75, 22.85],
  [107.35, 21.55],
  [107.9, 20.45],
  [108.55, 19.1],
  [109.25, 17.0],
  [109.45, 15.35],
  [109.3, 13.9],
  [109.2, 12.25],
  [109.35, 11.1],
  [108.85, 10.35],
  [107.6, 9.4],
  [106.55, 8.55],
  [105.2, 8.55],
  [104.55, 9.15],
  [104.7, 10.35],
  [105.15, 11.65],
  [105.7, 13.4],
  [105.55, 15.0],
  [104.85, 16.55],
  [103.85, 18.15],
  [103.1, 19.55],
  [102.45, 20.9],
  [102.15, 22.55],
]

function lonLatToUnit(lon: number, lat: number): [number, number] {
  const minLon = 102.1
  const maxLon = 109.6
  const minLat = 8.4
  const maxLat = 23.5
  return [
    (lon - minLon) / (maxLon - minLon),
    (lat - minLat) / (maxLat - minLat),
  ]
}

function pointInPoly(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function seeded(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function buildStarField(countOutline: number, countFill: number) {
  const unitPoly = VN_OUTLINE.map(([lon, lat]) => lonLatToUnit(lon, lat))

  const outlinePts: [number, number][] = []
  // denser outline for readable silhouette
  for (let s = 0; s < countOutline; s++) {
    const t = s / countOutline
    const seg = t * (unitPoly.length - 1)
    const i = Math.floor(seg)
    const f = seg - i
    const a = unitPoly[i]
    const b = unitPoly[Math.min(i + 1, unitPoly.length - 1)]
    outlinePts.push([
      a[0] + (b[0] - a[0]) * f + (seeded(s) - 0.5) * 0.01,
      a[1] + (b[1] - a[1]) * f + (seeded(s + 99) - 0.5) * 0.01,
    ])
  }

  const fillPts: [number, number][] = []
  let attempts = 0
  let i = 0
  while (fillPts.length < countFill && attempts < countFill * 50) {
    attempts++
    const x = seeded(i * 3.1)
    const y = seeded(i * 7.7 + 1.3)
    i++
    if (pointInPoly(x, y, unitPoly)) fillPts.push([x, y])
  }

  const all = [...outlinePts, ...fillPts]
  const n = all.length
  const positions = new Float32Array(n * 3)
  const colors = new Float32Array(n * 3)

  // World scale — tall VN shape behind the bubble cloud
  const scaleX = 18
  const scaleY = 28
  const offsetY = -0.8

  const cEdge = new THREE.Color('#7dd3fc')
  const cCore = new THREE.Color('#a78bfa')
  const cFill = new THREE.Color('#94a3b8')

  for (let k = 0; k < n; k++) {
    const [u, v] = all[k]
    const isOutline = k < outlinePts.length
    // Place on a plane slightly behind origin (in front of deep sky, behind KOLs)
    const x = (u - 0.5) * scaleX
    const y = (v - 0.48) * scaleY + offsetY
    const z = -14 + (seeded(k * 1.7) - 0.5) * 1.2

    positions[k * 3] = x
    positions[k * 3 + 1] = y
    positions[k * 3 + 2] = z

    const c = isOutline
      ? cEdge.clone().lerp(cCore, seeded(k + 2) * 0.5)
      : cFill.clone().lerp(cCore, seeded(k + 5) * 0.4)
    // Brighten outline stars
    if (isOutline) c.multiplyScalar(1.35)
    colors[k * 3] = c.r
    colors[k * 3 + 1] = c.g
    colors[k * 3 + 2] = c.b
  }

  return { positions, colors, count: n, outlineCount: outlinePts.length }
}

interface Props {
  lite?: boolean
}

/**
 * Cosmic Vietnam constellation backdrop.
 * fog=false + closer Z so it is actually visible behind KOL bubbles.
 */
export function VietnamConstellation({ lite = false }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const matRef = useRef<THREE.PointsMaterial>(null)
  const matOutlineRef = useRef<THREE.PointsMaterial>(null)

  const { positions, colors, count, outlineCount } = useMemo(
    () => buildStarField(lite ? 520 : 720, lite ? 220 : 360),
    [lite],
  )

  // Separate buffer for outline-only layer (brighter)
  const outlinePositions = useMemo(() => {
    const out = new Float32Array(outlineCount * 3)
    for (let i = 0; i < outlineCount * 3; i++) out[i] = positions[i]
    return out
  }, [positions, outlineCount])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.z = Math.sin(t * 0.04) * 0.025
    groupRef.current.position.y = 0.4 + Math.sin(t * 0.06) * 0.12
    const pulse = 0.5 + Math.sin(t * 0.9) * 0.08
    if (matRef.current) matRef.current.opacity = (lite ? 0.45 : 0.55) * pulse
    if (matOutlineRef.current)
      matOutlineRef.current.opacity = (lite ? 0.65 : 0.78) * pulse
  })

  return (
    <group
      ref={groupRef}
      position={[0, 0.2, 0]}
      scale={lite ? 1.15 : 1.25}
      renderOrder={-5}
    >
      {/* Soft nebula plate behind the map (no fog so it reads) */}
      <mesh position={[0, 0, -15.5]} renderOrder={-6}>
        <planeGeometry args={[22, 34]} />
        <meshBasicMaterial
          color="#0a1628"
          transparent
          opacity={lite ? 0.35 : 0.4}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <mesh position={[0, 0, -15.2]} renderOrder={-5}>
        <planeGeometry args={[16, 28]} />
        <meshBasicMaterial
          color="#12203a"
          transparent
          opacity={0.2}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Interior star dust */}
      <points frustumCulled={false} renderOrder={-4}>
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
          size={lite ? 0.22 : 0.26}
          vertexColors
          transparent
          opacity={lite ? 0.5 : 0.6}
          sizeAttenuation
          depthWrite={false}
          depthTest
          fog={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      {/* Outline constellation — larger, brighter */}
      <points frustumCulled={false} renderOrder={-3}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[outlinePositions, 3]}
            count={outlineCount}
            array={outlinePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={matOutlineRef}
          size={lite ? 0.32 : 0.38}
          color="#a5f3fc"
          transparent
          opacity={lite ? 0.7 : 0.85}
          sizeAttenuation
          depthWrite={false}
          depthTest
          fog={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  )
}
