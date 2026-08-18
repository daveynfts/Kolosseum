import { useCallback, useEffect, useRef, useState } from 'react'
import { getAdminToken } from '../lib/feedStore'
import {
  OPS_DATASET_SPECS,
  ageDays,
  formatAgeDays,
  opsApiUrl,
  opsHealthTone,
  pickIsoTimestamp,
  type OpsHealthTone,
} from '../lib/opsHealth'

interface Props {
  onToast: (msg: string) => void
}

type Row = {
  id: string
  label: string
  r2Key: string
  cadence: string
  warnAfterDays: number
  staleAfterDays: number
  tone: OpsHealthTone
  age: number | null
  timestamp: string | null
  error: string | null
}

function toneLabel(tone: OpsHealthTone): string {
  if (tone === 'ok') return 'OK'
  if (tone === 'warn') return 'Cũ'
  if (tone === 'stale') return 'Quá hạn'
  return 'Lỗi'
}

export function AdminOpsHealth({ onToast }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const toastOnDone = useRef(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const token = getAdminToken()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    const now = Date.now()
    const next: Row[] = await Promise.all(
      OPS_DATASET_SPECS.map(async (spec) => {
        try {
          const res = await fetch(opsApiUrl(spec.path), {
            cache: 'no-store',
            headers,
          })
          const body = await res.json().catch(() => null)
          if (!res.ok) {
            return {
              id: spec.id,
              label: spec.label,
              r2Key: spec.r2Key,
              cadence: spec.cadence,
              warnAfterDays: spec.warnAfterDays,
              staleAfterDays: spec.staleAfterDays,
              tone: 'error' as const,
              age: null,
              timestamp: null,
              error: (body && body.error) || `HTTP ${res.status}`,
            }
          }
          const timestamp = pickIsoTimestamp(body, spec.timestampFields)
          const age = timestamp ? ageDays(timestamp, now) : null
          return {
            id: spec.id,
            label: spec.label,
            r2Key: spec.r2Key,
            cadence: spec.cadence,
            warnAfterDays: spec.warnAfterDays,
            staleAfterDays: spec.staleAfterDays,
            tone: opsHealthTone(age, spec.warnAfterDays, spec.staleAfterDays),
            age,
            timestamp,
            error: timestamp ? null : 'missing timestamp',
          }
        } catch (e) {
          return {
            id: spec.id,
            label: spec.label,
            r2Key: spec.r2Key,
            cadence: spec.cadence,
            warnAfterDays: spec.warnAfterDays,
            staleAfterDays: spec.staleAfterDays,
            tone: 'error' as const,
            age: null,
            timestamp: null,
            error: e instanceof Error ? e.message : String(e),
          }
        }
      }),
    )
    setRows(next)
    setCheckedAt(new Date(now).toISOString())
    setLoading(false)
    if (toastOnDone.current) {
      const bad = next.filter((r) => r.tone === 'stale' || r.tone === 'error').length
      onToast(
        bad
          ? `Ops: ${bad} tập dữ liệu quá hạn hoặc lỗi`
          : `Ops: ${next.length} tập dữ liệu OK`,
      )
    }
  }, [onToast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="admin-ops-health">
      <div className="admin-ops-health__bar">
        <p className="admin-ops-health__lede">
          Đọc <code>updatedAt</code> / <code>generatedAt</code> từ các GET API
          hiện có — không thêm serverless function. Cron GitHub Actions ghi đè
          feed mỗi ngày và SCEX mỗi tuần; job fail thì timestamp đứng yên.
        </p>
        <button
          type="button"
          className="btn btn--primary"
          disabled={loading}
          onClick={() => {
            toastOnDone.current = true
            void refresh()
          }}
        >
          {loading ? 'Đang đọc…' : 'Refresh'}
        </button>
      </div>
      {checkedAt ? (
        <p className="admin-ops-health__checked">
          Kiểm tra lúc {new Date(checkedAt).toLocaleString('vi-VN')}
        </p>
      ) : null}
      <table className="admin-ops-health__table">
        <thead>
          <tr>
            <th>Tập dữ liệu</th>
            <th>R2 key</th>
            <th>Tuổi</th>
            <th>Ngưỡng</th>
            <th>Lịch</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-tone={r.tone}>
              <td>{r.label}</td>
              <td>
                <code>{r.r2Key}</code>
              </td>
              <td title={r.timestamp || r.error || ''}>
                {r.error ? r.error : formatAgeDays(r.age)}
              </td>
              <td>
                {r.warnAfterDays}d / {r.staleAfterDays}d
              </td>
              <td>{r.cadence}</td>
              <td>
                <span className={`admin-ops-health__pill is-${r.tone}`}>
                  {toneLabel(r.tone)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="admin-ops-health__hint">
        GitHub → Settings → Secrets: <code>FEED_ADMIN_TOKEN</code>,{' '}
        <code>R2_*</code>. Actions → Refresh X feed → Run workflow để thử trước
        khi tin vào lịch. Schedule bị tắt sau 60 ngày không commit.
      </p>
    </div>
  )
}
