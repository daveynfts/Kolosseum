/**
 * Partner event ribbon — loads config from R2 (Admin → Banner).
 */
import { useEffect, useState } from 'react'
import {
  resolveBannerArt,
  resolveBannerLogo,
  type SiteBannerConfig,
} from '../data/siteBanner'
import {
  getSiteBanner,
  loadSiteBannerWithSource,
  SITE_BANNER_EVENT,
} from '../lib/siteBannerStore'
import { safeHref } from '../lib/safeUrl'

export function SiteBannerRibbon({
  config,
  variant = 'ribbon',
}: {
  config: SiteBannerConfig
  variant?: 'ribbon' | 'overlay'
}) {
  if (!config.enabled) return null

  const logoUrl = resolveBannerLogo(config)
  const artUrl = resolveBannerArt(config)

  const href = safeHref(config.href)
  if (!href) return null

  const overlay = variant === 'overlay'

  return (
    <a
      className={`scex-event-banner${overlay ? ' scex-event-banner--overlay glass-regular' : ''}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        config.ariaLabel ||
        `${config.title}. ${config.cta}`
      }
    >
      <span className="scex-event-banner__base" aria-hidden />

      <span className="scex-event-banner__art" aria-hidden>
        <img
          src={artUrl}
          alt=""
          width={1500}
          height={500}
          decoding="async"
          fetchPriority="high"
        />
      </span>

      <span className="scex-event-banner__inner">
        <span className="scex-event-banner__left">
          <img
            className="scex-event-banner__logo"
            src={logoUrl}
            alt="Partner logo"
            width={140}
            height={40}
            decoding="async"
          />
          <span className="scex-event-banner__meta">
            <span className="scex-event-banner__eyebrow">{config.eyebrow}</span>
            <span className="scex-event-banner__title">{config.title}</span>
            <span className="scex-event-banner__sub">{config.subtitle}</span>
          </span>
        </span>

        <span className="scex-event-banner__right">
          {config.pill ? (
            <span className="scex-event-banner__pills" aria-hidden>
              <span>{config.pill}</span>
            </span>
          ) : null}
          <span className="scex-event-banner__cta">
            {config.cta}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </span>
      </span>
    </a>
  )
}

export function useSiteBanner(): SiteBannerConfig {
  const [config, setConfig] = useState(() => getSiteBanner())

  useEffect(() => {
    let cancelled = false
    void loadSiteBannerWithSource().then((r) => {
      if (!cancelled) setConfig(r.config)
    })
    const onUpdate = () => setConfig(getSiteBanner())
    window.addEventListener(SITE_BANNER_EVENT, onUpdate)
    return () => {
      cancelled = true
      window.removeEventListener(SITE_BANNER_EVENT, onUpdate)
    }
  }, [])

  return config
}

export function ScexEventBanner({
  variant = 'ribbon',
}: {
  variant?: 'ribbon' | 'overlay'
}) {
  const config = useSiteBanner()
  return <SiteBannerRibbon config={config} variant={variant} />
}
