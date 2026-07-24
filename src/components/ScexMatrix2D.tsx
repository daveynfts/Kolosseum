/**
 * SCEX mention matrix — 2D packed plot (volume × quality).
 * Quadrant labels outside plot; zoom + pan for closer inspection.
 */
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import type { ScexActor, ScexConfig } from '../data/scexTracking'
import {
  actorMatrixPos,
  actorSizeValue,
  actorVolumeMetric,
} from '../data/scexTracking'
import { XProfileAvatar } from './XProfileAvatar'

export type ScexMatrix2DProps = {
  actors: ScexActor[]
  config: ScexConfig
  selectedId: string | null
  mapHandles: Set<string>
  onSelect: (actor: ScexActor | null) => void
}

type BubbleLayout = {
  id: string
  x: number
  y: number
  r: number
  z: number
  depth: number
}

const ZOOM_MIN = 0.7
const ZOOM_MAX = 2.8
const ZOOM_STEP = 0.15

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
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
}: ScexMatrix2DProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [plotSize, setPlotSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{
    active: boolean
    pid: number
    sx: number
    sy: number
    ox: number
    oy: number
    moved: boolean
  } | null>(null)

  useLayoutEffect(() => {
    const el = plotRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setPlotSize({ w: rect.width, h: rect.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [actors.length])

  // Reset pan when zoom returns to 1
  const setZoomClamped = useCallback((next: number | ((z: number) => number)) => {
    setZoom((z) => {
      const v = typeof next === 'function' ? next(z) : next
      const nz = clamp(Math.round(v * 100) / 100, ZOOM_MIN, ZOOM_MAX)
      if (nz <= 1.02) {
        setPan({ x: 0, y: 0 })
        return nz <= 1 ? 1 : nz
      }
      return nz
    })
  }, [])

  const clampPan = useCallback(
    (px: number, py: number, z: number) => {
      if (z <= 1 || !plotSize.w) return { x: 0, y: 0 }
      const maxX = ((z - 1) * plotSize.w) / 2 + 40
      const maxY = ((z - 1) * plotSize.h) / 2 + 40
      return {
        x: clamp(px, -maxX, maxX),
        y: clamp(py, -maxY, maxY),
      }
    },
    [plotSize.w, plotSize.h],
  )

  const onWheel = (e: ReactWheelEvent) => {
    // Ctrl/meta or trackpad pinch often sets ctrlKey; also allow plain wheel over plot
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1 - ZOOM_STEP * 0.7 : 1 + ZOOM_STEP * 0.7
    setZoomClamped((z) => z * factor)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    // Don't start pan on bubble click — bubbles stopPropagation
    if ((e.target as HTMLElement).closest('.scex-bubble')) return
    if (zoom <= 1.02) return
    const el = plotRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    dragRef.current = {
      active: true,
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: pan.x,
      oy: pan.y,
      moved: false,
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d?.active || d.pid !== e.pointerId) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (Math.hypot(dx, dy) > 4) d.moved = true
    setPan(clampPan(d.ox + dx, d.oy + dy, zoom))
  }

  const endDrag = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d || d.pid !== e.pointerId) return
    try {
      plotRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
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
  const q = config.quadrantLabels

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

  const zoomPct = Math.round(zoom * 100)

  return (
    <div className="scex2d-root">
      <div className="scex2d-zoombar" role="toolbar" aria-label="Zoom ma trận 2D">
        <button
          type="button"
          className="scex2d-zoombar__btn"
          title="Thu nhỏ"
          disabled={zoom <= ZOOM_MIN + 0.01}
          onClick={() => setZoomClamped((z) => z - ZOOM_STEP)}
        >
          −
        </button>
        <button
          type="button"
          className="scex2d-zoombar__pct"
          title="Đặt lại 100%"
          onClick={() => {
            setZoom(1)
            setPan({ x: 0, y: 0 })
          }}
        >
          {zoomPct}%
        </button>
        <button
          type="button"
          className="scex2d-zoombar__btn"
          title="Phóng to"
          disabled={zoom >= ZOOM_MAX - 0.01}
          onClick={() => setZoomClamped((z) => z + ZOOM_STEP)}
        >
          +
        </button>
        <span className="scex2d-zoombar__hint">
          Cuộn chuột zoom · Kéo nền để pan
        </span>
      </div>

      <div className="scex2d-stage">
        <div className="scex-frame-row scex-frame-row--top" aria-hidden>
          <span className="scex-frame-chip scex-frame-chip--nurture">
            {q.nurture?.title || 'TIỀM NĂNG'}
          </span>
          <span className="scex-frame-chip scex-frame-chip--stars">
            {q.stars?.title || 'TRỌNG ĐIỂM'}
          </span>
        </div>

        <div className="scex2d-plot-shell">
          <div
            className={`scex-matrix__plot scex2d-plot ${zoom > 1.02 ? 'is-zoomed' : ''}`}
            ref={plotRef}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
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
              <div className="scex2d-crosshair" aria-hidden />

              <div className="scex-matrix__stage">
                {packed.map((b) => {
                  const a = actorById.get(b.id)
                  if (!a) return null
                  const ring =
                    config.sentimentLabels[a.sentiment]?.color || '#94a3b8'
                  const diam = b.r * 2
                  const selected = selectedId === a.id
                  const onMap = mapHandles.has(a.handle.toLowerCase())
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={[
                        'scex-bubble',
                        selected ? 'is-selected' : '',
                        onMap ? 'is-on-map' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        left: b.x,
                        top: b.y,
                        width: diam,
                        height: diam,
                        borderColor: ring,
                        zIndex: selected ? 80 : b.z,
                        ['--depth' as string]: String(b.depth),
                        ['--ring' as string]: ring,
                      }}
                      title={`@${a.handle} · V${Math.round(actorVolumeMetric(a, config))} · Q${Math.round(a.qualityScore)} · raw ${a.postsVolume} · ${formatCompact(a.followers)}${a.mapRank ? ` · ${a.mapRank}` : onMap ? ' · Map' : ''}`}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        if (dragRef.current?.moved) return
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
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="scex-frame-row scex-frame-row--bottom" aria-hidden>
          <span className="scex-frame-chip scex-frame-chip--ignore">
            {q.ignore?.title || 'TÍN HIỆU YẾU'}
          </span>
          <span className="scex-frame-chip scex-frame-chip--noise">
            {q.noise?.title || 'CẦN RÀ SOÁT'}
          </span>
        </div>

        <div className="scex2d-axis-bar">
          <span className="scex2d-axis-bar__y">
            ↑ {config.qualityAxis.label || 'Điểm chất lượng'}
          </span>
          <span className="scex2d-axis-bar__x">
            {config.volumeAxis.label || 'Tần suất mention'} →
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
