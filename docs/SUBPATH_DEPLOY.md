# Deploy under `daveynfts.com/vietnamkolradar`

## Architecture

```
https://daveynfts.com/vietnamkolradar/*
        │  rewrite (main site Vercel project)
        ▼
https://vietnamkolsradar.vercel.app/*
        │  Vite base = /vietnamkolradar/
        ▼
Static assets + /api/* (feed, media, x-status)
```

## 1. KOL app (`VietNamKOLsRadar` / vietnamkolsradar)

- Vite `base: '/vietnamkolradar/'` (see `vite.config.ts`)
- Production URL: `https://vietnamkolsradar.vercel.app`
- Client paths use `withBase()` so `/api/feed` → `/vietnamkolradar/api/feed`

## 2. Main site (`daveynfts.com`)

On the **Vercel project that serves daveynfts.com** (currently `personal-news-board`), add rewrites:

```json
{
  "source": "/vietnamkolradar",
  "destination": "https://vietnamkolsradar.vercel.app"
},
{
  "source": "/vietnamkolradar/",
  "destination": "https://vietnamkolsradar.vercel.app/"
},
{
  "source": "/vietnamkolradar/:path*",
  "destination": "https://vietnamkolsradar.vercel.app/:path*"
}
```

Same pattern as existing `/papercut` and `/agentswindler` rewrites.

If the live site is another repo than `daveynfts-review`, copy these rewrites there too.

## 3. URLs

| Page | URL |
|------|-----|
| Map | https://daveynfts.com/vietnamkolradar/ |
| Admin | https://daveynfts.com/vietnamkolradar/#/admin |
| Feed admin | https://daveynfts.com/vietnamkolradar/#/admin/feed |
| API | https://daveynfts.com/vietnamkolradar/api/feed |

Direct Vercel URL still works: `https://vietnamkolsradar.vercel.app/vietnamkolradar/`  
(with base path; root `/` may 404 assets — prefer subpath or set `VITE_BASE_PATH=/` for standalone only).

## 4. Local dev

```bash
# default base /vietnamkolradar/
npm run dev
# open http://localhost:5173/vietnamkolradar/

# root base (optional)
set VITE_BASE_PATH=/
npm run dev
```

## 5. R2 / env

R2 env vars stay on **vietnamkolsradar** Vercel project (can mirror daveynfts R2 credentials). API is hit via the rewrite path; still executed on the KOL deployment.
