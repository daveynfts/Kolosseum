# Session handoff — VN KOL Map

**Ngày lưu:** 2026-07-09  
**Tiếp tục:** mở project `C:\Users\caokh\vn-kol-map` và đọc file này trước.

---

## 1. Mục tiêu sản phẩm (đã thống nhất)

- **3D bubble map** KOL crypto Việt Nam.
- List KOL **curated tay** (Google Sheet), không cào auto toàn market.
- Scope map v1: **Tier 1 + Tier 2 có link X** (~105 người).
- Metric dài hạn:
  - **Base** ≈ smart followers (Surf)
  - **Hot / bubble phình** ≈ post + tương tác 24h (Surf `user-posts`)
- **Mindshare project** của Surf ≠ mindshare từng KOL — không dùng làm metric chính cho bubble người.
- Surf Chat API (20–200 cr) **không** dùng cho map; chỉ Data API social (1 cr/call) + batch 1 lần/ngày.

---

## 2. Đã làm xong hôm nay

### Project

| Item | Chi tiết |
|------|----------|
| Path | `C:\Users\caokh\vn-kol-map` |
| Stack | Vite + React + TS + `@react-three/fiber` + `drei` + Three.js |
| Dev | `npm run dev` → thường `http://localhost:5173/` |
| Build | `npm run build` (đã pass) |

### Data từ Google Sheet

- Sheet: https://docs.google.com/spreadsheets/d/1opstP7DZX2Gwkncu3JdP6X_cFDC3_kgDCnVZhW0VKRA/edit?usp=sharing
- Cột dùng: `Name, Link, Followers, Tier, Type` (đã bỏ Price, Manager khỏi product)
- Parse: **185** KOL có handle X / **182** không có X (TikTok/TG/YT…)
- Map hiện dùng: **90 KOL** Tier 1–2 còn sống trên X (đã xóa 15 account không resolve; xem `data/removed-nonexistent.json`)

| File | Vai trò |
|------|---------|
| `data/kols-from-sheet.json` | Full KOL có X (cleaned) |
| `data/kols-skipped.json` | Dòng không có X |
| `data/kols-raw.csv` | CSV thô từ sheet |
| `src/data/sheetKols.ts` | Data map (auto-gen Tier 1–2) |
| `scripts/fetch_sheet.py` | Re-fetch sheet → JSON |
| `scripts/generate_tier12_data.py` | JSON → `sheetKols.ts` |

### Avatar X

- **105/105** file trong `public/avatars/{handle}.jpg`
- Phần lớn: ảnh X thật (`pbs.twimg.com` qua fxtwitter)
- ~14 handle 404/đổi tên: **fallback gradient + initials** (`scripts/fill_missing_avatars.py`)
- UI: billboard disc + shell/wireframe/orbit 3D + sparkles
- Script: `download_avatars.py` (full), `fill_missing_avatars.py` (bù thiếu)

### UI map

- Filter: All / Tier 1 / Tier 2 + niche (Trading, Research, Airdrop, …)
- Size bubble = composite mock (followers sheet + tier + mock engagement)
- Color = primary type từ sheet
- Pulse “hot” = **vẫn mock** (chưa Surf)
- Click bubble / rank → detail (followers live, assessment, link X)

---

## 3. Chưa làm (backlog ngày mai / tiếp theo)

### Ưu tiên cao

1. **Wire Surf API** (daily cron 1×/ngày)
   - `social/user` — profile / followers
   - `smart-followers/history` — smart followers
   - `social/user/posts` — engagement 24h
   - Lưu snapshot JSON/DB → map chỉ đọc snapshot (0 credit/pageview)
2. **Admin / list tay** — CRUD handle active (hiện = sheet + script; có thể giữ Sheet làm source of truth)
3. **Fix 15 handle lỗi avatar** — rà sheet, sửa handle, re-run `download_avatars.py`

### Ưu tiên vừa

4. Score thật thay mock:  
   `score ≈ 0.55·log(smartFollowers) + 0.45·log(engagement24h)`
5. Delta vs hôm qua (bubble ↑↓)
6. Mobile fallback 2D (3D nặng phone)
7. Hosting (Vercel) + CI regenerate data

### Không làm vội

- Surf Chat / Research 2.0
- On-chain SQL / prediction markets
- “Smart followers sống ở VN” (geo) — Surf không có sẵn

---

## 4. Lệnh hay dùng

```bash
cd C:\Users\caokh\vn-kol-map

# Chạy map
npm run dev

# Cập nhật list từ Google Sheet
python scripts/fetch_sheet.py
python scripts/generate_tier12_data.py

# Tải / refresh avatar X (fxtwitter → pbs.twimg)
python scripts/download_avatars.py
```

---

## 5. Kiến trúc credit Surf (nhắc lại)

| Endpoint | ~Credits | Dùng cho |
|----------|----------|----------|
| social/* | 1 (Light) | KOL profile, posts, smart followers |
| market/project mindshare | 1 | Narrative phụ, không phải size KOL |
| Chat `surf-2.0` | 20–200 | **Tránh** |

**100 KOL × 2–3 call/ngày ≈ 200–300 cr/ngày** nếu batch 1 lần — rất rẻ so với chat.

Anonymous free **30 cr/ngày** không đủ production → cần API key.

---

## 6. File code chính

```
src/App.tsx                 # state filter, scene + HUD
src/components/Scene.tsx    # R3F canvas
src/components/KolBubble.tsx# bubble + avatar texture
src/components/Hud.tsx      # filters, rank, detail
src/components/AvatarImg.tsx
src/data/sheetKols.ts       # generated data
src/data/kols.ts            # re-export
src/types.ts                # Niche, Kol
src/lib/layout.ts           # 3D positions
src/lib/avatar.ts           # /avatars/{handle}.jpg
```

---

## 7. Context hội thoại (tóm tắt quyết định)

1. Ý tưởng marketing Web3 / Surf → chốt **KOL map VN**.
2. Mindshare Surf = project; KOL metric tự build.
3. Smart followers + hot theo post/ngày.
4. Mock 3D đẹp trước → OK.
5. Option **C**: chỉ Tier 1–2 từ sheet → done.
6. Avatar X → cache local 90/105 → done.
7. Session save (file này).

---

## 8. Prompt gợi ý mở phiên ngày mai

> Tiếp tục project `vn-kol-map` theo `SESSION.md`.  
> Ưu tiên: (1) wire Surf daily snapshot cho smart followers + posts 24h, hoặc (2) fix 15 avatar thiếu, hoặc (3) …  
> Đọc SESSION.md trước khi code.

---

*Handoff tự động — cập nhật file này mỗi khi chốt milestone lớn.*
