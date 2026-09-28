import { readFile, writeFile } from 'node:fs/promises'
import { sha256 } from '../../lib/evidence/reportCrypto'

// Source-reviewed editorial corrections. The encrypted Surf result remains immutable.
const path = 'public/demo/nbaluong-premium.json'
const report = JSON.parse(await readFile(path, 'utf8'))
if (report.editorialReview) throw new Error('Already reviewed; do not apply edits twice')
if (sha256(report.content) !== '0df24d04a6e34032e3011a61da42ae80df350a78523a9b35ecc91ffce2cfaf46') throw new Error('Unexpected source report')
const edits: Array<[string, string]> = [
  ['“3x ref” (“three times the referrals”)', '“3x ref” (an ambiguous referral-count expression; neither an exact count nor threefold growth is established)'],
  ['Claims three-times referrals; questions future KYC/ref eligibility', 'Uses the ambiguous phrase “3x ref”; questions future KYC/ref eligibility'],
  ['| Replies on 22 and 28 Jul |', '| Replies on 22 Aug and 28 Jul |'],
  ['[[9 Sep](https://x.com/luong4101992/status/2097868628083568855)]', '[[10 Sep](https://x.com/luong4101992/status/2097868628083568855)]'],
  ['### Bottom line', '### Overall assessment'],
]
for (const [before, after] of edits) {
  if (!report.content.includes(before)) throw new Error('Expected correction target missing')
  report.content = report.content.replaceAll(before, after)
}
const addition = `### Prize-schedule discrepancy to verify\n\nThe July campaign posts list **VND20 million for ranks 4–10**, while the 18 August prize announcement lists **VND15 million for ranks 4–10**. This is a difference between the supplied posts, not proof that terms were unlawfully changed or that anyone was underpaid. The snapshot does not establish whether these were different rounds, revised terms or a posting error. Obtain the dated official rules and winner notices before drawing a conclusion. [July campaign post](https://x.com/luong4101992/status/2079764123051860016) · [18 August announcement](https://x.com/luong4101992/status/2089663121686507785).\n\n`
report.content = report.content.replace('### What cannot be concluded', addition + '### What cannot be concluded')
report.editorialReview = {
  reviewedAt: new Date().toISOString(),
  originalContentHash: report.contentHash,
  method: 'AI-assisted source review against the supplied snapshot; not independent verification of the underlying claims.',
  changes: ['Clarified ambiguous Vietnamese referral wording in two places.', 'Corrected two citation date descriptions.', 'Added the July/August prize-schedule discrepancy with source links and limitations.', 'Recomputed aggregate, monthly and median engagement statistics against all 36 source records.'],
}
report.contentHash = sha256(report.content)
await writeFile(path, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ contentHash: report.contentHash, originalContentHash: report.editorialReview.originalContentHash, words: report.content.split(/\s+/).length }))
