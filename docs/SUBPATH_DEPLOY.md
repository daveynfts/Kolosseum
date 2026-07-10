# Domain: `radar.daveynfts.com`

## Architecture

```
https://radar.daveynfts.com/*
        │  DNS CNAME → Vercel
        ▼
https://vietnamkolsradar.vercel.app  (project: vietnamkolsradar)
```

No reverse-proxy through daveynfts.com — main site stays independent (no extra hop).

## Setup checklist

### 1. Vercel (project **vietnamkolsradar**)

1. **Settings → Domains** → Add `radar.daveynfts.com`
2. Follow Vercel DNS instructions (usually CNAME `radar` → `cname.vercel-dns.com`)

### 2. DNS (Cloudflare / domain registrar)

If DNS is on Cloudflare for `daveynfts.com`:

| Type | Name | Target |
|------|------|--------|
| CNAME | `radar` | `cname.vercel-dns.com` |

Proxy (orange cloud) optional; Vercel SSL works either way (if proxied, SSL mode Full).

### 3. App config

- Vite `base: '/'` (default)
- APIs: `/api/feed`, `/api/media`, `/api/x-status`
- Admin: `https://radar.daveynfts.com/#/admin`
- Feed admin: `https://radar.daveynfts.com/#/admin/feed`

### 4. Remove old subpath (if added)

On **daveynfts.com** Vercel project, remove rewrites for `/vietnamkolradar` so traffic goes only to the subdomain.

## R2 / env

Keep R2 + `FEED_ADMIN_TOKEN` on **vietnamkolsradar** project (can mirror keys from main site).
