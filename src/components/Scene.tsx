import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Kol, Niche } from '../types'
import type { ViewMode } from '../lib/layout'
import { KolBubble } from './KolBubble'
import { positionForKol, positionForKol25d } from '../lib/layout'
import {
  AmbientOrbs,
  FloatingDust,
  FloorRings,
  SceneSparkles,
} from './SceneEffects'

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
  // 2d mode = 2.5D: same spatial cloud, lighter materials
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
        const dimmed = filterNiche !== 'All' && kol.niche !== filterNiche
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

/** Same framing as 3D cloud so 2.5D feels spatial, not flat. */
function ViewCamera({ viewMode }: { viewMode: ViewMode }) {
  const { camera } = useThree()
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null

  useEffect(() => {
    // Both modes use the 3D cloud camera — 2.5D only differs in materials/FX
    if (viewMode === '2d') {
      camera.position.set(0, 5.5, 26)
    } else {
      camera.position.set(0, 4, 24)
    }
    camera.near = 0.1
    camera.far = 200
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.update()
    }
  }, [viewMode, camera, controls])

  return null
}

/** Soft ground plane for 2.5D depth cue (cheap). */
function StageFloor() {
  return (
    <group position={[0, -11.5, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[18, 48]} />
        <meshBasicMaterial
          color="#0b1220"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[12, 12.35, 64]} />
        <meshBasicMaterial
          color="#475569"
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[16.5, 16.85, 64]} />
        <meshBasicMaterial
          color="#334155"
          transparent
          opacity={0.22}
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
      <color attach="background" args={['#03040a']} />
      <fog attach="fog" args={['#03040a', lite ? 38 : 42, lite ? 72 : 80]} />

      <ViewCamera viewMode={viewMode} />

      <ambientLight intensity={lite ? 0.75 : 0.55} />
      <hemisphereLight args={['#e2e8f0', '#0f172a', lite ? 0.5 : 0.6]} />
      <pointLight position={[12, 14, 18]} intensity={lite ? 0.95 : 1.1} color="#e0e7ff" />
      <pointLight position={[-12, -4, 10]} intensity={0.55} color="#67e8f9" />
      <pointLight position={[0, 8, -10]} intensity={lite ? 0.35 : 0.4} color="#a78bfa" />

      {/* 2.5D: light stage + depth, no heavy VFX */}
      {lite && <StageFloor />}

      {/* Full 3D: liquid atmosphere */}
      {!lite && (
        <>
          <pointLight position={[0, -8, 10]} intensity={0.45} color="#f9a8d4" />
          <spotLight
            position={[0, 18, 8]}
            angle={0.55}
            penumbra={0.6}
            intensity={0.55}
            color="#ffffff"
          />
          <Stars
            radius={90}
            depth={50}
            count={2400}
            factor={3.5}
            saturation={0}
            fade
            speed={0.45}
          />
          <SceneSparkles />
          <FloatingDust />
          <AmbientOrbs />
          <FloorRings />
        </>
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
      camera={{ position: [0, 4, 24], fov: 44, near: 0.1, far: 200 }}
      dpr={[1, 1.75]}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        background: '#03040a',
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor('#03040a', 1)
        gl.domElement.style.display = 'block'
      }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <SceneContent {...props} />
    </Canvas>
  )
}
