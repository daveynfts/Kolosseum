import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Kol, Niche } from '../types'
import { kolMatchesNiche } from '../types'
import type { ViewMode } from '../lib/layout'
import { KolBubble } from './KolBubble'
import { positionForKol, positionForKol25d } from '../lib/layout'
import { FloatingDust } from './SceneEffects'
import { CosmicBackground } from './CosmicBackground'

interface Props {
  kols: Kol[]
  selectedId: string | null
  filterNiche: Niche | 'All'
  onSelect: (kol: Kol | null) => void
  autoRotate: boolean
  viewMode: ViewMode
}

function Bubbles({
  kols,
  selectedId,
  filterNiche,
  onSelect,
  viewMode,
}: Omit<Props, 'autoRotate'>) {
  const lite = viewMode === '2d'
  const positions = useMemo(() => {
    const map = new Map<string, [number, number, number]>()
    const place = lite ? positionForKol25d : positionForKol
    kols.forEach((k, i) => {
      map.set(k.id, place(k, i, kols.length))
    })
    return map
  }, [kols, lite])

  return (
    <>
      {kols.map((kol) => {
        const dimmed = !kolMatchesNiche(kol, filterNiche)
        const pos = positions.get(kol.id)
        if (!pos) return null
        return (
          <KolBubble
            key={kol.id}
            kol={kol}
            position={pos}
            selected={selectedId === kol.id}
            dimmed={dimmed}
            onSelect={onSelect}
            lite={lite}
          />
        )
      })}
    </>
  )
}

function ViewCamera({ viewMode }: { viewMode: ViewMode }) {
  const { camera } = useThree()
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null

  useEffect(() => {
    if (viewMode === '2d') {
      camera.position.set(0, 5.5, 26)
    } else {
      camera.position.set(0, 4, 24)
    }
    camera.near = 0.1
    camera.far = 280
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.update()
    }
  }, [viewMode, camera, controls])

  return null
}

function SceneContent({
  kols,
  selectedId,
  filterNiche,
  onSelect,
  autoRotate,
  viewMode,
}: Props) {
  const lite = viewMode === '2d'
  const controlsRef = useRef<OrbitControlsImpl>(null)

  return (
    <>
      <color attach="background" args={['#030712']} />
      <fog attach="fog" args={['#030712', lite ? 50 : 55, lite ? 120 : 140]} />

      <ViewCamera viewMode={viewMode} />

      <ambientLight intensity={lite ? 0.55 : 0.4} />
      <hemisphereLight args={['#94a3b8', '#020617', 0.45]} />
      <pointLight
        position={[14, 10, 16]}
        intensity={lite ? 0.55 : 0.65}
        color="#e2e8f0"
      />
      <pointLight position={[-10, -2, 8]} intensity={0.28} color="#67e8f9" />

      {/* 3D cosmos only — no flat discs / rings / orbs */}
      <CosmicBackground lite={lite} />
      {!lite && <FloatingDust />}

      <Bubbles
        kols={kols}
        selectedId={selectedId}
        filterNiche={filterNiche}
        onSelect={onSelect}
        viewMode={viewMode}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        minDistance={11}
        maxDistance={lite ? 48 : 46}
        autoRotate={autoRotate}
        autoRotateSpeed={lite ? 0.38 : 0.32}
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
      camera={{ position: [0, 4, 24], fov: 44, near: 0.1, far: 280 }}
      dpr={[1, 1.75]}
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
