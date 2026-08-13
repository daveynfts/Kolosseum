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
  STATUS_EMOJI,
  STATUS_LABELS,
} from '../types'
import { radiusForScore } from '../lib/layout'
import { resolveKolAvatarTextureUrl } from '../lib/avatar'

import { AvatarImg } from './AvatarImg'
import { RankBadge } from './RankBadge'
import { RankRingDecor } from './RankRingDecor'
import { TextureErrorBoundary } from './TextureErrorBoundary'

interface Props {
  kol: Kol
  position: [number, number, number]
  selected: boolean
  dimmed: boolean
  /** Another KOL is selected — recede this one */
  recessed?: boolean
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
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 1
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
  const statusEmoji = STATUS_EMOJI[status] ?? '🟢'
  const statusTitle = STATUS_LABELS[status] ?? 'Stable'
  const isHot = status === 'hot' || kol.hotScore >= 78
  const isFocus = selected || hovered
  const segs = 48
  const hasFace = !!map
  const placeholderColor = loadState === 'loading' ? '#1e293b' : '#0f172a'
  const faceColor = hasFace ? color : placeholderColor
  const rankRingOpacity = dimmed
    ? 0.16
    : isFocus
      ? 1
      : rank === 'challenger'
        ? 0.98
        : rank === 'master'
          ? 0.94
          : rank === 'diamond'
            ? 0.9
            : 0.86

  const haloOpacity = dimmed
    ? 0.05
    : !hasFace
      ? loadState === 'loading'
        ? 0.3
        : 0.18
      : isFocus
        ? rank === 'challenger'
          ? 0.5
          : 0.4
        : isHot
          ? 0.36
          : rank === 'challenger'
            ? 0.34
            : rank === 'master'
              ? 0.3
              : rank === 'diamond'
                ? 0.26
                : 0.2

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const target = dimmed ? 0.88 : recessed && !isFocus ? 0.94 : isFocus ? 1.2 : 1
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, target, 0.14))
  })

  const faceOpacity = dimmed ? 0.22 : recessed && !isFocus ? 0.72 : 1

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
        ? '#ddd6fe'
        : rank === 'diamond'
          ? '#e0f2fe'
          : rank === 'platinum'
            ? '#ccfbf1'
            : '#fde68a'

  return (
    <group position={position} ref={groupRef}>
      <Billboard follow lockZ={false}>
        {/* Rank-tinted bloom — thicker / hotter for higher tiers */}
        <mesh
          position={[0, 0, -0.04]}
          renderOrder={isFocus ? 8 : 0}
        >
          <circleGeometry
            args={[baseR * (ringOuter + (isFocus ? 0.22 : 0.14)), segs]}
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

        {rank === 'challenger' && !dimmed && (
          <mesh position={[0, 0, -0.05]} renderOrder={isFocus ? 7 : 0}>
            <ringGeometry
              args={[
                baseR * ringOuter,
                baseR * (ringOuter + 0.18),
                segs,
              ]}
            />
            <meshBasicMaterial
              color="#f5e6b8"
              transparent
              opacity={isFocus ? 0.42 : 0.22}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        )}

        <mesh
          position={[0, 0, 0]}
          renderOrder={isFocus ? 9 : 1}
          {...pickHandlers}
        >
          <circleGeometry args={[baseR, segs]} />
          {map ? (
            <meshBasicMaterial
              map={map}
              transparent={dimmed || (recessed && !isFocus)}
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

        <mesh position={[0, 0, 0.016]} renderOrder={isFocus ? 12 : 5}>
          <ringGeometry args={[baseR * 0.965, baseR * 1.008, segs]} />
          <meshBasicMaterial
            color={innerRim}
            transparent
            opacity={dimmed ? 0.08 : isFocus ? 0.7 : 0.38}
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
