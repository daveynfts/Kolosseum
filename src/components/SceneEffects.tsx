import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { getStarTexture } from '../lib/starTexture'

/** Floating dust + connection-feel ambient particles (soft circles) */
export function FloatingDust() {
  const ref = useRef<THREE.Points>(null)
  const map = useMemo(() => getStarTexture('soft'), [])
  const { positions, colors } = useMemo(() => {
    const n = 420
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const palette = [
      new THREE.Color('#22d3ee'),
      new THREE.Color('#a78bfa'),
      new THREE.Color('#f472b6'),
      new THREE.Color('#94a3b8'),
      new THREE.Color('#fbbf24'),
    ]
    for (let i = 0; i < n; i++) {
      const r = 6 + Math.random() * 16
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.7
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      const c = palette[i % palette.length]
      const b = 0.55 + Math.random() * 0.45
      col[i * 3] = c.r * b
      col[i * 3 + 1] = c.g * b
      col[i * 3 + 2] = c.b * b
    }
    return { positions: pos, colors: col }
  }, [])

  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * 0.03
    ref.current.rotation.x += dt * 0.008
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        map={map}
        size={0.14}
        vertexColors
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        alphaTest={0.01}
      />
    </points>
  )
}

/** Soft neon orbs drifting in the scene */
export function AmbientOrbs() {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.rotation.y = t * 0.04
    ref.current.children.forEach((child, i) => {
      child.position.y += Math.sin(t * 0.6 + i) * 0.002
    })
  })

  return (
    <group ref={ref}>
      <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.6}>
        <mesh position={[9, 2, -7]}>
          <sphereGeometry args={[2.1, 32, 32]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.05} />
        </mesh>
      </Float>
      <Float speed={0.9} rotationIntensity={0.15} floatIntensity={0.5}>
        <mesh position={[-8, -2.5, 6]}>
          <sphereGeometry args={[2.4, 32, 32]} />
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.045} />
        </mesh>
      </Float>
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.7}>
        <mesh position={[3, 7, 5]}>
          <sphereGeometry args={[1.6, 32, 32]} />
          <meshBasicMaterial color="#f472b6" transparent opacity={0.04} />
        </mesh>
      </Float>
      <Float speed={1.0} rotationIntensity={0.1} floatIntensity={0.4}>
        <mesh position={[-4, 5, -8]}>
          <sphereGeometry args={[1.9, 32, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.035} />
        </mesh>
      </Float>
    </group>
  )
}

/** Concentric floor rings for depth */
export function FloorRings() {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.05
  })
  return (
    <group ref={ref} position={[0, -10.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {[7, 10, 13.5, 17].map((r, i) => (
        <mesh key={r}>
          <ringGeometry args={[r, r + 0.06, 96]} />
          <meshBasicMaterial
            color={i % 2 === 0 ? '#334155' : '#1e293b'}
            transparent
            opacity={0.35 - i * 0.05}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* dashed energy arc */}
      <mesh>
        <ringGeometry args={[11.2, 11.35, 128, 1, 0, Math.PI * 1.4]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

export function SceneSparkles() {
  return (
    <>
      <Sparkles
        count={80}
        scale={[28, 18, 28]}
        size={2.5}
        speed={0.35}
        opacity={0.45}
        color="#a5b4fc"
      />
      <Sparkles
        count={40}
        scale={[20, 14, 20]}
        size={3.5}
        speed={0.2}
        opacity={0.3}
        color="#67e8f9"
      />
    </>
  )
}
