/**
 * Wire surfReportPdfUrl for KOLs when a public R2 PDF exists.
 * Strict matching — no fuzzy "capital" / "research" false positives.
 *
 *   node scripts/sync_surf_pdfs.mjs
 *   node scripts/sync_surf_pdfs.mjs --apply
 *   node scripts/sync_surf_pdfs.mjs --apply --fix-existing
 */
import fs from 'fs'
import { adminPutJson } from './lib/adminPut.mjs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DEFAULT_BASE =
  'https://pub-8288264395e64bebab09946b5bc0b740.r2.dev'

function loadEnv(file) {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1)
    if (v && (!process.env[k] || process.env[k] === '')) process.env[k] = v
  }
}
loadEnv('.env.local')
loadEnv('.env.production.local')

const apply = process.argv.includes('--apply')
const fixExisting = process.argv.includes('--fix-existing')
const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
const api = (
  process.env.RADAR_API_BASE || 'https://radar.daveynfts.com'
).replace(/\/$/, '')
const pubBase = (
  process.env.R2_PUBLIC_BASE_URL ||
  process.env.R2_PUBLIC_URL ||
  DEFAULT_BASE
).replace(/\/$/, '')

const headCache = new Map()

async function urlOk(url) {
  if (headCache.has(url)) return headCache.get(url)
  try {
    let r = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (r.status === 403 || r.status === 405 || r.status === 400) {
      r = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-16' },
        redirect: 'follow',
      })
    }
    const ok = r.ok || r.status === 206
    headCache.set(url, ok)
    return ok
  } catch {
    headCache.set(url, false)
    return false
  }
}

function publicUrl(rel) {
  return `${pubBase}/${rel
    .replace(/^\//, '')
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')}`
}

/**
 * Explicit relative path → handle (case-insensitive).
 * Only these (and strict handle-in-filename probes) are auto-wired.
 */
const EXPLICIT = [
  [
    'RadarKOLsReport/SurfAI_KOL_Analysis_Report_mingli0x_2026-07-15.pdf',
    'mingli0x',
  ],
  [
    'RadarKOLsReport/ThuanCapital_KOL_Evaluation_Report.pdf',
    'ThuanCapital',
  ],
  [
    'RadarKOLsReport/BaoCao_PhanTich_KOL_EmilyVuong_SurfAI_2026-07.pdf',
    'emilyyvuong',
  ],
  ['BaoCao_KOL_LeninUGReal_Premium_20260710.pdf', 'LeninUGReal'],
  [
    'RadarKOLsReport/BaoCao_PhanTich_KOL_LensMoso_SurfAI.pdf',
    'LensMoso',
  ],
  [
    'RadarKOLsReport/SurfAI_KOL_Report_Lecter_XFinance_20260715.pdf',
    'Lecter_XFinance',
  ],
  [
    'RadarKOLsReport/SurfAI_KOL_Evaluation_Steven_Research_15072026.pdf',
    'Steven_Research',
  ],
  [
    'RadarKOLsReport/SurfAI_KOL_Report_TriMaiMS_15072026.pdf',
    'TriMaiMS',
  ],
  ['Yiwi.pdf', 'YiwiJR'],
  [
    'RadarKOLsReport/SurfAI_KOL_Evaluation_Report_phamduydong179.pdf',
    'phamduydong179',
  ],
  [
    'RadarKOLsReport/SurfAI_BaoCao_PhanTich_KOL_bachkhoabnb_20260715.pdf',
    'bachkhoabnb',
  ],
  [
    'RadarKOLsReport/SurfAI_PhanTich_KOL_TranThanh_Report_2026-07-15.pdf',
    'tranthanhbk',
  ],
  [
    'RadarKOLsReport/BaoCao_DanhGia_KOL_mintt_34_SurfAI.pdf',
    'mintt_34',
  ],
  [
    'RadarKOLsReport/SurfAI_KOL_Evaluation_TradeCoinVN_20260716.pdf',
    'TCVNcommunity',
  ],
  [
    'RadarKOLsReport/Bao_cao_Danh_gia_KOL_NickyPham_HC_SurfAI_Grok.docx',
    'NickyPham_HC',
  ],
  [
    'RadarKOLsReport/Bao_cao_Danh_gia_KOL_NickyPham_HC_SurfAI_Grok.pdf',
    'NickyPham_HC',
  ],
  // optional alternates (same handles)
  ['BaoCao_KOL_YiwiJR_Premium_20260710.pdf', 'YiwiJR'],
  [
    'RadarKOLsReport/BaoCao_KOL_YiwiJR_Premium_20260710.pdf',
    'YiwiJR',
  ],
]

/** Per-handle extra candidate paths (probed only for that handle) */
function extraCandidates(handle) {
  const h = handle.replace(/^@/, '').trim()
  return [
    `RadarKOLsReport/SurfAI_KOL_Evaluation_Report_${h}.pdf`,
    `RadarKOLsReport/SurfAI_KOL_Report_${h}_15072026.pdf`,
    `RadarKOLsReport/SurfAI_KOL_Report_${h}_20260715.pdf`,
    `RadarKOLsReport/SurfAI_KOL_Report_${h}.pdf`,
    `RadarKOLsReport/SurfAI_KOL_Analysis_Report_${h}_2026-07-15.pdf`,
    `RadarKOLsReport/SurfAI_KOL_Analysis_Report_${h}.pdf`,
    `RadarKOLsReport/SurfAI_BaoCao_PhanTich_KOL_${h}_20260715.pdf`,
    `RadarKOLsReport/BaoCao_PhanTich_KOL_${h}_SurfAI.pdf`,
    `RadarKOLsReport/BaoCao_DanhGia_KOL_${h}_SurfAI.pdf`,
    `RadarKOLsReport/BaoCao_KOL_${h}_Premium_20260710.pdf`,
    `BaoCao_KOL_${h}_Premium_20260710.pdf`,
    `RadarKOLsReport/${h}_KOL_Evaluation_Report.pdf`,
    `RadarKOLsReport/${h}.pdf`,
    `${h}.pdf`,
  ]
}

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () =>
      worker(),
    ),
  )
  return out
}

async function main() {
  const get = await fetch(`${api}/api/kols?t=${Date.now()}`, {
    cache: 'no-store',
  })
  if (!get.ok) throw new Error(`GET /api/kols ${get.status}`)
  const payload = await get.json()
  const kols = payload.kols || []
  const byH = new Map(kols.map((k) => [String(k.handle).toLowerCase(), k]))
  console.log('KOLs', kols.length, 'pubBase', pubBase)

  /** handleLower -> url */
  const found = new Map()

  console.log('Probing explicit PDF → handle map…')
  await mapPool(EXPLICIT, 10, async ([rel, handle]) => {
    const url = publicUrl(rel)
    if (!(await urlOk(url))) return
    const h = handle.toLowerCase()
    if (!byH.has(h)) {
      console.log('  HIT orphan (no KOL)', handle, rel)
      return
    }
    // Prefer first hit; later alternates only if empty
    if (!found.has(h)) {
      found.set(h, url)
      console.log('  HIT', handle, '←', rel)
    }
  })

  // Probe handle-specific patterns for KOLs still missing
  const missing = kols.filter(
    (k) => !found.has(String(k.handle).toLowerCase()),
  )
  console.log(`\nProbing handle-named paths for ${missing.length} KOLs…`)
  await mapPool(missing, 6, async (k) => {
    const h = String(k.handle)
    for (const rel of extraCandidates(h)) {
      const url = publicUrl(rel)
      if (await urlOk(url)) {
        found.set(h.toLowerCase(), url)
        console.log('  HIT', h, '←', rel)
        return
      }
    }
  })

  if (fixExisting) {
    console.log('\nRevalidating existing URLs…')
    for (const k of kols) {
      const cur = (k.surfReportPdfUrl || '').trim()
      if (!cur) continue
      const ok = await urlOk(cur)
      const h = String(k.handle).toLowerCase()
      if (!ok) {
        console.log('  BROKEN', k.handle, cur)
        // allow found[] replacement if any
      } else if (!found.has(h)) {
        found.set(h, cur)
      }
    }
  } else {
    // Keep existing live values if already set
    for (const k of kols) {
      const cur = (k.surfReportPdfUrl || '').trim()
      const h = String(k.handle).toLowerCase()
      if (cur && !found.has(h)) found.set(h, cur)
    }
  }

  const toSet = []
  const alreadyOk = []
  const stillMissing = []

  for (const k of kols) {
    const h = String(k.handle).toLowerCase()
    const cur = (k.surfReportPdfUrl || '').trim()
    const want = found.get(h)
    if (want) {
      if (cur === want) alreadyOk.push(k.handle)
      else toSet.push({ handle: k.handle, from: cur || null, to: want })
    } else {
      stillMissing.push(k.handle)
    }
  }

  console.log('\n=== SUMMARY ===')
  console.log('Already OK:', alreadyOk.length)
  console.log('Will SET/UPDATE:', toSet.length)
  toSet.forEach((x) =>
    console.log(
      `  ${x.handle}: ${x.from ? 'UPDATE' : 'SET'} → ${x.to.replace(pubBase, '…')}`,
    ),
  )
  console.log('Still missing (no PDF on public R2):', stillMissing.length)

  const report = {
    generatedAt: new Date().toISOString(),
    pubBase,
    alreadyOk,
    toSet,
    stillMissing,
  }
  fs.writeFileSync(
    path.join(ROOT, 'data/surf-pdf-sync-report.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
  console.log('Wrote data/surf-pdf-sync-report.json')

  if (!apply) {
    console.log('\nDry-run. Re-run with --apply to publish.')
    return
  }
  if (!token) {
    console.error('FEED_ADMIN_TOKEN missing')
    process.exit(1)
  }
  if (!toSet.length) {
    console.log('Nothing to apply.')
    return
  }

  for (const x of toSet) {
    const k = byH.get(x.handle.toLowerCase())
    if (k) k.surfReportPdfUrl = x.to
  }
  payload.updatedAt = new Date().toISOString()
  payload.note = `admin · sync_surf_pdfs (${toSet.length} urls)`
  payload.source = 'admin server · sync_surf_pdfs'
  payload.count = kols.length

  const put = await adminPutJson(`${api}/api/kols`, token, payload)
  const body = await put.json().catch(() => ({}))
  console.log('PUT', put.status, body)
  if (!put.ok) process.exit(1)

  fs.writeFileSync(
    path.join(ROOT, 'data/kols-server-snapshot.json'),
    JSON.stringify(payload, null, 2) + '\n',
  )
  patchSheetKols(toSet)
  console.log('Done.')
}

function patchSheetKols(toSet) {
  const sheetPath = path.join(ROOT, 'src/data/sheetKols.ts')
  if (!fs.existsSync(sheetPath)) return
  let text = fs.readFileSync(sheetPath, 'utf8')
  let n = 0
  for (const x of toSet) {
    const handle = x.handle
    const pos = text.indexOf(`"handle": "${handle}"`)
    if (pos < 0) {
      console.log('  sheet skip', handle)
      continue
    }
    const nextId = text.indexOf('\n  {\n    "id":', pos + 1)
    const end = nextId > 0 ? nextId : text.length
    const region = text.slice(pos, end)
    const pdfJson = JSON.stringify(x.to)
    let region2
    if (/"surfReportPdfUrl"\s*:/.test(region)) {
      region2 = region.replace(
        /"surfReportPdfUrl"\s*:\s*"[^"]*"/,
        `"surfReportPdfUrl": ${pdfJson}`,
      )
    } else {
      const m =
        region.match(/("isTop30"\s*:\s*(?:true|false))/) ||
        region.match(/("hidden"\s*:\s*(?:true|false))/) ||
        region.match(/("activity7dSource"\s*:\s*"[^"]+")/) ||
        region.match(/("dataSource"\s*:\s*"[^"]+")/)
      if (!m) {
        console.log('  sheet insert fail', handle)
        continue
      }
      region2 = region.replace(
        m[1],
        `${m[1]},\n    "surfReportPdfUrl": ${pdfJson}`,
      )
    }
    text = text.slice(0, pos) + region2 + text.slice(end)
    n++
  }
  fs.writeFileSync(sheetPath, text)
  console.log('sheetKols patched', n)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
