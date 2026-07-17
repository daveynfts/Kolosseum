import { useEffect, useMemo, useState } from 'react'
import {
  getRecentFollowers,
  getSmartFollowers,
  type RecentFollower,
  type SmartFollower,
} from '../data/recentFollowers'
import {
  loadRecentFollowersWithSource,
  RECENT_FOLLOWERS_EVENT,
} from '../lib/recentFollowersStore'
import { formatRelativeAgo } from '../lib/relativeTime'
import { XProfileAvatar } from './XProfileAvatar'

interface Props {
  kolHandle: string
}

type SubTab = 'recent' | 'smart'

export function RecentFollowersPanel({ kolHandle }: Props) {
  const [recent, setRecent] = useState(() => getRecentFollowers(kolHandle))
  const [smart, setSmart] = useState(() => getSmartFollowers(kolHandle))
  const [subTab, setSubTab] = useState<SubTab>('smart')
  /** Tick so relative labels recompute as time passes */
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const refresh = () => {
      setRecent(getRecentFollowers(kolHandle))
      setSmart(getSmartFollowers(kolHandle))
    }
    refresh()
    void loadRecentFollowersWithSource().then(() => refresh())
    window.addEventListener(RECENT_FOLLOWERS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(RECENT_FOLLOWERS_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [kolHandle])

  useEffect(() => {
    // Prefer Smart when available; else Recent
    if (getSmartFollowers(kolHandle).length > 0) setSubTab('smart')
    else if (getRecentFollowers(kolHandle).length > 0) setSubTab('recent')
  }, [kolHandle])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const activeCount = subTab === 'smart' ? smart.length : recent.length
  const empty = recent.length === 0 && smart.length === 0

  const sortedSmart = useMemo(
    () =>
      [...smart].sort(
        (a, b) => (b.influenceScore ?? 0) - (a.influenceScore ?? 0),
      ),
    [smart],
  )

  if (empty) {
    return (
      <div className="recent-follows">
        <p className="recent-follows__empty">
          Chưa có snapshot Smart / Recent followers cho @
          {kolHandle.replace(/^@/, '')}.
        </p>
      </div>
    )
  }

  return (
    <div className="recent-follows">
      <div className="recent-follows__head">
        <h3 className="recent-follows__title">
          Smart Followers
          <span className="recent-follows__count">({activeCount})</span>
        </h3>
        <p className="recent-follows__sub">
          {subTab === 'smart'
            ? 'Tài khoản chất lượng cao đang follow KOL'
            : 'Ai follow KOL gần đây'}
        </p>
      </div>

      <div className="recent-follows__subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'smart'}
          className={`recent-follows__subtab ${subTab === 'smart' ? 'is-active' : ''}`}
          onClick={() => setSubTab('smart')}
          disabled={smart.length === 0}
        >
          Smart Followers
          {smart.length > 0 && (
            <span className="recent-follows__subtab-n">{smart.length}</span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'recent'}
          className={`recent-follows__subtab ${subTab === 'recent' ? 'is-active' : ''}`}
          onClick={() => setSubTab('recent')}
          disabled={recent.length === 0}
        >
          Recent Followers
          {recent.length > 0 && (
            <span className="recent-follows__subtab-n">{recent.length}</span>
          )}
        </button>
      </div>

      {subTab === 'smart' ? (
        sortedSmart.length === 0 ? (
          <p className="recent-follows__empty">
            Chưa có Smart Followers cho account này.
          </p>
        ) : (
          <ul className="recent-follows__list recent-follows__list--smart">
            {sortedSmart.map((f, i) => (
              <SmartFollowerRow key={f.handle} f={f} rank={i + 1} />
            ))}
          </ul>
        )
      ) : recent.length === 0 ? (
        <p className="recent-follows__empty">
          Chưa có Recent Followers cho account này.
        </p>
      ) : (
        <ul className="recent-follows__list">
          {recent.map((f) => {
            const handle = f.handle.replace(/^@/, '')
            const xUrl = `https://x.com/${handle}`
            const ago = formatFollowerAgo(f, now)
            return (
              <li key={handle} className="recent-follows__item">
                <a
                  className="recent-follows__link"
                  href={xUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open @${handle} on X`}
                >
                  <XProfileAvatar
                    handle={handle}
                    name={f.displayName}
                    size={40}
                    className="recent-follows__avatar"
                  />
                  <span className="recent-follows__meta">
                    <span className="recent-follows__name">
                      {f.displayName}
                    </span>
                    <span className="recent-follows__handle">@{handle}</span>
                  </span>
                  <time
                    className="recent-follows__ago"
                    dateTime={f.followedAt || undefined}
                    title={
                      f.followedAt
                        ? new Date(f.followedAt).toLocaleString()
                        : f.followedAgo
                    }
                  >
                    {ago}
                  </time>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SmartFollowerRow({
  f,
  rank,
}: {
  f: SmartFollower
  rank: number
}) {
  const handle = f.handle.replace(/^@/, '')
  const xUrl = `https://x.com/${handle}`
  const score =
    f.influenceScore != null && Number.isFinite(f.influenceScore)
      ? f.influenceScore
      : null
  const followers =
    f.followers != null && Number.isFinite(f.followers) ? f.followers : null

  return (
    <li className="recent-follows__item">
      <a
        className="recent-follows__link recent-follows__link--smart"
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open @${handle} on X`}
      >
        <span className="recent-follows__rank" aria-hidden>
          {rank}
        </span>
        <XProfileAvatar
          handle={handle}
          name={f.displayName}
          size={40}
          className="recent-follows__avatar"
        />
        <span className="recent-follows__meta">
          <span className="recent-follows__name">{f.displayName}</span>
          <span className="recent-follows__handle">@{handle}</span>
          {f.role ? (
            <span className="recent-follows__role">{f.role}</span>
          ) : null}
        </span>
        <span className="recent-follows__stats">
          {followers != null && (
            <span className="recent-follows__stat" title="Followers">
              {formatCompact(followers)}
              <em> fol</em>
            </span>
          )}
          {score != null && (
            <span
              className={`recent-follows__stat recent-follows__stat--score ${score <= 0 ? 'is-zero' : ''}`}
              title="Điểm ảnh hưởng"
            >
              {score.toLocaleString('en-US', {
                maximumFractionDigits: 2,
                minimumFractionDigits: score % 1 === 0 ? 0 : 2,
              })}
            </span>
          )}
        </span>
      </a>
    </li>
  )
}

function formatFollowerAgo(f: RecentFollower, nowMs: number): string {
  return formatRelativeAgo(f.followedAt, f.followedAgo || '', nowMs)
}

function formatCompact(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}
