# Recorded Kolosseum sandbox walkthrough

On 25 September 2026, the live Radar snapshot dated 20 September contained 596 actors and 1,023 SCEX posts. The KOL with the most posts was @luong4101992 with 36. The research prompt used this KOL's 20 most recent posts, original X links, current matrix position, and source metadata. The snapshot is dated source data, not a live X firehose.

One successful surf-2.0 exchange-stance request produced a real English report. A count in the first Surf draft incorrectly said 21 sampled posts. The application now grounds that count to the 20 posts actually supplied before hashing and storing. The corrected report was generated from the encrypted hourly Surf cache, so that correction did not call Chat again. Its citations were checked against the supplied X URLs, and no direct buy/sell recommendation was found. The fixed research disclaimer is present.

Two separate purchases then completed through the real pay.sh sandbox gateway:

| Path | Report | Sandbox payment | Surf credits for this invocation | Verification |
| --- | --- | --- | --- | --- |
| MPP session quick exchange-stance | a8f0d399-6f12-4c6e-b79a-1b2066f508b3 | $0.450000 USDC | 0 new credits; encrypted cache hit | Receipt reconciled, channel open, 0.550000 USDC remaining; SHA-256 and [devnet Memo](https://explorer.solana.com/tx/2ZeFWivoR3VvL5xn3GCk4bqXH55YEo1SwN8ciVqKRJNK1VQ1uettKt4SkVPuNu5PkWRZeL25YZrAqrwve71n9Di2?cluster=devnet) match |
| x402 upto custom deep | c7d824e1-b5a4-4b57-91eb-772d5966ec67 | $0.120000 USDC | 20 by Surf's published none-effort rate; response omitted meta.credits_used | Settlement reconciled; SHA-256 and [devnet Memo](https://explorer.solana.com/tx/h7B1YGY11rbKn3WgfyRM2GPytRSzETSzHmPnaKQp5Rc75Gw2V16yQapmCgzwA5kxZAxPU1sbQwpEM8awtYixm7q?cluster=devnet) match |

The paid quick report has all eight required headings, cites 20 supplied post URLs, says 20 sampled posts and 36 posts in the full snapshot, and has no unknown post URL. The deep report has the same headings, cites six supplied posts, and has no unknown post URL. These checks establish source membership and report integrity, not the truth of every interpretation. Both reports remain private buyer/admin content.

The following command results were observed, not simulated:

~~~text
npm run research:check-surf-auth     authenticated Data API accepted the replacement key
npm run pay:demo-buy -- -KolHandle luong4101992 -TemplateSlug exchange-stance
  Purchased report a8f0d399-6f12-4c6e-b79a-1b2066f508b3
  Payment verified: 0.450000 sandbox USDC. Channel open, remaining 0.550000.
npm run pay:demo-buy -- -KolHandle luong4101992 -Prompt "Analyze this KOL's SCEX exchange stance using the supplied posts and explain credibility risks with source links."
  Purchased report c7d824e1-b5a4-4b57-91eb-772d5966ec67
  Payment verified: 0.120000 sandbox USDC.
npm run demo:record -- --report a8f0d399-6f12-4c6e-b79a-1b2066f508b3
  status=purchase-verified, paymentVerified=true, memoVerified=true
npm run demo:record -- --report c7d824e1-b5a4-4b57-91eb-772d5966ec67 --output .demo-captures/flow-x402.json
  status=purchase-verified, paymentVerified=true, memoVerified=true
Chrome replay and paid report check: seven verified replay stages, browser SHA-256 match,
  verified payment and Memo on the report page, zero page errors.
~~~

The default replay is .demo-captures/flow.json (MPP). A copy is saved as flow-mpp.json. The separate deep capture is flow-x402.json. All are Git-ignored, signed, and store report content encrypted with REPORT_ENC_KEY. They contain public source posts, a buyer public key, and verified payment references, but no Surf key, admin token, raw payment receipt, or operator secret key.

To open the saved flow without another Surf or pay.sh purchase, keep DEMO_REPLAY_ENABLED=true, PAY_MODE=sandbox, and the sidecar bound to loopback. Start npm run research:dev and npm run dev -- --host 127.0.0.1, then open http://127.0.0.1:5173/demo/replay and enter the local ADMIN_TOKEN. The page shows nbaluong (@luong4101992) with the existing R2 avatar, original snapshot figures, report template, and optional Phantom/Solflare connection. Press **Create report from recording** to reveal the seven saved stages and report, or **Show saved result now** to skip the animation. These buttons use only the data already loaded into the page; they do not create a report or make a provider, payment, database, or Solana request. The browser recomputes the report SHA-256. The Memo badge reflects verification when the capture was saved; replay does not re-query Solana. To show the deep recording instead, set DEMO_REPLAY_FILE=.demo-captures/flow-x402.json in the ignored .env.local and restart the research sidecar. Restore the default file path afterward.

SURF_CACHE_DIR=.demo-captures/surf-cache separately stores completed provider responses encrypted for the current prompt/hour bucket. Reusing it can avoid a repeated Chat call, but a new prompt or hour can incur credits. Keep REPORT_ENC_KEY stable to read existing reports and captures. See [Surf authentication and usage metadata](./SURF_AUTH.md).

The browser wallet does not directly fund a pay.sh sandbox channel. The local Windows demo buyer uses the pay.sh CLI wallet; a different connected Phantom/Solflare wallet does not become that report's owner. Report resale remains disabled pending Surf commercial-use permission or a replacement data source with suitable rights.
Final local checks: Node 24.19.0 ran 38 Vitest files and 182 tests successfully, including the dedicated PostgreSQL vote-proof integration test. npm run research:typecheck, npm run build, and npm run lint -- --quiet passed. npm run research:check-secrets found none of six configured secrets in 290 built files. Chrome opened the saved MPP replay and paid report page with seven verified stages, matching hashes, verified Memo/payment badges, and zero page errors. The global Node 25.8.0 binary still fails one pre-existing Events localStorage cache test; the same complete suite passes under Node 24.

On 26 September, headless Chrome verified the updated nbaluong replay at desktop and phone widths: the R2 avatar loaded, both wallet connect controls were present, all seven captured stages appeared, the browser SHA-256 matched, and replay clicks made zero report-creation, payment, Surf, or Solana requests. There were no page errors or horizontal overflow at 390px. The headless test disabled extensions, so it did not exercise a live Phantom/Solflare approval prompt.
