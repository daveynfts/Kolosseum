/**
 * Top event banner — assets from phocaptaisanso.com / @scexofficial.
 * Ref link for partner attribution.
 */
import { withBase } from '../lib/base'

const REF_URL = 'https://phocaptaisanso.com/r/Z7ii209XQTExj9Xd'

function asset(path: string) {
  return withBase(`/scex-banner/${path}`)
}

export function ScexEventBanner() {
  return (
    <a
      className="scex-event-banner"
      href={REF_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Đấu trường Tài sản mã hóa — đăng ký SCEX Simulator"
    >
      <span
        className="scex-event-banner__bg"
        style={{ backgroundImage: `url(${asset('x-banner.jpg')})` }}
        aria-hidden
      />
      <span className="scex-event-banner__shade" aria-hidden />

      <span className="scex-event-banner__inner">
        <img
          className="scex-event-banner__logo"
          src={asset('scex-logo.png')}
          alt="SCEX"
          width={120}
          height={36}
          decoding="async"
        />
        <span className="scex-event-banner__divider" aria-hidden />
        <span className="scex-event-banner__copy">
          <span className="scex-event-banner__kicker">
            <img
              src={asset('medal.svg')}
              alt=""
              width={16}
              height={16}
              className="scex-event-banner__medal"
            />
            Đấu trường Tài sản mã hóa
          </span>
          <span className="scex-event-banner__desc">
            Học · thực chiến trên{' '}
            <img
              className="scex-event-banner__wordmark"
              src={asset('scex-wordmark.svg')}
              alt="SCEX"
              height={14}
            />{' '}
            Simulator · 5.000+ giải · 1,6+ tỷ đồng
          </span>
        </span>
        <span className="scex-event-banner__cta">
          Vào đấu trường
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
    </a>
  )
}
