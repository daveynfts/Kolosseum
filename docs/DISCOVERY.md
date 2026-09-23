# M0 — Discovery: Kolosseum trên nền SCEX Radar

**Ngày kiểm tra:** 23/09/2026, múi giờ Việt Nam (UTC+7).
**Trạng thái:** hoàn tất khảo sát mã nguồn, đọc tài liệu và kiểm tra baseline; chưa triển khai Deep Research.
**Đầu ra của bước này:** duy nhất `D:/VibeCode/Kolosseum/docs/DISCOVERY.md`. Chưa tạo PLAN.md, DECISIONS.md, migration, cấu hình thanh toán hay mã nguồn mới.

## 1. Nguồn khảo sát và ranh giới công việc

- Brief nghiên cứu là nội dung Markdown người dùng cung cấp trong cuộc hội thoại. Không tìm thấy file research riêng trong thư mục Kolosseum.
- Thư mục đích `D:/VibeCode/Kolosseum` trống trước khi tạo tài liệu này và chưa là Git repository.
- Tìm thấy checkout gốc tại `D:/VibeCode/daveynfts.com/Radar`, có remote `https://github.com/daveynfts/VietNamKOLsRadar.git`.
- Commit đã đọc: `9348e40ac5197490763bb89ebc52de344ec9a2d8`, ngày 27/08/2026, message: `Merge fix/r2-proxy-rate-limit: fit one real page load`.
- GitHub API không xác thực trả HTTP 404. Vì vậy, chưa xác minh checkout local có trùng HEAD hiện tại trên GitHub; không kết luận repo bị xóa hay người dùng không có quyền truy cập.
- Đã đọc README, SESSION, tài liệu vận hành, manifests, cấu hình deploy, types, stores, handlers, UI và workflows liên quan. SESSION phản ánh sản phẩm SCEX mới hơn README gốc.
- Không sửa mã nguồn checkout gốc. Lint/test/build chỉ chạy để ghi baseline; build tạo thư mục dist và cache đã được gitignore. Trạng thái Git tracked không thay đổi.

**Điểm dừng:** sau Discovery, chờ người dùng review trước khi tạo tài liệu triển khai tiếp theo hoặc chạm vào code. Việc chọn các phương án dưới đây chưa có nghĩa là đã triển khai hay kiểm thử các tích hợp mới.

## 2. Các quyết định người dùng đã chốt

| Chủ đề | Quyết định |
|---|---|
| Nơi phát triển | Bản Kolosseum riêng trong `D:/VibeCode/Kolosseum`, kế thừa cấu trúc repo gốc; không phát triển trực tiếp trên checkout Radar đang dùng. |
| Phạm vi dữ liệu thật | Áp dụng cho toàn bộ luồng dự thi: nghiên cứu, thanh toán, bằng chứng và bán lại. Khi tắt feature flag, giữ hành vi ứng dụng cũ. |
| Phạm vi sàn | SCEX trước. Sàn khác chỉ được đưa vào khi có nguồn thật; thiếu dữ liệu phải nói rõ. |
| Bán lại | Người mua trực tiếp được bán thêm quyền đọc cùng report. Người mua qua lượt bán lại chỉ nhận quyền đọc, không tự có quyền bán tiếp. |
| Chia doanh thu bán lại | 80% cho người bán, 20% cho nền tảng. Giao dịch mua/tạo report trực tiếp trả 100% cho nền tảng. |
| Lưu dữ liệu mới | Cho phép bổ sung Postgres với các bảng `dr_`; dữ liệu Radar vẫn ở R2. Đây là thay đổi đã được người dùng chấp thuận so với yêu cầu ban đầu chỉ dùng storage hiện có. |
| Quyền thương mại Surf | Chưa rõ; cần xác nhận quyền dùng và cấp lại quyền đọc output. |
| Blockchain | Chỉ Solana devnet và/hoặc pay.sh sandbox; không mainnet, không tiền thật của người dùng, không giữ hộ tiền khách. |

Quyền đọc là quyền truy cập trong ứng dụng, không phải tuyên bố chuyển giao bản quyền của tweet, dữ liệu bên thứ ba hay quyền sở hữu độc quyền đối với output AI.

## 3. Stack, chạy local và deploy hiện có

### 3.1 Stack

| Thành phần | Thực tế trong repo |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, CSS hiện có; không phải Next.js. |
| Radar chính | Three.js, React Three Fiber, Drei; map KOL 3D. |
| SCEX | Ma trận 2D và feed; phiên bản SCEX 3D đã được bỏ theo SESSION. |
| Routing | Tự xử lý pathname/hash trong `src/main.tsx`; chưa có React Router. |
| Package manager | npm, có package-lock.json, ESM qua `type: module`. |
| Backend | Vercel Node handlers; hai entrypoint `api/json.ts` và `api/bin.ts`. |
| Storage | Cloudflare R2 qua AWS S3 SDK; JSON object và media. Chưa có database quan hệ. |
| Runtime CI | Node 22 trên Ubuntu. |
| Runtime máy khảo sát | Node v25.8.0, npm 11.11.0; môi trường này khác CI. |
| Kiểm thử | Vitest; các test DOM chọn happy-dom. Lint bằng oxlint. |
| Hosting | Cấu hình Vercel cho Vite, output dist; site hiện tại: https://radar.daveynfts.com. |

Nguồn: [package.json](D:/VibeCode/daveynfts.com/Radar/package.json), [main.tsx](D:/VibeCode/daveynfts.com/Radar/src/main.tsx), [vercel.json](D:/VibeCode/daveynfts.com/Radar/vercel.json), [CI](D:/VibeCode/daveynfts.com/Radar/.github/workflows/ci.yml).

### 3.2 Lệnh hiện có

Chạy tại root checkout được lựa chọn:

```powershell
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run preview
```

- Vite dev mặc định tại http://localhost:5173.
- `npm run dev` chỉ chạy frontend, không cung cấp các route Vercel `/api/*`.
- Muốn chạy backend hiện có tại local cần Vercel CLI và env hợp lệ; tài liệu repo hướng dẫn `npx vercel dev`.
- Trong lượt Discovery này không chạy npm ci, không cài thêm dependency, không khởi động server dev.
- `npm run build` hiện là `tsc -b && vite build`. Cấu hình TypeScript hiện tập trung vào frontend và vite.config; cần bổ sung typecheck riêng cho backend research sau này, không mặc định coi build cũ đã kiểm tra mọi file server mới.

### 3.3 Pipeline

- Google Sheet → scripts Python → seed KOL cho map.
- R2 là nguồn server được ưu tiên khi chạy ứng dụng.
- Workflow feed có cron `0 17 * * *`: 00:00 UTC+7 mỗi ngày.
- Workflow SCEX có cron `0 18 * * 1`: 18:00 UTC thứ Hai, tương đương **01:00 UTC+7 thứ Ba**. Comment hiện ghi “Monday 01:00 ICT” không khớp cron; ghi nhận, chưa sửa.
- Feed refresh dùng `--require-live`; SCEX harvest dùng `--require-fetch`. Không kích hoạt workflow hay chạy script ghi dữ liệu trong Discovery.
- Chưa kiểm tra dashboard Actions để xác nhận các lịch này đang hoạt động thành công.

Đây là hệ thống snapshot có refresh theo lịch và khi UI lấy lại dữ liệu, chưa có bằng chứng về luồng X realtime liên tục.

## 4. Dữ liệu thật, schema và đường đi vào UI

### 4.1 Kiểm tra HTTP trực tiếp

Các kết quả sau được đo bằng GET không xác thực ngày 23/09/2026. Chúng chứng minh API đang phục vụ dữ liệu; không đồng nghĩa đã kiểm chứng độc lập từng tweet.

| API công khai | HTTP | Số lượng trả về | Mốc thời gian trong response |
|---|---:|---|---|
| [SCEX tracking](https://radar.daveynfts.com/api/scex-tracking) | 200 | 596 actors, 1.023 posts | updatedAt: 2026-09-22T03:44:12.438Z; asOf: 2026-09-20 |
| [KOL list](https://radar.daveynfts.com/api/kols) | 200 | 104 KOL | updatedAt: 2026-08-13T04:02:20.663Z |
| [Feed chung](https://radar.daveynfts.com/api/feed) | 200 | 60 posts ở mảng posts | generatedAt: 2026-08-17T04:30:26.078Z |

596 actors bao gồm cả `kind: kol` và `kind: user`; không được giới thiệu là 596 KOL đã tuyển chọn. Mảng archivedPosts của feed chung tách khỏi con số 60 ở trên.

Config API SCEX trả `brandName: SCEX` và bộ keywords SCEX. Không tìm thấy schema quản lý đồng thời SCEX, CAEX, VIXEX, TCEX và sàn thứ năm trong các types/luồng được khảo sát. Không xác nhận hay suy diễn tình trạng cấp phép của các sàn từ brief.

### 4.2 Storage hiện có

| Dữ liệu | Object R2 | Seed/fallback trong repo gốc |
|---|---|---|
| KOL map | `kols/v1.json` | `D:/VibeCode/daveynfts.com/Radar/src/data/sheetKols.ts` |
| Ma trận và post SCEX | `scex/tracking/v1.json` | `D:/VibeCode/daveynfts.com/Radar/src/data/internal/scex-tracking.json` |
| Feed chung | `feed/v1.json` | `D:/VibeCode/daveynfts.com/Radar/public/feed/tier1-feed.json` |
| Report biên tập hiện có | `internal/kol-reports/v1.json` | Seed report hiện có trong source |
| Recent/smart followers | `recent-followers/v1.json` | Dữ liệu seed trong source |
| Benchmark TwitterScore | `internal/twitterscore-top100/v1.json` | Dữ liệu seed trong source |

Các object key được khai báo trong [r2.ts](D:/VibeCode/daveynfts.com/Radar/lib/server/r2.ts). Không có bảng SQL để thêm foreign key trực tiếp từ Postgres vào KOL hiện có.

### 4.3 KOL dùng cho ma trận SCEX

Nguồn type: [ScexActor, ScexPost và ScexDataset](D:/VibeCode/daveynfts.com/Radar/src/data/scexTracking.ts:120).

| Yêu cầu của brief | Field/hàm thực tế |
|---|---|
| ID | `ScexActor.id`; map chính có `Kol.id` riêng |
| Handle | `handle` |
| Tên | `displayName` |
| Avatar | `avatarUrl?`; component hiện có tự xử lý fallback |
| Followers | `followers` |
| Uy tín trong ma trận | `qualityScore` |
| Số bài/mention | `postsVolume`; có thể có `gocPosts`, `replyPosts` |
| Điểm trục X | `volumeScore?`; fallback sang `postsVolume` theo config |
| Sentiment | `sentiment`; có thể có `sentimentConfidence` |
| Giá trị sentiment | `bullish`, `bearish`, `shill`, `scam`, `neutral` |
| Tọa độ logic | Tính bằng `actorMatrixPos(actor, config)`, không phải cột x/y lưu sẵn |
| Kích thước bubble | `actorSizeValue`; theo followers hoặc reach7d tùy config |
| Tứ phân | `quadrant?`; vị trí hiển thị còn chịu ảnh hưởng thuật toán giãn bubble |

`actorMatrixPos` chuẩn hóa volume theo volumeAxis.max và qualityScore theo qualityAxis.max, chặn trong khoảng 0–1. Đây là tọa độ logic trước layout/pan/zoom, không phải tọa độ pixel cần đưa vào prompt.

`qualityScore` là **điểm theo công thức của Radar**, dùng rank/audience, sentiment, độ sâu và engagement. Không được trình bày nó như sự thật độc lập rằng một cá nhân đáng tin, gian lận hoặc có năng lực đầu tư.

Map KOL chung có các field khác: `score`, `baseScore`, `hotScore`, `smartFollowers`, `posts24h`, `activity7dPosts`, `activity7dSource`… Không tự thay `qualityScore` bằng `Kol.score`. Type có ghi một số chỉ số là proxy/ước tính.

Nguồn bổ sung: [Kol](D:/VibeCode/daveynfts.com/Radar/src/types.ts).

### 4.4 Posts

| Nội dung | SCEX: ScexPost | Feed chung: FeedPost |
|---|---|---|
| ID record | `id` | `id` |
| Tweet URL | `url` | `url` |
| Tác giả | `handle` | `handle`, `displayName` |
| Nội dung | `text` | `text` |
| Thời điểm | `postedAt` | `createdAt` |
| Engagement | `likes?`, `replies?`, `reposts?`, `views?` | `likes`, `replies`, `reposts`, `views` |
| Sentiment | `sentiment` | Không có field sentiment |
| Media | `media?` | `media` |
| Reply | Không có boolean chuyên biệt | `isReply` |
| Mention sàn | Không có `exchangeMentions[]`; dataset thuộc SCEX và có config.keywords | Không có field mention sàn có cấu trúc |

Không mặc định mọi `id` đều là X snowflake: luồng admin có thể sinh ID nội bộ. Adapter phải xác định tweet ID từ URL status hợp lệ khi cần và giữ nguyên URL nguồn.

GET công khai SCEX loại post hidden và một số field admin. Adapter research phải dùng phần dữ liệu được phép công khai, không đưa ghi chú nội bộ vào Surf.

### 4.5 Data flow hiện có

**SCEX:**

```text
ScexTrackingPage
  → loadScexWithSource() + loadKolsWithSource()
  → GET /api/scex-tracking + GET /api/kols
  → Vercel rewrite → api/json.ts
  → handlers tương ứng → R2
  → recomputeScexScores(dataset, mapKols)
  → ScexMatrix2D + feed + ScexKolDetail
```

- SCEX store ưu tiên server → localStorage → seed.
- KOL store ưu tiên server → localStorage → seed.
- UI lấy lại dữ liệu khi focus, visibility, storage hoặc event nội bộ thay đổi.
- Feed chung dùng `loadFeed/loadFeedWithSource`: server → localStorage → seed.
- Các fallback này giữ nguyên cho ứng dụng cũ. Adapter research mới không được âm thầm lấy seed/mock khi live API lỗi.

Nguồn: [SCEX page](D:/VibeCode/daveynfts.com/Radar/src/pages/ScexTrackingPage.tsx:309), [SCEX store](D:/VibeCode/daveynfts.com/Radar/src/lib/scexStore.ts), [KOL store](D:/VibeCode/daveynfts.com/Radar/src/lib/kolStore.ts), [feed store](D:/VibeCode/daveynfts.com/Radar/src/lib/feedStore.ts).

## 5. Auth, env, UI tái sử dụng

### Auth và env

- Chưa có đăng nhập khách hàng hoặc tích hợp Phantom/Solflare trong phần khảo sát.
- Admin dùng Bearer `FEED_ADMIN_TOKEN`; token nhập qua admin UI và giữ trong sessionStorage. Server kiểm tra quyền ghi; không dùng cơ chế này làm auth người mua.
- Vercel server đọc env; helper `env()` trim giá trị và dấu nháy.
- Script vận hành có `loadRadarEnv()`, đọc .env.local rồi .env.production.local, giữ env đã có.
- Không sao chép các file env thật sang Kolosseum tự động.
- Các biến mới trong brief chưa được khai báo trong .env.local đã khảo sát. Chỉ kiểm tra sự hiện diện; không ghi giá trị bí mật vào tài liệu.
- `pay` và `solana` CLI chưa có trên PATH máy khảo sát. Có wsl.exe nhưng chưa kiểm chứng bản phân phối/runtime WSL.

### Điểm gắn UI

[ScexKolDetail](D:/VibeCode/daveynfts.com/Radar/src/components/ScexKolDetail.tsx) nhận actor, mapKol, config và posts. Đây là điểm gắn Deep Research có ít thay đổi nhất cho phạm vi SCEX.

Tái sử dụng:

- Layout/theme SCEX và các class glass/button đang có.
- [ReportMarkdown](D:/VibeCode/daveynfts.com/Radar/src/components/ReportMarkdown.tsx): render Markdown, escape HTML.
- Avatar và safe URL helpers hiện có.
- Router thủ công trong main.tsx cho các trang report và tài khoản mới.

**Surf hiện có chưa phải tích hợp Chat API:** [SurfAnalysisMock](D:/VibeCode/daveynfts.com/Radar/src/components/SurfAnalysisMock.tsx) mở report đã được admin xuất bản; một nhánh có tiến trình giả. Không dùng component này để chứng minh đã gọi Surf live. Khi bật Deep Research, luồng mới cần trạng thái từ request/job thật; khi tắt flag, giữ luồng cũ.

SCEX chủ yếu dùng chuỗi tiếng Việt trực tiếp. i18n ở Event Map là phạm vi riêng, chưa phải i18n chung cho toàn ứng dụng.

## 6. Kết quả đối chiếu tài liệu bên ngoài

Tất cả ví dụ ở mục này là **tham chiếu tài liệu**, chưa phải lệnh tích hợp đã chạy. Không có request trả phí tới Surf hoặc giao dịch blockchain nào được thực hiện trong M0.

### 6.1 Surf

Endpoint xác nhận trong [Chat API](https://agents.asksurf.ai/docs/chat/overview) và [Research 2.0](https://agents.asksurf.ai/docs/chat/responses):

```text
POST https://api.asksurf.ai/gateway/v1/responses
Authorization: Bearer $SURF_API_KEY
```

- Request dùng model `surf-2.0` hoặc `surf-2.0-instant`, nội dung trong `input`; hướng dẫn tách ở `instructions`.
- Độ sâu nằm trong `reasoning.effort`. Không dùng API chat/completions cũ.
- Response có output và usage token. Tài liệu pricing nhắc credits_used, nhưng ví dụ Chat response không thể hiện field đó; cần kiểm tra response thật trước khi quyết định cách hạch toán credits. Không tự bịa field hoặc coi số token là chi phí USD chính xác.

Theo [pricing](https://agents.asksurf.ai/docs/pricing), giá niêm yết hiện tại:

| Lựa chọn | Credits/call | Chi phí API/call |
|---|---:|---:|
| instant hoặc surf-2.0 không extended reasoning | 20 | $0,12 |
| surf-2.0 low | 50 | $0,30 |
| surf-2.0 medium | 120 | $0,72 |
| surf-2.0 high | 150 | $0,90 |
| surf-2.0 xhigh | 200 | $1,20 |

Giá $0,10 cho một report mới thấp hơn chi phí Chat tối thiểu, chưa tính hạ tầng. Giá đó chỉ hợp lý khi có trợ giá, credit ưu đãi hoặc phục vụ bản cache. Với ceiling $1,00, không chọn xhigh theo giá niêm yết. Giá bán cuối cùng và budget retry phải được ghi rõ ở PLAN sau review.

**Điều kiện bán lại:** [Surf Terms, mục 3(a)](https://asksurf.ai/terms-of-service) yêu cầu chấp thuận bằng văn bản cho việc dùng output vào mục đích thương mại. Người dùng xác nhận chưa rõ quyền này. Cần làm rõ phạm vi API, lưu trữ, phân phối report và quyền người mua bán thêm quyền đọc; có API key không tự giải quyết điều kiện này.

### 6.2 pay.sh

Đã đọc các trang bắt buộc: [install](https://pay.sh/docs/toolchain/install), [using pay](https://pay.sh/docs/using-pay), [getting started](https://pay.sh/docs/building-with-pay/getting-started), [channels concept](https://pay.sh/docs/building-with-pay/payment-channels/concept), [upto](https://pay.sh/docs/building-with-pay/payment-channels/upto), [sessions](https://pay.sh/docs/building-with-pay/payment-channels/sessions), [YAML](https://pay.sh/docs/building-with-pay/yaml-specification).

Trích lệnh cài đặt được tài liệu công bố:

```sh
npm install -g @solana/pay
pay --version
```

Tài liệu YAML hiện đưa lệnh khởi động/kiểm tra spec:

```sh
pay --sandbox gate api paywall.yml --bind 127.0.0.1:1402
```

Một ví dụ client sandbox từ tài liệu using pay:

```sh
pay --sandbox curl https://debugger.pay.sh/mpp/quote/AAPL
```

Các điểm phải phản ánh trong kế hoạch:

1. Brief dùng tên `pay server`, còn trang YAML hiện dùng `gate api`; các trang docs cũng chưa hoàn toàn thống nhất. Khi triển khai phải pin version và xác nhận `--help`, không xem tên lệnh trong brief là đã được kiểm thử.
2. Sandbox cưỡng chế localnet. Không gắn nhãn transaction sandbox là devnet, không tạo link explorer devnet cho transaction localnet.
3. MPP session có deposit cap, voucher tích lũy, settlement và refund khi đóng. `Payment-Receipt` là thông tin của MPP; x402 upto có `PAYMENT-RESPONSE`. Lưu đúng loại receipt, không giả lập cùng một header.
4. Ví dụ YAML upto dùng `min_usd` làm giá settle mặc định cho tới khi gắn bộ đo usage thật. Chỉ khai báo YAML chưa đủ để chứng minh charge theo chi phí Surf thực tế.
5. [SDK TypeScript](https://pay.sh/docs/sdk/typescript/schemes) có cơ chế ghi usage. [Pricing & gates](https://pay.sh/docs/sdk/typescript/pricing-and-gates) mô tả chia phí qua MPP và từ chối gate có phí nếu chỉ nhận x402. Vì vậy, không hứa chia tiền bán lại 80/20 chỉ bằng x402.
6. Cần kiểm chứng session splits cho seller động. Channel đã gắn bộ recipients này không được tái sử dụng như thể nó thanh toán cho seller khác.
7. Tiền đặt cọc của khách nằm trong escrow của chương trình; doanh thu đã settle mới phân phối tới bên nhận. Không thiết kế đường vòng thu toàn bộ về ví operator rồi trả tay cho seller.

Ưu tiên gateway sidecar để giữ deployment Radar ổn định. Nếu CLI không cung cấp đủ actual metering hoặc splits động, đánh giá SDK chính thức trong service TypeScript mới và ghi rõ thay đổi thiết kế trước khi code phần đó. Không tự sáng tạo header metering hay payment proof.

M0 chưa cài CLI/SDK nên các khả năng nêu trên mới được xác nhận qua tài liệu, chưa qua chạy tích hợp.

## 7. Phương án tích hợp đề xuất để review

### 7.1 Kiến trúc bổ sung

```text
Radar UI hiện có
  + Deep Research panel / report page / me page
          │
          ▼
Research gateway + TypeScript service/worker mới
    ├── Đọc public Radar APIs → context có timestamp và nguồn
    ├── Surf Chat/Data APIs → report thật
    ├── Postgres dr_* → report, mua hàng, quyền đọc, vote, job
    ├── Solana payment channels → receipt, settlement, phân phối tiền
    └── Solana devnet Memo → bằng chứng hash
```

- Giữ frontend React/Vite, npm, TypeScript và hai API entrypoint Vercel hiện tại.
- Backend research/worker chạy riêng; không đặt worker/channel state chỉ trong RAM của một Vercel request.
- Đề xuất adapter lấy dữ liệu từ API công khai đang có, với base URL cấu hình server-side. Không thêm bản sao bảng KOL vào Postgres.
- Dùng handle chuẩn hóa để tham chiếu KOL/actor. `kol_ref` là tham chiếu logic tới nguồn R2, không phải SQL foreign key đến một bảng KOL mới.
- Context mặc định đề xuất lấy tối đa 50 post thật mới nhất của handle, khử trùng URL/ID, kèm asOf/updatedAt và liên kết nguồn. Không đồng nhất “không thu thập được bài” với “KOL không có bài”.
- Dùng lại cách tính score/tọa độ của UI để tránh prompt dùng điểm cũ, nhưng ghi rõ đây là chỉ số phương pháp của Radar.
- Các phần token-price và amplifier network chỉ có nội dung khi có bằng chứng phù hợp. Nếu thiếu thì trả “chưa đủ dữ liệu”; không suy diễn mạng phối hợp từ việc cùng nhắc một sàn.
- Chuỗi report: nội dung thật → kiểm tra nguồn và hướng dẫn nội dung → disclaimer cố định → canonical Markdown → SHA-256 → AES-256-GCM → lưu → job evidence.
- Memo xác nhận nội dung đã được ghi nhận với hash nào, không xác nhận mọi nhận định trong report là đúng.
- Nguồn X, output Surf, prompt tự do và payment challenge đều là dữ liệu không đáng tin. Không thực thi hướng dẫn, tool call hay URL tùy ý do chúng đề xuất.
- Không chỉ dựa vào regex xóa từ “buy/sell”: chặn template/prompt khuyến nghị giao dịch, kiểm tra output và không công bố report không đạt yêu cầu.

### 7.2 Dữ liệu mới

Giữ bốn nhóm yêu cầu: `dr_templates`, `dr_reports`, `dr_votes`, `dr_channels`. Bổ sung các nhóm cần cho quyền bán lại và vận hành:

| Nhóm bổ sung | Vai trò |
|---|---|
| dr_purchases | Giao dịch sơ cấp/bán lại, payer thật, số tiền, protocol, receipt, trạng thái settlement và khóa chống xử lý trùng |
| dr_licenses | Quyền đọc theo report + wallet, nguồn mua và cờ được bán lại |
| dr_listings | Niêm yết của seller được cấp quyền; giá và trạng thái |
| dr_usage | Usage Surf và cách tính chi phí/ước tính theo phiên bản pricing |
| dr_jobs | Job generation/evidence có khả năng retry và khôi phục |

Chỉ là nhóm dữ liệu đề xuất, chưa tạo migration hay chốt mọi column.

Các nguyên tắc cần đưa vào PLAN:

- Một report có nhiều người được cấp quyền; không dùng một field buyer_wallet duy nhất làm toàn bộ cơ chế phân quyền.
- Cache có thể tái dùng nội dung phù hợp, nhưng mỗi lượt mua có payment và license riêng. Không trả object sở hữu của buyer trước cho buyer sau.
- Free prompt mặc định riêng tư; không tự niêm yết hoặc đưa vào cache chia sẻ giữa người dùng.
- Cache phải nhận biết phiên bản template, model/effort, ngôn ngữ và dấu vết dữ liệu đầu vào, ngoài hour bucket.
- Vote duy nhất theo report/wallet, trọng số lấy từ khoản thanh toán đã kiểm chứng. Giữ voucher/reference và settlement transaction tách biệt khi transaction chưa tồn tại.
- DB transaction và idempotency ngăn cấp quyền/vote/thu phí trùng khi người dùng retry.
- Retry Surf phải tính đến khả năng request đầu đã bị tính credit dù client timeout; không mặc định retry vô hạn hoặc dùng idempotency header chưa được nhà cung cấp tài liệu hóa.

### 7.3 Interfaces dự kiến

Trên origin của gateway/service mới:

| Interface | Hành vi |
|---|---|
| POST /research/quick | Chọn KOL/template, tạo hoặc lấy report hợp lệ; MPP session từ M2 |
| POST /research/deep | Prompt riêng, báo ceiling; x402 upto với usage được hạch toán |
| GET /templates | Công khai, không chứa prompt_system hoặc bí mật vận hành |
| GET /reports/:id/verify | Công khai hash/evidence/status; không lộ nội dung trả phí |
| GET /reports/:id/content | Chỉ wallet có license hợp lệ được nhận Markdown đã giải mã |
| POST /reports/:id/vote | Auth wallet, có proof mua; không thu thêm tiền chỉ để vote |
| API challenge/verify ví | Xác thực chữ ký nonce, domain và hạn dùng; wallet connect một mình chưa phải auth |
| API listing/purchase | Niêm yết và mua quyền đọc, kiểm tra quyền seller, chia 80/20 |
| API /me và admin stats | Dữ liệu theo ví đã xác thực; stats bảo vệ bằng ADMIN_TOKEN |

Wire schema chi tiết và endpoint listing/auth cuối cùng sẽ nằm trong PLAN. Không tự nhận buyer_wallet từ request là bằng chứng người mua.

UI vẫn có đường dẫn `/reports/:id` và `/me` trên origin ứng dụng. API nội dung ở service riêng nên không xung đột route SPA.

Với server-side demo buyer: UI phải thể hiện ví sandbox nào thực sự chi trả. Wallet kết nối có thể nhận quyền đọc theo một đơn demo đã xác thực, nhưng không được trình bày receipt của demo wallet như khoản tiền ví người dùng đã trả.

### 7.4 Feature flag

Tên duy nhất: `DEEP_RESEARCH_ENABLED`.

- Mặc định tắt ngoài demo; demo chỉ bật khi cấu hình thực sự đủ.
- Frontend chỉ được nhận boolean flag và URL công khai cần thiết; không expose toàn bộ process.env.
- Khi false: không mount panel/providers/payment SDK mới, giữ route và hành vi cũ; backend mới không phục vụ chức năng trả phí.
- Khi true: panel mới có dữ liệu request/job thật, thông báo rõ network và độ mới dữ liệu; không dùng progress giả của SurfAnalysisMock.
- Nếu Surf/Radar/payment service lỗi hoặc thiếu cấu hình: trả trạng thái lỗi hoặc chưa sẵn sàng, không dựng report/receipt/tx giả.

### 7.5 Danh sách bổ sung dự kiến

Các đường dẫn sau đều thuộc bản Kolosseum tương lai, chưa được tạo trong M0:

| Đường dẫn mới | Mục đích |
|---|---|
| D:/VibeCode/Kolosseum/src/research/ | Panel, wallet/session UI, report/me pages, API client và chuỗi ngôn ngữ của phần mới |
| D:/VibeCode/Kolosseum/lib/research/ | Read-only kolContext, Surf client, generation, DB, auth, service và worker |
| D:/VibeCode/Kolosseum/lib/payments/ | Payment adapter, receipt/proof, reconciliation, kiểm soát network |
| D:/VibeCode/Kolosseum/lib/evidence/ | Hash/encryption helpers, Memo và verification |
| D:/VibeCode/Kolosseum/dr_migrations/ | SQL migration chỉ tạo các bảng dr_ |
| D:/VibeCode/Kolosseum/scripts/research/ | Seed templates, khởi động demo, integration checks và kiểm tra bundle |
| D:/VibeCode/Kolosseum/paywall.yml | Cấu hình gateway theo schema và version được xác nhận |
| D:/VibeCode/Kolosseum/tsconfig.research.json | Typecheck backend mới |

Test unit đặt cạnh module trong src/lib để tương thích pattern Vitest hiện tại. PLAN.md và DECISIONS.md sẽ được tạo ở bước tài liệu kế tiếp sau review; không phải đầu ra của bước này.

### 7.6 Các file cũ dự kiến cần sửa tối thiểu

Đường dẫn là **bản sao tương lai trong Kolosseum**, không phải yêu cầu sửa checkout Radar gốc.

| File | Lý do |
|---|---|
| D:/VibeCode/Kolosseum/src/components/ScexKolDetail.tsx | Gắn panel Deep Research sau flag, giữ nhánh UI cũ khi tắt |
| D:/VibeCode/Kolosseum/src/main.tsx | Thêm lazy routes report/me và provider cho phạm vi mới |
| D:/VibeCode/Kolosseum/vite.config.ts | Truyền flag và cấu hình client công khai có chọn lọc |
| D:/VibeCode/Kolosseum/vercel.json | Rewrite các trang SPA mới; giữ nguyên API/feed/matrix hiện tại |
| D:/VibeCode/Kolosseum/package.json | Dependency và script typecheck, seed, sandbox/demo |
| D:/VibeCode/Kolosseum/package-lock.json | Khóa dependency bổ sung |
| D:/VibeCode/Kolosseum/.env.example | Mô tả env mới, không chứa secret thật |
| D:/VibeCode/Kolosseum/README.md | Hướng dẫn demo 10 phút và khai báo nền Radar có sẵn |

Phương án sidecar này không cần sửa các KOL/feed stores, scoring, ma trận, seed, object R2 cũ hoặc hai handler entrypoint hiện có. Nếu thử nghiệm tích hợp cho thấy cần thêm file ngoài danh sách, phải nêu rõ lý do để review trước khi sửa.

### 7.7 Env cần thêm sau review

| Biến | Mục đích |
|---|---|
| SURF_API_KEY | Secret server-only |
| SURF_API_BASE_URL | Base gateway Surf; cấu hình ghép đúng /v1/responses |
| SOLANA_RPC_URL | RPC devnet cho bằng chứng; không tái dùng nhầm cho sandbox payment |
| OPERATOR_KEYPAIR_PATH | Keypair dùng cho evidence; payment signer cấu hình đúng network riêng |
| REPORT_ENC_KEY | Khóa AES-256-GCM, chỉ trên server |
| ADMIN_TOKEN | Bảo vệ stats/ops mới |
| PAY_MODE | sandbox trong demo |
| PAY_GATEWAY_URL | URL gateway; chỉ URL cần thiết được phép đưa ra client |
| DEEP_RESEARCH_ENABLED | Boolean bật/tắt tính năng |
| DATABASE_URL | Kết nối Postgres đã được người dùng chấp thuận bổ sung |
| RADAR_API_BASE | Base URL đọc dữ liệu Radar; tận dụng tên biến hiện có |

Env riêng của pay, cơ chế ký session và chứng thực giữa gateway/origin phải được lấy từ version/docs thực tế khi lập PLAN. Không tự chốt tên biến hoặc header chưa có tài liệu. Origin generation phải được bảo vệ khỏi gọi thẳng để vượt paywall.

## 8. Định hướng dự thi và mốc kiểm chứng

### Giá trị sản phẩm

Giả thuyết khách hàng ban đầu: người làm nghiên cứu và đội partnership cần đọc bằng chứng về KOL crypto Việt Nam. Lợi thế sẵn có là dữ liệu Radar đã tuyển chọn, lịch sử bài viết và giao diện SCEX đang phục vụ dữ liệu.

Phần mới để dự thi: biến dữ liệu đó thành report có nguồn, thanh toán theo lần qua Solana, dấu vết nội dung và quyền bán thêm quyền đọc. Mục tiêu demo phải thể hiện đầy đủ việc một report được dùng lại bởi người thứ hai, không chỉ thêm nút chat AI.

Ba template giữ theo brief: risk-profile, exchange-stance và token-track-record. Exchange-stance bắt đầu với SCEX; các nhận định về token hoặc sàn khác cần nguồn thật và phạm vi thời gian rõ.

### Các mốc đề xuất, chưa phải cam kết đã đạt

| Mốc | Cửa sổ mục tiêu | Kết quả cần chứng minh |
|---|---|---|
| M0 | 23/09 | Discovery này; review riêng trước code |
| M1 | 24–27/09 | Surf thật + context Radar + report mã hóa + hash/Memo devnet; generation chưa thu tiền chỉ mở trong môi trường dev/demo được bảo vệ |
| M2 | 28–30/09 | UI demo buyer và CLI mua report; session/upto, receipt, refund và actual metering được kiểm chứng |
| M3 | 01–03/10 | Hai người dùng mua/bán quyền đọc với split 80/20; /me, vote và demo có thể chạy lại |
| Demo Day | 04/10 | Demo thật; chuẩn bị video dự phòng được quay từ chính luồng chạy thật |
| Hoàn thiện | 05–11/10 | Sửa lỗi, đo chi phí, thử với người dùng, tài liệu và video nộp bài |
| M4 | Chỉ khi luồng chính ổn định | Attestation Service, data-partner split bổ sung, listing và agent demo nâng cao |

Bán lại là yêu cầu cốt lõi ở M3; chỉ split cho data partner mới là stretch. Nếu thiếu credits/quyền Surf hoặc session settlement không chạy được, cần báo rõ tác động lịch trình, không thay bằng mock.

### Quy định và hồ sơ

- [Colosseum FAQ](https://colosseum.com/hackathon) cho phép sử dụng code có sẵn nhưng yêu cầu khai báo phần phát triển trước cuộc thi; chỉ phần làm trong thời gian thi được đánh giá. Hồ sơ phải chỉ ra baseline Radar và phần mới của Kolosseum.
- FAQ yêu cầu repo để review, video giới thiệu 2–3 phút và demo tối đa 3 phút. Repo private cần cấp quyền cho đơn vị chấm theo hướng dẫn chính thức; chưa thực hiện việc cấp quyền.
- [Official Rules](https://colosseum.com/legal/Crypto%20World%27s%20Fair%20Hackathon%20Rules.pdf) ghi hạn cuối 12/10/2026, 23:59 Pacific, tương đương **13/10/2026, 13:59 UTC+7**. Nên đặt hạn nội bộ 11/10 và nộp trong ngày 12/10. Nội dung nộp theo rules phải bằng tiếng Anh.
- Mốc Demo Day 04/10 và việc đăng ký riêng Road to Colosseum được nêu trong [thông báo trên Coin68](https://coin68.com/superteam-vietnam-to-chuc-hackathon-tiep-suc-cho-builder-tren-solana/). Chưa đọc được biểu mẫu đăng ký và bài X chính thức bằng công cụ; chưa xác nhận tình trạng nhận đăng ký hiện tại hay người dùng đã đăng ký.
- Không đồng nhất chương trình Road to Colosseum Việt Nam với mọi sidetrack trên Superteam Earn.

## 9. Kiểm tra thực tế đã chạy

Tại checkout Radar gốc, không cài lại dependency:

| Kiểm tra | Kết quả |
|---|---|
| Public GET: SCEX, KOL, feed | Cả ba HTTP 200; số lượng và timestamp tại mục 4 |
| npm run lint | Exit 0, có warnings hiện hữu |
| npm test | Exit 1: 148 passed, 1 failed, tổng 149 test / 27 file |
| npm run build | Exit 0; Vite production build hoàn tất |
| Git tracked state sau kiểm tra | Không thay đổi |

Trích output thật:

```text
> vn-kol-map@0.0.0 test
> vitest run

Test Files  1 failed | 26 passed (27)
     Tests  1 failed | 148 passed (149)
```

Lỗi hiện hữu:

```text
FAIL src/lib/convictionEventsStore.test.ts
loadEventsWithSource > admin cache round-trips hidden events
AssertionError: expected 'seed' to be 'cache'
Expected: "cache"
Received: "seed"
```

Case DOCX ghi `Skip: DOCX not on this machine` và không chạy phần kiểm tra với fixture đó, dù Vitest tính test là passed. Không coi toàn bộ 148 test là bằng chứng rằng fixture DOCX đã được kiểm tra.

Build:

```text
> vn-kol-map@0.0.0 build
> tsc -b && vite build

vite v8.1.4 building client environment for production...
✓ 945 modules transformed.
✓ built in 11.39s
```

Có cảnh báo chunk lớn và warnings lint. Không sửa chúng trong M0. Lỗi cache cần tái hiện ở Node 22 trước khi kết luận nguyên nhân; cảnh báo localStorage trên Node 25 là quan sát, chưa phải chẩn đoán.

Chưa kiểm thử UI bằng trình duyệt, Surf API, Phantom/Solflare, payment gateway, Postgres, receipt, Memo hoặc bán lại. Không có report mới hoặc transaction thật nào được tạo trong Discovery.

## 10. Điều kiện tiếp tục và acceptance cho các mốc sau

### Những việc cần xác nhận trước khi tuyên bố “chạy thật”

| Điều kiện | Trạng thái / cách giải quyết |
|---|---|
| Baseline repo | Đã đọc local commit; cần đối chiếu branch/remote được phép truy cập trước khi dựng checkout Kolosseum |
| Surf API key và credits | Chưa có trong env đã khảo sát; cần cấu hình server-side, không gửi key vào chat |
| Quyền thương mại và bán lại | Người dùng xác nhận chưa rõ; cần xác nhận với Surf, kể cả phạm vi demo phân phối cho người khác |
| Postgres | Đã đồng ý bổ sung; chưa provision hay kết nối database |
| pay version và sandbox | Chưa cài/chạy; cần pin version, đọc schema và thử session/upto/splits |
| Devnet signer/RPC | Chưa cấu hình/chạy; key của evidence và payment network phải phân biệt |
| Dữ liệu đủ mới | SCEX có snapshot mới; feed chung cũ. Phải hiển thị timestamp và giới hạn nguồn |
| Baseline test | Có một lỗi hiện hữu; cần xác minh trên runtime CI, không giấu lỗi |
| Đăng ký cuộc thi | Chưa xác nhận registration trên Colosseum và chương trình Việt Nam |

M0 không thực hiện đăng ký, liên hệ Surf/ban tổ chức, cấp quyền repo, mua credits, deploy hay chuyển tiền.

### Acceptance cần đưa vào PLAN

1. Flag false: ma trận, feed và luồng cũ không bị đổi hành vi; diff chỉ ở danh sách được review.
2. Flag true: report lấy context server thật, có nguồn/timestamp; API lỗi không trả mock hay report seed dưới nhãn mới.
3. Cache/retry không tạo report hoặc thu tiền trùng; đổi dữ liệu đầu vào phải làm mất hiệu lực cache phù hợp.
4. Encrypt/decrypt/hash round-trip thành công; sửa nội dung phải làm verify thất bại. Verify phải phân biệt hash khớp trong storage với bằng chứng đã đọc và đối chiếu on-chain.
5. UI demo và pay CLI đều hoàn thành handshake thật; channel cap/spent/refund lấy từ trạng thái đã xác minh, không từ số tự nhập.
6. Thiếu/giả/replay proof, sai wallet, sai cluster hoặc gọi tắt origin không được cấp report.
7. Ví A mua sơ cấp rồi niêm yết; ví B mua quyền đọc; split 80/20 có bằng chứng settlement; B không được bán tiếp. Các ví có thể là ví thử nghiệm do người vận hành kiểm soát, phải ghi rõ khi demo.
8. Vote từ buyer hợp lệ, trọng số từ purchase proof; unique theo report/wallet, không tăng trọng số qua retry.
9. Khi Memo chưa xác nhận, UI hiển thị pending; retry không tạo nhiều bằng chứng logic cho cùng report.
10. Kiểm tra bundle chỉ báo tên file bị phát hiện secret, không in giá trị secret. Surf key, khóa mã hóa, admin token và private key không nằm trong bundle hoặc log.
11. Chạy lint/test/build với Node 22; thêm integration test thực sự gọi sandbox và kiểm chứng devnet cho phần bằng chứng. Test double chỉ dùng trong unit test lỗi/retry, không thay cho demo dữ liệu thật.

**Kết luận M0:** có nền Radar phù hợp để mở rộng theo hướng bổ sung. Những khoảng trống chính là auth ví, dữ liệu giao dịch/quyền đọc, Surf live, payment metering/splits và điều kiện thương mại của output. Tài liệu này là kết quả Discovery và đề xuất để review; chưa phải xác nhận các chức năng mới đã hoạt động.
