# Ops — cron, CLI, health

KOL Radar uses **two** Vercel serverless functions (`api/json.ts`, `api/bin.ts`). Public URLs (`/api/feed`, `/api/media`, …) are unchanged — `vercel.json` rewrites them. Data refresh still runs on **GitHub Actions**, not Vercel cron.

## GitHub secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Required |
|--------|----------|
| `FEED_ADMIN_TOKEN` | yes (same as Vercel) |
| `R2_ACCOUNT_ID` | yes (feed media + SCEX hydrate) |
| `R2_ACCESS_KEY_ID` | yes |
| `R2_SECRET_ACCESS_KEY` | yes |
| `R2_BUCKET_NAME` | yes |
| `RADAR_API_BASE` | no (default `https://radar.daveynfts.com`) |
| `R2_PUBLIC_BASE_URL` | no |

Then Actions → **Refresh X feed** → Run workflow once before trusting the schedule. X guest GraphQL is often blocked from GitHub IPs; `--require-live` aborts instead of publishing a feed whose `generatedAt` looks fresh.

GitHub **disables scheduled workflows after 60 days without a commit**. Push anything, or run workflow_dispatch.

## Workflows

| File | When | What |
|------|------|------|
| `.github/workflows/refresh-feed.yml` | daily 00:00 ICT + manual | `refresh_feed_challenger_master.mjs --require-live` |
| `.github/workflows/refresh-scex.yml` | Monday 01:00 ICT + manual | fetch mentions → hydrate media → recompute sentiment/scores → warm avatars |

Disable the SCEX workflow if that partner page is retired.

## CLI

```bash
node scripts/radar.mjs health
node scripts/radar.mjs push followers --handle hakresearch --type recent --file followers.json
node scripts/radar.mjs hide kol --handle somehandle
node scripts/radar.mjs hide kol --handle somehandle --unhide
node scripts/radar.mjs refresh feed --require-live
```

Follower JSON is an array of `{ handle, displayName, ... }` or `{ "followers": [...] }`. Old `scripts/push_<handle>_*.mjs` files still work; new work should use this CLI.

## Admin

`#/admin/ops` reads timestamps from existing GET APIs (no extra serverless function).
