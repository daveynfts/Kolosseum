import { useState } from 'react'
import { initials, xAvatarUrl } from '../lib/avatar'

interface Props {
  handle: string
  name: string
  className?: string
  size?: number
  color?: string
}

/** DOM avatar from R2 CDN. Falls back to initials. */
export function AvatarImg({
  handle,
  name,
  className = '',
  size = 40,
  color = '#64748b',
}: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={`avatar-fallback ${className}`}
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 30% 30%, ${color}, #0f172a 75%)`,
          fontSize: size * 0.34,
        }}
        title={`@${handle}`}
      >
        {initials(name)}
      </div>
    )
  }

  return (
    <img
      className={`avatar-img ${className}`}
      src={xAvatarUrl(handle)}
      alt={`@${handle}`}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
    />
  )
}
