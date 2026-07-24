/**
 * SCEX mention matrix — Story 2D (volume × quality).
 * Compact floating zoom + density clustering; pan when zoomed.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { ScexActor, ScexConfig, ScexQuadrant } from '../data/scexTracking'
import {
  actorMatrixPos,
  actorSizeValue,
  actorVolumeMetric,
} from '../data/scexTracking'
import { XProfileAvatar } from './XProfileAvatar'

const STORY_TIP_KEY = 'scex-story-tip-v1'

/** Action-first zone names (Story matrix) */
const STORY_ZONE: Record<
  ScexQuadrant,
  { title: string; hint: string; corner: 'tl' | 'tr' | 'bl' | 'br' }
> = {
  nurture: {
    title: 'Nuôi dưỡng',
    hint: 'Chất lượng cao · ít mention',
    corner: 'tl',
  },
  stars: {
    title: 'Ưu tiên hợp tác',
    hint: 'Hay mention · chất lượng cao',
    corner: 'tr',
  },
  ignore: {
    title: 'Ít ưu tiên',
    hint: 'Ít mention · chất lượng thấp',
    corner: 'bl',
  },
  noise: {
    title: 'Cần rà soát',
    hint: 'Hay mention · chất lượng thấp',
    corner: 'br',
  },
}

function storyVolumePhrase(vol: number, split: number): string {
  if (vol >= split * 1.2) return 'Hay mention'
  if (vol >= split) return 'Mention khá'
  if (vol >= split * 0.55) return 'Mention vừa'
  return 'Ít mention'
}

function storyQualityPhrase(q: number, split: number): string {
  if (q >= split * 1.15) return 'Chất lượng cao'
  if (q >= split) return 'Chất lượng khá'
  if (q >= split * 0.7) return 'Chất lượng trung bình'
  return 'Chất lượng thấp'
}

function zoneTitle(key: ScexQuadrant, config: ScexConfig): string {
  const raw = config.quadrantLabels[key]?.title || ''
  if (raw && !/^(TRỌNG ĐIỂM|TIỀM NĂNG|CẦN RÀ SOÁT|TÍN HIỆU YẾU)$/i.test(raw)) {
    return raw
  }
  return STORY_ZONE[key].title
}

export type ScexMatrix2DProps = {
  actors: ScexActor[]
  config: ScexConfig
  selectedId: string | null
  mapHandles: Set<string>
  onSelect: (actor: ScexActor | null) => void
  /** @deprecated FAB is always visible; kept for API compat */
  showZoomControls?: boolean
}

type PlacedActor = {
  actor: ScexActor
  x: number
  y: number
  r: number
  depth: number
  followers: number
  quality: number
}

type SingleNode = {
  kind: 'single'
  id: string
  actor: ScexActor
  x: number
  y: number
  r: number
  z: number
  depth: number
}

type ClusterNode = {
  kind: 'cluster'
  id: string
  members: ScexActor[]
  x: number
  y: number
  r: number
  z: number
  /** Top members for stacked faces (by followers) */
  faces: ScexActor[]
  onMapCount: number
}

type LayoutNode = SingleNode | ClusterNode

/** Discrete zoom steps */
const ZOOM_STEPS = [0.75, 1, 1.35, 1.75, 2.25] as const
const DEFAULT_ZOOM_I = 1 // 100%

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function placeActors(
  actors: ScexActor[],
  config: ScexConfig,
  width: number,
  height: number,
  maxSize: number,
): PlacedActor[] {
  if (!actors.length || width < 40 || height < 40) return []
  const pad = 28
  return actors.map((a) => {
    const { x, y } = actorMatrixPos(a, config)
    const r = 16 + (actorSizeValue(a, config) / maxSize) * 22
    const px = pad + r + x * Math.max(1, width - 2 * pad - 2 * r)
    const py = pad + r + (1 - y) * Math.max(1, height - 2 * pad - 2 * r)
    return {
      actor: a,
      x: px,
      y: py,
      r,
      depth: actorSizeValue(a, config) / maxSize,
      followers: a.followers || 0,
      quality: a.qualityScore || 0,
    }
  })
}

/**
 * Cell size in layout px — larger when zoomed out → more clustering;
 * shrinks when zoomed in → more individuals.
 */
function clusterCellSize(zoom: number, actorCount: number): number {
  const densityBoost = actorCount > 40 ? 1.15 : actorCount > 24 ? 1.05 : 1
  // zoom 0.75 → ~88px, 1 → ~64px, 1.35 → ~48px, 1.75 → ~38px, 2.25 → ~30px
  const base = 64 / Math.pow(zoom, 0.85)
  return clamp(base * densityBoost, 28, 100)
}

function separateNodes(
  nodes: Array<{ x: number; y: number; r: number; followers: number }>,
  width: number,
  height: number,
  pad: number,
  iterations = 36,
) {
  for (let iter = 0; iter < iterations; iter++) {
    const strength = 0.5 * (1 - iter / iterations) + 0.12
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.01
        const minDist = a.r + b.r + 10
        if (dist < minDist) {
          const push = ((minDist - dist) / 2) * strength
          const ux = dx / dist
          const uy = dy / dist
          const wa = 1 / (1 + Math.log10((a.followers || 1) + 1))
          const wb = 1 / (1 + Math.log10((b.followers || 1) + 1))
          const sum = wa + wb
          a.x -= ux * push * (wb / sum)
          a.y -= uy * push * (wb / sum)
          b.x += ux * push * (wa / sum)
          b.y += uy * push * (wa / sum)
        }
      }
    }
    for (const n of nodes) {
      n.x = clamp(n.x, n.r + pad, width - n.r - pad)
      n.y = clamp(n.y, n.r + pad, height - n.r - pad)
    }
  }
}

/**
 * Build layout with zoom-aware clustering.
 * `expandedActorIds` forces those members to stay as individuals after open.
 */
function buildLayout(
  actors: ScexActor[],
  config: ScexConfig,
  width: number,
  height: number,
  maxSize: number,
  zoom: number,
  mapHandles: Set<string>,
  expandedActorIds: Set<string>,
): LayoutNode[] {
  const placed = placeActors(actors, config, width, height, maxSize)
  if (!placed.length) return []

  const cell = clusterCellSize(zoom, actors.length)
  const buckets = new Map<string, PlacedActor[]>()

  for (const p of placed) {
    // Expanded actors always solo — never re-bucket into a cluster
    if (expandedActorIds.has(p.actor.id)) continue
    const cx = Math.floor(p.x / cell)
    const cy = Math.floor(p.y / cell)
    const key = `${cx}:${cy}`
    const list = buckets.get(key)
    if (list) list.push(p)
    else buckets.set(key, [p])
  }

  const layout: LayoutNode[] = []
  const singles: PlacedActor[] = []

  // Force-expanded first
  for (const p of placed) {
    if (expandedActorIds.has(p.actor.id)) singles.push(p)
  }

  for (const [key, group] of buckets) {
    const clusterId = `c_${key}`

    if (group.length === 1) {
      singles.push(group[0])
      continue
    }

    // High zoom: pairs that are already apart stay individual
    if (zoom >= 1.7 && group.length === 2) {
      const d = Math.hypot(group[0].x - group[1].x, group[0].y - group[1].y)
      if (d > group[0].r + group[1].r + 8) {
        singles.push(group[0], group[1])
        continue
      }
    }

    const sorted = [...group].sort((a, b) => b.followers - a.followers)
    const cx = group.reduce((s, g) => s + g.x, 0) / group.length
    const cy = group.reduce((s, g) => s + g.y, 0) / group.length
    const r = clamp(22 + Math.sqrt(group.length) * 7, 26, 48)
    const faces = sorted.slice(0, 3).map((g) => g.actor)
    const onMapCount = group.filter((g) =>
      mapHandles.has(g.actor.handle.toLowerCase()),
    ).length
    const depth = sorted[0].depth
    layout.push({
      kind: 'cluster',
      id: clusterId,
      members: sorted.map((g) => g.actor),
      x: cx,
      y: cy,
      r,
      z: Math.round(20 + depth * 40 + group.length),
      faces,
      onMapCount,
    })
  }

  // Separate singles so they don't stack
  const sep = singles.map((s) => ({
    x: s.x,
    y: s.y,
    r: s.r,
    followers: s.followers,
    src: s,
  }))
  separateNodes(sep, width, height, 22, 40)

  for (const s of sep) {
    const a = s.src.actor
    layout.push({
      kind: 'single',
      id: a.id,
      actor: a,
      x: s.x,
      y: s.y,
      r: s.r,
      depth: s.src.depth,
      z: Math.round(10 + s.src.depth * 40 + s.src.quality * 0.15),
    })
  }

  // Light separation between clusters and singles
  const all = layout.map((n) => ({
    x: n.x,
    y: n.y,
    r: n.r,
    followers:
      n.kind === 'cluster'
        ? n.members.reduce((s, m) => s + (m.followers || 0), 0)
        : n.actor.followers || 0,
    node: n,
  }))
  separateNodes(all, width, height, 18, 20)
  for (const item of all) {
    item.node.x = item.x
    item.node.y = item.y
  }

  return layout.sort((a, b) => a.z - b.z)
}

export function ScexMatrix2D({
  actors,
  config,
  selectedId,
  mapHandles,
  onSelect,
}: ScexMatrix2DProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [plotSize, setPlotSize] = useState({ w: 0, h: 0 })
  const [zoomI, setZoomI] = useState(DEFAULT_ZOOM_I)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [showStoryTip, setShowStoryTip] = useState(false)
  /** Actor ids kept un-clustered after user opened a group */
  const [expandedActorIds, setExpandedActorIds] = useState<Set<string>>(
    () => new Set(),
  )
  const zoom = ZOOM_STEPS[zoomI]
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  panRef.current = pan
  zoomRef.current = zoom

  const dragRef = useRef<{
    pid: number
    sx: number
    sy: number
    ox: number
    oy: number
    moved: boolean
  } | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORY_TIP_KEY) !== '1') setShowStoryTip(true)
    } catch {
      setShowStoryTip(true)
    }
  }, [])

  const dismissStoryTip = () => {
    setShowStoryTip(false)
    try {
      localStorage.setItem(STORY_TIP_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  useLayoutEffect(() => {
    const el = plotRef.current
    if (!el) return
    const measure = () => {
      setPlotSize({
        w: Math.max(0, el.clientWidth),
        h: Math.max(0, el.clientHeight),
      })
    }
    measure()
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [actors.length])

  const clampPanTo = useCallback(
    (px: number, py: number, z: number, w: number, h: number) => {
      if (z <= 1 || w < 1 || h < 1) return { x: 0, y: 0 }
      const maxX = ((z - 1) * w) / 2
      const maxY = ((z - 1) * h) / 2
      return {
        x: clamp(px, -maxX, maxX),
        y: clamp(py, -maxY, maxY),
      }
    },
    [],
  )

  const goZoom = useCallback(
    (nextI: number, focus?: { x: number; y: number }) => {
      const i = clamp(nextI, 0, ZOOM_STEPS.length - 1)
      const el = plotRef.current
      const w = el?.clientWidth || plotSize.w
      const h = el?.clientHeight || plotSize.h
      const oldZ = zoomRef.current
      const newZ = ZOOM_STEPS[i]
      const oldPan = panRef.current

      // Zooming out past 100% clears manual expansions (re-cluster cleanly)
      if (newZ <= 1) {
        setExpandedActorIds(new Set())
      }

      if (newZ === 1) {
        setZoomI(i)
        setPan({ x: 0, y: 0 })
        return
      }

      if (focus && w > 0 && h > 0 && oldZ > 0) {
        const cx = focus.x - w / 2
        const cy = focus.y - h / 2
        const contentX = (cx - oldPan.x) / oldZ
        const contentY = (cy - oldPan.y) / oldZ
        const newPanX = cx - contentX * newZ
        const newPanY = cy - contentY * newZ
        setZoomI(i)
        setPan(clampPanTo(newPanX, newPanY, newZ, w, h))
      } else {
        setZoomI(i)
        setPan((p) => clampPanTo(p.x, p.y, newZ, w, h))
      }
    },
    [clampPanTo, plotSize.w, plotSize.h],
  )

  /** Zoom in toward a layout point (cluster center) */
  const zoomTowardLayoutPoint = useCallback(
    (lx: number, ly: number) => {
      const el = plotRef.current
      if (!el) {
        goZoom(zoomI + 1)
        return
      }
      const w = el.clientWidth
      const h = el.clientHeight
      const z = zoomRef.current
      const pan = panRef.current
      // layout (lx,ly) → screen coords in plot
      const screenX = w / 2 + (lx - w / 2) * z + pan.x
      const screenY = h / 2 + (ly - h / 2) * z + pan.y
      goZoom(zoomI + 1, { x: screenX, y: screenY })
    },
    [goZoom, zoomI],
  )

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    if (
      (e.target as HTMLElement).closest(
        '.scex-bubble, .scex-cluster, .scex2d-zoom-fab',
      )
    )
      return
    if (zoomRef.current <= 1) return
    const el = plotRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    dragRef.current = {
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: panRef.current.x,
      oy: panRef.current.y,
      moved: false,
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d || d.pid !== e.pointerId) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (Math.hypot(dx, dy) > 3) d.moved = true
    const el = plotRef.current
    const w = el?.clientWidth || plotSize.w
    const h = el?.clientHeight || plotSize.h
    setPan(clampPanTo(d.ox + dx, d.oy + dy, zoomRef.current, w, h))
  }

  const endDrag = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d || d.pid !== e.pointerId) return
    try {
      plotRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (d.moved) suppressClickRef.current = true
    dragRef.current = null
  }

  const maxSize = Math.max(
    ...actors.map((a) => actorSizeValue(a, config)),
    1,
  )

  const layout = useMemo(
    () =>
      buildLayout(
        actors,
        config,
        plotSize.w,
        plotSize.h,
        maxSize,
        zoom,
        mapHandles,
        expandedActorIds,
      ),
    [
      actors,
      config,
      plotSize.w,
      plotSize.h,
      maxSize,
      zoom,
      mapHandles,
      expandedActorIds,
    ],
  )

  const clusterCount = useMemo(
    () => layout.filter((n) => n.kind === 'cluster').length,
    [layout],
  )

  const vmax = Math.max(config.volumeAxis.max, 1)
  const qmax = Math.max(config.qualityAxis.max, 1)
  const splitXPct = Math.min(
    92,
    Math.max(8, (config.volumeSplit / vmax) * 100),
  )
  const splitYFromTopPct = Math.min(
    92,
    Math.max(8, (1 - config.qualitySplit / qmax) * 100),
  )

  const zones = (['nurture', 'stars', 'ignore', 'noise'] as const).map(
    (key) => ({
      key,
      title: zoneTitle(key, config),
      hint: STORY_ZONE[key].hint,
      corner: STORY_ZONE[key].corner,
    }),
  )

  const zoomPct = Math.round(zoom * 100)
  const canZoomOut = zoomI > 0
  const canZoomIn = zoomI < ZOOM_STEPS.length - 1
  const isDefaultZoom = zoomI === DEFAULT_ZOOM_I && pan.x === 0 && pan.y === 0

  return (
    <div className="scex2d-root scex2d-root--story">
      {showStoryTip && (
        <div className="scex2d-story-tip" role="status">
          <div className="scex2d-story-tip__body">
            <strong>Cách đọc nhanh</strong>
            <p>
              Góc <em>trên-phải</em> = ưu tiên cao. Nhóm avatar = cluster (bấm
              để mở rộng / zoom gần). Dùng nút ± góc phải để phóng.
            </p>
          </div>
          <button
            type="button"
            className="scex2d-story-tip__ok"
            onClick={dismissStoryTip}
          >
            Đã hiểu
          </button>
        </div>
      )}

      <div className="scex2d-story-read" aria-hidden>
        <span className="scex2d-story-read__y">↑ Chất lượng cao hơn</span>
        <span className="scex2d-story-read__x">
          ← Ít mention &nbsp;·&nbsp; Nhiều mention →
        </span>
      </div>

      <div className="scex2d-stage scex2d-stage--story">
        <div className="scex2d-plot-shell">
          <div
            className={`scex-matrix__plot scex2d-plot scex2d-plot--story ${zoom > 1 ? 'is-zoomed' : ''}`}
            ref={plotRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => {
              goZoom(DEFAULT_ZOOM_I)
              setExpandedActorIds(new Set())
            }}
          >
            {zones.map((z) => (
              <div
                key={z.key}
                className={`scex2d-zone scex2d-zone--${z.corner} scex2d-zone--${z.key}`}
                aria-hidden
              >
                <strong>{z.title}</strong>
                <span>{z.hint}</span>
              </div>
            ))}

            <div
              className="scex2d-zoom-layer"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <div className="scex2d-wash scex2d-wash--nurture" aria-hidden />
              <div className="scex2d-wash scex2d-wash--stars" aria-hidden />
              <div className="scex2d-wash scex2d-wash--ignore" aria-hidden />
              <div className="scex2d-wash scex2d-wash--noise" aria-hidden />
              <div
                className="scex2d-crosshair scex2d-crosshair--split"
                style={
                  {
                    ['--split-x' as string]: `${splitXPct}%`,
                    ['--split-y' as string]: `${splitYFromTopPct}%`,
                  } as CSSProperties
                }
                aria-hidden
              />

              <div className="scex-matrix__stage">
                {layout.map((node) => {
                  if (node.kind === 'cluster') {
                    const diam = node.r * 2
                    const showTip = hoverId === node.id
                    const top = node.members[0]
                    return (
                      <button
                        key={node.id}
                        type="button"
                        className={`scex-cluster ${showTip ? 'is-tip' : ''}`}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: diam,
                          height: diam,
                          zIndex: showTip ? 85 : node.z,
                        }}
                        aria-label={`Nhóm ${node.members.length} KOL`}
                        title={`${node.members.length} KOL gần nhau — bấm để mở`}
                        onMouseEnter={() => setHoverId(node.id)}
                        onMouseLeave={() =>
                          setHoverId((id) => (id === node.id ? null : id))
                        }
                        onClick={(ev) => {
                          ev.stopPropagation()
                          if (suppressClickRef.current) {
                            suppressClickRef.current = false
                            return
                          }
                          // Keep members as individuals, then zoom toward group
                          setExpandedActorIds((prev) => {
                            const next = new Set(prev)
                            for (const m of node.members) next.add(m.id)
                            return next
                          })
                          if (canZoomIn) {
                            zoomTowardLayoutPoint(node.x, node.y)
                          }
                        }}
                        onPointerDown={(ev) => ev.stopPropagation()}
                      >
                        <span className="scex-cluster__stack" aria-hidden>
                          {node.faces.map((f, i) => (
                            <span
                              key={f.id}
                              className="scex-cluster__face"
                              style={{
                                zIndex: 3 - i,
                                transform: `translate(${i * 7 - (node.faces.length - 1) * 3.5}px, ${i * 2}px)`,
                              }}
                            >
                              <XProfileAvatar
                                handle={f.handle}
                                name={f.displayName}
                                size={Math.max(
                                  22,
                                  Math.round(diam * 0.42),
                                )}
                              />
                            </span>
                          ))}
                        </span>
                        <span className="scex-cluster__badge">
                          {node.members.length}
                        </span>
                        {node.onMapCount > 0 && (
                          <span className="scex-cluster__map">
                            {node.onMapCount}
                          </span>
                        )}
                        {showTip && (
                          <span className="scex-bubble__tip" role="tooltip">
                            <em>{node.members.length} KOL gần nhau</em>
                            <small>
                              Bấm để tách nhóm
                              {canZoomIn ? ' + phóng gần' : ''}
                            </small>
                            {top && (
                              <small>
                                Top: {top.displayName || top.handle}
                              </small>
                            )}
                          </span>
                        )}
                      </button>
                    )
                  }

                  const a = node.actor
                  const ring =
                    config.sentimentLabels[a.sentiment]?.color || '#94a3b8'
                  const diam = node.r * 2
                  const selected = selectedId === a.id
                  const onMap = mapHandles.has(a.handle.toLowerCase())
                  const showTip = hoverId === a.id || selected
                  const sentLabel =
                    config.sentimentLabels[a.sentiment]?.label || a.sentiment
                  const vol = actorVolumeMetric(a, config)
                  const volPhrase = storyVolumePhrase(vol, config.volumeSplit)
                  const qualPhrase = storyQualityPhrase(
                    a.qualityScore,
                    config.qualitySplit,
                  )
                  const zoneKey = (a.quadrant || 'ignore') as ScexQuadrant
                  const zoneLabel = zoneTitle(zoneKey, config)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={[
                        'scex-bubble',
                        selected ? 'is-selected' : '',
                        onMap ? 'is-on-map' : '',
                        showTip ? 'is-tip' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        left: node.x,
                        top: node.y,
                        width: diam,
                        height: diam,
                        borderColor: ring,
                        zIndex: selected || showTip ? 80 : node.z,
                        ['--depth' as string]: String(node.depth),
                        ['--ring' as string]: ring,
                      }}
                      aria-label={`${a.displayName || a.handle}, ${zoneLabel}, ${volPhrase}, ${qualPhrase}`}
                      onMouseEnter={() => setHoverId(a.id)}
                      onMouseLeave={() =>
                        setHoverId((id) => (id === a.id ? null : id))
                      }
                      onFocus={() => setHoverId(a.id)}
                      onBlur={() =>
                        setHoverId((id) => (id === a.id ? null : id))
                      }
                      onClick={(ev) => {
                        ev.stopPropagation()
                        if (suppressClickRef.current) {
                          suppressClickRef.current = false
                          return
                        }
                        onSelect(selectedId === a.id ? null : a)
                      }}
                      onPointerDown={(ev) => ev.stopPropagation()}
                    >
                      <span className="scex-bubble__glow" aria-hidden />
                      <span className="scex-bubble__disc">
                        <XProfileAvatar
                          handle={a.handle}
                          name={a.displayName}
                          size={Math.max(24, Math.round(diam - 8))}
                        />
                      </span>
                      {onMap && <span className="scex-bubble__map-dot" />}
                      <span className="scex-bubble__label">
                        @
                        {a.handle.length > 10
                          ? `${a.handle.slice(0, 9)}…`
                          : a.handle}
                      </span>
                      {showTip && (
                        <span className="scex-bubble__tip" role="tooltip">
                          <em>{a.displayName || a.handle}</em>
                          <small className="scex-bubble__tip-zone">
                            {zoneLabel}
                          </small>
                          <small>
                            {volPhrase} · {qualPhrase}
                          </small>
                          <small>
                            {formatCompact(a.followers)} followers
                            {onMap ? ' · Có trên map' : ''}
                            {a.mapRank ? ` · ${a.mapRank}` : ''}
                            {sentLabel ? ` · ${sentLabel}` : ''}
                          </small>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Compact floating zoom — overlay, no layout height */}
            <div
              className="scex2d-zoom-fab"
              role="toolbar"
              aria-label="Zoom ma trận"
            >
              <button
                type="button"
                className="scex2d-zoom-fab__btn"
                title="Phóng to"
                disabled={!canZoomIn}
                onClick={(e) => {
                  e.stopPropagation()
                  const el = plotRef.current
                  if (el) {
                    goZoom(zoomI + 1, {
                      x: el.clientWidth / 2,
                      y: el.clientHeight / 2,
                    })
                  } else goZoom(zoomI + 1)
                }}
              >
                +
              </button>
              <button
                type="button"
                className={`scex2d-zoom-fab__level ${!isDefaultZoom ? 'is-active' : ''}`}
                title={
                  isDefaultZoom
                    ? 'Mức zoom hiện tại'
                    : 'Về 100% (hoặc double-click nền)'
                }
                onClick={(e) => {
                  e.stopPropagation()
                  goZoom(DEFAULT_ZOOM_I)
                  setExpandedActorIds(new Set())
                }}
              >
                {zoomPct}%
              </button>
              <button
                type="button"
                className="scex2d-zoom-fab__btn"
                title="Thu nhỏ"
                disabled={!canZoomOut}
                onClick={(e) => {
                  e.stopPropagation()
                  goZoom(zoomI - 1)
                }}
              >
                −
              </button>
              <div className="scex2d-zoom-fab__rail" aria-hidden>
                {ZOOM_STEPS.map((z, i) => (
                  <button
                    key={z}
                    type="button"
                    className={`scex2d-zoom-fab__tick ${i === zoomI ? 'is-on' : ''}`}
                    title={`${Math.round(z * 100)}%`}
                    onClick={(e) => {
                      e.stopPropagation()
                      goZoom(i)
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="scex2d-story-axes">
          <span className="scex2d-story-axes__y">
            ↑ {config.qualityAxis.label || 'Chất lượng'}
          </span>
          <span className="scex2d-story-axes__track" aria-hidden>
            <i />
          </span>
          <span className="scex2d-story-axes__x">
            {config.volumeAxis.label || 'Tần suất mention'} →
          </span>
        </div>
      </div>

      <div className="scex2d-encode" aria-label="Chú thích ma trận">
        <span>
          <i className="scex2d-encode__size" aria-hidden />
          To hơn = nhiều followers
        </span>
        <span>
          <i className="scex2d-encode__ring" aria-hidden />
          Viền = cảm xúc
        </span>
        <span>
          <i className="scex2d-encode__map" aria-hidden />
          Chấm xanh = trên map
        </span>
        {clusterCount > 0 && (
          <span className="scex2d-encode__cluster">
            <i className="scex2d-encode__cluster-icon" aria-hidden />
            {clusterCount} nhóm — bấm để tách
          </span>
        )}
        <span className="scex2d-encode__hint">± phóng · kéo nền khi &gt;100%</span>
      </div>
    </div>
  )
}
