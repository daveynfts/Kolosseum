/**
 * Human relative time for Smart Followers / feed-style labels.
 * Prefer ISO `followedAt`; caller supplies static fallback when missing.
 */
export function formatRelativeAgo(
  iso: string | undefined | null,
  fallback = '',
  nowMs: number = Date.now(),
): string {
  if (!iso) return fallback
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return fallback

  let diff = nowMs - t
  // Future timestamps (clock skew) → treat as just now
  if (diff < 0) diff = 0

  const sec = Math.floor(diff / 1000)
  if (sec < 45) return 'just now'

  const min = Math.floor(sec / 60)
  if (min < 60) return min === 1 ? '1 minute ago' : `${min} minutes ago`

  const hr = Math.floor(min / 60)
  if (hr < 48) return hr === 1 ? '1 hour ago' : `${hr} hours ago`

  const day = Math.floor(hr / 24)
  if (day < 30) return day === 1 ? '1 day ago' : `${day} days ago`

  const month = Math.floor(day / 30)
  if (month < 12) {
    return month === 1 ? 'a month ago' : `${month} months ago`
  }

  const year = Math.floor(day / 365)
  return year <= 1 ? 'a year ago' : `${year} years ago`
}
