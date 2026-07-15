import { useEffect, useMemo, useRef, useState } from 'react'
import {
  initials,
  xAvatarTextureUrl,
  xAvatarUrl,
} from '../lib/avatar'

interface Props {
  handle: string
  name: string
  className?: string
  size?: number
  color?: string
}

/**
 * DOM avatar from R2 CDN.
 * - Prefer direct public R2 URL (no crossOrigin — R2 public bucket has no CORS yet)
 * - On failure, retry same-origin /r2/* proxy rewrite
 * - Loading: soft skeleton; permanent error: neutral initials
 */
export function AvatarImg({
  handle,
  name,
  className = '',
  size = 40,
  color = '#64748b',
}: Props) {
  const sources = useMemo(() => {
    const clean = handle.replace(/^@/, '').trim()
    return [
      // Deployed static first (always same-origin, works when R2 public 403)
      `/avatars/${encodeURIComponent(clean)}.jpg`,
      // R2 CDN + same-origin proxy rewrite
      xAvatarUrl(clean),
      xAvatarTextureUrl(clean),
      // Live X proxy fallbacks
      `https://unavatar.io/x/${encodeURIComponent(clean)}`,
      `https://unavatar.io/twitter/${encodeURIComponent(clean)}`,
    ]
  }, [handle])
  const [srcIndex, setSrcIndex] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const imgRef = useRef<HTMLImageElement | null>(null)
  const src = sources[srcIndex] ?? sources[0]

  useEffect(() => {
    setSrcIndex(0)
    setStatus('loading')
  }, [handle])

  // Cached images may already be complete before onLoad attaches
  useEffect(() => {
    const el = imgRef.current
    if (!el) return
    if (el.complete && el.naturalWidth > 0) {
      setStatus('ready')
    }
  }, [src, srcIndex])

  if (status === 'error') {
    return (
      <div
        className={`avatar-fallback avatar-fallback--error ${className}`}
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 30% 30%, ${color}55, #0f172a 75%)`,
          fontSize: size * 0.32,
        }}
        title={`@${handle}`}
      >
        {initials(name)}
      </div>
    )
  }

  return (
    <span
      className={`avatar-wrap ${className}`}
      style={{ width: size, height: size }}
      title={`@${handle}`}
    >
      {status === 'loading' && (
        <span
          className="avatar-skeleton"
          style={{ width: size, height: size }}
          aria-hidden
        />
      )}
      <img
        key={src}
        ref={imgRef}
        className="avatar-img"
        src={src}
        alt={`@${handle}`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setStatus('ready')}
        onError={() => {
          if (srcIndex + 1 < sources.length) {
            setSrcIndex((i) => i + 1)
            setStatus('loading')
            return
          }
          setStatus('error')
        }}
        style={{
          width: size,
          height: size,
          opacity: status === 'ready' ? 1 : 0,
          position: status === 'ready' ? 'relative' : 'absolute',
          inset: status === 'ready' ? undefined : 0,
        }}
      />
    </span>
  )
}
