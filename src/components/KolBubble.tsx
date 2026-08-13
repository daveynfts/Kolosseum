import { Suspense, useRef, useState } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { Billboard, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Kol, StatusLabel } from '../types'
import {
  getKolRank,
  NICHE_COLORS,
  primaryNiche,
  RANK_RING_COLORS,
  RANK_RING_WIDTH,
} from '../types'
import { radiusForScore } from '../lib/layout'
import { resolveKolAvatarTextureUrl } from '../lib/avatar'

import { AvatarImg } from './AvatarImg'
import { RankBadge } from './RankBadge'
import { StatusBadge } from './StatusBadge'
import { RankRingDecor } from './RankRingDecor'
import { TextureErrorBoundary } from './TextureErrorBoundary'

interface Props {
  kol: Kol
  position: [number, number, number]
  selected: boolean
  dimmed: boolean
  /** Another KOL is selected — recede this one */
  recessed?: boolean
  /** 0 = back of cloud, 1 = toward camera */
  depth?: number
  onSelect: (kol: Kol) => void
}

export function KolBubble(props: Props) {
  const texKey = `${props.kol.handle}|${props.kol.avatarUrl || ''}`
  return (
    <TextureErrorBoundary
      fallback={<AvatarNode {...props} map={null} loadState="error" />}
    >
      <Suspense
        fallback={<AvatarNode {...props} map={null} loadState="loading" />}
      >
        <AvatarWithTexture key={texKey} {...props} />
      </Suspense>
    </TextureErrorBoundary>
  )
}

function AvatarWithTexture(props: Props) {
  const clean = props.kol.handle.replace(/^@/, '').trim()
  const override = (props.kol.avatarUrl || '').trim()
  const url = override
    ? resolveKolAvatarTextureUrl(props.kol)
    : `/avatars/${encodeURIComponent(clean)}.jpg`
  const texture = useLoader(THREE.TextureLoader, url, (loader) => {
    loader.setCrossOrigin('anonymous')
  })
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 4
  texture.needsUpdate = true
  return <AvatarNode {...props} map={texture} loadState="ready" />
}

type LoadState = 'ready' | 'loading' | 'error'

function AvatarNode({
  kol,
  position,
  selected,
  dimmed,
  recessed = false,
  depth = 0.65,
  onSelect,
  map,
  loadState = 'ready',
}: Props & { map: THREE.Texture | null; loadState?: LoadState }) {
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  const color = NICHE_COLORS[primaryNiche(kol)]
  const rank = getKolRank(kol)
  const rankRing = RANK_RING_COLORS[rank]
  const ringOuter = RANK_RING_WIDTH[rank]
  const baseR = radiusForScore(kol.score) * 1.08
  const status = (kol.statusLabel ?? 'stable') as StatusLabel
  const isHot = status === 'hot' || kol.hotScore >= 78
  const isFocus = selected || hovered
  const segs = 96
  const hasFace = !!map
  const placeholderColor = loadState === 'loading' ? '#1e293b' : '#0f172a'
  const faceColor = hasFace ? color : placeholderColor
  const quiet = rank === 'gold' || rank === 'platinum'
  const rankRingOpacity = dimmed
    ? 0.12
    : isFocus
      ? 1
      : quiet
        ? 0.62 + depth * 0.18
        : rank === 'challenger'
          ? 0.82 + depth * 0.16
          : 0.72 + depth * 0.18

  const haloOpacity = dimmed
    ? 0.02
    : !hasFace
      ? 0.08
      : isFocus
        ? rank === 'challenger'
          ? 0.14
          : 0.09
        : quiet
          ? 0.025
          : rank === 'challenger'
            ? 0.06
            : isHot
              ? 0.05
              : 0.03

  const idleScale = 0.86 + depth * 0.16
  const faceOpacity = dimmed
    ? 0.2
    : isFocus
      ? 1
      : recessed
        ? 0.58 + depth * 0.28
        : 0.7 + depth * 0.3
  const layer = isFocus ? 20 : Math.round(depth * 12)
  const translucent = faceOpacity < 0.98
  const glassOp = dimmed ? 0 : isFocus ? 1 : 0.45 + depth * 0.55

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const target = dimmed
      ? 0.86
      : recessed && !isFocus
        ? idleScale * 0.92
        : isFocus
          ? 1.12
          : idleScale
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, target, 0.14))
  })

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

  const innerRim =
    rank === 'challenger'
      ? '#fff6d4'
      : rank === 'master'
        ? '#eef2ff'
        : rank === 'diamond'
          ? '#f0f9ff'
          : rank === 'platinum'
            ? '#f0fdfa'
            : '#fffbeb'

  return (
    <group position={position} ref={groupRef}>
      <Billboard follow lockZ={false}>
        {/* Contact shadow — soft disc under the front of the cluster */}
        <mesh position={[0.04, -0.12, -0.08]} renderOrder={layer}>
          <circleGeometry args={[baseR * 1.08, segs]} />
          <meshBasicMaterial
            color="#020617"
            transparent
            opacity={dimmed ? 0.03 : 0.08 + depth * 0.2}
            depthWrite={false}
            depthTest
            toneMapped={false}
          />
        </mesh>

        {/* Barely-there rank wash — only reads on focus / Challenger */}
        <mesh position={[0, 0, -0.04]} renderOrder={layer}>
          <circleGeometry
            args={[baseR * (ringOuter + (isFocus ? 0.04 : 0.015)), segs]}
          />
          <meshBasicMaterial
            color={hasFace ? rankRing : placeholderColor}
            transparent
            opacity={haloOpacity}
            depthWrite={false}
            depthTest
            toneMapped={false}
          />
        </mesh>

        <mesh
          position={[0, 0, 0]}
          renderOrder={layer + 1}
          {...pickHandlers}
        >
          <circleGeometry args={[baseR, segs]} />
          {map ? (
            <meshBasicMaterial
              map={map}
              transparent={translucent}
              opacity={faceOpacity}
              depthWrite={!translucent}
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
          renderOrder={layer + 2}
          depth={depth}
        />

        {/* Glass volume — bottom shade + catchlight (reads as a sphere) */}
        {hasFace && !dimmed && (
          <>
            <mesh position={[0, 0, 0.018]} renderOrder={layer + 3}>
              <ringGeometry
                args={[
                  baseR * 0.52,
                  baseR * 0.99,
                  40,
                  1,
                  Math.PI * 1.12,
                  Math.PI * 0.82,
                ]}
              />
              <meshBasicMaterial
                color="#020617"
                transparent
                opacity={0.16 * glassOp}
                depthWrite={false}
                depthTest
                side={THREE.FrontSide}
                toneMapped={false}
              />
            </mesh>
            <mesh position={[0, 0, 0.02]} renderOrder={layer + 3}>
              <ringGeometry
                args={[
                  baseR * 0.38,
                  baseR * 0.9,
                  40,
                  1,
                  Math.PI * 0.52,
                  Math.PI * 0.62,
                ]}
              />
              <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={0.13 * glassOp}
                depthWrite={false}
                depthTest
                side={THREE.FrontSide}
                toneMapped={false}
              />
            </mesh>
          </>
        )}

        {/* Hairline inner rim — crystal edge, not a second glow ring */}
        <mesh position={[0, 0, 0.022]} renderOrder={layer + 4}>
          <ringGeometry args={[baseR * 0.988, baseR * 1.004, segs]} />
          <meshBasicMaterial
            color={innerRim}
            transparent
            opacity={dimmed ? 0.04 : isFocus ? 0.55 : quiet ? 0.16 : 0.28}
            depthWrite={false}
            depthTest
            side={THREE.FrontSide}
            toneMapped={false}
          />
        </mesh>
      </Billboard>

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
              avatarUrl={kol.avatarUrl}
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
                <StatusBadge status={status} size="sm" />
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
