import { useEffect, useState } from 'react'
import { getRecentFollowers } from '../data/recentFollowers'
import { RECENT_FOLLOWERS_EVENT } from '../lib/recentFollowersStore'
import { XProfileAvatar } from './XProfileAvatar'

interface Props {
  kolHandle: string
}

export function RecentFollowersPanel({ kolHandle }: Props) {
  const [list, setList] = useState(() => getRecentFollowers(kolHandle))

  useEffect(() => {
    const refresh = () => setList(getRecentFollowers(kolHandle))
    refresh()
    window.addEventListener(RECENT_FOLLOWERS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(RECENT_FOLLOWERS_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [kolHandle])

  if (list.length === 0) {
    return (
      <div className="recent-follows">
        <p className="recent-follows__empty">
          Chưa có snapshot recent followers cho @{kolHandle.replace(/^@/, '')}.
        </p>
      </div>
    )
  }

  return (
    <div className="recent-follows">
      <div className="recent-follows__head">
        <h3 className="recent-follows__title">
          Recent Followers
          <span className="recent-follows__count">({list.length})</span>
        </h3>
        <p className="recent-follows__sub">Smart Followers gần đây</p>
      </div>

      <ul className="recent-follows__list">
        {list.map((f) => {
          const handle = f.handle.replace(/^@/, '')
          const xUrl = `https://x.com/${handle}`
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
                  <span className="recent-follows__name">{f.displayName}</span>
                  <span className="recent-follows__handle">@{handle}</span>
                </span>
                <span className="recent-follows__ago">{f.followedAgo}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
