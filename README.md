# VN KOL Map (3D)

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
