/**
 * Compact top banner for SCEX simulator event + partner ref link.
 */
const REF_URL = 'https://phocaptaisanso.com/r/Z7ii209XQTExj9Xd'

export function ScexEventBanner() {
  return (
    <a
      className="scex-event-banner"
      href={REF_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="scex-event-banner__badge">SCEX</span>
      <span className="scex-event-banner__text">
        <strong>Đấu trường Tài sản mã hóa</strong>
        <span className="scex-event-banner__sep">·</span>
        Simulator — luyện trade, không lo cháy túi. Tham gia ngay
      </span>
      <span className="scex-event-banner__cta">Đăng ký ↗</span>
    </a>
  )
}
