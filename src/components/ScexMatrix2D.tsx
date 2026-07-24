/**
 * SCEX mention matrix — Story 2D (volume × quality).
 * Scroll-to-zoom; transient % HUD; zoom spreads + enlarges bubbles.
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
  /** @deprecated FAB is always visible */
  showZoomControls?: boolean
}

type BubbleLayout = {
  id: string
  /** Base layout position (zoom=1, before spread) */
  bx: number
  by: number
  /** Screen position after zoom spread + pan */
  x: number
  y: number
  r: number
  z: number
  depth: number
}

/** Discrete zoom steps — higher = more spread */
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

/**
 * Place bubbles at matrix positions then push apart so they don't stack.
 * `gapBoost` grows with zoom so zoom-in leaves more air between avatars.
 */
function packBubbles(
  actors: ScexActor[],
  config: ScexConfig,
  width: number,
  height: number,
  maxSize: number,
  gapBoost = 1,
): Array<{
  id: string
  x: number
  y: number
  r: number
  depth: number
  followers: number
  quality: number
}> {
  if (!actors.length || width < 40 || height < 40) return []
  const pad = 24
  const items = actors.map((a) => {
    const { x, y } = actorMatrixPos(a, config)
    const r = 16 + (actorSizeValue(a, config) / maxSize) * 22
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

  const gap = 8 + 10 * Math.max(0, gapBoost - 1)
  const iters = Math.round(40 + 20 * Math.min(gapBoost, 2.5))

  for (let iter = 0; iter < iters; iter++) {
    const strength = 0.55 * (1 - iter / iters) + 0.12
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.01
        const minDist = a.r + b.r + gap
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
    // Soft pull back to true matrix anchor so spread doesn't destroy meaning
    const anchorPull = 0.035 / Math.sqrt(gapBoost)
    for (let i = 0; i < items.length; i++) {
      const a = actors[i]
      const { x, y } = actorMatrixPos(a, config)
      const r = items[i].r
      const ax = pad + r + x * Math.max(1, width - 2 * pad - 2 * r)
      const ay = pad + r + (1 - y) * Math.max(1, height - 2 * pad - 2 * r)
      items[i].x += (ax - items[i].x) * anchorPull
      items[i].y += (ay - items[i].y) * anchorPull
      items[i].x = clamp(items[i].x, r + pad, width - r - pad)
      items[i].y = clamp(items[i].y, r + pad, height - r - pad)
    }
  }

  return items
}

/**
 * Zoom-in: positions spread from center AND avatar radius grows so faces
 * read clearer (not smaller). Then de-overlap in screen space.
 */
function layoutWithZoom(
  packed: ReturnType<typeof packBubbles>,
  width: number,
  height: number,
  zoom: number,
  pan: { x: number; y: number },
): BubbleLayout[] {
  if (!packed.length || width < 1 || height < 1) return []
  const cx = width / 2
  const cy = height / 2
  // Avatar grows with zoom (cap so they don't eat the whole plot)
  const sizeScale = clamp(zoom, 0.75, 2.4)

  const items = packed.map((p) => {
    const x = cx + (p.x - cx) * zoom + pan.x
    const y = cy + (p.y - cy) * zoom + pan.y
    const r = Math.min(p.r * sizeScale, 52)
    return {
      id: p.id,
      bx: p.x,
      by: p.y,
      x,
      y,
      r,
      depth: p.depth,
      quality: p.quality,
      followers: p.followers,
    }
  })

  // De-overlap with larger bodies — gap scales with zoom too
  const gap = 8 + 12 * Math.max(0, zoom - 1)
  const iters = Math.round(28 + 20 * Math.max(0, zoom - 0.75))
  for (let iter = 0; iter < iters; iter++) {
    const strength = 0.55 * (1 - iter / iters) + 0.12
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.01
        const minDist = a.r + b.r + gap
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
  }

  const margin = zoom > 1 ? 100 * (zoom - 1) : 0
  for (const it of items) {
    it.x = clamp(it.x, it.r - margin, width - it.r + margin)
    it.y = clamp(it.y, it.r - margin, height - it.r + margin)
  }

  return items
    .map((it) => ({
      id: it.id,
      bx: it.bx,
      by: it.by,
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
}: ScexMatrix2DProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [plotSize, setPlotSize] = useState({ w: 0, h: 0 })
  const [zoomI, setZoomI] = useState(DEFAULT_ZOOM_I)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [showStoryTip, setShowStoryTip] = useState(false)
  /** Brief zoom % toast (auto-hide ~2s) */
  const [zoomHudVisible, setZoomHudVisible] = useState(false)
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
  const zoomHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashZoomHud = useCallback(() => {
    setZoomHudVisible(true)
    if (zoomHudTimerRef.current) clearTimeout(zoomHudTimerRef.current)
    zoomHudTimerRef.current = setTimeout(() => {
      setZoomHudVisible(false)
      zoomHudTimerRef.current = null
    }, 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (zoomHudTimerRef.current) clearTimeout(zoomHudTimerRef.current)
    }
  }, [])

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
      // Spread content extends ~ (z-1)/2 * size from center
      const maxX = ((z - 1) * w) / 2 + 40
      const maxY = ((z - 1) * h) / 2 + 40
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
      if (i === zoomI && !focus) {
        flashZoomHud()
        return
      }
      const el = plotRef.current
      const w = el?.clientWidth || plotSize.w
      const h = el?.clientHeight || plotSize.h
      const oldZ = zoomRef.current
      const newZ = ZOOM_STEPS[i]
      const oldPan = panRef.current

      if (newZ === 1) {
        setZoomI(i)
        setPan({ x: 0, y: 0 })
        flashZoomHud()
        return
      }

      if (focus && w > 0 && h > 0 && oldZ > 0) {
        // Keep point under cursor roughly stable while spreading
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
      flashZoomHud()
    },
    [clampPanTo, plotSize.w, plotSize.h, zoomI, flashZoomHud],
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
    goZoom(zoomI + dir, focus)
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

  // Base pack at 1× with mild gap; zoom spread happens in layoutWithZoom
  const packed = useMemo(
    () =>
      packBubbles(actors, config, plotSize.w, plotSize.h, maxSize, 1),
    [actors, config, plotSize.w, plotSize.h, maxSize],
  )

  const layout = useMemo(
    () => layoutWithZoom(packed, plotSize.w, plotSize.h, zoom, pan),
    [packed, plotSize.w, plotSize.h, zoom, pan],
  )

  const actorById = useMemo(
    () => new Map(actors.map((a) => [a.id, a])),
    [actors],
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

  return (
    <div className="scex2d-root scex2d-root--story">
      {showStoryTip && (
        <div className="scex2d-story-tip" role="status">
          <div className="scex2d-story-tip__body">
            <strong>Cách đọc nhanh</strong>
            <p>
              Góc <em>trên-phải</em> = ưu tiên cao. Cuộn chuột để zoom (avatar
              to hơn khi phóng). Bấm avatar để xem KOL.
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
            onDoubleClick={() => goZoom(DEFAULT_ZOOM_I)}
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

            {/*
              Background: never shrink below 1× (fixes empty corners at 75%).
              Only expand + pan when zoomed in so washes still fill the plot.
            */}
            <div
              className="scex2d-zoom-layer scex2d-zoom-layer--bg"
              style={{
                transform:
                  zoom >= 1
                    ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                    : 'none',
              }}
              aria-hidden
            >
              <div className="scex2d-wash scex2d-wash--nurture" />
              <div className="scex2d-wash scex2d-wash--stars" />
              <div className="scex2d-wash scex2d-wash--ignore" />
              <div className="scex2d-wash scex2d-wash--noise" />
              <div
                className="scex2d-crosshair scex2d-crosshair--split"
                style={
                  {
                    ['--split-x' as string]: `${splitXPct}%`,
                    ['--split-y' as string]: `${splitYFromTopPct}%`,
                  } as CSSProperties
                }
              />
            </div>

            {/* Bubbles: spread positions in JS (not CSS-scaled) so they open up */}
            <div className="scex-matrix__stage scex-matrix__stage--spread">
              {layout.map((b) => {
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

            {/* Transient zoom % — 2s then fade (does not block UI) */}
            <div
              className={`scex2d-zoom-hud ${zoomHudVisible ? 'is-on' : ''}`}
              aria-live="polite"
              aria-hidden={!zoomHudVisible}
            >
              {zoomPct}%
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
        <span className="scex2d-encode__hint">
          Cuộn = zoom · kéo nền khi &gt;100%
        </span>
      </div>
    </div>
  )
}
