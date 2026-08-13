import { STATUS_COLORS, STATUS_LABELS, type StatusLabel } from '../types'
import './RankBadge.css'

interface Props {
  status: StatusLabel
  /** sm = icon + label, pip = icon only */
  size?: 'sm' | 'pip'
  className?: string
}

export function StatusBadge({
  status,
  size = 'sm',
  className = '',
}: Props) {
  const color = STATUS_COLORS[status]
  const label = STATUS_LABELS[status]

  if (size === 'pip') {
    return (
      <span
        className={`rank-pip rank-pip--${status} ${className}`}
        style={{ ['--rank' as string]: color }}
        title={label}
        aria-label={label}
      >
        <StatusMark status={status} />
      </span>
    )
  }

  return (
    <span
      className={`rank-badge rank-badge--sm rank-badge--${status} ${className}`}
      style={{ ['--rank' as string]: color }}
      title={label}
    >
      <StatusMark status={status} />
      <span className="rank-badge__label">{label}</span>
    </span>
  )
}

function StatusMark({ status }: { status: StatusLabel }) {
  const svgProps = {
    className: 'rank-mark' as const,
    viewBox: '0 0 24 24',
    width: 14,
    height: 14,
    fill: 'none' as const,
    'aria-hidden': true as const,
  }
  if (status === 'hot') {
    return (
      <svg {...svgProps}>
        <path
          d="M12 3.15c1.35 2.45 3.55 4.2 3.55 7.35 0 .72-.16 1.38-.44 1.95 1.28-.42 2.14-1.6 2.14-3.05 1.18 1.28 1.9 2.95 1.9 4.85 0 3.42-2.82 5.85-6.15 5.85S6.85 17.67 6.85 14.25c0-2.7 1.62-4.72 2.95-6.45C10.7 6.55 11.55 4.85 12 3.15z"
          fill="currentColor"
        />
        <path
          d="M12 13.55c1.12 0 1.95.82 1.95 1.92S13.12 17.4 12 17.4s-1.95-.83-1.95-1.93.83-1.92 1.95-1.92z"
          fill="#fff"
          opacity="0.42"
        />
      </svg>
    )
  }
  if (status === 'active') {
    return (
      <svg {...svgProps}>
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.38"
        />
        <path
          d="M13.35 4.4 7.85 13.15h3.45L10.15 19.7 16.4 10.4h-3.4z"
          fill="currentColor"
        />
      </svg>
    )
  }
  if (status === 'stable') {
    return (
      <svg {...svgProps}>
        <circle
          cx="12"
          cy="12"
          r="8.25"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="12" cy="12" r="3.15" fill="currentColor" />
        <circle cx="12" cy="12" r="1.15" fill="#fff" opacity="0.45" />
      </svg>
    )
  }
  if (status === 'quiet') {
    return (
      <svg {...svgProps}>
        <path
          d="M14.05 4.85A7.2 7.2 0 1 0 18.4 15.7 6.15 6.15 0 1 1 14.05 4.85z"
          fill="currentColor"
        />
      </svg>
    )
  }
  return (
    <svg {...svgProps}>
      <circle
        cx="12"
        cy="12"
        r="8.25"
        stroke="currentColor"
        strokeWidth="1.55"
        opacity="0.5"
      />
      <rect x="8.1" y="7.55" width="2.4" height="8.9" rx="0.9" fill="currentColor" />
      <rect
        x="13.5"
        y="7.55"
        width="2.4"
        height="8.9"
        rx="0.9"
        fill="currentColor"
      />
    </svg>
  )
}
