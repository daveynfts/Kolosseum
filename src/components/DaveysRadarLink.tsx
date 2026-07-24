/**
 * Brand link to the public Radar map.
 */
import type { ReactNode } from 'react'

export const DAVEY_RADAR_URL = 'https://radar.daveynfts.com/'

type Props = {
  /** Full visible text; default "Davey's Radar" */
  children?: ReactNode
  className?: string
  title?: string
}

export function DaveysRadarLink({
  children = "Davey's Radar",
  className = '',
  title = "Mở Davey's Radar",
}: Props) {
  return (
    <a
      href={DAVEY_RADAR_URL}
      target="_blank"
      rel="noreferrer"
      className={`scex-davey-link ${className}`.trim()}
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  )
}
