/**
 * SCEX mention matrix — 2D packed plot (volume × quality).
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ScexActor, ScexConfig } from '../data/scexTracking'
import { actorMatrixPos, actorSizeValue } from '../data/scexTracking'
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

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

function packBubbles(
  actors: ScexActor[],
  config: ScexConfig,
  width: number,
  height: number,
  maxSize: number,
): BubbleLayout[] {
  if (!actors.length || width < 40 || height < 40) return []
  const pad = 14
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

  return (
    <div className="scex2d-wrap">
      <div className="scex-matrix__plot scex2d-plot" ref={plotRef}>
        <div className="scex-matrix__quad scex-matrix__quad--nurture">
          <strong>{q.nurture?.title}</strong>
          <small>{q.nurture?.subtitle}</small>
        </div>
        <div className="scex-matrix__quad scex-matrix__quad--stars">
          <strong>{q.stars?.title}</strong>
          <small>{q.stars?.subtitle}</small>
        </div>
        <div className="scex-matrix__quad scex-matrix__quad--ignore">
          <strong>{q.ignore?.title}</strong>
          <small>{q.ignore?.subtitle}</small>
        </div>
        <div className="scex-matrix__quad scex-matrix__quad--noise">
          <strong>{q.noise?.title}</strong>
          <small>{q.noise?.subtitle}</small>
        </div>

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
                title={`@${a.handle} · V${a.postsVolume} · Q${a.qualityScore} · ${formatCompact(a.followers)}${onMap ? ' · Map' : ''}`}
                onClick={() =>
                  onSelect(selectedId === a.id ? null : a)
                }
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
      <div className="scex-matrix__axis-x">
        {config.volumeAxis.label || 'Số lần nhắc'} →
      </div>
      <div className="scex-matrix__axis-y">
        ↑ {config.qualityAxis.label || 'Chất lượng'}
      </div>
    </div>
  )
}
