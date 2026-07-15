import { Suspense, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { Billboard, Float, Html, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import type { Kol, StatusLabel } from '../types'
import {
  getKolRank,
  NICHE_COLORS,
  primaryNiche,
  RANK_RING_COLORS,
  RANK_RING_WIDTH,
  STATUS_EMOJI,
  STATUS_LABELS,
} from '../types'
import { radiusForScore } from '../lib/layout'
import { xAvatarTextureUrl } from '../lib/avatar'
import { AvatarImg } from './AvatarImg'
import { RankBadge } from './RankBadge'
import { RankRingDecor } from './RankRingDecor'
import { TextureErrorBoundary } from './TextureErrorBoundary'

interface Props {
  kol: Kol
  position: [number, number, number]
  selected: boolean
  dimmed: boolean
  onSelect: (kol: Kol) => void
  /** 2D lite: fewer meshes / no glass shells / cheaper materials */
  lite?: boolean
}

export function KolBubble(props: Props) {
  return (
    <TextureErrorBoundary
      fallback={<AvatarNode {...props} map={null} loadState="error" />}
    >
      <Suspense
        fallback={<AvatarNode {...props} map={null} loadState="loading" />}
      >
        <AvatarWithTexture {...props} />
      </Suspense>
    </TextureErrorBoundary>
  )
}

function AvatarWithTexture(props: Props) {
  const url = xAvatarTextureUrl(props.kol.handle)
  // R2 CDN is cross-origin — required for WebGL texture upload
  const texture = useLoader(THREE.TextureLoader, url, (loader) => {
    loader.setCrossOrigin('anonymous')
  })
  texture.colorSpace = THREE.SRGBColorSpace
  // Lite/2.5D: no mipmap thrash when billboard distance changes (stops shimmer)
  if (props.lite) {
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 1
  } else {
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 16
  }
  texture.needsUpdate = true
  return <AvatarNode {...props} map={texture} loadState="ready" />
}

type LoadState = 'ready' | 'loading' | 'error'

function AvatarNode({
  kol,
  position,
  selected,
  dimmed,
  onSelect,
  map,
  lite = false,
  loadState = 'ready',
}: Props & { map: THREE.Texture | null; loadState?: LoadState }) {
  const glowRef = useRef<THREE.Mesh>(null)
  const discRef = useRef<THREE.Group>(null)
  const orbitRef = useRef<THREE.Group>(null)
  const shellRef = useRef<THREE.Mesh>(null)
  const shellInnerRef = useRef<THREE.Mesh>(null)
  const rimRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const { gl } = useThree()

  if (map && !lite) {
    map.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy())
  }

  const color = NICHE_COLORS[primaryNiche(kol)]
  const rank = getKolRank(kol)
  const rankRing = RANK_RING_COLORS[rank]
  const ringOuter = RANK_RING_WIDTH[rank]
  const baseR = radiusForScore(kol.score) * (lite ? 1.08 : 1)
  const status = (kol.statusLabel ?? 'stable') as StatusLabel
  const statusEmoji = STATUS_EMOJI[status] ?? '🟢'
  const statusTitle = STATUS_LABELS[status] ?? 'Stable'
  const isHot = status === 'hot' || kol.hotScore >= 78
  const isFocus = selected || hovered
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  const segs = lite ? 48 : 64
  // Static scale in 2.5D — no per-frame pulse (was causing flicker)
  const liteScale = isFocus ? 1.12 : 1
  const hasFace = !!map
  // Neutral placeholder while texture loads / on error — no letter flash
  const placeholderColor = loadState === 'loading' ? '#1e293b' : '#0f172a'
  const faceColor = hasFace ? color : placeholderColor
  // Rank border visibility on full map (stronger when focused)
  const rankRingOpacity = dimmed
    ? 0.14
    : isFocus
      ? 1
      : rank === 'challenger'
        ? 0.95
        : rank === 'master'
          ? 0.9
          : 0.82

  useFrame((state) => {
    // 2.5D: skip all per-frame motion on avatars (stable, no flicker)
    if (lite) return

    const t = state.clock.elapsedTime
    if (!discRef.current || !glowRef.current) return

    const floatY = Math.sin(t * 0.85 + phase) * 0.07
    discRef.current.position.y = floatY

    const pulse =
      isHot || isFocus
        ? 1 + Math.sin(t * (isHot ? 2.6 : 2.0) + phase) * (isHot ? 0.065 : 0.04)
        : 1 + Math.sin(t * 1.15 + phase) * 0.018
    const boost = isFocus ? 1.18 : 1
    const s = pulse * boost

    discRef.current.scale.setScalar(
      THREE.MathUtils.lerp(discRef.current.scale.x, s, 0.12),
    )
    glowRef.current.scale.setScalar(
      THREE.MathUtils.lerp(glowRef.current.scale.x, s * 1.55, 0.1),
    )

    if (orbitRef.current) {
      orbitRef.current.rotation.y = t * (isHot ? 0.75 : 0.32) + phase
      orbitRef.current.rotation.z = Math.sin(t * 0.45 + phase) * 0.35
      orbitRef.current.rotation.x = 0.55 + Math.sin(t * 0.3 + phase) * 0.12
    }

    if (shellRef.current) {
      shellRef.current.rotation.y = t * 0.18 + phase
      shellRef.current.rotation.x = t * 0.09
      const mat = shellRef.current.material as THREE.MeshPhysicalMaterial
      mat.opacity = THREE.MathUtils.lerp(
        mat.opacity,
        dimmed ? 0.03 : isFocus ? 0.28 : isHot ? 0.2 : 0.14,
        0.08,
      )
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        isFocus ? 0.45 : isHot ? 0.28 : 0.14,
        0.08,
      )
    }

    if (shellInnerRef.current) {
      shellInnerRef.current.rotation.y = -t * 0.12 + phase
      const mat = shellInnerRef.current.material as THREE.MeshPhysicalMaterial
      mat.opacity = THREE.MathUtils.lerp(
        mat.opacity,
        dimmed ? 0.02 : isFocus ? 0.18 : 0.1,
        0.08,
      )
    }

    if (rimRef.current) {
      rimRef.current.rotation.z = t * 0.4
      rimRef.current.rotation.x = Math.PI / 2.2
    }
  })

  const faceOpacity = dimmed ? 0.2 : 1

  const pickHandlers = {
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      onSelect(kol)
    },
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      setHovered(true)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      setHovered(false)
      document.body.style.cursor = 'default'
    },
  }

  /* ——— 2.5D: static disc (no float/pulse) — avoids avatar flicker ——— */
  if (lite) {
    return (
      <group position={position} scale={liteScale}>
        {/* Soft halo behind face — tinted by rank for map-level scan */}
        <Billboard follow lockZ={false}>
          <mesh position={[0, 0, -0.03]} renderOrder={0}>
            <circleGeometry args={[baseR * (ringOuter + 0.12), segs]} />
            <meshBasicMaterial
              color={hasFace ? rankRing : placeholderColor}
              transparent
              opacity={
                dimmed
                  ? 0.06
                  : hasFace
                    ? isHot
                      ? 0.32
                      : rank === 'challenger'
                        ? 0.28
                        : 0.2
                    : loadState === 'loading'
                      ? 0.3
                      : 0.18
              }
              depthWrite={false}
              depthTest
              toneMapped={false}
            />
          </mesh>

          {/* Face — opaque depth write so no transparent thrash */}
          <mesh position={[0, 0, 0]} renderOrder={1} {...pickHandlers}>
            <circleGeometry args={[baseR, segs]} />
            {map ? (
              <meshBasicMaterial
                map={map}
                transparent={dimmed}
                opacity={faceOpacity}
                depthWrite={!dimmed}
                depthTest
                side={THREE.FrontSide}
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
              />
            ) : (
              <meshBasicMaterial
                color={faceColor}
                transparent
                opacity={dimmed ? 0.25 : loadState === 'loading' ? 0.85 : 0.7}
                depthWrite={!dimmed}
                side={THREE.FrontSide}
                toneMapped={false}
              />
            )}
          </mesh>

          {/* Rank border + metallic hextech frame */}
          <RankRingDecor
            baseR={baseR}
            rank={rank}
            color={hasFace ? rankRing : '#334155'}
            opacity={rankRingOpacity}
            segs={segs}
            dimmed={dimmed}
            z={0.012}
            frontSide
            animate={!dimmed}
          />

          {/* Inner hairline — keeps avatar edge crisp */}
          <mesh position={[0, 0, 0.016]} renderOrder={5}>
            <ringGeometry args={[baseR * 0.97, baseR * 1.005, segs]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={dimmed ? 0.08 : isFocus ? 0.55 : 0.28}
              depthWrite={false}
              depthTest
              side={THREE.FrontSide}
              toneMapped={false}
            />
          </mesh>
        </Billboard>

        {/* Pill + status emoji only on hover / select */}
        {isFocus && !dimmed && (
          <Html
            center
            distanceFactor={11}
            position={[0, baseR * 1.65, 0]}
            style={{ pointerEvents: 'none' }}
            zIndexRange={[50, 0]}
          >
            <div className="bubble-label bubble-label--with-avatar glass">
              <AvatarImg
                handle={kol.handle}
                name={kol.displayName}
                size={36}
                color={color}
                className="bubble-label__avatar"
              />
              <div className="bubble-label__text">
                <span className="bubble-label__name">{kol.displayName}</span>
                <span className="bubble-label__meta">
                  @{kol.handle} · {formatNum(kol.followers)}
                </span>
                <div className="bubble-label__pills">
                  <RankBadge
                    tier={kol.tier}
                    score={kol.score}
                    isTop30={kol.isTop30}
                    rank={kol.rank}
                    size="sm"
                  />
                  <span
                    className="bubble-label__status-pill"
                    title={statusTitle}
                  >
                    <span aria-hidden>{statusEmoji}</span>
                    {statusTitle}
                  </span>
                </div>
              </div>
            </div>
          </Html>
        )}
      </group>
    )
  }

  /* ——— Full 3D glass bubble ——— */
  return (
    <group position={position}>
      <mesh ref={shellRef}>
        <sphereGeometry args={[baseR * 1.28, 48, 48]} />
        <meshPhysicalMaterial
          color={rankRing}
          transparent
          opacity={0.12}
          roughness={0.08}
          metalness={0.05}
          transmission={0.55}
          thickness={0.6}
          ior={1.4}
          emissive={rankRing}
          emissiveIntensity={rank === 'challenger' ? 0.22 : 0.12}
          depthWrite={false}
          clearcoat={1}
          clearcoatRoughness={0.12}
        />
      </mesh>

      <mesh ref={shellInnerRef} scale={0.92}>
        <sphereGeometry args={[baseR * 1.12, 32, 32]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.1}
          roughness={0.2}
          metalness={0}
          transmission={0.7}
          thickness={0.35}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={rimRef} rotation={[Math.PI / 2.15, 0, 0]}>
        <torusGeometry
          args={[baseR * 1.2, rank === 'challenger' ? 0.02 : 0.014, 12, 64]}
        />
        <meshBasicMaterial
          color={rankRing}
          transparent
          opacity={dimmed ? 0.1 : isFocus ? 0.75 : 0.45}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {!dimmed && (
        <mesh scale={baseR * 1.32}>
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={rankRing}
            wireframe
            transparent
            opacity={isFocus ? 0.18 : 0.06}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh ref={glowRef}>
        <sphereGeometry args={[baseR * 1.18, 24, 24]} />
        <meshBasicMaterial
          color={rankRing}
          transparent
          opacity={dimmed ? 0.03 : isHot ? 0.18 : 0.1}
          depthWrite={false}
        />
      </mesh>

      {!dimmed && (
        <group ref={orbitRef}>
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2
            const rr = baseR * 1.42
            return (
              <mesh
                key={i}
                position={[
                  Math.cos(a) * rr,
                  Math.sin(a * 1.7) * rr * 0.28,
                  Math.sin(a) * rr,
                ]}
              >
                <sphereGeometry args={[baseR * (i % 2 === 0 ? 0.08 : 0.055), 12, 12]} />
                <meshBasicMaterial
                  color={i % 2 === 0 ? '#ffffff' : rankRing}
                  transparent
                  opacity={0.9}
                  toneMapped={false}
                />
              </mesh>
            )
          })}
        </group>
      )}

      {(isHot || isFocus) && !dimmed && (
        <Sparkles
          count={isFocus ? 22 : 12}
          scale={[baseR * 3.4, baseR * 3.4, baseR * 3.4]}
          size={isFocus ? 3.2 : 2.2}
          speed={0.55}
          opacity={0.7}
          color={rankRing}
        />
      )}

      <Float
        speed={isFocus ? 2.1 : 1.15}
        rotationIntensity={0}
        floatIntensity={isFocus ? 0.4 : 0.18}
        floatingRange={[-0.05, 0.05]}
      >
        <Billboard follow>
          <group ref={discRef}>
            <mesh position={[0, 0, -0.05]}>
              <circleGeometry args={[baseR * 1.16, segs]} />
              <meshPhysicalMaterial
                color={rankRing}
                transparent
                opacity={dimmed ? 0.1 : 0.28}
                roughness={0.15}
                metalness={0.1}
                transmission={0.35}
                thickness={0.2}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            <mesh position={[0, 0, -0.03]}>
              <circleGeometry args={[baseR * (ringOuter + 0.08), segs]} />
              <meshBasicMaterial
                color={rankRing}
                transparent
                opacity={dimmed ? 0.05 : isHot ? 0.26 : 0.14}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Rank border + metallic hextech frame */}
            <RankRingDecor
              baseR={baseR}
              rank={rank}
              color={rankRing}
              opacity={rankRingOpacity}
              segs={72}
              dimmed={dimmed}
              z={-0.012}
              frontSide={false}
              animate={!dimmed}
            />

            <mesh position={[0, 0, -0.006]}>
              <ringGeometry args={[baseR * 0.985, baseR * 1.02, 72]} />
              <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={dimmed ? 0.1 : 0.55}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>

            <mesh position={[0, 0, 0]} {...pickHandlers}>
              <circleGeometry args={[baseR, segs]} />
              {map ? (
                <meshBasicMaterial
                  map={map}
                  transparent
                  opacity={faceOpacity}
                  side={THREE.DoubleSide}
                  toneMapped={false}
                />
              ) : (
                <meshBasicMaterial
                  color={faceColor}
                  transparent
                  opacity={dimmed ? 0.25 : loadState === 'loading' ? 0.85 : 0.7}
                  side={THREE.DoubleSide}
                />
              )}
            </mesh>

            {!dimmed && hasFace && (
              <mesh position={[0, baseR * 0.35, 0.01]} scale={[0.85, 0.35, 1]}>
                <circleGeometry args={[baseR * 0.55, 32]} />
                <meshBasicMaterial
                  color="#ffffff"
                  transparent
                  opacity={isFocus ? 0.16 : 0.08}
                  depthWrite={false}
                />
              </mesh>
            )}

            {/* Hot: thin outer halo still rank-colored */}
            {isHot && !dimmed && hasFace && (
              <mesh position={[0, 0, 0.02]}>
                <ringGeometry
                  args={[baseR * ringOuter, baseR * (ringOuter + 0.1), 72]}
                />
                <meshBasicMaterial
                  color={rankRing}
                  transparent
                  opacity={0.55}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            )}
          </group>
        </Billboard>
      </Float>

      {/* Pill + status emoji only on hover / select */}
      {isFocus && !dimmed && (
        <Html
          center
          distanceFactor={11}
          position={[0, baseR * 1.75, 0]}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[100, 0]}
        >
          <div className="bubble-label bubble-label--with-avatar glass">
            <AvatarImg
              handle={kol.handle}
              name={kol.displayName}
              size={40}
              color={color}
              className="bubble-label__avatar"
            />
            <div className="bubble-label__text">
              <span className="bubble-label__name">{kol.displayName}</span>
              <span className="bubble-label__meta">
                @{kol.handle} · {formatNum(kol.followers)}
              </span>
              <div className="bubble-label__pills">
                <RankBadge
                  tier={kol.tier}
                  score={kol.score}
                  isTop30={kol.isTop30}
                  size="sm"
                />
                <span className="bubble-label__status-pill" title={statusTitle}>
                  <span aria-hidden>{statusEmoji}</span>
                  {statusTitle}
                </span>
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
