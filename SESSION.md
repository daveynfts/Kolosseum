# Session handoff — VN KOL Radar + SCEX

**Cập nhật:** 2026-07-27  
**Workspace:** `C:\VibeCode\KOL Radar`  
**Prod:** https://radar.daveynfts.com  

> Đọc file này trước khi tiếp tục. README gốc vẫn mô tả pipeline Sheet → map 3D; **partner SCEX + R2** là lớp sản phẩm đã phát triển sau.

---

## 1. Sản phẩm (hai mặt)

| Mặt | URL / route | Vai trò |
|-----|-------------|---------|
| **Map Radar** | `/` (3D + list) | KOL crypto VN curated |
| **SCEX Partner** | route SCEX tracking page | Ma trận mention + livefeed cho SCEX |
| **Admin** | `/#/admin` (token) | Feed, KOL, SCEX, reports, smart/recent followers |

---

## 2. Ghi chú quan trọng (đừng quên)

### R2 = source of truth (server)

- Cloudflare R2 bucket; API Vercel: `api/*.ts` → `lib/server/r2.ts`.
- Key objects hay dùng:
  - `recent-followers/v1.json` — recent + **smartMap**
  - KOL list, feed, SCEX tracking, kol-reports (xem từng API)
- **PUT** cần `FEED_ADMIN_TOKEN` (Bearer). Token local: `.env.local` / `.env.production.local`.
- Client load: **server → cache localStorage → seed code**. Nếu R2 có key mà thiếu 1 handle, seed vẫn fallback **từng handle** (smart/recent).

### SCEX UI (partner)

- **Chỉ 2D** — đã **xóa 3D** + toggle (`ScexMatrix3D.tsx` removed).
- Story matrix: 4 nhãn trục (uy tín / bài đăng), tooltip table, zone theo **vị trí pixel vs crosshair**.
- Nhãn vùng partner (không dùng jargon R2 cũ):
  - `stars` → **Ưu tiên hợp tác** (không “Trọng điểm”)
  - `nurture` → **Có tiềm năng** (không “Nuôi dưỡng”)
  - `noise` → **Cần rà soát**
  - `ignore` → **Ít ưu tiên**
- Helper: `partnerQuadrantTitle()`, `viVolumeAxisLabel()`, `viQualityAxisLabel()` trong `src/data/scexTracking.ts`.
- Detail KOL quick stats (PA A): **Số mention · Tần suất · Uy tín · Followers · Bài trong feed**.
- “Davey's Radar” → link `https://radar.daveynfts.com/` (`DaveysRadarLink.tsx`).
- Banner SCEX: pill **nhận ngay 1 tỷ VND** (không pill VNĐ riêng).

### Smart / Recent Followers

| KOL | Loại | Nơi seed | R2 |
|-----|------|----------|-----|
| `@henvaibta` | **Smart** (9, Tier A/B) | `SMART_FOLLOWERS_BY_HANDLE.henvaibta` | ✅ đã PUT |
| `@HakResearch` | **Recent** (9 + score) | `RECENT_FOLLOWERS_BY_HANDLE.hakresearch` | ✅ đã PUT |

- Interface: `RecentFollower` (+ optional `score`), `SmartFollower` (`role`, `followers`, `influenceScore`).
- Push scripts:
  - `scripts/push_henvaibta_smart_followers.mjs`
  - `scripts/push_hakresearch_recent_followers.mjs`
- UI panel: `RecentFollowersPanel.tsx` (tabs Smart / Recent).

### Avatar

- Local: `public/avatars/{handle}.jpg` (case-sensitive trên R2).
- `XProfileAvatar`: R2 → proxy → unavatar → optional live fxtwitter.
- R2 avatar key case-sensitive — luôn thử variants handle.

### Env cần có

| Biến | Dùng |
|------|------|
| `FEED_ADMIN_TOKEN` | PUT API admin |
| `R2_*` | Server Vercel / script R2 (prod) |
| `RADAR_API_BASE` | optional override API (default `https://radar.daveynfts.com`) |

---

## 3. Đường dẫn file làm việc (hay đụng)

### SCEX partner page

| File | Việc |
|------|------|
| `src/pages/ScexTrackingPage.tsx` | Page chính matrix + feed + filters |
| `src/pages/ScexTrackingPage.css` | Layout, axis labels, tooltip, detail |
| `src/components/ScexMatrix2D.tsx` | Ma trận 2D, zoom, pack, tooltip |
| `src/components/ScexKolDetail.tsx` | Panel chi tiết KOL |
| `src/components/ScexEventBanner.tsx` | Banner đầu trang |
| `src/components/DaveysRadarLink.tsx` | Link brand Radar |
| `src/data/scexTracking.ts` | Types, scoring, quadrant labels, helpers |
| `src/data/internal/scex-tracking.json` | Seed SCEX dataset |
| `api/scex-tracking.ts` | GET/PUT SCEX trên R2 |

### Map Radar + KOL data

| File | Việc |
|------|------|
| `src/data/sheetKols.ts` | Seed KOL map (gen từ sheet) |
| `src/types.ts` | `Kol`, niches, tiers |
| `src/App.tsx` / `src/App.css` | Shell map 3D |
| `data/kols-from-sheet.json` | Sheet parse |
| `scripts/fetch_sheet.py` | Pull Google Sheet |
| `scripts/generate_tier12_data.py` | → sheetKols.ts |

### Smart / Recent followers

| File | Việc |
|------|------|
| `src/data/recentFollowers.ts` | **Seed** recent + smart lists |
| `src/lib/recentFollowersStore.ts` | Load/save R2 + cache |
| `src/components/RecentFollowersPanel.tsx` | UI trong detail |
| `src/pages/AdminRecentFollowersEditor.tsx` | Admin CRUD |
| `api/recent-followers.ts` | GET/PUT `recent-followers/v1.json` |
| `scripts/push_*_followers.mjs` | One-shot publish R2 |

### Admin / reports / feed

| File | Việc |
|------|------|
| `src/pages/AdminDashboard.tsx` | Hub admin |
| `src/pages/AdminScexEditor.tsx` | Editor SCEX |
| `src/pages/AdminKolReportsEditor.tsx` | KOL Reports (MD/R2) |
| `api/kols.ts`, `api/feed.ts`, `api/kol-reports.ts` | R2 backends |
| `docs/FEED_SERVER.md` | Feed server notes |
| `docs/BIO_R2_WORKFLOW.md` | Bio/R2 workflow |

### Config / deploy

| File | Việc |
|------|------|
| `.env.local` | Token + secrets local (không commit) |
| `.env.example` | Template env |
| `vercel.json` | Deploy routes |
| `lib/server/r2.ts` | R2 client + object keys |

---

## 4. Lệnh thường dùng

```bash
cd "C:\VibeCode\KOL Radar"
npm run dev          # http://localhost:5173/
npm run build        # tsc + vite

# Publish followers lên R2 (cần FEED_ADMIN_TOKEN)
node scripts/push_henvaibta_smart_followers.mjs
node scripts/push_hakresearch_recent_followers.mjs
```

---

## 5. UX SCEX đã chốt gần đây

- Tooltip bubble: **bảng** Vùng / Tần suất / Uy tín / Góc nhìn / Reach (chỉ followers).
- Vùng tooltip = **vị trí visual** so crosshair (không tin `actor.quadrant` stale).
- Nhãn trục L/R: dọc mặc định, **hover → ngang**.
- Nhãn trục T/B: giữa cạnh trên/dưới plot (“đỉnh trục”).
- Fullscreen: detail z-index > matrix (20100+).
- Không còn 3D / toggle 2D-3D.

---

## 6. Backlog gợi ý (không chặn)

1. Merge thêm smart lists (Martin seed) lên R2 nếu cần online parity.
2. Warm avatars cho smart/recent handles mới (`scripts/warm_smart_follower_avatars.mjs`).
3. Admin UI nhập score cho Recent followers.
4. Đồng bộ `quadrantLabels` trên R2 SCEX config (bỏ TRỌNG ĐIỂM trong JSON server).

---

*File này là handoff ngắn; chi tiết API feed/R2 xem `docs/`.*
