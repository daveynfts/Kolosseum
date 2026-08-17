import { useEffect, useState } from 'react'
import {
  eventPublicPath,
  type EventEditionMeta,
} from '../data/eventEditions'
import { fetchEditionCatalog } from '../lib/convictionEventsStore'
import { applyEventHubSeo } from '../lib/eventMapSeo'
import { withBase } from '../lib/base'
import { useEventMapLocale } from '../lib/eventMapI18n'
import './EventHubPage.css'

function statusLabel(status: EventEditionMeta['status'], locale: 'vi' | 'en') {
  if (status === 'archive') return locale === 'en' ? 'Archive' : 'Lưu trữ'
  if (status === 'live') return locale === 'en' ? 'Live' : 'Đang diễn ra'
  return locale === 'en' ? 'Draft' : 'Nháp'
}

export function EventHubPage() {
  const { locale, setLocale } = useEventMapLocale()
  const [editions, setEditions] = useState<EventEditionMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    applyEventHubSeo(locale)
  }, [locale])

  useEffect(() => {
    let cancelled = false
    void fetchEditionCatalog().then((list) => {
      if (cancelled) return
      setEditions(list)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="ehub">
      <div className="ehub__hero">
        <p className="ehub__kicker">Davey's Radar · Event maps</p>
        <h1 className="ehub__title">
          {locale === 'en' ? 'Side-event maps' : 'Bản đồ side events'}
        </h1>
        <p className="ehub__lead">
          {locale === 'en'
            ? 'Each conference week lives at its own URL. Last year’s pins stay archived; next year starts a new map without overwriting the old one.'
            : 'Mỗi tuần sự kiện có URL riêng. Bản đồ năm trước được lưu trữ; năm sau mở map mới mà không ghi đè dữ liệu cũ.'}
        </p>
        <div className="ehub__lang" role="group" aria-label="Language">
          <button
            type="button"
            className={locale === 'vi' ? 'is-on' : ''}
            onClick={() => setLocale('vi')}
          >
            VI
          </button>
          <button
            type="button"
            className={locale === 'en' ? 'is-on' : ''}
            onClick={() => setLocale('en')}
          >
            EN
          </button>
        </div>
      </div>

      <ul className="ehub__grid">
        {loading && !editions.length ? (
          <li className="ehub__card ehub__card--ghost">
            {locale === 'en' ? 'Loading editions…' : 'Đang tải danh sách…'}
          </li>
        ) : null}
        {editions.map((ed) => (
          <li key={ed.slug}>
            <a className="ehub__card" href={eventPublicPath(ed.slug)}>
              <div className="ehub__card-top">
                {ed.logoUrl ? (
                  <img
                    className="ehub__logo"
                    src={withBase(ed.logoUrl)}
                    alt=""
                    width={140}
                    height={24}
                    decoding="async"
                  />
                ) : (
                  <span className="ehub__slug">{ed.slug}</span>
                )}
                <span className={`ehub__badge ehub__badge--${ed.status}`}>
                  {statusLabel(ed.status, locale)}
                </span>
              </div>
              <h2>{ed.title}</h2>
              <p>
                {locale === 'en'
                  ? ed.descriptionEn || ed.dateLabel
                  : ed.descriptionVi || ed.dateLabel}
              </p>
              <dl>
                {ed.dateLabel ? (
                  <>
                    <dt>{locale === 'en' ? 'Dates' : 'Ngày'}</dt>
                    <dd>{ed.dateLabel}</dd>
                  </>
                ) : null}
                {ed.venueName ? (
                  <>
                    <dt>{locale === 'en' ? 'Venue' : 'Địa điểm'}</dt>
                    <dd>
                      {ed.venueName}
                      {ed.city ? ` · ${ed.city}` : ''}
                    </dd>
                  </>
                ) : null}
              </dl>
              <span className="ehub__go">
                /event/{ed.slug} →
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className="ehub__foot">
        {locale === 'en'
          ? 'Next year: Admin → Events → Clone next year. The new map is stored at /event/<slug> and the previous edition stays readable.'
          : 'Năm sau: Admin → Events → Tạo năm sau. Map mới lưu tại /event/<slug>, edition cũ vẫn xem được.'}
      </p>
    </div>
  )
}
