/**
 * Luma-sourced copy (titles, hosts, venues, HTML descriptions) must never
 * keep decorative theme fonts. Those faces lack Vietnamese glyphs, so
 * accents fall back to a second font (split-font / "broken" look).
 *
 * Live R2 JSON has also stored UTF-8 Vietnamese as CP437/OEM-US glyphs
 * (`Nguyß╗àn` → `Nguyễn`). Repair that on read so the map does not wait
 * on a republish.
 */

export const VN_FONT_STACK =
  "'Be Vietnam Pro', 'Noto Sans', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"

const LUMA_FONT_HINT =
  /snpro|sn-pro|new-spirit|newspirit|roc-grotesk|museo(?:-slab)?|geist-mono|font_title|--title-font/i

/**
 * Unicode for CP437 bytes 0x80–0xFF (IBM PC / Windows OEM-US).
 * UTF-8 misread as this page looks like `ß╗à`, `├ù`, `ΓÇö`.
 */
const CP437_HIGH = [
  0x00c7, 0x00fc, 0x00e9, 0x00e2, 0x00e4, 0x00e0, 0x00e5, 0x00e7, 0x00ea,
  0x00eb, 0x00e8, 0x00ef, 0x00ee, 0x00ec, 0x00c4, 0x00c5, 0x00c9, 0x00e6,
  0x00c6, 0x00f4, 0x00f6, 0x00f2, 0x00fb, 0x00f9, 0x00ff, 0x00d6, 0x00dc,
  0x00a2, 0x00a3, 0x00a5, 0x20a7, 0x0192, 0x00e1, 0x00ed, 0x00f3, 0x00fa,
  0x00f1, 0x00d1, 0x00aa, 0x00ba, 0x00bf, 0x2310, 0x00ac, 0x00bd, 0x00bc,
  0x00a1, 0x00ab, 0x00bb, 0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561,
  0x2562, 0x2556, 0x2555, 0x2563, 0x2551, 0x2557, 0x255d, 0x255c, 0x255b,
  0x2510, 0x2514, 0x2534, 0x252c, 0x251c, 0x2500, 0x253c, 0x255e, 0x255f,
  0x255a, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256c, 0x2567, 0x2568,
  0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256b, 0x256a, 0x2518,
  0x250c, 0x2588, 0x2584, 0x258c, 0x2590, 0x2580, 0x03b1, 0x00df, 0x0393,
  0x03c0, 0x03a3, 0x03c3, 0x00b5, 0x03c4, 0x03a6, 0x0398, 0x03a9, 0x03b4,
  0x221e, 0x03c6, 0x03b5, 0x2229, 0x2261, 0x00b1, 0x2265, 0x2264, 0x2320,
  0x2321, 0x00f7, 0x2248, 0x00b0, 0x2219, 0x00b7, 0x221a, 0x207f, 0x00b2,
  0x25a0, 0x00a0,
] as const

const CP437_TO_BYTE = new Map<number, number>(
  CP437_HIGH.map((cp, i) => [cp, 0x80 + i]),
)

/** Box drawing / CP437 leftovers never appear in real Conviction copy. */
export function looksLikeCp437Mojibake(s: string): boolean {
  return /[\u2500-\u259F]/.test(s) || /ß[╗║╝]/.test(s) || /ΓÇ/.test(s)
}

/**
 * Reverse “UTF-8 bytes shown as CP437”: `22B Nguyß╗àn Thß╗ï Diß╗çu`
 * → `22B Nguyễn Thị Diệu`. No-op on already-correct Vietnamese.
 */
export function repairCp437Utf8Mojibake(s: string): string {
  if (!s || !looksLikeCp437Mojibake(s)) return s
  const bytes: number[] = []
  for (const ch of s) {
    const cp = ch.codePointAt(0)
    if (cp == null) return s
    if (cp < 0x80) {
      bytes.push(cp)
      continue
    }
    const b = CP437_TO_BYTE.get(cp)
    if (b == null) return s
    bytes.push(b)
  }
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(bytes),
    )
    return decoded || s
  } catch {
    return s
  }
}

/**
 * UTF-8 interpreted as Latin-1/Windows-1252 (`Nguyá»…n` → `Nguyễn`).
 * Only runs on high-bit Latin-1 sequences; skips real Vietnamese.
 */
export function repairLatin1Utf8Mojibake(s: string): string {
  if (!s || /[\u1EA0-\u1EF9]/.test(s)) return s
  if (!/[ÃÂá][\u0080-\u00BF»º]/.test(s)) return s
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c > 255) return s
    bytes[i] = c
  }
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return decoded || s
  } catch {
    return s
  }
}

export function repairUtf8Mojibake(s: string): string {
  return repairLatin1Utf8Mojibake(repairCp437Utf8Mojibake(s))
}

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
  s = repairUtf8Mojibake(s)
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function looksLikeLumaThemeFont(value: unknown): boolean {
  return typeof value === 'string' && LUMA_FONT_HINT.test(value)
}

/** Recursively repair string fields (R2 GET/PUT payloads). */
export function repairJsonStrings<T>(value: T): T {
  if (typeof value === 'string') return repairUtf8Mojibake(value) as T
  if (Array.isArray(value)) {
    return value.map((item) => repairJsonStrings(item)) as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[key] = repairJsonStrings(nested)
    }
    return out as T
  }
  return value
}
