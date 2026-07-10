# Phase 1 — Server Feed (Upstash Redis on Vercel)

Shared Tier 1 Feed for all visitors via `GET/PUT /api/feed`.

## Setup (one-time)

1. [Vercel Dashboard](https://vercel.com) → project **VietNamKOLsRadar**
2. **Storage / Marketplace** → add **Upstash Redis** → Connect to project  
   (injects `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
3. **Settings → Environment Variables** → add:
   ```
   FEED_ADMIN_TOKEN=<chuỗi bí mật dài>
   ```
4. Redeploy project

## Admin usage

1. Open `#/admin/feed`
2. Paste the same secret into **Server token** → Save token
3. Edit posts → **Save local** and/or **Save to server**
4. Map Feed panel loads **server first** for every user

## API

| Method | Auth | Effect |
|--------|------|--------|
| `GET /api/feed` | no | Read shared JSON |
| `PUT /api/feed` | `Authorization: Bearer <FEED_ADMIN_TOKEN>` | Write |
| `DELETE /api/feed` | Bearer | Clear server feed |
| `GET /api/x-status?url=` | Bearer if `FEED_ADMIN_TOKEN` set | Fetch X post snapshot + cache images |
| `GET /api/media?id=` | no | Serve cached image from Redis |

### Paste X URL (Admin)

1. Dán `https://x.com/user/status/...`
2. **Fetch từ X** → text, eng, media (snapshot)
3. Ảnh được lưu Redis → URL `/api/media?id=...` (còn hiện nếu tweet xóa / X lỗi)
4. **Save to server** để mọi user thấy

## Load priority (client)

1. Server (`/api/feed`)  
2. `localStorage` cache  
3. Seed `public/feed/tier1-feed.json`

## Local dev

`npm run dev` does **not** run `/api/*`.  
Admin saves to localStorage only until you use `vercel dev` or deploy.

```bash
npx vercel dev
```

## Security note

Token in the browser is visible to whoever has Admin URL + token.  
Treat `FEED_ADMIN_TOKEN` like a password; rotate if leaked.
