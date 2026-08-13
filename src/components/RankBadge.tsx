import {
  getKolRank,
  RANK_COLORS,
  RANK_LABELS,
  RANK_SHORT,
  type KolRank,
} from '../types'
import './RankBadge.css'

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
  const rank = getKolRank({ tier, score, isTop30, rank: rankProp })
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
  const svgProps = {
    className: 'rank-mark' as const,
    viewBox: '0 0 24 24',
    width: 14,
    height: 14,
    fill: 'none' as const,
    'aria-hidden': true as const,
  }
  if (rank === 'challenger') {
    return (
      <svg {...svgProps}>
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="1.15"
          opacity="0.42"
        />
        <path
          d="M12 3.2 13.55 9.1 19.6 10.2 14.9 14.15 16.3 20.3 12 16.95 7.7 20.3 9.1 14.15 4.4 10.2 10.45 9.1Z"
          fill="currentColor"
          opacity="0.95"
        />
        <circle cx="12" cy="12.4" r="2.15" fill="currentColor" />
        <circle cx="12" cy="12.4" r="0.85" fill="#fff" opacity="0.55" />
      </svg>
    )
  }
  if (rank === 'master') {
    return (
      <svg {...svgProps}>
        <path
          d="M4.6 16.6 5.4 8.6l3.4 3.6L12 6.2l3.2 6 3.4-3.6.8 8Z"
          fill="currentColor"
          opacity="0.92"
        />
        <rect
          x="4.4"
          y="16.2"
          width="15.2"
          height="2.35"
          rx="0.7"
          fill="currentColor"
        />
        <circle cx="12" cy="6.15" r="1.55" fill="currentColor" />
        <circle cx="12" cy="6.15" r="0.55" fill="#fff" opacity="0.55" />
      </svg>
    )
  }
  if (rank === 'diamond') {
    return (
      <svg {...svgProps}>
        <path
          d="M12 3.1 20.2 10.2 12 21 3.8 10.2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M3.8 10.2h16.4"
          stroke="currentColor"
          strokeWidth="1.25"
          opacity="0.75"
        />
        <path
          d="M7.4 10.2 12 3.1l4.6 7.1L12 21Z"
          fill="currentColor"
          opacity="0.28"
        />
        <path
          d="M12 3.1 8.2 10.2 12 21"
          stroke="currentColor"
          strokeWidth="0.9"
          opacity="0.45"
        />
      </svg>
    )
  }
  if (rank === 'platinum') {
    return (
      <svg {...svgProps}>
        <path
          d="M12 3.15 19.4 7.4v9.2L12 20.85 4.6 16.6V7.4Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M12 7.05 16.35 9.55v5.05L12 17.1 7.65 14.6V9.55Z"
          fill="currentColor"
          opacity="0.32"
        />
        <path
          d="M12 7.05 16.35 9.55v5.05L12 17.1 7.65 14.6V9.55Z"
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinejoin="round"
          opacity="0.7"
        />
      </svg>
    )
  }
  return (
    <svg {...svgProps}>
      <circle
        cx="12"
        cy="12"
        r="8.35"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="12"
        cy="12"
        r="5.7"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.5"
      />
      <path
        d="M12 7.15 13.15 10.4l3.5.28-2.68 2.22.82 3.4L12 14.55 9.21 16.3l.82-3.4-2.68-2.22 3.5-.28Z"
        fill="currentColor"
      />
    </svg>
  )
}
