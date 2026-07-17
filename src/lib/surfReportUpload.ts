/**
 * Client helper: upload Surf report PDF to R2 via PUT /api/surf-report
 * → key RadarKOLsReport/{filename}
 * DOCX is not accepted — convert to PDF first.
 */
import { withBase } from './base'
import { getAdminToken } from './feedStore'

export type SurfUploadResult =
  | {
      ok: true
      url: string
      key: string
      filename: string
      bytes: number
    }
  | { ok: false; error: string; status?: number }

function sanitizeClientName(name: string): string {
  let n = name.trim().replace(/\\/g, '/').split('/').pop() || 'report.pdf'
  n = n.replace(/[^\w.\-()+\s\u00C0-\u024F]/g, '_').replace(/\s+/g, '_')
  if (/\.docx$/i.test(n)) n = n.replace(/\.docx$/i, '.pdf')
  if (!/\.pdf$/i.test(n)) n = `${n.replace(/\.[^.]+$/, '') || 'report'}.pdf`
  return n
}

/** Suggest PDF filename for a KOL handle */
export function suggestSurfReportFilename(
  handle: string,
  originalName?: string,
): string {
  const h = handle.replace(/^@/, '').trim() || 'kol'
  if (originalName && /\.pdf$/i.test(originalName)) {
    const base = sanitizeClientName(originalName)
    if (base.toLowerCase().includes(h.toLowerCase())) return base
  }
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `SurfAI_KOL_Evaluation_${h}_${y}${m}${day}.pdf`
}

export async function uploadSurfReport(
  file: File,
  options?: {
    token?: string
    /** Override object basename under RadarKOLsReport/ */
    filename?: string
  },
): Promise<SurfUploadResult> {
  const token = (options?.token || getAdminToken()).trim()
  if (!token) {
    return {
      ok: false,
      error: 'Chưa có token — dán FEED_ADMIN_TOKEN → Apply token',
    }
  }
  if (!file || file.size < 64) {
    return { ok: false, error: 'File rỗng hoặc quá nhỏ' }
  }
  if (file.size > 4.5 * 1024 * 1024) {
    return {
      ok: false,
      error: 'File quá lớn (max ~4.5MB do giới hạn Vercel serverless)',
    }
  }

  const name = (file.name || '').toLowerCase()
  const type = (file.type || '').toLowerCase()
  if (
    name.endsWith('.docx') ||
    type.includes('wordprocessingml') ||
    type.includes('msword')
  ) {
    return {
      ok: false,
      error:
        'Không upload .docx lên R2. Export/convert sang PDF rồi upload lại.',
    }
  }

  const filename = sanitizeClientName(
    options?.filename || file.name || 'report.pdf',
  )
  if (/\.docx$/i.test(filename)) {
    return {
      ok: false,
      error: 'Filename phải là .pdf (không nhận .docx).',
    }
  }

  const url = `${withBase('/api/surf-report')}?filename=${encodeURIComponent(filename)}`

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/pdf',
        'X-Filename': filename,
      },
      body: file,
    })
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      url?: string
      key?: string
      filename?: string
      bytes?: number
      error?: string
      message?: string
    }
    if (!res.ok || !body.url) {
      return {
        ok: false,
        status: res.status,
        error:
          body.message ||
          body.error ||
          `Upload failed (${res.status})`,
      }
    }
    return {
      ok: true,
      url: body.url,
      key: body.key || `RadarKOLsReport/${filename}`,
      filename: body.filename || filename,
      bytes: body.bytes || file.size,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Network error',
    }
  }
}
