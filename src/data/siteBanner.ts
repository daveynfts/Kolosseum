import { withBase } from '../lib/base'

export interface SiteBannerConfig {
  version: number
  kind: 'site-banner'
  updatedAt?: string
  enabled: boolean
  href: string
  eyebrow: string
  title: string
  subtitle: string
  pill: string
  cta: string
  ariaLabel?: string
  logoUrl?: string
  artUrl?: string
  note?: string
  baseUpdatedAt?: string
}

export const LOCAL_BANNER_LOGO = '/scex-banner/scex-logo.png'
export const LOCAL_BANNER_ART = '/scex-banner/x-banner.jpg'

/** Logo lockup on the 76px ribbon (contain, ~36×128). Upload @2x. */
export const BANNER_LOGO_SPEC = {
  ratio: '4:1',
  width: 320,
  height: 80,
  format: 'PNG / WebP, nền trong suốt',
  hint: 'Lockup ngang. Trên ribbon cao 36px, rộng tối đa 128px — đừng nhồi chữ dọc.',
} as const

/**
 * Campaign art fills the right ~half of a 76px-tall ribbon (cover crop).
 * Keep the subject in the right two-thirds; the left edge fades into the wash.
 */
export const BANNER_ART_SPEC = {
  ratio: '4:1',
  width: 1600,
  height: 400,
  format: 'JPEG / WebP',
  hint: 'Chủ thể nằm nửa phải. Nửa trái sẽ mờ vào nền chữ. Tránh text trên ảnh.',
  objectPosition: '70% 35%',
} as const

/** Soft limits so copy fits the fixed-height ribbon without ellipsis. */
export const BANNER_COPY_LIMITS = {
  eyebrow: 42,
  title: 40,
  subtitle: 56,
  pill: 28,
  cta: 24,
} as const

export const SITE_BANNER_SEED: SiteBannerConfig = {
  version: 1,
  kind: 'site-banner',
  enabled: true,
  href: 'https://phocaptaisanso.com/r/Z7ii209XQTExj9Xd',
  eyebrow: 'Đối tác · Trading Simulator',
  title: 'Đấu trường Tài sản mã hóa',
  subtitle: 'Giao dịch mô phỏng · 5.000+ giải · quỹ thưởng 1,6+ tỷ đồng',
  pill: 'nhận ngay 1 tỷ VND',
  cta: 'Tham gia chương trình',
  ariaLabel:
    'SCEX — Đấu trường Tài sản mã hóa. Mở trang đăng ký Simulator',
}

export function normalizeSiteBanner(raw: unknown): SiteBannerConfig {
  const seed = SITE_BANNER_SEED
  if (!raw || typeof raw !== 'object') return { ...seed }
  const o = raw as Record<string, unknown>
  const str = (k: string, fallback: string) => {
    const v = o[k]
    return typeof v === 'string' && v.trim() ? v.trim() : fallback
  }
  return {
    version: typeof o.version === 'number' ? o.version : 1,
    kind: 'site-banner',
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined,
    enabled: o.enabled === false ? false : true,
    href: str('href', seed.href),
    eyebrow: str('eyebrow', seed.eyebrow),
    title: str('title', seed.title),
    subtitle: str('subtitle', seed.subtitle),
    pill: str('pill', seed.pill),
    cta: str('cta', seed.cta),
    ariaLabel: str('ariaLabel', seed.ariaLabel || ''),
    logoUrl: typeof o.logoUrl === 'string' ? o.logoUrl.trim() : '',
    artUrl: typeof o.artUrl === 'string' ? o.artUrl.trim() : '',
    note: typeof o.note === 'string' ? o.note : undefined,
  }
}

export function resolveBannerLogo(config: SiteBannerConfig): string {
  if (config.logoUrl?.trim()) return config.logoUrl
  return withBase(LOCAL_BANNER_LOGO)
}

export function resolveBannerArt(config: SiteBannerConfig): string {
  if (config.artUrl?.trim()) return config.artUrl
  return withBase(LOCAL_BANNER_ART)
}
