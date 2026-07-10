import { useEffect, useState } from 'react'
import { initials, xAvatarUrl } from '../lib/avatar'

interface Props {
  handle: string
  name: string
  className?: string
  size?: number
  color?: string
}

/**
 * DOM avatar from R2 CDN.
 * Loading: soft skeleton (no letter). Error: neutral initials only as last resort.
 */
export function AvatarImg({
  handle,
  name,
  className = '',
  size = 40,
  color = '#64748b',
}: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const src = xAvatarUrl(handle)

  // Reset when handle changes
  useEffect(() => {
    setStatus('loading')
  }, [handle, src])

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
    >
      {status === 'loading' && (
        <span
          className="avatar-skeleton"
          style={{ width: size, height: size }}
          aria-hidden
        />
      )}
      <img
        className="avatar-img"
        src={src}
        alt={`@${handle}`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
        style={{
          width: size,
          height: size,
          opacity: status === 'ready' ? 1 : 0,
          position: status === 'ready' ? 'relative' : 'absolute',
        }}
      />
    </span>
  )
}
