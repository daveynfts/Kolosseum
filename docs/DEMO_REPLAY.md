# Recorded sandbox walkthrough

The local walkthrough at `/demo/replay` replays an actual captured test. It does not create a report, call Surf, open a pay.sh channel, charge sandbox USDC, or submit a new Solana transaction. It is explicitly labeled **recorded**, with the Radar source date and the status of every stage. The UI uses the existing Kolosseum theme.

## Current capture (25 September 2026)

`npm run demo:record -- --surf-chat-401` selected `@luong4101992` by counting posts in the public SCEX feed: **36 of 1,023 posts** across **596 actors**. The source declares `asOf: 2026-09-20` and `updatedAt: 2026-09-22T03:44:12.438Z`; this is a real but dated snapshot, not a live X firehose. The recorder saved 20 recent posts, source URLs, template quote, matrix position, and an honest stage timeline to `.demo-captures/flow.json`.

The same configured Surf key matched the masked key shown in the dashboard and returned HTTP 200 from the official Data API (`GET /v1/market/price?symbol=SOL`, one credit). Surf Chat returned HTTP 401 from `POST /v1/responses` for both a full KOL request and a minimal documented `surf-2.0` request. `GET /v1/me/credit-balance` also returned 401. The sidecar's 502 was therefore an upstream Chat authentication failure, not a PostgreSQL or Solana failure. **No Kolosseum report row, sandbox purchase, receipt claim, or devnet Memo was produced by this test.** The replay currently shows those stages as blocked/pending instead of inventing them.

The first full request ran under the earlier 65-second/two-attempt client policy and produced no report. The client now waits up to 240 seconds, makes only one attempt by default to avoid an ambiguous duplicate charge, and can persist a completed Surf response in an encrypted local cache. An explicit retry option still exists for controlled tests. Local `SURF_REASONING_EFFORT=none` uses Surf's documented 20-credit `surf-2.0` mode; the application default remains `low` (50 credits). The provider's published [pricing](https://agents.asksurf.ai/docs/pricing) describes both rates. An attempt in 20-credit mode returned Chat HTTP 401 in about five seconds, so no cached Surf answer exists yet.

## Record the full path after Surf Chat works

1. Confirm the **Chat API** accepts the key with `POST https://api.asksurf.ai/gateway/v1/responses` using the documented Bearer token. An active key plus a working Data API call did not establish Chat access in this test. Do not paste the key into a Git issue or chat.
2. Run `npm run research:migrate`, start `npm run research:dev`, and generate one real report for `@luong4101992` with the `exchange-stance` template. Use the private preview first or the sandbox gateway if its signer and paid-mode flags are configured.
3. Confirm `/reports/<id>/verify` returns `recomputedHashMatch: true` and `onChainMatch: true`. For a full paid recording, claim the actual pay.sh sandbox receipt first and confirm `paymentVerified: true`. The local demo buyer and `npm run pay:sandbox` instructions remain in the README.
4. Run `npm run demo:record -- --report <id>`. It refuses a report for a different KOL or one whose decrypted SHA-256 does not match. It records the source selection, encrypted report, Surf credits, verified sandbox payment/channel state if present, vote totals, and devnet Memo state. It never writes the Surf key, admin token, payment receipt header, or operator private key.
5. With `DEMO_REPLAY_ENABLED=true`, `PAY_MODE=sandbox`, and the research sidecar bound to loopback, open `http://127.0.0.1:5173/demo/replay`. Enter `ADMIN_TOKEN`. The sidecar decrypts the captured report only for the local admin; the browser recomputes SHA-256. The Memo badge says **verified at capture**, since replay makes no new chain query.

`SURF_CACHE_DIR=.demo-captures/surf-cache` is optional. It stores completed Surf responses encrypted with `REPORT_ENC_KEY` under the existing prompt/hour hash, so a restart within that bucket does not repeat the provider call. Keep this key stable. The capture directory is Git-ignored; do not commit or publish its contents. Surf's [terms](https://asksurf.ai/terms-of-service) require prior written consent for commercial use of Output, so a private replay is not permission to sell or publicly redistribute it.

## Verification run

```text
Full Vitest suite (Node 24)               175 passed, including dedicated Neon vote test
npm run research:typecheck                 passed
npm run build                              passed
npm run lint -- --quiet                    passed
npm run demo:record -- --surf-chat-401   status=source-ready, topKol=luong4101992, topPosts=36
GET /research/demo-replay without token   401
GET /research/demo-replay with admin      200; signed capture; 7 stages: 3 verified, 1 blocked, 3 pending
Playwright /demo/replay                    7 stages, 1 blocked, 0 provider calls, 0 page errors
Playwright top-KOL panel (images enabled)  templates/link loaded in 4.1s; API 200; 0 page errors
npm run research:check-secrets            6 configured secrets absent from 290 dist files
```

This recorded state is suitable for a truthful workflow mockup, but it does not satisfy the real Surf report, paid purchase, or on-chain report acceptance checks yet.
