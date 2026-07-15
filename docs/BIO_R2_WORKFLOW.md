# KOL bio workflow — R2 is source of truth

## Display priority (map / detail Tổng quan)

1. **Cloudflare R2** via `GET /api/kols` (`kols/v1.json`)
2. localStorage cache (mirror of last successful load/save)
3. `sheetKols.ts` seed — **offline fallback only**

Seed must **never** override R2 on the client.

## When Grok / admin updates a bio

1. Prepare text (bullets OK; use `\n` line breaks).
2. Push to R2:

```bash
# Token = Vercel FEED_ADMIN_TOKEN (same as Admin → Feed / Save all)
set FEED_ADMIN_TOKEN=your_token   # PowerShell: $env:FEED_ADMIN_TOKEN="..."

node scripts/push_kol_bio.mjs --handle emilyyvuong --bio-file data/bio-patches/emilyyvuong.txt --followers 182312
```

Or multi-handle JSON:

```bash
node scripts/push_kol_bio.mjs --from-json data/bio-patches/batch.json
```

`batch.json` example:

```json
{
  "emilyyvuong": { "bio": "...", "followers": 182312 },
  "thuancapital": { "bio": "...", "followers": 595900 }
}
```

3. Hard-refresh map — no need to touch `sheetKols.ts` for live users.
4. Optional: keep a copy under `data/bio-patches/{handle}.txt` for git history.

## Admin UI

- Edit bio in **Admin → Editor** → **Save all** (requires token) also writes R2.
- Prefer R2 path for all public-facing assessment text.

## Local token

Put non-empty `FEED_ADMIN_TOKEN=...` in `.env.local` (gitignored) so CLI scripts can push without pasting each time.
