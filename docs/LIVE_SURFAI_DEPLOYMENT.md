# Live SurfAI on Solana Devnet

The paying wallet is the report author. Each report uses a fresh Surf Responses request after its SOL payment reaches **finalized**. Source coverage comes from the KOL's available Radar snapshot (up to 50 posts), not an assertion of exhaustive real-time coverage. Surf has a 30-minute timeout. Closing the browser does not cancel the worker.

## Railway deployment

Use a separate persistent Railway service with `RAILWAY_DOCKERFILE_PATH=Dockerfile.research`. Do not enable service sleeping/serverless mode. Start with one replica. Configure `/healthz` as its health check with a 120-second timeout. The image runs idempotent database migrations before starting the API and worker. The health check never calls Surf. There is deliberately no root `railway.json` that could change the existing frontend service's build.

1. Authenticate the Railway CLI in the intended account, create/link a project and provision PostgreSQL (or supply the existing managed PostgreSQL URL).
2. Configure the server variables below through Railway's secret settings. Never put secrets in `VITE_` variables, committed files or CLI output.
3. Deploy the repository using `railway up`, generate an HTTPS domain, then set `REPORT_NFT_PUBLIC_BASE_URL` to that origin, without `/live` or `/dr-api`.
4. The Vercel rewrite forwards `/dr-api/live/*` to `https://surfai-api-production.up.railway.app/live/*`. Deploy the frontend changes to enable it. For other hosts, set `VITE_RESEARCH_API_URL` to the backend HTTPS origin. Add the frontend origin to `RESEARCH_ALLOWED_ORIGINS`.
5. Verify `/healthz`, `/live/catalog?handle=helenvn88`, preflight CORS, and the full wallet flow. The catalog is read-only; requesting a quote does not call Surf. A finalized payment **does** spend real Surf API credits even though the payment uses valueless Devnet SOL.

| Server variable | Value/purpose |
| --- | --- |
| `SURF_LIVE_ENABLED` | `true` |
| `DATABASE_URL` | PostgreSQL connection URL; enable backups |
| `SURF_API_KEY` | Server-only Surf platform key |
| `REPORT_ENC_KEY` | Existing 32-byte hex encryption key; back up securely and retain across deployments |
| `LIVE_OPERATOR_SECRET_KEY` | JSON array for a dedicated Devnet treasury keypair; fund it for refund transaction fees |
| `SOLANA_RPC_URL` | Reliable Solana Devnet RPC; server checks genesis |
| `REPORT_SOL_TREASURY` | Optional treasury public key; must match the operator |
| `REPORT_NFT_PUBLIC_BASE_URL` | Public HTTPS backend origin hosting metadata |
| `REPORT_APP_PUBLIC_URL` | Frontend HTTPS origin for NFT report links |
| `RESEARCH_ALLOWED_ORIGINS` | Comma-separated exact frontend origins |
| `SURF_LIVE_DAILY_CREDIT_CAP` | Default `1000` credits across jobs started in the previous 24 hours |
| `RADAR_API_BASE` | Defaults to `https://radar.daveynfts.com` |
| `DEEP_RESEARCH_ENABLED` | `false` unless explicitly enabling legacy admin flows |
| `PAY_DEMO_BUY_ENABLED` / `DEMO_REPLAY_ENABLED` | `false` in hosting |

Railway supplies `PORT`; the image sets `RESEARCH_HOST=0.0.0.0`. Render can run the same Dockerfile as an always-on web service with PostgreSQL and the same variables/health check.

## Pricing and recovery

Configured published tiers: low 50 credits ($0.30), medium 120 ($0.72), high 150 ($0.90), xhigh 200 ($1.20), at $0.006 per credit. Quotes use the server's live SOL/USD rate and round lamports upward; expire after 60 seconds. Network and mint costs are separate. These are published prices, not a claim that Surf returned a measured credit debit. Review rates against [Surf documentation](https://docs.asksurf.ai/chat/responses) before launch.

Signed transaction bytes and signatures are persisted before broadcast. An uncertain broadcast is reconciled using the original signature; no second payment is automatically created. Only finalized payment queues research. Each job records that its Surf call started before contacting the provider, so crashes cannot cause an automatic second paid call. Stale workers fail after 35 minutes without a heartbeat; failed research exposes a one-time SOL research-fee refund from the original treasury. Network fees are excluded. Unresolved chain signatures remain pending for manual investigation instead of risking double collection/refund.

## NFT and permission semantics

The Metaplex Core NFT contains an immutable report hash, report ID, author and HTTPS metadata URI. The report itself remains encrypted in PostgreSQL. Viewing modes are author-only, current holder plus author, wallet allowlist, or public. Server reads current finalized on-chain ownership; former holders lose holder access. Recipients open `/me?report=<id>` from NFT metadata or enter the report ID in My Reports.

The original author holds the Permanent Freeze Delegate authority and may freeze/unfreeze transfers even after resale. The UI discloses this before purchase and in metadata. Freezing blocks gifts as well as marketplace transfers. The built-in transfer action is a **gift with no sale settlement**; an internal marketplace, enforced royalties and automatic marketplace discovery are outside this implementation. See [Metaplex Permanent Freeze Delegate](https://www.metaplex.com/docs/smart-contracts/core/plugins/permanent-freeze-delegate).

Viewing controls depend on the running backend and retained encryption key. Making a report public or granting access cannot erase copies a reader saved. NFT ownership does not assign copyright or authorship of the analyzed KOL's posts. Metadata is hosted, not permanently stored on-chain; preserve the backend domain and database. Minting checks the public metadata response before preparing the transaction.

## Local validation

Use Node 24. Run `npm run research:migrate`, start backend and Vite with `SURF_LIVE_ENABLED=true`. Existing `.env.local` is loaded by the backend; never commit it.

To test the local frontend against Railway, set `LIVE_RESEARCH_PROXY_TARGET=https://surfai-api-production.up.railway.app` in `.env.local`; this overrides only live routes and leaves the legacy local sidecar routes intact.

- `npm run lint`, `npm run research:typecheck`, `npm run build`, `npm test`, `npm run research:check-secrets`.
- `npx tsx scripts/research/live-smoke.ts`: browser flow with ephemeral wallet and mocked API; no real payment or Surf request.
- `npx tsx scripts/research/simulate-live.ts`: real Devnet simulation of frozen and allowed transfers; no broadcast.
- Integration tests require a separate `TEST_DATABASE_URL` whose database is named `kolosseum_test`. They mock chain/Surf and remove their own fixtures.

Before public use, complete a real Phantom/Solflare Devnet payment, a real Surf completion, mint, transfer to a second wallet, author freeze after transfer, and viewing-policy revocation. Automated tests and simulations do not substitute for this wallet smoke test.
