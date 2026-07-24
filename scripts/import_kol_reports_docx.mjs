/**
 * Import SurfAI KOL report DOCX → plain text corpus on R2.
 *
 * Default folder:
 *   C:\Users\caokh\OneDrive\Documents\KOls Report Docx
 *
 *   node scripts/import_kol_reports_docx.mjs
 *   node scripts/import_kol_reports_docx.mjs --dir "D:/reports"
 *   node scripts/import_kol_reports_docx.mjs --put
 *   node scripts/import_kol_reports_docx.mjs --force   # re-import same filename
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mammoth from 'mammoth'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

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

const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
const base = (process.env.RADAR_API_BASE || 'https://radar.daveynfts.com').replace(
  /\/$/,
  '',
)
const doPut = process.argv.includes('--put')
const force = process.argv.includes('--force')

function argVal(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i < 0) return fallback
  const v = process.argv[i + 1]
  if (v == null || v.startsWith('--')) return fallback
  return v
}

const DEFAULT_DIR =
  'C:\\Users\\caokh\\OneDrive\\Documents\\KOls Report Docx'
const dir = argVal('--dir', DEFAULT_DIR)

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function createChangelog(action, summary, by = 'import_docx') {
  return {
    id: newId('cl'),
    at: new Date().toISOString(),
    action,
    by,
    summary,
  }
}

/**
 * Heuristic: extract X handle from DOCX filename.
 * Prefer known patterns after KOL_ / before date/SurfAI noise.
 */
function guessHandle(filename) {
  const baseName = filename.replace(/\.docx$/i, '')
  // Known explicit tokens (case-insensitive match later)
  const candidates = [
    /(?:KOL[_-]?)?(NickyPham_HC)/i,
    /(?:KOL[_-]?)?(mintt_?34)/i,
    /(?:KOL[_-]?)?(EmilyVuong|emilyyvuong)/i,
    /(?:KOL[_-]?)?(LensMoso)/i,
    /(?:KOL[_-]?)?(Sandeman52)/i,
    /(?:KOL[_-]?)?(immrape)/i,
    /(?:KOL[_-]?)?(bachkhoabnb)/i,
    /(?:KOL[_-]?)?(Jack_?Vi|jackvi810)/i,
    /(?:KOL[_-]?)?(mingli0x)/i,
    /(?:KOL[_-]?)?(phamduydong179)/i,
    /(?:KOL[_-]?)?(Steven_Research)/i,
    /(?:KOL[_-]?)?(TradeCoinVN|wearestcvn|TCVNcommunity)/i,
    /(?:KOL[_-]?)?(Martin|martin_bml|MartinHo99999)/i,
    /(?:KOL[_-]?)?(BiCanTho)/i,
    /(?:KOL[_-]?)?(Lecter_XFinance)/i,
    /(?:KOL[_-]?)?(TriMaiMS)/i,
    /(?:KOL[_-]?)?(TranThanh|tranthanhbk)/i,
  ]
  for (const re of candidates) {
    const m = baseName.match(re)
    if (m) return normalizeHandle(m[1])
  }
  // Fallback: last CamelCase / snake token before date
  const cleaned = baseName
    .replace(/^SurfAI[_-]?/i, '')
    .replace(/^Bao[_-]?cao[_-]?/i, '')
    .replace(/Danh[_-]?gia[_-]?/gi, '')
    .replace(/Phan[_-]?tich[_-]?/gi, '')
    .replace(/Evaluation[_-]?Report[_-]?/gi, '')
    .replace(/Analysis[_-]?Report[_-]?/gi, '')
    .replace(/Report[_-]?/gi, '')
    .replace(/KOL[_-]?/gi, '')
    .replace(/_?\d{4}[-_]?\d{0,2}[-_]?\d{0,2}.*$/i, '')
    .replace(/_?v\d+$/i, '')
  const parts = cleaned.split(/[_\-\s]+/).filter(Boolean)
  const last = parts[parts.length - 1] || cleaned
  return normalizeHandle(last)
}

function normalizeHandle(raw) {
  let h = String(raw || '')
    .replace(/^@/, '')
    .trim()
  // Known renames
  const map = {
    emilyvuong: 'emilyyvuong',
    jack_vi: 'jackvi810',
    jackvi: 'jackvi810',
    tradecoinvn: 'wearestcvn',
    martin: 'martin_bml',
    tranthanh: 'tranthanhbk',
    mintt34: 'mintt_34',
  }
  const key = h.toLowerCase()
  if (map[key]) return map[key]
  return h.toLowerCase()
}

function displayNameFromHandle(h) {
  if (!h) return h
  // Keep underscores as style of handle
  return h
}

async function extractDocxText(filePath) {
  const buf = fs.readFileSync(filePath)
  const result = await mammoth.extractRawText({ buffer: buf })
  return String(result.value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Best-effort parse of SurfAI-style scores from plain text.
 * Keeps free-form `text` as source of truth; structured is for AI scoring later.
 */
function extractStructuredFromText(text) {
  const metrics = {
    charCount: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    source: 'docx_import',
  }
  const head = text.slice(0, 3500)
  let overallScore = null
  const overallPatterns = [
    /Signal Score:\s*(\d+(?:\.\d+)?)\s*\/\s*100/i,
    /SurfAI Signal Score:\s*(\d+(?:\.\d+)?)\s*\/\s*100/i,
    /SurfAI Score[\s:\u00b7•]*(\d+(?:\.\d+)?)\s*\/\s*100/i,
    /điểm tổng(?:\s*hợp)?[\s:\u00b7•]*(\d+(?:\.\d+)?)\s*\/\s*100/i,
    /(?:Overall|Tổng\s*thể|Tổng\s*điểm|Overall Score|Composite)[\s\S]{0,48}?(\d+(?:\.\d+)?)\s*\/\s*100/i,
    /Influence Score[\s\S]{0,40}?(\d+(?:\.\d+)?)\s*\/\s*100/i,
    /(\d+(?:\.\d+)?)\s*\/\s*100\s*[·•]\s*Tích/i,
    /(?:điểm|score)\s*(?:tổng|overall|signal)?[\s:]*(\d+(?:\.\d+)?)\s*\/\s*100/i,
    /Score:\s*(\d+(?:\.\d+)?)\s*\/\s*100/i,
  ]
  for (const re of overallPatterns) {
    const m = head.match(re)
    if (m) {
      overallScore = Number(m[1])
      break
    }
  }
  // Fallback: first X/100 in first 1500 chars if still null
  if (overallScore == null) {
    const m = head.slice(0, 1500).match(/(\d{2,3}(?:\.\d+)?)\s*\/\s*100/)
    if (m) {
      const n = Number(m[1])
      if (n >= 40 && n <= 100) overallScore = n
    }
  }
  if (overallScore != null) metrics.overallScore = overallScore
  // Dimension scores e.g. "Educational Value (92/100)" or "Community Building (95/100)"
  const dimRe =
    /([A-Za-zÀ-ỹ& ]{3,40}?)\s*[\(:]\s*(\d+(?:\.\d+)?)\s*\/\s*100/g
  let dm
  while ((dm = dimRe.exec(text)) !== null) {
    const key = dm[1]
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi, '')
    if (key.length >= 3 && key.length <= 40) {
      metrics[key] = Number(dm[2])
    }
  }
  const followersM = text.match(
    /(\d{1,3}(?:[.,]\d{3})+|\d{4,})\s*followers/i,
  )
  if (followersM) {
    metrics.followersMentioned = Number(
      String(followersM[1]).replace(/[.,]/g, ''),
    )
  }
  const niches = []
  for (const n of [
    'airdrop',
    'defi',
    'nft',
    'builder',
    'trading',
    'research',
    'community',
    'arc',
    'on-chain',
  ]) {
    if (new RegExp(n, 'i').test(text)) niches.push(n)
  }
  return {
    overallScore,
    niches: niches.slice(0, 12),
    metrics,
  }
}

async function loadServerDataset() {
  if (!token) return null
  try {
    const r = await fetch(`${base}/api/kol-reports?all=1&t=${Date.now()}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

const seedPath = path.join(ROOT, 'src/data/internal/kol-reports.json')
const dataPath = path.join(ROOT, 'data/internal/kol-reports.json')

async function main() {
  if (!fs.existsSync(dir)) {
    console.error('Directory not found:', dir)
    process.exit(1)
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.docx'))
    .filter((f) => !f.startsWith('~$'))

  console.log(JSON.stringify({ dir, files: files.length, put: doPut, force }, null, 2))

  let dataset =
    (await loadServerDataset()) ||
    (fs.existsSync(seedPath)
      ? JSON.parse(fs.readFileSync(seedPath, 'utf8'))
      : null) || {
      version: 1,
      kind: 'kol-reports',
      updatedAt: new Date().toISOString(),
      reports: [],
      trash: [],
    }

  if (!Array.isArray(dataset.reports)) dataset.reports = []
  if (!Array.isArray(dataset.trash)) dataset.trash = []

  let created = 0
  let updated = 0
  let skipped = 0

  for (const file of files) {
    const full = path.join(dir, file)
    const handle = guessHandle(file)
    process.stdout.write(`${file} → @${handle} … `)
    let text = ''
    try {
      text = await extractDocxText(full)
    } catch (e) {
      console.log('EXTRACT_FAIL', e.message)
      continue
    }
    if (!text || text.length < 40) {
      console.log('EMPTY')
      skipped++
      continue
    }

    const existing = dataset.reports.find(
      (r) =>
        String(r.sourceFilename || '').toLowerCase() === file.toLowerCase() ||
        (String(r.handle).toLowerCase() === handle &&
          String(r.sourceFilename || '').toLowerCase() === file.toLowerCase()),
    )

    if (existing && !force) {
      // Same file already imported — skip unless force
      if (
        String(existing.sourceFilename || '').toLowerCase() ===
        file.toLowerCase()
      ) {
        console.log('skip (exists)')
        skipped++
        continue
      }
    }

    const now = new Date().toISOString()
    if (existing && force) {
      const fromLen = String(existing.text || '').length
      const structured = extractStructuredFromText(text)
      existing.text = text
      existing.structured = structured
      existing.title = existing.title || `Báo cáo SurfAI · @${handle}`
      existing.sourceFilename = file
      existing.sourcePath = full
      existing.handle = handle
      existing.displayName = existing.displayName || displayNameFromHandle(handle)
      existing.updatedAt = now
      existing.changelog = [
        createChangelog(
          'import',
          `Re-import DOCX ${file} (text ${fromLen}→${text.length} chars)` +
            (structured.overallScore != null
              ? ` · score ${structured.overallScore}`
              : ''),
        ),
        ...(existing.changelog || []),
      ].slice(0, 200)
      updated++
      console.log(
        `update ${text.length}c` +
          (structured.overallScore != null
            ? ` score=${structured.overallScore}`
            : ''),
      )
    } else {
      const structured = extractStructuredFromText(text)
      dataset.reports.push({
        id: newId('rep'),
        handle,
        displayName: displayNameFromHandle(handle),
        title: `Báo cáo SurfAI · @${handle}`,
        text,
        structured,
        sourceFilename: file,
        sourcePath: full,
        visibility: 'private',
        createdAt: now,
        updatedAt: now,
        changelog: [
          createChangelog(
            'import',
            `Import DOCX ${file} (${text.length} chars) → @${handle}` +
              (structured.overallScore != null
                ? ` · score ${structured.overallScore}`
                : ''),
          ),
        ],
        tags: ['surfai', 'docx-import'],
      })
      created++
      console.log(`create ${text.length}c`)
    }
  }

  dataset.kind = 'kol-reports'
  dataset.version = dataset.version || 1
  dataset.updatedAt = new Date().toISOString()
  dataset.asOf = dataset.updatedAt
  dataset.note = `KOL reports text corpus · ${dataset.reports.length} reports · imported from DOCX`

  dataset.reports.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  const json = JSON.stringify(dataset, null, 2) + '\n'
  fs.mkdirSync(path.dirname(seedPath), { recursive: true })
  fs.mkdirSync(path.dirname(dataPath), { recursive: true })
  fs.writeFileSync(seedPath, json, 'utf8')
  fs.writeFileSync(dataPath, json, 'utf8')
  console.log('wrote', seedPath)
  console.log('wrote', dataPath)
  console.log(JSON.stringify({ created, updated, skipped, total: dataset.reports.length }, null, 2))

  if (doPut) {
    if (!token) {
      console.error('FEED_ADMIN_TOKEN missing')
      process.exit(1)
    }
    const putRes = await fetch(`${base}/api/kol-reports`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dataset),
    })
    console.log('PUT', putRes.status, (await putRes.text()).slice(0, 280))
    if (!putRes.ok) process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
