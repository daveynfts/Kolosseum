/**
 * Luma-sourced copy (titles, hosts, venues, HTML descriptions) must never
 * keep decorative theme fonts. Those faces lack Vietnamese glyphs, so
 * accents fall back to a second font (split-font / "broken" look).
 */

export const VN_FONT_STACK =
  "'Be Vietnam Pro', 'Noto Sans', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"

const LUMA_FONT_HINT =
  /snpro|sn-pro|new-spirit|newspirit|roc-grotesk|museo(?:-slab)?|geist-mono|font_title|--title-font/i

/** Drop inline / theme font-family so our Vietnamese stack wins. */
export function stripLumaFontStyles(html: string): string {
  if (!html) return ''
  return html
    .replace(/font-family\s*:\s*[^;}"']+;?/gi, '')
    .replace(/--title-font\s*:\s*[^;}"']+;?/gi, '')
    .replace(/\s*style\s*=\s*(['"])\s*;*\s*\1/gi, '')
}

function decodeHtmlEntities(s: string): string {
  if (!s.includes('&')) return s
  if (typeof document !== 'undefined') {
    const el = document.createElement('textarea')
    el.innerHTML = s
    return el.value
  }
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
}

/** Plain text for cards / pins. Strips Luma HTML + font-family if present. */
export function sanitizeLumaText(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let s = raw.replace(/^\uFEFF/, '').trim()
  if (!s) return ''
  const looksHtml =
    /<[a-z][\s\S]*>/i.test(s) ||
    /font-family|--title-font/i.test(s) ||
    LUMA_FONT_HINT.test(s)
  if (looksHtml) {
    s = stripLumaFontStyles(s)
    s = s.replace(/<br\s*\/?>/gi, '\n')
    s = s.replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
    s = s.replace(/<[^>]+>/g, '')
  }
  s = decodeHtmlEntities(s)
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function looksLikeLumaThemeFont(value: unknown): boolean {
  return typeof value === 'string' && LUMA_FONT_HINT.test(value)
}
