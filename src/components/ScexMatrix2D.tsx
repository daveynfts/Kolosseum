/**
 * SCEX mention matrix — Story 2D (volume × quality).
 * Plain-language zones/axes; zoom + pan; works in fullscreen.
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
  type WheelEvent as ReactWheelEvent,
} from 'react'
import type { ScexActor, ScexConfig, ScexQuadrant } from '../data/scexTracking'
import {
  actorMatrixPos,
  actorSizeValue,
  actorVolumeMetric,
} from '../data/scexTracking'
import { XProfileAvatar } from './XProfileAvatar'

const STORY_TIP_KEY = 'scex-story-tip-v1'

/** Action-first zone names (Story matrix) — override jargon titles when present */
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
  // Prefer story labels; use config if already action-oriented (not ALL CAPS jargon)
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
  /**
   * Always show zoom bar (e.g. fullscreen).
   * Default: show only on hover of the 2D root (Lite Partner).
   */
  showZoomControls?: boolean
}

type BubbleLayout = {
  id: string
  x: number
  y: number
  r: number
  z: number
  depth: number
}

/** Discrete zoom steps — predictable + / − */
const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2, 2.5] as const
const DEFAULT_ZOOM_I = 1 // 100%

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function nearestStepIndex(z: number): number {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < ZOOM_STEPS.length; i++) {
    const d = Math.abs(ZOOM_STEPS[i] - z)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function packBubbles(
  actors: ScexActor[],
  config: ScexConfig,
  width: number,
  height: number,
  maxSize: number,
): BubbleLayout[] {
  if (!actors.length || width < 40 || height < 40) return []
  const pad = 22
  const items = actors.map((a) => {
    const { x, y } = actorMatrixPos(a, config)
    const r = 18 + (actorSizeValue(a, config) / maxSize) * 24
    const px = pad + r + x * Math.max(1, width - 2 * pad - 2 * r)
    const py = pad + r + (1 - y) * Math.max(1, height - 2 * pad - 2 * r)
    return {
      id: a.id,
      x: px,
      y: py,
      r,
      depth: actorSizeValue(a, config) / maxSize,
      followers: a.followers || 0,
      quality: a.qualityScore || 0,
    }
  })

  for (let iter = 0; iter < 52; iter++) {
    const strength = 0.55 * (1 - iter / 52) + 0.12
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.01
        const minDist = a.r + b.r + 12
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
    for (let i = 0; i < items.length; i++) {
      const a = actors[i]
      const { x, y } = actorMatrixPos(a, config)
      const r = items[i].r
      const ax = pad + r + x * Math.max(1, width - 2 * pad - 2 * r)
      const ay = pad + r + (1 - y) * Math.max(1, height - 2 * pad - 2 * r)
      items[i].x += (ax - items[i].x) * 0.04
      items[i].y += (ay - items[i].y) * 0.04
      items[i].x = Math.min(width - r - pad, Math.max(r + pad, items[i].x))
      items[i].y = Math.min(height - r - pad, Math.max(r + pad, items[i].y))
    }
  }

  return items
    .map((it) => ({
      id: it.id,
      x: it.x,
      y: it.y,
      r: it.r,
      depth: it.depth,
      z: Math.round(10 + it.depth * 40 + it.quality * 0.15),
    }))
    .sort((a, b) => a.z - b.z)
}

export function ScexMatrix2D({
  actors,
  config,
  selectedId,
  mapHandles,
  onSelect,
  showZoomControls = false,
}: ScexMatrix2DProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [plotSize, setPlotSize] = useState({ w: 0, h: 0 })
  const [zoomI, setZoomI] = useState(DEFAULT_ZOOM_I)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [showStoryTip, setShowStoryTip] = useState(false)
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
      // clientWidth/Height = layout box (not transform-affected)
      setPlotSize({
        w: Math.max(0, el.clientWidth),
        h: Math.max(0, el.clientHeight),
      })
    }
    measure()
    const ro = new ResizeObserver(() => {
      // rAF so fullscreen flex settles before measure
      requestAnimationFrame(measure)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [actors.length])

  const clampPanTo = useCallback(
    (px: number, py: number, z: number, w: number, h: number) => {
      if (z <= 1 || w < 1 || h < 1) return { x: 0, y: 0 }
      // Scaled content extends by (z-1)/2 on each side of center
      const maxX = ((z - 1) * w) / 2
      const maxY = ((z - 1) * h) / 2
      return {
        x: clamp(px, -maxX, maxX),
        y: clamp(py, -maxY, maxY),
      }
    },
    [],
  )

  /** Zoom to step index, optionally keeping a viewport point fixed (cursor). */
  const goZoom = useCallback(
    (nextI: number, focus?: { x: number; y: number }) => {
      const i = clamp(nextI, 0, ZOOM_STEPS.length - 1)
      const el = plotRef.current
      const w = el?.clientWidth || plotSize.w
      const h = el?.clientHeight || plotSize.h
      const oldZ = zoomRef.current
      const newZ = ZOOM_STEPS[i]
      const oldPan = panRef.current

      if (newZ === 1) {
        setZoomI(i)
        setPan({ x: 0, y: 0 })
        return
      }

      if (focus && w > 0 && h > 0 && oldZ > 0) {
        // Point under cursor in content coords (origin = center of plot)
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

  const onWheel = (e: ReactWheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = plotRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const focus = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    const dir = e.deltaY > 0 ? -1 : 1
    // Use current nearest step in case of float drift
    const cur = nearestStepIndex(zoomRef.current)
    goZoom(cur + dir, focus)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.scex-bubble')) return
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
    setPan(
      clampPanTo(d.ox + dx, d.oy + dy, zoomRef.current, w, h),
    )
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
  const packed = useMemo(
    () => packBubbles(actors, config, plotSize.w, plotSize.h, maxSize),
    [actors, config, plotSize.w, plotSize.h, maxSize],
  )
  const actorById = useMemo(
    () => new Map(actors.map((a) => [a.id, a])),
    [actors],
  )

  const vmax = Math.max(config.volumeAxis.max, 1)
  const qmax = Math.max(config.qualityAxis.max, 1)
  /** Split lines as % of plot (match scoring thresholds) */
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

  return (
    <div
      className={`scex2d-root scex2d-root--story ${showZoomControls ? 'scex2d-root--zoom-on' : 'scex2d-root--zoom-hover'}`}
    >
      <div
        className="scex2d-zoombar"
        role="toolbar"
        aria-label="Zoom ma trận 2D"
      >
        <button
          type="button"
          className="scex2d-zoombar__btn"
          title="Thu nhỏ (−)"
          disabled={!canZoomOut}
          onClick={() => goZoom(zoomI - 1)}
        >
          −
        </button>
        <button
          type="button"
          className="scex2d-zoombar__pct"
          title="Về 100%"
          onClick={() => goZoom(DEFAULT_ZOOM_I)}
        >
          {zoomPct}%
        </button>
        <button
          type="button"
          className="scex2d-zoombar__btn"
          title="Phóng to (+)"
          disabled={!canZoomIn}
          onClick={() => goZoom(zoomI + 1)}
        >
          +
        </button>
        <div className="scex2d-zoombar__steps" aria-hidden>
          {ZOOM_STEPS.map((z, i) => (
            <button
              key={z}
              type="button"
              className={`scex2d-zoombar__dot ${i === zoomI ? 'is-on' : ''}`}
              title={`${Math.round(z * 100)}%`}
              onClick={() => goZoom(i)}
            />
          ))}
        </div>
        <span className="scex2d-zoombar__hint">
          Scroll = zoom · Kéo nền = pan (khi &gt;100%)
        </span>
      </div>

      {showStoryTip && (
        <div className="scex2d-story-tip" role="status">
          <div className="scex2d-story-tip__body">
            <strong>Cách đọc nhanh</strong>
            <p>
              Góc <em>trên-phải</em> = ưu tiên cao (hay mention + chất lượng).
              Bấm avatar để xem KOL. Bubble to hơn = nhiều followers.
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
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {/* Zone labels fixed to viewport (readable while zoomed) */}
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
                {packed.map((b) => {
                  const a = actorById.get(b.id)
                  if (!a) return null
                  const ring =
                    config.sentimentLabels[a.sentiment]?.color || '#94a3b8'
                  const diam = b.r * 2
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
                        left: b.x,
                        top: b.y,
                        width: diam,
                        height: diam,
                        borderColor: ring,
                        zIndex: selected || showTip ? 80 : b.z,
                        ['--depth' as string]: String(b.depth),
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
          Viền = cảm xúc bài
        </span>
        <span>
          <i className="scex2d-encode__map" aria-hidden />
          Chấm xanh = đã có trên map
        </span>
        <span className="scex2d-encode__hint">Bấm avatar để xem chi tiết</span>
      </div>
    </div>
  )
}
