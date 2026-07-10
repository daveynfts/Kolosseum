import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Visible deep-space backdrop: multi-layer stars + soft nebulae.
 * fog=false on key layers so the cosmos always reads.
 */
export function CosmicBackground({ lite = false }: { lite?: boolean }) {
  return (
    <group renderOrder={-20}>
      <DeepSpaceStars lite={lite} />
      <NebulaClouds lite={lite} />
      <Stars
        radius={120}
        depth={60}
        count={lite ? 2500 : 4000}
        factor={lite ? 3.8 : 4.5}
        saturation={0.15}
        fade
        speed={lite ? 0.2 : 0.35}
      />
    </group>
  )
}

function DeepSpaceStars({ lite }: { lite: boolean }) {
  const ref = useRef<THREE.Points>(null)
  const { positions, colors } = useMemo(() => {
    const n = lite ? 1800 : 2800
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const palette = [
      new THREE.Color('#e0f2fe'),
      new THREE.Color('#a5b4fc'),
      new THREE.Color('#c4b5fd'),
      new THREE.Color('#fbcfe8'),
      new THREE.Color('#ffffff'),
      new THREE.Color('#67e8f9'),
    ]
    for (let i = 0; i < n; i++) {
      // Spherical shell around scene
      const r = 35 + Math.random() * 70
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.85
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      const c = palette[i % palette.length]
      const b = 0.55 + Math.random() * 0.45
      col[i * 3] = c.r * b
      col[i * 3 + 1] = c.g * b
      col[i * 3 + 2] = c.b * b
    }
    return { positions: pos, colors: col }
  }, [lite])

  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * 0.012
    ref.current.rotation.x += dt * 0.003
  })

  return (
    <points ref={ref} frustumCulled={false}>
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
        size={lite ? 0.35 : 0.42}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        fog={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

function NebulaClouds({ lite }: { lite: boolean }) {
  const group = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!group.current) return
    const t = state.clock.elapsedTime
    group.current.rotation.y = t * 0.018
    group.current.rotation.z = Math.sin(t * 0.04) * 0.04
  })

  const clouds = useMemo(
    () => [
      {
        pos: [-18, 6, -28] as [number, number, number],
        scale: [28, 18, 1] as [number, number, number],
        color: '#4c1d95',
        opacity: lite ? 0.22 : 0.28,
      },
      {
        pos: [16, -4, -32] as [number, number, number],
        scale: [24, 16, 1] as [number, number, number],
        color: '#0e7490',
        opacity: lite ? 0.2 : 0.26,
      },
      {
        pos: [2, 12, -36] as [number, number, number],
        scale: [32, 20, 1] as [number, number, number],
        color: '#831843',
        opacity: lite ? 0.14 : 0.18,
      },
      {
        pos: [-8, -10, -24] as [number, number, number],
        scale: [20, 14, 1] as [number, number, number],
        color: '#1e3a5f',
        opacity: lite ? 0.18 : 0.22,
      },
      {
        pos: [10, 8, -20] as [number, number, number],
        scale: [14, 10, 1] as [number, number, number],
        color: '#312e81',
        opacity: lite ? 0.16 : 0.2,
      },
    ],
    [lite],
  )

  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.pos} scale={c.scale} renderOrder={-15}>
          <circleGeometry args={[1, 48]} />
          <meshBasicMaterial
            color={c.color}
            transparent
            opacity={c.opacity}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Bright galactic band */}
      <mesh
        position={[0, -2, -40]}
        rotation={[0, 0, 0.35]}
        scale={[50, 8, 1]}
        renderOrder={-16}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#6366f1"
          transparent
          opacity={lite ? 0.08 : 0.12}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
