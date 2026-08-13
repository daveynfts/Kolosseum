import { Suspense, useMemo, useRef, useState, type RefObject } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { Billboard, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Kol, StatusLabel } from '../types'
import {
  getKolNiches,
  getKolRank,
  NICHE_COLORS,
  primaryNiche,
  RANK_LABELS,
  RANK_RING_COLORS,
  RANK_RING_WIDTH,
} from '../types'
import { radiusForScore } from '../lib/layout'
import { resolveKolAvatarTextureUrl } from '../lib/avatar'

import { RankBadge } from './RankBadge'
import { StatusBadge } from './StatusBadge'
import { RankRingDecor } from './RankRingDecor'
import { TextureErrorBoundary } from './TextureErrorBoundary'

const mapHtmlPortal = {
  get current() {
    if (typeof document === 'undefined') return null
    return document.getElementById('map-html-layer')
  },
} as RefObject<HTMLElement>

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
  const liftRef = useRef<THREE.Group>(null)
  const liftAmt = useRef(0)
  const chipBelowRef = useRef(true)
  const toCam = useMemo(() => new THREE.Vector3(), [])
  const basePos = useMemo(() => new THREE.Vector3(), [])
  const [hovered, setHovered] = useState(false)
  const [chipBelow, setChipBelow] = useState(true)

  const color = NICHE_COLORS[primaryNiche(kol)]
  const rank = getKolRank(kol)
  const rankRing = RANK_RING_COLORS[rank]
  const ringOuter = RANK_RING_WIDTH[rank]
  const baseR = radiusForScore(kol.score) * 1.08
  const status = (kol.statusLabel ?? 'stable') as StatusLabel
  const isHot = status === 'hot' || kol.hotScore >= 78
  const isHoverOnly = hovered && !selected
  const segs = 96
  const hasFace = !!map
  const placeholderColor = loadState === 'loading' ? '#1e293b' : '#0f172a'
  const faceColor = hasFace ? color : placeholderColor
  const skipDepth = selected
  const rankRingOpacity = dimmed
    ? 0.12
    : selected
      ? 1
      : isHoverOnly
        ? 0.95
        : recessed
          ? 0.22 + depth * 0.1
          : rank === 'challenger'
            ? 0.86 + depth * 0.12
            : 0.72 + depth * 0.2

  const showHalo = !dimmed && (selected || isHoverOnly || (isHot && !recessed))
  const haloOpacity = selected
    ? 0.16
    : isHoverOnly
      ? 0.08
      : isHot
        ? 0.05
        : 0

  const idleScale = 0.88 + depth * 0.14
  const faceOpacity = dimmed
    ? 0.2
    : selected || isHoverOnly
      ? 1
      : recessed
        ? 0.28 + depth * 0.12
        : 0.78 + depth * 0.2
  const layer = selected ? 80 : isHoverOnly ? 24 : Math.round(depth * 12)
  const translucent = !selected && faceOpacity < 0.98
  const glassOp = dimmed
    ? 0
    : selected || isHoverOnly
      ? 1
      : 0.55 + depth * 0.4

  useFrame(({ camera }) => {
    const g = liftRef.current
    if (!g) return
    const targetScale = dimmed
      ? 0.86
      : selected
        ? 1.22
        : recessed && !hovered
          ? idleScale * 0.82
          : isHoverOnly
            ? 1.06
            : idleScale
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, targetScale, 0.16))

    const targetLift = selected
      ? 0.55
      : recessed && !hovered
        ? -0.12
        : isHoverOnly
          ? 0.12
          : 0
    liftAmt.current = THREE.MathUtils.lerp(liftAmt.current, targetLift, 0.16)
    basePos.set(position[0], position[1], position[2])
    toCam.copy(camera.position).sub(basePos)
    const dist = toCam.length()
    if (dist > 0.001) toCam.multiplyScalar(liftAmt.current / dist)
    else toCam.set(0, 0, 0)
    g.position.copy(toCam)

    if (selected) {
      basePos
        .set(position[0], position[1], position[2])
        .add(g.position)
        .project(camera)
      const nextBelow = basePos.y > -0.38
      if (nextBelow !== chipBelowRef.current) {
        chipBelowRef.current = nextBelow
        setChipBelow(nextBelow)
      }
    }
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
    <group position={position}>
      <group ref={liftRef}>
        <Billboard follow lockZ={false}>
          {/* Contact shadow — soft disc under the front of the cluster */}
          <mesh position={[0.04, -0.12, -0.08]} renderOrder={layer}>
            <circleGeometry args={[baseR * 1.08, segs]} />
            <meshBasicMaterial
              color="#020617"
              transparent
              opacity={
                dimmed ? 0.03 : selected ? 0.22 : recessed ? 0.04 : 0.08 + depth * 0.2
              }
              depthWrite={false}
              depthTest={!skipDepth}
              toneMapped={false}
              fog={!selected}
            />
          </mesh>

          {/* Rank wash — selected / hover / hot only */}
          {showHalo && (
            <mesh position={[0, 0, selected ? 0.04 : -0.04]} renderOrder={layer}>
              <circleGeometry
                args={[
                  baseR *
                    (ringOuter + (selected ? 0.12 : isHoverOnly ? 0.04 : 0.02)),
                  segs,
                ]}
              />
              <meshBasicMaterial
                color={hasFace ? rankRing : placeholderColor}
                transparent
                opacity={haloOpacity}
                depthWrite={false}
                depthTest={!skipDepth}
                toneMapped={false}
                fog={!selected}
              />
            </mesh>
          )}

          <mesh
            position={[0, 0, selected ? 0.08 : 0]}
            renderOrder={layer + 1}
            {...pickHandlers}
          >
            <circleGeometry args={[baseR, segs]} />
            {map ? (
              <meshBasicMaterial
                map={map}
                transparent={translucent}
                opacity={faceOpacity}
                depthWrite={selected || !translucent}
                depthTest={!skipDepth}
                side={THREE.FrontSide}
                toneMapped={false}
                fog={!selected}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
              />
            ) : (
              <meshBasicMaterial
                color={faceColor}
                transparent
                opacity={
                  dimmed ? 0.25 : loadState === 'loading' ? 0.85 : selected ? 1 : 0.7
                }
                depthWrite={selected || !dimmed}
                depthTest={!skipDepth}
                side={THREE.FrontSide}
                toneMapped={false}
                fog={!selected}
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
            z={selected ? 0.09 : 0.012}
            frontSide
            animate={!dimmed}
            renderOrder={layer + 2}
            depth={selected ? 1 : depth}
            depthTest={!skipDepth}
          />

          {/* Glass volume — bottom shade + catchlight (reads as a sphere) */}
          {hasFace && !dimmed && (
            <>
              <mesh position={[0, 0, selected ? 0.1 : 0.018]} renderOrder={layer + 3}>
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
                  depthTest={!skipDepth}
                  side={THREE.FrontSide}
                  toneMapped={false}
                  fog={!selected}
                />
              </mesh>
              <mesh position={[0, 0, selected ? 0.102 : 0.02]} renderOrder={layer + 3}>
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
                  opacity={(selected ? 0.2 : 0.13) * glassOp}
                  depthWrite={false}
                  depthTest={!skipDepth}
                  side={THREE.FrontSide}
                  toneMapped={false}
                  fog={!selected}
                />
              </mesh>
            </>
          )}

          {/* Hairline inner rim — crystal edge, not a second glow ring */}
          <mesh position={[0, 0, selected ? 0.105 : 0.022]} renderOrder={layer + 4}>
            <ringGeometry args={[baseR * 0.988, baseR * 1.004, segs]} />
            <meshBasicMaterial
              color={innerRim}
              transparent
              opacity={
                dimmed
                  ? 0.04
                  : selected
                    ? 0.7
                    : isHoverOnly
                      ? 0.5
                      : 0.32
              }
              depthWrite={false}
              depthTest={!skipDepth}
              side={THREE.FrontSide}
              toneMapped={false}
              fog={!selected}
            />
          </mesh>
        </Billboard>

        {selected && !dimmed && (
          <Html
            center
            position={[0, (chipBelow ? -1.85 : 1.85) * baseR, 0.25]}
            style={{ pointerEvents: 'none' }}
            zIndexRange={[100, 80]}
            occlude={false}
            pointerEvents="none"
            wrapperClass="bubble-html bubble-html--selected"
            portal={mapHtmlPortal}
          >
            <SelectedChip kol={kol} status={status} />
          </Html>
        )}

        {isHoverOnly && !dimmed && (
          <Html
            center
            distanceFactor={9}
            position={[0, baseR * 1.7, 0.12]}
            style={{ pointerEvents: 'none' }}
            zIndexRange={[90, 40]}
            occlude={false}
            pointerEvents="none"
            wrapperClass="bubble-html"
            portal={mapHtmlPortal}
          >
            <div className="bubble-label bubble-label--hover glass">
              <span className="bubble-label__name">{kol.displayName}</span>
              <span className="bubble-label__meta">@{kol.handle}</span>
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

function SelectedChip({
  kol,
  status,
}: {
  kol: Kol
  status: StatusLabel
}) {
  const niches = getKolNiches(kol)
  const shown = niches.slice(0, 2)
  const extra = niches.length - shown.length
  const rank = getKolRank(kol)

  return (
    <div className="bubble-chip glass-regular glass--liquid">
      <div className="bubble-chip__head">
        <div className="bubble-chip__id">
          <span className="bubble-chip__name">{kol.displayName}</span>
          <span className="bubble-chip__handle">@{kol.handle}</span>
        </div>
        <div className="bubble-chip__score">
          <strong>{kol.score.toFixed(1)}</strong>
          <span>score</span>
        </div>
      </div>
      <div className="bubble-chip__stats">
        <span>
          <em>Rank</em> {RANK_LABELS[rank]}
        </span>
        <span>
          <em>Followers</em> {formatNum(kol.followers)}
        </span>
      </div>
      <div className="bubble-chip__pills">
        <RankBadge
          tier={kol.tier}
          score={kol.score}
          isTop30={kol.isTop30}
          rank={kol.rank}
          size="sm"
        />
        <StatusBadge status={status} size="sm" />
        {shown.map((n) => (
          <span
            key={n}
            className="bubble-chip__niche"
            style={{
              color: NICHE_COLORS[n],
              borderColor: `${NICHE_COLORS[n]}66`,
              background: `${NICHE_COLORS[n]}1f`,
            }}
          >
            {n}
          </span>
        ))}
        {extra > 0 && <span className="bubble-chip__niche">+{extra}</span>}
      </div>
    </div>
  )
}

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
