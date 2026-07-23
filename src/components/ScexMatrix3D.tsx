/**
 * SCEX mention matrix as interactive 3D cloud (OrbitControls like main map).
 * X = volume (số lần nhắc), Y = quality, Z = depth scatter.
 */
import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, Billboard } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type { ScexActor, ScexConfig } from '../data/scexTracking'
import { actorMatrixPos, actorSizeValue } from '../data/scexTracking'
import { XProfileAvatar } from './XProfileAvatar'

export type ScexMatrix3DProps = {
  actors: ScexActor[]
  config: ScexConfig
  selectedId: string | null
  /** Handles present on the main VN KOL map */
  mapHandles: Set<string>
  onSelect: (actor: ScexActor | null) => void
  autoRotate?: boolean
}

type Placed = {
  actor: ScexActor
  position: [number, number, number]
  radius: number
}

function hash01(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return ((h >>> 0) % 1000) / 1000
}

function placeActors(actors: ScexActor[], config: ScexConfig): Placed[] {
  if (!actors.length) return []
  const maxSize = Math.max(...actors.map((a) => actorSizeValue(a, config)), 1)
  const items = actors.map((actor) => {
    const { x, y } = actorMatrixPos(actor, config)
    // Map unit coords → 3D stage
    const px = (x - 0.5) * 14
    const py = (y - 0.5) * 10
    const pz = (hash01(actor.handle) - 0.5) * 5.5
    const radius = 0.38 + (actorSizeValue(actor, config) / maxSize) * 0.72
    return {
      actor,
      position: [px, py, pz] as [number, number, number],
      radius,
      mass: Math.log10((actor.followers || 1) + 10),
    }
  })

  // Soft 3D repulsion so avatars don't stack
  for (let iter = 0; iter < 36; iter++) {
    const s = 0.5 * (1 - iter / 36) + 0.1
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        const dx = b.position[0] - a.position[0]
        const dy = b.position[1] - a.position[1]
        const dz = b.position[2] - a.position[2]
        const dist = Math.hypot(dx, dy, dz) || 0.01
        const minD = a.radius + b.radius + 0.55
        if (dist < minD) {
          const push = ((minD - dist) / 2) * s
          const ux = dx / dist
          const uy = dy / dist
          const uz = dz / dist
          const wa = 1 / a.mass
          const wb = 1 / b.mass
          const sum = wa + wb
          a.position[0] -= ux * push * (wb / sum)
          a.position[1] -= uy * push * (wb / sum)
          a.position[2] -= uz * push * (wb / sum)
          b.position[0] += ux * push * (wa / sum)
          b.position[1] += uy * push * (wa / sum)
          b.position[2] += uz * push * (wa / sum)
        }
      }
    }
    // Pull slightly toward data anchors
    for (const it of items) {
      const { x, y } = actorMatrixPos(it.actor, config)
      const ax = (x - 0.5) * 14
      const ay = (y - 0.5) * 10
      it.position[0] += (ax - it.position[0]) * 0.05
      it.position[1] += (ay - it.position[1]) * 0.05
      it.position[0] = Math.max(-7.2, Math.min(7.2, it.position[0]))
      it.position[1] = Math.max(-5.2, Math.min(5.2, it.position[1]))
      it.position[2] = Math.max(-3.2, Math.min(3.2, it.position[2]))
    }
  }

  return items.map(({ actor, position, radius }) => ({
    actor,
    position,
    radius,
  }))
}

function QuadrantPlanes({ config }: { config: ScexConfig }) {
  const q = config.quadrantLabels
  const labels: Array<{
    key: string
    title: string
    sub: string
    pos: [number, number, number]
    color: string
  }> = [
    {
      key: 'nurture',
      title: q.nurture?.title || 'CẦN NUÔI',
      sub: q.nurture?.subtitle || '',
      pos: [-3.6, 3.2, -2.8],
      color: '#38bdf8',
    },
    {
      key: 'stars',
      title: q.stars?.title || 'NGÔI SAO',
      sub: q.stars?.subtitle || '',
      pos: [3.6, 3.2, -2.8],
      color: '#22c55e',
    },
    {
      key: 'ignore',
      title: q.ignore?.title || 'THẤP',
      sub: q.ignore?.subtitle || '',
      pos: [-3.6, -3.2, -2.8],
      color: '#64748b',
    },
    {
      key: 'noise',
      title: q.noise?.title || 'ỒN ÀO',
      sub: q.noise?.subtitle || '',
      pos: [3.6, -3.2, -2.8],
      color: '#f59e0b',
    },
  ]

  return (
    <group>
      {/* Soft stage floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5.4, 0]} receiveShadow>
        <circleGeometry args={[11, 48]} />
        <meshBasicMaterial color="#0a1224" transparent opacity={0.55} />
      </mesh>
      {/* Cross axes */}
      <mesh position={[0, 0, -3]}>
        <planeGeometry args={[14.5, 10.5]} />
        <meshBasicMaterial
          color="#0f172a"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Vertical split */}
      <mesh position={[0, 0, -2.95]}>
        <planeGeometry args={[0.04, 10.4]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>
      {/* Horizontal split */}
      <mesh position={[0, 0, -2.95]}>
        <planeGeometry args={[14.4, 0.04]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>
      {labels.map((L) => (
        <Html
          key={L.key}
          position={L.pos}
          center
          distanceFactor={14}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[10, 0]}
        >
          <div className="scex3d-quad-label" style={{ borderColor: `${L.color}55` }}>
            <strong style={{ color: L.color }}>{L.title}</strong>
            {L.sub ? <small>{L.sub}</small> : null}
          </div>
        </Html>
      ))}
    </group>
  )
}

function ActorBubble3D({
  placed,
  config,
  selected,
  onMap,
  onSelect,
}: {
  placed: Placed
  config: ScexConfig
  selected: boolean
  onMap: boolean
  onSelect: (a: ScexActor) => void
}) {
  const { actor, position, radius } = placed
  const group = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const ring =
    config.sentimentLabels[actor.sentiment]?.color || '#94a3b8'
  const focus = selected || hovered

  useFrame((_, dt) => {
    if (!group.current) return
    const target = focus ? 1.12 : 1
    const s = group.current.scale.x
    const next = s + (target - s) * Math.min(1, dt * 10)
    group.current.scale.setScalar(next)
  })

  const pxSize = Math.round(Math.max(36, Math.min(72, radius * 52)))

  return (
    <group ref={group} position={position}>
      <Billboard follow lockZ={false}>
        {/* Halo */}
        <mesh position={[0, 0, -0.02]}>
          <circleGeometry args={[radius * 1.22, 32]} />
          <meshBasicMaterial
            color={ring}
            transparent
            opacity={focus ? 0.35 : 0.16}
            depthWrite={false}
          />
        </mesh>
        {/* Hit target */}
        <mesh
          onClick={(e) => {
            e.stopPropagation()
            onSelect(actor)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
            document.body.style.cursor = onMap ? 'pointer' : 'default'
          }}
          onPointerOut={() => {
            setHovered(false)
            document.body.style.cursor = 'default'
          }}
        >
          <circleGeometry args={[radius, 32]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Billboard>

      <Html
        center
        distanceFactor={11}
        position={[0, 0, 0.02]}
        style={{ pointerEvents: 'none' }}
        zIndexRange={[40, 0]}
      >
        <div
          className={[
            'scex3d-bubble',
            selected ? 'is-selected' : '',
            onMap ? 'is-on-map' : '',
            focus ? 'is-focus' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            width: pxSize,
            height: pxSize,
            borderColor: ring,
            ['--ring' as string]: ring,
          }}
        >
          <XProfileAvatar
            handle={actor.handle}
            name={actor.displayName}
            size={Math.max(28, pxSize - 8)}
          />
          {onMap && <span className="scex3d-bubble__map-dot" title="Có trên map" />}
          <span className="scex3d-bubble__label">
            @{actor.handle.length > 11 ? `${actor.handle.slice(0, 10)}…` : actor.handle}
          </span>
        </div>
      </Html>
    </group>
  )
}

function SceneInner({
  actors,
  config,
  selectedId,
  mapHandles,
  onSelect,
  autoRotate,
}: ScexMatrix3DProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const placed = useMemo(() => placeActors(actors, config), [actors, config])

  return (
    <>
      <color attach="background" args={['#050814']} />
      <fog attach="fog" args={['#050814', 22, 48]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#94a3b8', '#020617', 0.4]} />
      <pointLight position={[10, 8, 12]} intensity={0.55} color="#e2e8f0" />
      <pointLight position={[-8, -2, 6]} intensity={0.28} color="#67e8f9" />

      <QuadrantPlanes config={config} />

      {placed.map((p) => (
        <ActorBubble3D
          key={p.actor.id}
          placed={p}
          config={config}
          selected={selectedId === p.actor.id}
          onMap={mapHandles.has(p.actor.handle.toLowerCase())}
          onSelect={(a) =>
            onSelect(selectedId === a.id ? null : a)
          }
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        minDistance={9}
        maxDistance={28}
        autoRotate={autoRotate}
        autoRotateSpeed={0.35}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI * 0.88}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  )
}

export function ScexMatrix3D(props: ScexMatrix3DProps) {
  return (
    <div className="scex3d-canvas-wrap">
      <Canvas
        camera={{ position: [0, 2.2, 16], fov: 42, near: 0.1, far: 80 }}
        dpr={[1, 1.6]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x050814, 1)
        }}
        onPointerMissed={() => props.onSelect(null)}
      >
        <SceneInner {...props} />
      </Canvas>
      <div className="scex3d-hint" aria-hidden>
        Kéo để xoay · Cuộn để zoom · Chấm xanh = có trên map Radar
      </div>
    </div>
  )
}
