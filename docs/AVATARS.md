# Avatar sync

Kolosseum reuses the existing Radar Cloudflare R2 bucket. This is an internal object-key prefix, not a link to the old Radar UI.

- Live source: GET /api/scex-tracking on RADAR_API_BASE.
- R2 key: radar/avatars/{X handle}.jpg (R2 keys are case-sensitive).
- Browser read path: the public Radar media route at https://radar.daveynfts.com/r2/radar/avatars/{handle}.jpg in production; local Vite proxies /r2/radar/avatars/{handle}.jpg to the same source. Successful images are cached for one week. A custom CDN can replace this with VITE_R2_PUBLIC_URL.
- Write path: authenticated PUT /api/avatar?handle={handle}; the existing server fetches the current X avatar and writes it to R2. No new local image files are created.

The sync command first checks the actor's existing avatarUrl key, then the handle's exact-case and lowercase R2 keys. A successful image HEAD means no upload. A 404 means that key is absent. Other HTTP statuses are errors, never treated as an invitation to overwrite.

## Read-only audit

~~~bash
npm run avatars:sync
node scripts/warm_scex_avatars.mjs --limit 50 --concurrency 3
~~~

The summary reports live actor/post counts, unique handles, existing images, missing images, and failed checks.

## Upload missing images

Put FEED_ADMIN_TOKEN in .env.local. The token must match the existing API's server-side secret. Do not use a VITE_ prefix, which would expose it to the browser. Then run:

~~~bash
npm run avatars:sync:apply
~~~

The script prints progress and any failed handles. Re-running is safe: existing R2 images are skipped. Some deleted or renamed X accounts cannot be fetched; those handles stay in the failure list for a later retry. A dry run and an upload use the same live dataset, so if the dataset changes between runs the counts can differ.

RADAR_API_BASE defaults to https://radar.daveynfts.com. Point it to a different compatible deployment only when that deployment owns the intended bucket.

The existing weekly GitHub Actions SCEX refresh runs this same sync with --apply after it updates the live dataset. Configure FEED_ADMIN_TOKEN in the repository's GitHub Actions secrets as well as locally if you want scheduled uploads; the workflow already uses that secret for the SCEX refresh steps.
