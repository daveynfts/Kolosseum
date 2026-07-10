import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Simplified Vietnam mainland outline (lon, lat).
 * Cosmic constellation: outline denser, interior sparse star dust.
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
  const x = (lon - minLon) / (maxLon - minLon)
  const y = (lat - minLat) / (maxLat - minLat)
  return [x, y]
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
  for (let s = 0; s < countOutline; s++) {
    const t = s / countOutline
    const seg = t * (unitPoly.length - 1)
    const i = Math.floor(seg)
    const f = seg - i
    const a = unitPoly[i]
    const b = unitPoly[Math.min(i + 1, unitPoly.length - 1)]
    const x = a[0] + (b[0] - a[0]) * f + (seeded(s) - 0.5) * 0.012
    const y = a[1] + (b[1] - a[1]) * f + (seeded(s + 99) - 0.5) * 0.012
    outlinePts.push([x, y])
  }

  const fillPts: [number, number][] = []
  let attempts = 0
  let i = 0
  while (fillPts.length < countFill && attempts < countFill * 40) {
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

  const scaleX = 22
  const scaleY = 34
  const offsetX = 0
  const offsetY = -1.5

  const cEdge = new THREE.Color('#a5f3fc')
  const cCore = new THREE.Color('#c4b5fd')
  const cDim = new THREE.Color('#64748b')

  for (let k = 0; k < n; k++) {
    const [u, v] = all[k]
    const isOutline = k < outlinePts.length
    const x = (u - 0.5) * scaleX + offsetX
    const y = (v - 0.48) * scaleY + offsetY
    const z = -38 + (seeded(k * 1.7) - 0.5) * 6

    positions[k * 3] = x
    positions[k * 3 + 1] = y
    positions[k * 3 + 2] = z

    const c = isOutline
      ? cEdge.clone().lerp(cCore, seeded(k + 2) * 0.45)
      : cDim.clone().lerp(cCore, seeded(k + 5) * 0.35)
    colors[k * 3] = c.r
    colors[k * 3 + 1] = c.g
    colors[k * 3 + 2] = c.b
  }

  return { positions, colors, count: n }
}

interface Props {
  lite?: boolean
}

/**
 * Cosmic Vietnam map as a constellation of tiny stars — far background, low contrast.
 */
export function VietnamConstellation({ lite = false }: Props) {
  const ref = useRef<THREE.Points>(null)
  const matRef = useRef<THREE.PointsMaterial>(null)

  const { positions, colors, count } = useMemo(
    () => buildStarField(lite ? 280 : 420, lite ? 160 : 280),
    [lite],
  )

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.rotation.z = Math.sin(t * 0.035) * 0.02
    ref.current.position.y = Math.sin(t * 0.05) * 0.15
    if (matRef.current) {
      matRef.current.opacity = (lite ? 0.26 : 0.36) + Math.sin(t * 0.7) * 0.035
    }
  })

  return (
    <group position={[0, 0.5, 0]} scale={lite ? 1.05 : 1.12} renderOrder={-10}>
      <mesh position={[0, 0, -42]} renderOrder={-11}>
        <planeGeometry args={[28, 42]} />
        <meshBasicMaterial
          color="#0c1224"
          transparent
          opacity={lite ? 0.18 : 0.24}
          depthWrite={false}
        />
      </mesh>

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
          size={lite ? 0.085 : 0.095}
          vertexColors
          transparent
          opacity={lite ? 0.28 : 0.38}
          sizeAttenuation
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={Math.floor(count * 0.35)}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={lite ? 0.038 : 0.048}
          color="#e0f2fe"
          transparent
          opacity={lite ? 0.1 : 0.14}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  )
}
