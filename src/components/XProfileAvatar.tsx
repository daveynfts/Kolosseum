import { useEffect, useMemo, useRef, useState } from 'react'
import {
  initials,
  resolveMediaUrl,
  xAvatarUrlCandidates,
} from '../lib/avatar'
import { isSafeImageUrl } from '../lib/safeUrl'
import './XProfileAvatar.css'

interface Props {
  handle: string
  name: string
  avatarUrl?: string
  size?: number
  className?: string
  /**
   * After R2/unavatar fail, try live fxtwitter once. Lookups are capped
   * globally (see LIVE_MAX_* below), so a long list degrades to initials
   * rather than hammering the live API.
   * Default false — leave it off for lists that are expected to miss in bulk.
   */
  liveFallback?: boolean
  /** Limit large avatar grids so research API requests retain browser connections. */
  bulkLoad?: boolean
}

const BULK_IMAGE_MAX_CONCURRENT = 3
let bulkImagesInFlight = 0
const bulkImageWaiters: Array<() => void> = []

function queueBulkImage(start: () => void): () => void {
  let active = false
  let cancelled = false
  const begin = () => {
    if (cancelled) return
    active = true
    bulkImagesInFlight += 1
    start()
  }
  if (bulkImagesInFlight < BULK_IMAGE_MAX_CONCURRENT) begin()
  else bulkImageWaiters.push(begin)
  return () => {
    if (cancelled) return
    cancelled = true
    if (!active) {
      const index = bulkImageWaiters.indexOf(begin)
      if (index >= 0) bulkImageWaiters.splice(index, 1)
      return
    }
    bulkImagesInFlight -= 1
    while (bulkImageWaiters.length && bulkImagesInFlight < BULK_IMAGE_MAX_CONCURRENT) {
      bulkImageWaiters.shift()!()
    }
  }
}

function upgradeTwimg(url: string): string {
  return url
    .replace('_normal.', '_400x400.')
    .replace('_bigger.', '_400x400.')
    .replace('_mini.', '_400x400.')
    .split('?')[0]
}

/**
 * Live lookups are the last resort for avatars missing from R2. The SCEX
 * matrix renders 300+ bubbles at once, so an unbounded stampede would
 * rate-limit fxtwitter exactly the way it already rate-limits unavatar.
 * Cap concurrency and total lookups per page load; past the cap we show
 * initials instead of queueing requests that would 429 anyway.
 */
const LIVE_MAX_CONCURRENT = 3
const LIVE_MAX_PER_PAGELOAD = 60
let liveInFlight = 0
let liveStarted = 0
const liveWaiters: Array<() => void> = []

async function acquireLiveSlot(): Promise<boolean> {
  if (liveStarted >= LIVE_MAX_PER_PAGELOAD) return false
  liveStarted += 1
  if (liveInFlight < LIVE_MAX_CONCURRENT) {
    liveInFlight += 1
    return true
  }
  // Slot is handed over directly by releaseLiveSlot, so inFlight stays put.
  await new Promise<void>((resolve) => liveWaiters.push(resolve))
  return true
}

function releaseLiveSlot(): void {
  const next = liveWaiters.shift()
  if (next) {
    next()
    return
  }
  liveInFlight -= 1
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
  avatarUrl,
  size = 40,
  className = '',
  liveFallback = false,
  bulkLoad = false,
}: Props) {
  const clean = handle.replace(/^@/, '').trim()
  const [liveUrl, setLiveUrl] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const triedLive = useRef(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const releaseImageRef = useRef<(() => void) | null>(null)
  const [queuedSrc, setQueuedSrc] = useState<string | null>(null)

  const sources = useMemo(() => {
    // R2 keys are case-sensitive (Lecter_XFinance.jpg ≠ lecter_xfinance.jpg).
    // Try casing variants + same-origin /r2 proxy, then unavatar, then optional live.
    const preferred = avatarUrl
      ? /^https?:\/\//i.test(avatarUrl) ? avatarUrl : resolveMediaUrl(avatarUrl)
      : ''
    const list: string[] = [
      ...(isSafeImageUrl(preferred) ? [preferred] : []),
      ...xAvatarUrlCandidates(clean),
      `/avatars/${encodeURIComponent(clean)}.jpg`,
      `/avatars/${encodeURIComponent(clean.toLowerCase())}.jpg`,
      // Live proxy CDN fallbacks
      `https://unavatar.io/x/${encodeURIComponent(clean)}`,
      `https://unavatar.io/twitter/${encodeURIComponent(clean)}`,
      `https://unavatar.io/x/${encodeURIComponent(clean.toLowerCase())}`,
    ]
    if (liveUrl) list.push(liveUrl)
    return [...new Set(list.filter(Boolean))]
  }, [clean, avatarUrl, liveUrl])

  useEffect(() => {
    setIdx(0)
    setFailed(false)
    setLiveUrl(null)
    setStatus('loading')
    triedLive.current = false
  }, [clean, avatarUrl])

  const src = sources[idx] || null
  useEffect(() => {
    if (!bulkLoad || !src) return
    setQueuedSrc(null)
    const release = queueBulkImage(() => setQueuedSrc(src))
    releaseImageRef.current = release
    return () => {
      release()
      if (releaseImageRef.current === release) releaseImageRef.current = null
    }
  }, [bulkLoad, src])

  useEffect(() => {
    const el = imgRef.current
    if (!el) return
    if (el.complete && el.naturalWidth > 0) {
      releaseImageRef.current?.()
      setStatus('ready')
    }
  }, [idx, sources, queuedSrc])

  const tryLiveThenFail = async () => {
    if (!liveFallback || triedLive.current) {
      setFailed(true)
      setStatus('error')
      return
    }
    triedLive.current = true
    if (!(await acquireLiveSlot())) {
      setFailed(true)
      setStatus('error')
      return
    }
    let url: string | null = null
    try {
      url = await fetchLiveAvatarUrl(clean)
    } finally {
      releaseLiveSlot()
    }
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
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
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
        borderRadius: '50%',
        overflow: 'hidden',
      }}
      title={`@${clean}`}
    >
      {status === 'loading' && (
        <span
          className="x-profile-avatar__placeholder"
          style={{ fontSize: size * 0.32 }}
          aria-hidden
        >
          {initials(name || clean)}
        </span>
      )}
      {(!bulkLoad || queuedSrc === src) && <img
        key={sources[idx] ?? clean}
        ref={imgRef}
        className={`x-profile-avatar ${className}`}
        src={sources[idx]}
        alt={`@${clean}`}
        width={size}
        height={size}
        loading={bulkLoad ? 'eager' : 'lazy'}
        fetchPriority={bulkLoad ? 'low' : undefined}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => {
          releaseImageRef.current?.()
          setStatus('ready')
        }}
        onError={() => {
          releaseImageRef.current?.()
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
          borderRadius: '50%',
          objectFit: 'cover',
          objectPosition: 'center',
          opacity: status === 'ready' ? 1 : 0,
          position: status === 'ready' ? 'relative' : 'absolute',
          inset: 0,
        }}
      />}
    </span>
  )
}
