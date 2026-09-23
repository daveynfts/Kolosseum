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

## Deep Research status

M1 code adds report templates, a Surf AI server client, encrypted reports, hash verification, and Solana devnet Memo evidence. Running that flow against live services requires PostgreSQL, a Surf API key, a report encryption key, an admin token, and a devnet operator keypair. The research routes are behind DEEP_RESEARCH_ENABLED; see the [M1 runbook](./docs/M1_RUNBOOK.md) and [database setup](./docs/DATABASE_SETUP.md).

Wallet purchases, x402/MPP payment channels, votes, and resale are later milestones. The M1 demo does not charge funds or connect a wallet. Do not present an unavailable report as a completed Surf analysis.

## Checks

~~~bash
npm run build
npm run lint
npm run research:typecheck
npm test
npm run research:check-secrets
~~~

The app uses Vite, React, TypeScript, the existing SCEX API and R2 store, and a separate Node research service.
