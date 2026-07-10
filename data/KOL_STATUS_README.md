# KOL live status (thay mock)

**Cập nhật:** chạy `python scripts/analyze_kols_live.py`  
**Nguồn:** profile X qua `api.fxtwitter.com` (followers, tweets, following, verified, joined, media…)

## File

| File | Nội dung |
|------|----------|
| `kol-live-profiles.json` | Full metrics live |
| `kol-status.json` | Bản gọn: status + assessment từng KOL |
| `../src/data/sheetKols.ts` | Data map (score + bio = assessment) |

## Cách đọc status

| Label | Ý nghĩa (ước từ lifetime rate) |
|-------|--------------------------------|
| **hot** | ≥ ~8 post/ngày hoặc mega + đăng dày |
| **active** | ~3–8 post/ngày |
| **stable** | ~1–3 post/ngày |
| **quiet** | ~0.3–1 post/ngày |
| **dormant** | < ~0.3 post/ngày |

## Giới hạn (minh bạch)

- **Không** phải Smart Followers chính thức của Surf/X.
- `posts/day` ước từ **tổng tweets / tuổi account** — account cũ từng spam có thể bị over-estimate; account mới post mạnh có thể under-estimate.
- Đánh giá là **khách quan theo số liệu profile**, không đọc hết timeline 90 người từng bài.
- True 24h engagement → cần Surf `user-posts` hoặc X API batch.

## Map UI

- Bubble size / score: followers live + pace
- Click KOL → panel hiện **assessment** + status tag + Δ% so với followers trên Google Sheet
