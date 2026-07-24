/**
 * KOL evaluation reports — plain text corpus for admin + future AI scoring.
 *
 * Source of truth (repo seed):
 *   src/data/internal/kol-reports.json
 *   data/internal/kol-reports.json  (mirror for agents / offline)
 *
 * Runtime (admin): R2 `internal/kol-reports/v1.json` via
 *   GET/PUT /api/kol-reports
 *   → cached in localStorage after load
 *
 * AI-friendly: each report has free-form `text` (source of truth) + optional
 * `structured` metrics for scoring later. Changelog records create/update/delete
 * with timestamps; visibility private|public for publish transparency.
 */
import seedJson from './internal/kol-reports.json'

export type KolReportVisibility = 'private' | 'public'

export type KolReportChangeAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'import'
  | 'publish'
  | 'unpublish'

export interface KolReportFieldChange {
  field: string
  from?: string
  to?: string
}

export interface KolReportChangelogEntry {
  id: string
  at: string
  action: KolReportChangeAction
  /** Optional actor label (admin token hash / "admin" / import script) */
  by?: string
  summary: string
  changes?: KolReportFieldChange[]
}

/**
 * AI-friendly structured slice (optional). Keep free-form `text` as source of truth;
 * structured can be filled later by extraction / manual edit for scoring.
 */
export interface KolReportStructured {
  overallScore?: number | null
  tierHint?: string | null
  niches?: string[]
  strengths?: string[]
  risks?: string[]
  engagementNotes?: string | null
  audienceNotes?: string | null
  /** Free key-value for future metrics without schema churn */
  metrics?: Record<string, string | number | boolean | null>
  [key: string]: unknown
}

export interface KolReport {
  id: string
  /** Canonical X handle (lowercase, no @) */
  handle: string
  displayName?: string
  title: string
  /**
   * Full report body as plain text / markdown-ish.
   * Primary corpus for AI consumption and human edit.
   */
  text: string
  structured?: KolReportStructured
  sourceFilename?: string
  sourcePath?: string
  visibility: KolReportVisibility
  createdAt: string
  updatedAt: string
  /** Soft-delete timestamp when in trash */
  deletedAt?: string
  changelog: KolReportChangelogEntry[]
  tags?: string[]
  notes?: string
}

export interface KolReportsDataset {
  version: number
  kind: 'kol-reports'
  updatedAt: string
  asOf?: string
  note?: string
  reports: KolReport[]
  /** Soft-deleted reports retained for audit / restore */
  trash: KolReport[]
}

export function emptyKolReportsDataset(): KolReportsDataset {
  return {
    version: 1,
    kind: 'kol-reports',
    updatedAt: new Date().toISOString(),
    asOf: new Date().toISOString(),
    note: 'KOL evaluation reports (text). AI-friendly corpus + changelog.',
    reports: [],
    trash: [],
  }
}

/** Repo seed (DOCX imports) — used offline / before first R2 PUT */
export const SEED_KOL_REPORTS: KolReportsDataset =
  normalizeKolReportsDataset(seedJson) || emptyKolReportsDataset()

export function defaultKolReportsDataset(): KolReportsDataset {
  return SEED_KOL_REPORTS.reports.length
    ? {
        ...SEED_KOL_REPORTS,
        reports: SEED_KOL_REPORTS.reports.map((r) => ({
          ...r,
          changelog: [...(r.changelog || [])],
        })),
        trash: (SEED_KOL_REPORTS.trash || []).map((r) => ({
          ...r,
          changelog: [...(r.changelog || [])],
        })),
      }
    : emptyKolReportsDataset()
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createChangelogEntry(
  action: KolReportChangeAction,
  summary: string,
  opts?: {
    by?: string
    changes?: KolReportFieldChange[]
  },
): KolReportChangelogEntry {
  return {
    id: newId('cl'),
    at: new Date().toISOString(),
    action,
    by: opts?.by || 'admin',
    summary,
    changes: opts?.changes,
  }
}

export function createEmptyReport(handle = ''): KolReport {
  const now = new Date().toISOString()
  const h = handle.replace(/^@/, '').trim().toLowerCase()
  return {
    id: newId('rep'),
    handle: h || `unknown_${Date.now().toString(36).slice(-4)}`,
    displayName: h || 'New report',
    title: h ? `Báo cáo đánh giá KOL @${h}` : 'Báo cáo mới',
    text: '',
    structured: {},
    visibility: 'private',
    createdAt: now,
    updatedAt: now,
    changelog: [
      createChangelogEntry('create', 'Tạo báo cáo trống trong admin'),
    ],
    tags: [],
  }
}

/** Diff selected string fields for changelog */
export function diffReportFields(
  before: KolReport,
  after: Partial<KolReport>,
): KolReportFieldChange[] {
  const fields: Array<keyof KolReport> = [
    'handle',
    'displayName',
    'title',
    'text',
    'visibility',
    'sourceFilename',
    'notes',
  ]
  const changes: KolReportFieldChange[] = []
  for (const f of fields) {
    if (!(f in after)) continue
    const from = String(before[f] ?? '')
    const to = String(after[f] ?? '')
    if (from !== to) {
      changes.push({
        field: f,
        from: from.length > 200 ? `${from.slice(0, 200)}…` : from || undefined,
        to: to.length > 200 ? `${to.slice(0, 200)}…` : to || undefined,
      })
    }
  }
  if (after.tags && JSON.stringify(before.tags || []) !== JSON.stringify(after.tags)) {
    changes.push({
      field: 'tags',
      from: (before.tags || []).join(', '),
      to: (after.tags || []).join(', '),
    })
  }
  if (
    after.structured &&
    JSON.stringify(before.structured || {}) !== JSON.stringify(after.structured)
  ) {
    changes.push({
      field: 'structured',
      from: JSON.stringify(before.structured || {}).slice(0, 120),
      to: JSON.stringify(after.structured).slice(0, 120),
    })
  }
  return changes
}

export function applyReportUpdate(
  report: KolReport,
  patch: Partial<KolReport>,
  by = 'admin',
): KolReport {
  const changes = diffReportFields(report, patch)
  const next: KolReport = {
    ...report,
    ...patch,
    id: report.id,
    handle: String(patch.handle ?? report.handle)
      .replace(/^@/, '')
      .trim()
      .toLowerCase(),
    updatedAt: new Date().toISOString(),
    changelog: [
      createChangelogEntry(
        changes.some((c) => c.field === 'visibility')
          ? patch.visibility === 'public'
            ? 'publish'
            : patch.visibility === 'private' && report.visibility === 'public'
              ? 'unpublish'
              : 'update'
          : 'update',
        changes.length
          ? `Cập nhật: ${changes.map((c) => c.field).join(', ')}`
          : 'Cập nhật (không đổi field chính)',
        { by, changes },
      ),
      ...(report.changelog || []),
    ].slice(0, 200),
  }
  return next
}

function normalizeChangelog(raw: unknown): KolReportChangelogEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const action = String(o.action || 'update') as KolReportChangeAction
      return {
        id: String(o.id || newId('cl')),
        at: String(o.at || new Date().toISOString()),
        action,
        by: o.by != null ? String(o.by) : undefined,
        summary: String(o.summary || ''),
        changes: Array.isArray(o.changes)
          ? (o.changes as KolReportFieldChange[])
          : undefined,
      } as KolReportChangelogEntry
    })
    .filter(Boolean) as KolReportChangelogEntry[]
}

function normalizeReport(raw: unknown, i: number): KolReport | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const handle = String(o.handle || '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase()
  if (!handle) return null
  const visibility: KolReportVisibility =
    o.visibility === 'public' ? 'public' : 'private'
  return {
    id: String(o.id || `rep_${handle}_${i}`),
    handle,
    displayName:
      o.displayName != null ? String(o.displayName) : handle,
    title: String(o.title || `Báo cáo @${handle}`),
    text: String(o.text || ''),
    structured:
      o.structured && typeof o.structured === 'object'
        ? (o.structured as KolReportStructured)
        : {},
    sourceFilename:
      o.sourceFilename != null ? String(o.sourceFilename) : undefined,
    sourcePath: o.sourcePath != null ? String(o.sourcePath) : undefined,
    visibility,
    createdAt: String(o.createdAt || new Date().toISOString()),
    updatedAt: String(o.updatedAt || o.createdAt || new Date().toISOString()),
    deletedAt: o.deletedAt != null ? String(o.deletedAt) : undefined,
    changelog: normalizeChangelog(o.changelog),
    tags: Array.isArray(o.tags)
      ? o.tags.map((t) => String(t))
      : undefined,
    notes: o.notes != null ? String(o.notes) : undefined,
  }
}

export function normalizeKolReportsDataset(
  raw: unknown,
): KolReportsDataset | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const reportsRaw = Array.isArray(o.reports) ? o.reports : []
  const trashRaw = Array.isArray(o.trash) ? o.trash : []
  const reports: KolReport[] = []
  reportsRaw.forEach((item, i) => {
    const r = normalizeReport(item, i)
    if (r && !r.deletedAt) reports.push(r)
  })
  const trash: KolReport[] = []
  trashRaw.forEach((item, i) => {
    const r = normalizeReport(item, i)
    if (r) trash.push(r)
  })
  reports.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  return {
    version: Number(o.version) || 1,
    kind: 'kol-reports',
    updatedAt: String(o.updatedAt || new Date().toISOString()),
    asOf: o.asOf ? String(o.asOf) : undefined,
    note: o.note ? String(o.note) : undefined,
    reports,
    trash,
  }
}

/** Public export: only published reports, slim changelog (last 5) */
export function publicKolReportsView(
  ds: KolReportsDataset,
): KolReportsDataset {
  return {
    ...ds,
    reports: ds.reports
      .filter((r) => r.visibility === 'public')
      .map((r) => ({
        ...r,
        changelog: (r.changelog || []).slice(0, 5),
      })),
    trash: [],
    note: 'Public KOL reports only',
  }
}
