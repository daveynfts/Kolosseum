import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Kol, Niche } from '../types'
import { kolMatchesNiche } from '../types'
import type { ViewMode } from '../lib/layout'
import { KolBubble } from './KolBubble'
import { positionForKol, positionForKol25d } from '../lib/layout'
import {
  AmbientOrbs,
  FloatingDust,
  FloorRings,
  SceneSparkles,
} from './SceneEffects'
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
    camera.far = 250
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.update()
    }
  }, [viewMode, camera, controls])

  return null
}

function StageFloor() {
  return (
    <group position={[0, -11.5, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[18, 48]} />
        <meshBasicMaterial
          color="#0b1220"
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[12, 12.35, 64]} />
        <meshBasicMaterial
          color="#475569"
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
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
      {/* Deep space clear color */}
      <color attach="background" args={['#050814']} />
      <fog attach="fog" args={['#050814', lite ? 55 : 60, lite ? 110 : 130]} />

      <ViewCamera viewMode={viewMode} />

      <ambientLight intensity={lite ? 0.7 : 0.5} />
      <hemisphereLight args={['#c7d2fe', '#0f172a', lite ? 0.55 : 0.65]} />
      <pointLight
        position={[12, 14, 18]}
        intensity={lite ? 0.9 : 1.05}
        color="#e0e7ff"
      />
      <pointLight position={[-12, -4, 10]} intensity={0.5} color="#67e8f9" />
      <pointLight
        position={[0, 8, -10]}
        intensity={lite ? 0.4 : 0.5}
        color="#a78bfa"
      />

      {/* Cosmic space — always on, both modes */}
      <CosmicBackground lite={lite} />

      {lite && <StageFloor />}

      {!lite && (
        <>
          <pointLight position={[0, -8, 10]} intensity={0.4} color="#f9a8d4" />
          <spotLight
            position={[0, 18, 8]}
            angle={0.55}
            penumbra={0.6}
            intensity={0.5}
            color="#ffffff"
          />
          <SceneSparkles />
          <FloatingDust />
          <AmbientOrbs />
          <FloorRings />
        </>
      )}

      {/* Extra near-field stars for 2.5D readability */}
      {lite && (
        <Stars
          radius={80}
          depth={35}
          count={1200}
          factor={2.8}
          saturation={0.1}
          fade
          speed={0.2}
        />
      )}

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
      camera={{ position: [0, 4, 24], fov: 44, near: 0.1, far: 250 }}
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
