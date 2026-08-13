import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useEffect, useMemo, useRef } from 'react'
import type { Kol, Niche } from '../types'
import { kolMatchesNiche } from '../types'
import { layoutConstellation } from '../lib/layout'
import { KolBubble } from './KolBubble'
import { CosmicBackground } from './CosmicBackground'

interface Props {
  kols: Kol[]
  selectedId: string | null
  filterNiche: Niche | 'All'
  onSelect: (kol: Kol | null) => void
  autoRotate: boolean
}

function Bubbles({
  kols,
  selectedId,
  filterNiche,
  onSelect,
}: Omit<Props, 'autoRotate'>) {
  const positions = useMemo(() => layoutConstellation(kols), [kols])

  const zRange = useMemo(() => {
    let min = Infinity
    let max = -Infinity
    positions.forEach((p) => {
      if (p[2] < min) min = p[2]
      if (p[2] > max) max = p[2]
    })
    return { min, span: Math.max(0.001, max - min) }
  }, [positions])

  const ordered = useMemo(() => {
    return [...kols].sort((a, b) => {
      const za = positions.get(a.id)?.[2] ?? 0
      const zb = positions.get(b.id)?.[2] ?? 0
      return za - zb
    })
  }, [kols, positions])

  return (
    <>
      {ordered.map((kol) => {
        const dimmed = !kolMatchesNiche(kol, filterNiche)
        const pos = positions.get(kol.id)
        if (!pos) return null
        const depth = (pos[2] - zRange.min) / zRange.span
        return (
          <KolBubble
            key={kol.id}
            kol={kol}
            position={pos}
            selected={selectedId === kol.id}
            dimmed={dimmed}
            recessed={!!selectedId && selectedId !== kol.id}
            depth={depth}
            onSelect={onSelect}
          />
        )
      })}
    </>
  )
}

function ViewCamera() {
  const { camera } = useThree()
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null

  useEffect(() => {
    camera.position.set(0, 5.5, 26)
    camera.near = 0.1
    camera.far = 280
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.update()
    }
  }, [camera, controls])

  return null
}

function SceneContent({
  kols,
  selectedId,
  filterNiche,
  onSelect,
  autoRotate,
}: Props) {
  const controlsRef = useRef<OrbitControlsImpl>(null)

  return (
    <>
      <color attach="background" args={['#030712']} />
      <fog attach="fog" args={['#030712', 50, 120]} />

      <ViewCamera />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#94a3b8', '#020617', 0.45]} />
      <pointLight position={[14, 10, 16]} intensity={0.55} color="#e2e8f0" />
      <pointLight position={[-10, -2, 8]} intensity={0.28} color="#67e8f9" />

      <CosmicBackground lite />

      <Bubbles
        kols={kols}
        selectedId={selectedId}
        filterNiche={filterNiche}
        onSelect={onSelect}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        minDistance={11}
        maxDistance={48}
        autoRotate={autoRotate}
        autoRotateSpeed={0.38}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI * 0.92}
        enableDamping
        dampingFactor={0.07}
      />
    </>
  )
}

export function Scene(props: Props) {
  return (
    <Canvas
      camera={{ position: [0, 5.5, 26], fov: 44, near: 0.1, far: 280 }}
      dpr={[1, 2]}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        background: 'transparent',
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
        gl.domElement.style.display = 'block'
      }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <SceneContent {...props} />
    </Canvas>
  )
}
