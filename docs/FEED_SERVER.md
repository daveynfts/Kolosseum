# Phase 1 — Server Feed + media on **Cloudflare R2**

Shared Tier-1 feed JSON and cached tweet images live in **R2** (object storage).

## Why R2

- Free tier **~10 GB** storage (check Cloudflare dashboard; higher than Redis free 256 MB)
- No egress fees for typical public access patterns
- Better for images than base64-in-Redis

## Setup (one-time)

### 1. Cloudflare R2

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2**
2. **Create bucket** e.g. `vn-kol-map`
3. **Manage R2 API Tokens** → Create token  
   - Permission: **Object Read & Write**  
   - Apply to that bucket  
4. Copy: **Access Key ID**, **Secret Access Key**, **Account ID**

### 2. Vercel env

Project → **Settings → Environment Variables** (Production + Preview):

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=vn-kol-map
FEED_ADMIN_TOKEN=your-admin-password
```

Optional public media CDN (same as **daveynfts.com**):

```
R2_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
# or alias used by daveynfts-review:
R2_PUBLIC_URL=https://...
```

(Enable public access on bucket or use custom domain.)

### Reuse env from daveynfts.com

If KOL Radar shares the same R2 bucket/token as the main site, **copy the same variables** from that Vercel project into VietNamKOLsRadar:

| Variable | Same as daveynfts? |
|----------|-------------------|
| `R2_ACCOUNT_ID` | Yes |
| `R2_ACCESS_KEY_ID` | Yes |
| `R2_SECRET_ACCESS_KEY` | Yes |
| `R2_BUCKET_NAME` | Yes (shared bucket OK) |
| `R2_PUBLIC_URL` | Yes (alias supported) |
| `FEED_ADMIN_TOKEN` | **New** — only for KOL feed write |

Objects are namespaced: `feed/v1.json`, `media/{id}` — will not overwrite random daveynfts upload paths if those use different key prefixes.

### 3. Redeploy

## Object layout

| Key | Content |
|-----|---------|
| `feed/v1.json` | Full feed JSON |
| `media/{hash}` | Cached tweet images |

## Admin usage

1. `#/admin/feed`
2. Paste **FEED_ADMIN_TOKEN** → Save token  
3. Paste X URL → **Fetch từ X** (snapshot + cache ảnh → R2)  
4. **Save to server** (feed JSON → R2)

## API

| Method | Auth | Effect |
|--------|------|--------|
| `GET /api/feed` | no | Read `feed/v1.json` |
| `PUT /api/feed` | Bearer admin | Write feed |
| `DELETE /api/feed` | Bearer admin | Delete feed object |
| `GET /api/x-status?url=` | Bearer if token set | Fetch X + cache images to R2 |
| `GET /api/media?id=` | no | Proxy image from R2 |
| `GET /api/feed?debug=1` | no | Env presence (no secrets) |

## Load priority (client)

1. Server `GET /api/feed` (R2)  
2. `localStorage` cache  
3. Seed `public/feed/tier1-feed.json`

## Local dev

`npm run dev` does not run `/api/*`. Use `npx vercel dev` with env, or test on Vercel.

## Migrating off Redis / Upstash

You can **remove** KV/Upstash env vars from this project.  
Old Redis data is **not** auto-migrated — re-**Fetch** posts or **Save to server** again from Admin.

## Security

- Keep R2 keys and `FEED_ADMIN_TOKEN` only on Vercel (never commit).  
- Prefer private bucket + `/api/media` proxy if you do not need public r2.dev.
