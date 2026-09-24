# Kolosseum

Kolosseum presents the live Vietnamese crypto KOL matrix and SCEX X feed as a Roman arena. Select a KOL to inspect source posts and open Deep Research. The app keeps the existing KOL and post data pipelines; the former Radar map and Events pages are no longer public entry points.

## Run locally

Node.js and npm are required.

~~~bash
npm install
npm run dev
~~~

Open http://localhost:5173/scex. The root URL and old Events URLs open the arena. The data comes from the existing SCEX API when available, with the repository snapshot used by the app's existing fallback. X posts remain in their original language; interface labels and new research prompts are English.

## Avatars

Avatars use the existing Cloudflare R2 bucket under radar/avatars/{handle}.jpg. The local Vite server proxies /r2/* to the configured RADAR_API_BASE, so an R2 URL works during local development. Each KOL's avatarUrl is preferred when present.

~~~bash
npm run avatars:sync
~~~

This read-only command audits every handle in the live /api/scex-tracking dataset. To upload only missing avatars, set FEED_ADMIN_TOKEN in .env.local and run:

~~~bash
npm run avatars:sync:apply
~~~

The existing authenticated /api/avatar endpoint fetches the image and writes directly to the same R2 bucket. The sync script does not save image files locally. The existing weekly SCEX GitHub Actions refresh also runs it after updating the live dataset. See [avatar sync details](./docs/AVATARS.md).

## Deep Research sandbox demo

The additive research service uses existing KOL/SCEX data, PostgreSQL `dr_` tables, the live Surf API, encrypted reports, Solana devnet Memo evidence, and a separate pay.sh sandbox gateway. The KOL panel offers template and custom research, exact quick-report pricing, custom-report ceiling/metering, and recorded channel status. `/me` lists reports, channels, and votes for a wallet after a short-lived signature. A settled purchase lets that buyer cast one weighted support or challenge vote.

For a **real** local report, configure the ignored `.env.local` as described in the [M1 runbook](./docs/M1_RUNBOOK.md) and [database setup](./docs/DATABASE_SETUP.md). Set `SURF_API_KEY`, `DATABASE_URL`, `REPORT_ENC_KEY`, `ADMIN_TOKEN`, `OPERATOR_KEYPAIR_PATH`, devnet `SOLANA_RPC_URL`, `DEEP_RESEARCH_ENABLED=true`, `PAY_GATEWAY_ENABLED=true`, `PAY_DEMO_BUY_ENABLED=true`, `PAY_MODE=sandbox`, and the public `PAY_GATEWAY_SIGNER_WALLET` printed by `pay --sandbox account list`. Then:

~~~powershell
npm run research:migrate
npm run research:dev
# In a second terminal:
npm run pay:sandbox
# In a third terminal:
npm run dev
~~~

With `PAY_DEMO_BUY_ENABLED=true` on this Windows loopback sidecar, the KOL panel also offers **Buy with local sandbox wallet** after you enter the admin token. The button runs the real guarded demo buyer; **Check last purchase** retrieves this server process’s latest result if the browser times out. Do not blindly repeat a request that may have already paid. You can alternatively copy and run either command below. Quick reports use an MPP session; custom prompts use x402 upto:

~~~powershell
npm run pay:demo-buy -- -KolHandle <real-X-handle> -TemplateSlug risk-profile
npm run pay:demo-buy -- -KolHandle <real-X-handle> -Prompt 'Which sourced public claims about this KOL can be verified?'
~~~

The script fails before paying if real Surf/PostgreSQL readiness or the sandbox signer is missing. It pays through the pay.sh CLI's own sandbox wallet, claims the receipt after settlement, and verifies the report hash and devnet Memo. The CLI wallet remains the report owner; connecting a different Phantom/Solflare wallet in the browser does not transfer ownership. A buyer whose connected wallet paid and claimed a report can reopen it, see it in `/me`, and vote. This flow has not run against a Kolosseum report yet because Surf and PostgreSQL credentials are pending; isolated MPP/x402 protocol fixtures have passed. The browser invokes the local admin-only CLI buyer; Phantom/Solflare do not directly fund the pay.sh sandbox checkout. Latest-purchase recovery is in memory and is lost if the sidecar restarts.

Report resale remains disabled. [Surf's terms](https://asksurf.ai/terms-of-service) require written permission for commercial output use; downstream paid resale needs that permission or a replacement source with suitable rights.

## Checks

~~~bash
npm run build
npm run lint
npm run research:typecheck
npm test
npm run research:check-secrets
~~~

The app uses Vite, React, TypeScript, the existing SCEX API and R2 store, and a separate Node research service.
