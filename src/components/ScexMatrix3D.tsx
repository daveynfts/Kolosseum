/**
 * SCEX mention matrix — interactive 3D cloud (OrbitControls).
 * Quadrant labels live in CSS overlay (clean, no Html clutter).
 */
import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, Billboard, Stars } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type { ScexActor, ScexConfig } from '../data/scexTracking'
import {
  actorMatrixPos,
  actorSizeValue,
  actorVolumeMetric,
} from '../data/scexTracking'
import { XProfileAvatar } from './XProfileAvatar'

export type ScexMatrix3DProps = {
  actors: ScexActor[]
  config: ScexConfig
  selectedId: string | null
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
    const px = (x - 0.5) * 13.2
    const py = (y - 0.5) * 9.2
    const pz = (hash01(actor.handle) - 0.5) * 4.2
    const radius = 0.42 + (actorSizeValue(actor, config) / maxSize) * 0.68
    return {
      actor,
      position: [px, py, pz] as [number, number, number],
      radius,
      mass: Math.log10((actor.followers || 1) + 10),
    }
  })

  for (let iter = 0; iter < 40; iter++) {
    const s = 0.52 * (1 - iter / 40) + 0.1
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        const dx = b.position[0] - a.position[0]
        const dy = b.position[1] - a.position[1]
        const dz = b.position[2] - a.position[2]
        const dist = Math.hypot(dx, dy, dz) || 0.01
        const minD = a.radius + b.radius + 0.62
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
    for (const it of items) {
      const { x, y } = actorMatrixPos(it.actor, config)
      const ax = (x - 0.5) * 13.2
      const ay = (y - 0.5) * 9.2
      it.position[0] += (ax - it.position[0]) * 0.045
      it.position[1] += (ay - it.position[1]) * 0.045
      it.position[0] = Math.max(-6.8, Math.min(6.8, it.position[0]))
      it.position[1] = Math.max(-4.8, Math.min(4.8, it.position[1]))
      it.position[2] = Math.max(-2.6, Math.min(2.6, it.position[2]))
    }
  }

  return items.map(({ actor, position, radius }) => ({
    actor,
    position,
    radius,
  }))
}

function StageFrame() {
  return (
    <group>
      {/* Soft radial floor glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5.1, 0]}>
        <circleGeometry args={[10.5, 64]} />
        <meshBasicMaterial color="#0c1a2e" transparent opacity={0.5} />
      </mesh>
      {/* Back plate with quadrant tints */}
      <mesh position={[0, 0, -3.2]}>
        <planeGeometry args={[14.2, 10.2]} />
        <meshBasicMaterial
          color="#0a1220"
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Quadrant color washes */}
      {(
        [
          { pos: [-3.5, 2.5, -3.15] as const, color: '#38bdf8' },
          { pos: [3.5, 2.5, -3.15] as const, color: '#22c55e' },
          { pos: [-3.5, -2.5, -3.15] as const, color: '#64748b' },
          { pos: [3.5, -2.5, -3.15] as const, color: '#f59e0b' },
        ] as const
      ).map((q, i) => (
        <mesh key={i} position={[...q.pos]}>
          <planeGeometry args={[6.8, 4.8]} />
          <meshBasicMaterial
            color={q.color}
            transparent
            opacity={0.055}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* Axis lines */}
      <mesh position={[0, 0, -3.1]}>
        <planeGeometry args={[0.035, 10]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.28} />
      </mesh>
      <mesh position={[0, 0, -3.1]}>
        <planeGeometry args={[14, 0.035]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.28} />
      </mesh>
      {/* Outer frame */}
      <lineSegments position={[0, 0, -3.05]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(14.1, 10.1)]} />
        <lineBasicMaterial color="#64748b" transparent opacity={0.35} />
      </lineSegments>
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
    const target = focus ? 1.14 : 1
    const s = group.current.scale.x
    group.current.scale.setScalar(s + (target - s) * Math.min(1, dt * 12))
  })

  const pxSize = Math.round(Math.max(44, Math.min(80, radius * 58)))

  return (
    <group ref={group} position={position}>
      <Billboard follow lockZ={false}>
        <mesh position={[0, 0, -0.03]}>
          <circleGeometry args={[radius * (focus ? 1.4 : 1.24), 40]} />
          <meshBasicMaterial
            color={ring}
            transparent
            opacity={focus ? 0.45 : onMap ? 0.24 : 0.12}
            depthWrite={false}
          />
        </mesh>
        <mesh
          onClick={(e) => {
            e.stopPropagation()
            onSelect(actor)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHovered(false)
            document.body.style.cursor = 'default'
          }}
        >
          <circleGeometry args={[radius * 1.05, 32]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Billboard>

      <Html
        center
        distanceFactor={10.2}
        position={[0, 0, 0.04]}
        style={{ pointerEvents: 'none' }}
        zIndexRange={[focus || selected ? 120 : 40, 0]}
        occlude={false}
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
          <span className="scex3d-bubble__face">
            <XProfileAvatar
              handle={actor.handle}
              name={actor.displayName}
              size={Math.max(32, pxSize - 10)}
            />
          </span>
          {onMap && (
            <span className="scex3d-bubble__map-dot" title="Có trên map" />
          )}
          {(focus || selected) && (
            <span className="scex3d-bubble__tip">
              <em>{actor.displayName}</em>
              <small>
                @{actor.handle}
                <br />
                V{Math.round(actorVolumeMetric(actor, config))} · Q
                {Math.round(actor.qualityScore)}
                {actor.mapRank
                  ? ` · ${actor.mapRank}`
                  : onMap
                    ? ' · Map'
                    : ''}
              </small>
            </span>
          )}
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
      <color attach="background" args={['#04080f']} />
      <fog attach="fog" args={['#04080f', 24, 52]} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#a5b4fc', '#020617', 0.35]} />
      <pointLight position={[12, 9, 14]} intensity={0.65} color="#e2e8f0" />
      <pointLight position={[-9, -1, 7]} intensity={0.32} color="#38bdf8" />
      <pointLight position={[0, 6, -4]} intensity={0.2} color="#22c55e" />

      <Stars
        radius={60}
        depth={40}
        count={900}
        factor={2.2}
        saturation={0.2}
        fade
        speed={0.25}
      />

      <StageFrame />

      {placed.map((p) => (
        <ActorBubble3D
          key={p.actor.id}
          placed={p}
          config={config}
          selected={selectedId === p.actor.id}
          onMap={mapHandles.has(p.actor.handle.toLowerCase())}
          onSelect={(a) => onSelect(selectedId === a.id ? null : a)}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0.2, 0]}
        enablePan={false}
        minDistance={10}
        maxDistance={26}
        autoRotate={autoRotate}
        autoRotateSpeed={0.28}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI * 0.82}
        enableDamping
        dampingFactor={0.075}
      />
    </>
  )
}

export function ScexMatrix3D(props: ScexMatrix3DProps) {
  const q = props.config.quadrantLabels
  const quads = [
    {
      key: 'stars',
      title: q.stars?.title || 'TRỌNG ĐIỂM',
      sub: q.stars?.subtitle || '',
      tone: 'stars' as const,
    },
    {
      key: 'nurture',
      title: q.nurture?.title || 'TIỀM NĂNG',
      sub: q.nurture?.subtitle || '',
      tone: 'nurture' as const,
    },
    {
      key: 'noise',
      title: q.noise?.title || 'CẦN RÀ SOÁT',
      sub: q.noise?.subtitle || '',
      tone: 'noise' as const,
    },
    {
      key: 'ignore',
      title: q.ignore?.title || 'TÍN HIỆU YẾU',
      sub: q.ignore?.subtitle || '',
      tone: 'ignore' as const,
    },
  ]

  return (
    <div className="scex3d-root">
      {/*
        Frame labels OUTSIDE the canvas — avatars never cover quadrant names.
        Spatial map: top = high quality, bottom = low; left = low volume, right = high.
      */}
      <div className="scex3d-stage">
        <div className="scex-frame-row scex-frame-row--top" aria-hidden>
          <span className="scex-frame-chip scex-frame-chip--nurture">
            {q.nurture?.title || 'TIỀM NĂNG'}
          </span>
          <span className="scex-frame-chip scex-frame-chip--stars">
            {q.stars?.title || 'TRỌNG ĐIỂM'}
          </span>
        </div>

        <div className="scex3d-canvas-wrap">
          <Canvas
            camera={{ position: [0, 1.4, 15.2], fov: 40, near: 0.1, far: 90 }}
            dpr={[1, 1.75]}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
            }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x04080f, 1)
            }}
            onPointerMissed={() => props.onSelect(null)}
          >
            <SceneInner {...props} />
          </Canvas>
        </div>

        <div className="scex-frame-row scex-frame-row--bottom" aria-hidden>
          <span className="scex-frame-chip scex-frame-chip--ignore">
            {q.ignore?.title || 'TÍN HIỆU YẾU'}
          </span>
          <span className="scex-frame-chip scex-frame-chip--noise">
            {q.noise?.title || 'CẦN RÀ SOÁT'}
          </span>
        </div>

        <div className="scex3d-axis-bar">
          <span className="scex3d-axis-bar__y">
            ↑ {props.config.qualityAxis.label || 'Điểm chất lượng'}
          </span>
          <span className="scex3d-axis-bar__hint">
            Kéo để xoay · Cuộn để zoom · Chấm xanh = có trên map
          </span>
          <span className="scex3d-axis-bar__x">
            {props.config.volumeAxis.label || 'Tần suất mention'} →
          </span>
        </div>
      </div>

      <ul className="scex3d-quad-legend">
        {quads.map((item) => (
          <li
            key={item.key}
            className={`scex3d-quad-legend__item scex3d-quad-legend__item--${item.tone}`}
          >
            <strong>{item.title}</strong>
            {item.sub ? <span>{item.sub}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
