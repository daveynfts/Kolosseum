import { useEffect, useMemo, useState } from 'react'
import { initials, xAvatarUrl } from '../lib/avatar'

interface Props {
  handle: string
  name: string
  size?: number
  className?: string
}

/**
 * Avatar for arbitrary X handles (recent follows, etc.).
 * Tries local/R2 cache → unavatar → initials.
 */
export function XProfileAvatar({
  handle,
  name,
  size = 40,
  className = '',
}: Props) {
  const clean = handle.replace(/^@/, '').trim()
  const sources = useMemo(
    () => [
      // Local deploy / R2 cache if we downloaded the avatar
      xAvatarUrl(clean),
      `/avatars/${encodeURIComponent(clean)}.jpg`,
      `https://unavatar.io/twitter/${encodeURIComponent(clean)}`,
      `https://unavatar.io/x/${encodeURIComponent(clean)}`,
    ],
    [clean],
  )
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setIdx(0)
    setFailed(false)
  }, [clean])

  if (failed || idx >= sources.length) {
    return (
      <div
        className={`x-profile-avatar x-profile-avatar--fallback ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.32,
        }}
        title={`@${clean}`}
      >
        {initials(name || clean)}
      </div>
    )
  }

  return (
    <img
      className={`x-profile-avatar ${className}`}
      src={sources[idx]}
      alt={`@${clean}`}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (idx + 1 < sources.length) setIdx((i) => i + 1)
        else setFailed(true)
      }}
      style={{ width: size, height: size }}
    />
  )
}
