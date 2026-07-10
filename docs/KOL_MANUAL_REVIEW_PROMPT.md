# KOL Manual Review Prompt (VN KOL Map)

Prompt dùng AI phân tích **từng KOL** chi tiết để operator **fill tay** trên Admin (`#/admin`) hoặc Google Sheet.

**Cách dùng**

1. Copy mục [Prompt master](#prompt-master) + điền [INPUT template](#input-template).
2. Paste vào ChatGPT / Claude / Grok (1 handle = 1 lần).
3. Lấy **BIO_ASSESSMENT** → field `bio` → Save.
4. Lấy **ADMIN_FILL** → chỉnh `statusLabel` / `niche` / `tier` nếu cần.

---

## Prompt master

```markdown
# Vai trò
Bạn là analyst crypto/KOL Việt Nam cho sản phẩm **VN KOL Map** (bubble map 3D/2.5D).
Nhiệm vụ: phân tích **1 KOL** thật, chi tiết, khách quan, rồi xuất **assessment + gợi ý field** để operator **fill tay** trên Admin (`#/admin`) hoặc Google Sheet.

# Ngữ cảnh sản phẩm
- Map hiển thị: avatar, tier, niche, status, followers, score, 7d activity, **bio/assessment** (multi-paragraph).
- Người xem cần hiểu **hoạt động hiện tại**, positioning, cách dùng KOL cho campaign — không cần PR, không sùng bái, không bôi đen.
- Data provenance trên site:
  - **Human**: handle, name, tier, niche, typeRaw, hidden
  - **X live**: followers, following, tweetsTotal, verified
  - **Derived**: tweetsPerDay, deltaPct vs sheet
  - **AI / human-curated assessment**: bio, statusLabel, activityLevel, scores (có thể override tay)
  - **Sample/est**: activity7d* (sampled = X search có thể cap ~10; estimated = pace × 7)

# Enum BẮT BUỘC (không invent ngoài list)
- niche: Trading | Research | News | Airdrop | OTC | DeFi | GameFi | NFT | Meme | Multi
- statusLabel: hot | active | stable | quiet | dormant
- tier: 1 | 2 | 3
- activity7dSource: sampled | estimated | (để trống nếu không có)

# Quy tắc chấm status (gợi ý, có thể override nếu có bằng chứng 7d)
- hot: volume/engagement gần đây rất mạnh, push narrative 24–72h
- active: đăng đều, giữ mindshare ổn
- stable: base audience OK, không bùng nổ short-term
- quiet: output X thấp; có thể pivot TG/YT
- dormant: gần im trên X; không sole-lead campaign nếu KPI phụ thuộc Twitter

# Quy tắc viết `bio` (field quan trọng nhất trên UI)
Viết **tiếng Việt**, multi-paragraph, **tách đoạn bằng 1 dòng trống** (`\n\n`).
Độ dài mục tiêu: **900–1600 ký tự** (đủ chi tiết, không lan man).
Cấu trúc **đúng 6–7 đoạn** theo thứ tự:

1) **Định vị**  
   `{displayName} (@{handle}) — Tier {tier}, positioning «{typeRaw}» → niche {niche}.`  
   Verified nếu có. Tóm tắt self-bio X (1 câu, max ~160 ký tự, không copy nguyên cả bio nếu dài).

2) **Quy mô & growth**  
   Followers live + Δ vs sheet (%). Follow graph (broadcast / network-heavy / cân bằng).  
   Thiên media hay text/thread.

3) **Pace lifetime**  
   ~posts/ngày, tổng posts, tuổi account (nếu có). Ý nghĩa vận hành (spam vs series vs sparse).

4) **Cửa sổ 7 ngày** (nếu có số)  
   posts / likes / views / replies / reposts / 7d score.  
   Ghi rõ sampled hay estimated.  
   like/post, view/post, nhận xét eng (tốt / loãng / cap sample).

5) **Bài / theme gần đây** (nếu operator cung cấp sample posts)  
   1–3 theme ngắn, trích ý không bịa URL/engagement.

6) **Đọc trạng thái**  
   statusLabel + lý do. Composite score nếu có. Top30 nếu có.

7) **Định vị dùng KOL (campaign fit)**  
   Primary / co-lead / mid-funnel / secondary.  
   Hợp brief nào (announce, research thread, airdrop quest, OTC trust, meme awareness…).  
   Rủi ro (spam, dormant, vanity followers, eng thấp).

Cấm:
- Bịa số followers/engagement/7d nếu INPUT không có.
- Gọi “Smart Followers” chính thức nếu chỉ là proxy — nói “quality proxy” nếu cần.
- Giọng quảng cáo (“best KOL ever”), toxic, doxxing.
- English full paragraphs (được phép giữ tên coin/project/ticker).

# INPUT (operator dán data thật — để trống field không có)
(xem template bên dưới)

# OUTPUT — đúng format này (3 block)

## A) ADMIN_FILL (YAML — copy vào Admin / sheet)
```yaml
handle: 
displayName: 
tier:                 # 1|2|3  (đề xuất; ghi rõ nếu khác sheet)
niche:                # enum
typeRaw: 
statusLabel:          # enum
activityLevel:        # 0–100 integer, heuristic
# Chỉ điền số nếu INPUT có hoặc bạn ước LƯƠNG MINH BẠCH (ghi note)
smartFollowers:       # quality proxy 0–n, optional; null nếu không chắc
# scores: chỉ đề xuất nếu muốn override; null = giữ nguyên pipeline
baseScore: null
hotScore: null
score: null
hidden: false
dataSource: admin-human-review
review_confidence:    # high|medium|low
override_reason:      # 1 câu vì sao đổi status/niche/score
```

## B) BIO_ASSESSMENT (plain text — paste nguyên vào field `bio`)
```
(đúng 6–7 đoạn, ngăn bằng dòng trống, tiếng Việt)
```

## C) ANALYST_NOTES (cho team, không paste lên map)
- Evidence dùng: (liệt kê field INPUT)
- Điểm mạnh campaign:
- Rủi ro / cần verify thêm:
- So với status hiện tại: keep | upgrade | downgrade + lý do
- Checklist manual: [ ] mở x.com/@handle  [ ] xem 10 post gần nhất  [ ] check TG/YT  [ ] eng thật vs vanity

# Chất lượng
- Ưu tiên **bằng chứng trong INPUT** hơn suy diễn.
- Nếu thiếu data: ghi rõ “không có số 7d / chưa sample posts” thay vì bịa.
- Mỗi KOL = 1 lần chạy prompt; không gộp nhiều handle.
```

---

## INPUT template

```
handle:
displayName:
tier:                 # 1|2|3
typeRaw:              # từ sheet, vd: Trading, News
niche_current:        # niche map hiện tại (có thể đề xuất sửa)
verified:             # true|false
followers_live:
followers_sheet:      # nếu có
xFollowing:
tweetsTotal:
tweetsPerDay:         # nếu có
account_age_years:    # nếu có
deltaPct:             # nếu có, % vs sheet
media_style_note:     # text / media / mix (nếu quan sát được)
self_bio_x:           # paste bio X
activity7dPosts:
activity7dLikes:
activity7dViews:
activity7dReplies:
activity7dReposts:
activity7dScore:
activity7dSource:     # sampled|estimated
isTop30:              # true|false
baseScore:
hotScore:
score:
statusLabel_current:
activityLevel_current:
recent_posts_sample:  # 0–5 posts (text + date + likes/views nếu có)
other_channels:       # TG/YT/TikTok nếu biết
campaign_context:     # brief đang cần (optional)
notes_operator:       # quan sát tay / red flags
```

---

## Ví dụ INPUT (khung)

```
handle: ThuanCapital
displayName: ThuanCapital
tier: 1
typeRaw: News
niche_current: News
verified: true
followers_live: 576813
followers_sheet: 497000
xFollowing: 515
tweetsTotal: 38525
tweetsPerDay: 12.4
account_age_years: 8.5
deltaPct: 16.1
media_style_note: media/visual
self_bio_x: Thạc Sĩ MBA | KPMG Alumni | 8+ years Crypto | NFA
activity7dPosts: 10
activity7dLikes: 185
activity7dViews: 20248
activity7dReplies: 25
activity7dReposts: 1
activity7dScore: 95.4
activity7dSource: sampled
isTop30: true
baseScore: 98
hotScore: 96.6
score: 97.4
statusLabel_current: active
activityLevel_current: 95
recent_posts_sample: (dán 2–3 post gần nhất)
other_channels: 
campaign_context: cần KOL news desk announce launch 48h
notes_operator: sample 7d có thể bị cap ~10
```

---

## Enum tham chiếu (khớp code)

| Field | Values |
|-------|--------|
| `niche` | `Trading` `Research` `News` `Airdrop` `OTC` `DeFi` `GameFi` `NFT` `Meme` `Multi` |
| `statusLabel` | `hot` `active` `stable` `quiet` `dormant` |
| `tier` | `1` `2` `3` |
| `activity7dSource` | `sampled` `estimated` |

## Field map → Admin UI

| Output | Admin field |
|--------|-------------|
| BIO_ASSESSMENT | Bio / assessment |
| niche | Niche |
| tier | Tier |
| statusLabel | Status |
| activityLevel | Activity level |
| smartFollowers | Quality proxy |
| baseScore / hotScore / score | Scores (optional override) |
| hidden | Hidden on map |

## Gợi ý vận hành

| Mục tiêu | Làm gì |
|----------|--------|
| Chỉ nâng chất bio | Chỉ paste block **B** |
| Sửa status/niche tay | Dùng **A** + `override_reason` |
| Batch 10 KOL | 1 chat = 1 handle; giữ cùng system prompt |
| Tránh hallucination | Bắt buộc điền followers/7d; để trống recent posts nếu chưa đọc |

## Related files

- Schema: `src/types.ts`
- Provenance badges: `src/lib/fieldMeta.ts`
- Seed data: `src/data/sheetKols.ts`
- Admin: `#/admin` → Editor
