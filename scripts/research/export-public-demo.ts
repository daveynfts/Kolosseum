import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'
import { openDemoCapture } from '../../lib/research/demoReplay'
config({ path: '.env.local', quiet: true })
const { capture, content } = await openDemoCapture('.demo-captures/flow-mpp.json', process.env.REPORT_ENC_KEY || '')
if (!content || !capture.report || capture.kol.handle !== 'luong4101992' || capture.template.slug !== 'exchange-stance') throw new Error('Expected verified nbaluong MPP report')
// Deliberately allow-list fields. Never serialize the capture or payment object.
const fixture = {
  version: 'nbaluong-mpp-20260925-v1', mode: 'recorded-demo',
  handle: capture.kol.handle, displayName: capture.kol.displayName,
  snapshotAt: capture.source.asOf, recordedAt: capture.recordedAt,
  postCount: capture.source.topKolPostCount, sampledPosts: capture.posts.length,
  template: capture.template.slug, model: capture.report.surfModel,
  content, contentHash: capture.report.contentHash,
  sources: capture.posts.map(post => ({ url: post.url, postedAt: post.postedAt })),
}
await mkdir('public/demo', { recursive: true })
await writeFile('public/demo/nbaluong.json', JSON.stringify(fixture, null, 2) + '\n')
console.log('Exported verified public nbaluong demo; private payment metadata excluded.')
