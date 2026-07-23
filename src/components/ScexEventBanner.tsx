/**
 * Compact partner ribbon — formal, readable; photo as soft right accent only.
 * Assets: public/scex-banner (phocaptaisanso / @scexofficial).
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
      aria-label="SCEX — Đấu trường Tài sản mã hóa. Mở trang đăng ký Simulator"
    >
      {/* Soft brand wash (left → center) */}
      <span className="scex-event-banner__base" aria-hidden />

      {/* Official art — right panel only, masked so type stays crisp */}
      <span className="scex-event-banner__art" aria-hidden>
        <img
          src={asset('x-banner.jpg')}
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
            src={asset('scex-logo.png')}
            alt="SCEX"
            width={140}
            height={40}
            decoding="async"
          />
          <span className="scex-event-banner__meta">
            <span className="scex-event-banner__eyebrow">
              Đối tác · Trading Simulator
            </span>
            <span className="scex-event-banner__title">
              Đấu trường Tài sản mã hóa
            </span>
            <span className="scex-event-banner__sub">
              Giao dịch mô phỏng · 5.000+ giải · quỹ thưởng 1,6+ tỷ đồng
            </span>
          </span>
        </span>

        <span className="scex-event-banner__right">
          <span className="scex-event-banner__pills" aria-hidden>
            <span>Demo 1 tỷ VND</span>
            <span>VNĐ</span>
          </span>
          <span className="scex-event-banner__cta">
            Tham gia chương trình
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
