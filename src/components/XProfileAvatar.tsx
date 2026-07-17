import { useEffect, useMemo, useState } from 'react'
import { initials, xAvatarUrl } from '../lib/avatar'

interface Props {
  handle: string
  name: string
  size?: number
  className?: string
}

function upgradeTwimg(url: string): string {
  return url
    .replace('_normal.', '_400x400.')
    .replace('_bigger.', '_400x400.')
    .replace('_mini.', '_400x400.')
    .split('?')[0]
}

async function fetchLiveAvatarUrl(handle: string): Promise<string | null> {
  const h = handle.replace(/^@/, '').trim()
  for (const host of ['api.fxtwitter.com', 'api.vxtwitter.com']) {
    try {
      const res = await fetch(`https://${host}/${encodeURIComponent(h)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const data = (await res.json()) as {
        user?: Record<string, unknown>
        avatar_url?: string
      }
      const user = data.user || (data as Record<string, unknown>)
      const img =
        (user.avatar_url as string) ||
        (user.profile_image_url_https as string) ||
        (user.avatar as string) ||
        data.avatar_url ||
        ''
      if (img && /^https?:\/\//i.test(img)) return upgradeTwimg(img)
    } catch {
      /* try next */
    }
  }
  return null
}

/**
 * Avatar for arbitrary X handles (smart/recent follows, etc.).
 * Live fxtwitter → R2 cache → unavatar → initials.
 */
export function XProfileAvatar({
  handle,
  name,
  size = 40,
  className = '',
}: Props) {
  const clean = handle.replace(/^@/, '').trim()
  const [liveUrl, setLiveUrl] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  const sources = useMemo(() => {
    const list: string[] = []
    if (liveUrl) list.push(liveUrl)
    list.push(
      xAvatarUrl(clean),
      `/avatars/${encodeURIComponent(clean)}.jpg`,
      `https://unavatar.io/twitter/${encodeURIComponent(clean)}`,
      `https://unavatar.io/x/${encodeURIComponent(clean)}`,
    )
    return list
  }, [clean, liveUrl])

  useEffect(() => {
    setIdx(0)
    setFailed(false)
    setLiveUrl(null)
    let cancelled = false
    void (async () => {
      const url = await fetchLiveAvatarUrl(clean)
      if (!cancelled && url) {
        setLiveUrl(url)
        setIdx(0)
        setFailed(false)
      }
    })()
    return () => {
      cancelled = true
    }
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
