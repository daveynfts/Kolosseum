# VN KOL Map (3D)

> **Kolosseum branch:** SCEX view giữ dữ liệu/luồng cũ và có skin đấu trường La Mã. M1 bổ sung Deep Research từ Radar + Surf thật, lưu PostgreSQL và xác minh Memo Solana devnet; cần cấu hình dịch vụ trước khi tạo report. Xem [M1 runbook](./docs/M1_RUNBOOK.md), [tạo database](./docs/DATABASE_SETUP.md), [Discovery](./docs/DISCOVERY.md) và [kế hoạch](./docs/PLAN.md). Payment x402/MPP và bán lại là các mốc sau M1, chưa hoạt động.

Interactive 3D bubble map of Vietnamese crypto KOLs (Tier 1–2 from curated Google Sheet).

> **Tiếp tục làm việc:** đọc [`SESSION.md`](./SESSION.md) trước (handoff phiên 2026-07-09).

## Run

```bash
cd vn-kol-map
npm install
npm run dev
```

Open `http://localhost:5173/`.

Ops (cron, CLI, data health): [`docs/OPS.md`](./docs/OPS.md).

## Data pipeline

```bash
# 1) Pull Google Sheet → data/kols-from-sheet.json
python scripts/fetch_sheet.py

# 2) Generate Tier 1–2 map data → src/data/sheetKols.ts
python scripts/generate_tier12_data.py

# 3) Download X avatars → public/avatars/{handle}.jpg
python scripts/download_avatars.py
```

## What’s real vs mock

| Source | Fields |
|--------|--------|
| Google Sheet | name, handle, followers, tier, type |
| X (cached) | profile photo (~90/105) |
| Mock (until Surf) | smart followers, 24h engagement, hot pulse |

## Stack

Vite · React · TypeScript · Three.js · React Three Fiber · Drei
