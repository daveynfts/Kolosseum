/**
 * Quick-start Markdown templates for KOL report authoring.
 */

export type ReportTemplateId =
  | 'blank'
  | 'full'
  | 'executive'
  | 'scorecard'
  | 'brief'

export interface ReportTemplate {
  id: ReportTemplateId
  label: string
  hint: string
  build: (handle: string, displayName?: string) => string
}

function h(handle: string) {
  return handle.replace(/^@/, '') || 'handle'
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'full',
    label: 'Báo cáo đầy đủ',
    hint: 'Tóm tắt → hồ sơ → phân tích → kết luận',
    build: (handle, displayName) => {
      const name = displayName || `@${h(handle)}`
      return [
        `# Báo cáo đánh giá · @${h(handle)}`,
        '',
        `> ${name} — đánh giá nội bộ · cập nhật ${new Date().toLocaleDateString('vi-VN')}`,
        '',
        '## Tóm tắt điều hành',
        '',
        '- **Điểm tổng:** …/100',
        '- **Vị thế:** …',
        '- **Khuyến nghị:** theo dõi / hợp tác / giữ khoảng',
        '',
        '## Hồ sơ & vị thế',
        '',
        '| Chỉ số | Giá trị |',
        '| --- | --- |',
        '| Handle | @' + h(handle) + ' |',
        '| Followers |  |',
        '| Niche |  |',
        '| Phong cách |  |',
        '',
        '## Điểm mạnh',
        '',
        '- ',
        '',
        '## Rủi ro / điểm yếu',
        '',
        '- ',
        '',
        '## Phân tích nội dung gần đây',
        '',
        '…',
        '',
        '## Kết luận & next steps',
        '',
        '…',
        '',
      ].join('\n')
    },
  },
  {
    id: 'executive',
    label: 'Executive brief',
    hint: 'Ngắn gọn 1 trang',
    build: (handle) =>
      [
        `# @${h(handle)} — Executive brief`,
        '',
        '**Score:** …/100  ·  **Tier:** …  ·  **Stance:** theo dõi',
        '',
        '## One-liner',
        '',
        '…',
        '',
        '## Why it matters',
        '',
        '1. ',
        '2. ',
        '',
        '## Watch-outs',
        '',
        '- ',
        '',
        '## Action',
        '',
        '- [ ] ',
        '',
      ].join('\n'),
  },
  {
    id: 'scorecard',
    label: 'Bảng điểm',
    hint: 'Bảng metrics + nhận xét',
    build: (handle) =>
      [
        `# Scorecard · @${h(handle)}`,
        '',
        '| Trụ cột | Điểm (/100) | Ghi chú |',
        '| --- | --- | --- |',
        '| Educational value |  |  |',
        '| Community |  |  |',
        '| Engagement |  |  |',
        '| Trust / transparency |  |  |',
        '| On-chain / alpha |  |  |',
        '| **Overall** |  |  |',
        '',
        '## Nhận xét',
        '',
        '…',
        '',
      ].join('\n'),
  },
  {
    id: 'brief',
    label: 'Ghi chú nhanh',
    hint: 'Bullet notes',
    build: (handle) =>
      [
        `# Notes · @${h(handle)}`,
        '',
        `- Ngày: ${new Date().toLocaleDateString('vi-VN')}`,
        '- Context: ',
        '- Signal: ',
        '- Follow-up: ',
        '',
      ].join('\n'),
  },
]

export function getTemplate(id: ReportTemplateId): ReportTemplate | undefined {
  return REPORT_TEMPLATES.find((t) => t.id === id)
}
