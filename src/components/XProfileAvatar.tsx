import { useEffect, useMemo, useRef, useState } from 'react'
import {
  initials,
  xAvatarTextureUrl,
  xAvatarUrl,
} from '../lib/avatar'

interface Props {
  handle: string
  name: string
  size?: number
  className?: string
  /**
   * After R2/unavatar fail, try live fxtwitter once.
   * Default false — long lists (TwitterScore 1k+) must not hammer live API.
   */
  liveFallback?: boolean
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
 * Avatar for arbitrary X handles (TwitterScore, smart/recent follows, etc.).
 * Order: R2 public → same-origin /r2 proxy → static /avatars → unavatar
 * → optional live fxtwitter → initials.
 *
 * Avatars are expected on R2 at radar/avatars/{handle}.jpg (warm via
 * scripts/warm_twitterscore_avatars.mjs or PUT /api/avatar).
 */
export function XProfileAvatar({
  handle,
  name,
  size = 40,
  className = '',
  liveFallback = false,
}: Props) {
  const clean = handle.replace(/^@/, '').trim()
  const [liveUrl, setLiveUrl] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const triedLive = useRef(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const sources = useMemo(() => {
    const list: string[] = [
      // Prefer durable R2 cache (warmed by admin scripts)
      xAvatarUrl(clean),
      xAvatarTextureUrl(clean),
      `/avatars/${encodeURIComponent(clean)}.jpg`,
      // Live proxy CDN fallbacks
      `https://unavatar.io/x/${encodeURIComponent(clean)}`,
      `https://unavatar.io/twitter/${encodeURIComponent(clean)}`,
    ]
    if (liveUrl) list.push(liveUrl)
    return [...new Set(list)]
  }, [clean, liveUrl])

  useEffect(() => {
    setIdx(0)
    setFailed(false)
    setLiveUrl(null)
    setStatus('loading')
    triedLive.current = false
  }, [clean])

  useEffect(() => {
    const el = imgRef.current
    if (!el) return
    if (el.complete && el.naturalWidth > 0) setStatus('ready')
  }, [idx, sources])

  const tryLiveThenFail = async () => {
    if (!liveFallback || triedLive.current) {
      setFailed(true)
      setStatus('error')
      return
    }
    triedLive.current = true
    const url = await fetchLiveAvatarUrl(clean)
    if (url) {
      setLiveUrl(url)
      setIdx(0)
      setFailed(false)
      setStatus('loading')
      return
    }
    setFailed(true)
    setStatus('error')
  }

  if (failed || (idx >= sources.length && !liveUrl)) {
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
    <span
      className={`x-profile-avatar-wrap ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        position: 'relative',
        flexShrink: 0,
      }}
      title={`@${clean}`}
    >
      {status === 'loading' && (
        <span
          className="avatar-skeleton"
          style={{ width: size, height: size, borderRadius: '50%' }}
          aria-hidden
        />
      )}
      <img
        key={sources[idx] ?? clean}
        ref={imgRef}
        className={`x-profile-avatar ${className}`}
        src={sources[idx]}
        alt={`@${clean}`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setStatus('ready')}
        onError={() => {
          if (idx + 1 < sources.length) {
            setIdx((i) => i + 1)
            setStatus('loading')
            return
          }
          void tryLiveThenFail()
        }}
        style={{
          width: size,
          height: size,
          opacity: status === 'ready' ? 1 : 0,
          position: status === 'ready' ? 'relative' : 'absolute',
          inset: 0,
        }}
      />
    </span>
  )
}
