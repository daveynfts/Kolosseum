import {
  getKolRank,
  RANK_COLORS,
  RANK_LABELS,
  RANK_SHORT,
  type KolRank,
} from '../types'

interface Props {
  tier?: number
  score?: number
  isTop30?: boolean
  /** sm | short | md | pip (icon only) */
  size?: 'sm' | 'short' | 'md' | 'pip'
  className?: string
  /** Force rank (optional) */
  rank?: KolRank
}

/**
 * Subtle LoL-inspired rank badge for map / panels.
 * Geometric marks only — not official League assets.
 */
export function RankBadge({
  tier,
  score,
  isTop30,
  size = 'sm',
  className = '',
  rank: rankProp,
}: Props) {
  const rank = rankProp ?? getKolRank({ tier, score, isTop30 })
  const color = RANK_COLORS[rank]
  const label = size === 'short' ? RANK_SHORT[rank] : RANK_LABELS[rank]

  if (size === 'pip') {
    return (
      <span
        className={`rank-pip rank-pip--${rank} ${className}`}
        style={{ ['--rank' as string]: color }}
        title={RANK_LABELS[rank]}
        aria-label={RANK_LABELS[rank]}
      >
        <RankMark rank={rank} />
      </span>
    )
  }

  return (
    <span
      className={`rank-badge rank-badge--${size} rank-badge--${rank} ${className}`}
      style={{ ['--rank' as string]: color }}
      title={RANK_LABELS[rank]}
    >
      <RankMark rank={rank} />
      <span className="rank-badge__label">{label}</span>
    </span>
  )
}

function RankMark({ rank }: { rank: KolRank }) {
  // Minimal geometric marks — not official LoL assets
  if (rank === 'challenger') {
    return (
      <svg className="rank-mark" viewBox="0 0 16 16" aria-hidden>
        <path
          d="M8 1.5l1.6 3.6 3.9.4-2.9 2.6.9 3.8L8 10.2 4.5 12l.9-3.8L2.5 5.5l3.9-.4L8 1.5z"
          fill="currentColor"
          opacity="0.95"
        />
      </svg>
    )
  }
  if (rank === 'master') {
    return (
      <svg className="rank-mark" viewBox="0 0 16 16" aria-hidden>
        <path
          d="M3 12.5L4.2 5.5 8 8.2l3.8-2.7L13 12.5H3z"
          fill="currentColor"
          opacity="0.9"
        />
        <circle cx="8" cy="4" r="1.6" fill="currentColor" />
      </svg>
    )
  }
  if (rank === 'diamond') {
    return (
      <svg className="rank-mark" viewBox="0 0 16 16" aria-hidden>
        <path
          d="M8 1.8L13.5 6.2 8 14.2 2.5 6.2 8 1.8z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="M2.5 6.2h11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.7"
        />
      </svg>
    )
  }
  if (rank === 'platinum') {
    return (
      <svg className="rank-mark" viewBox="0 0 16 16" aria-hidden>
        <path
          d="M8 2.2L12.8 5.5 11 13.2H5L3.2 5.5 8 2.2z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  // gold
  return (
    <svg className="rank-mark" viewBox="0 0 16 16" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.85" />
    </svg>
  )
}
