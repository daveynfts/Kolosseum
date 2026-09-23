# Decisions

## 2026-09-23 — Theme arena trên bản Kolosseum

User yêu cầu giữ nguyên dữ liệu và UI/UX Radar nhưng đổi hình ảnh thành KOL trong đấu trường La Mã. Vì vậy có thể sửa các file CSS/theme và asset hiển thị ngoài danh sách code tích hợp của `DISCOVERY.md`; đây là phạm vi mới được user trực tiếp giao. Không sửa scoring, matrix coordinates, bộ lọc, feed, endpoint nguồn hay layout/interaction. Theme là hình thức của bản Kolosseum nên vẫn hiện khi `DEEP_RESEARCH_ENABLED=false`; flag chỉ điều khiển tính năng research/payment.

## 2026-09-23 — M1 cần secret và dịch vụ thật

User sẽ cung cấp Surf API key sau. Không tạo key giả, output mẫu hoặc on-chain tx giả. Có thể hoàn thiện mã và unit/integration với public Radar API trước; generation thật, Postgres và Memo chỉ được xác nhận khi có env và dịch vụ tương ứng.

## 2026-09-23 — Local live-data proxy

Khi feature flag M1 bật, Vite development chuyển các request GET/HEAD `/api/*` tới `https://radar.daveynfts.com` để UI local dùng dữ liệu thật. Middleware trả 405 cho mọi method ghi, proxy loại bỏ Authorization/Cookie trước khi gửi ra ngoài. Đây chỉ là cấu hình dev; production giữ API Radar hiện hữu. Luồng admin ghi dữ liệu Radar không dùng được qua Vite local, tránh tác động lên production. Sidecar research dùng `/dr-api` riêng và không proxy secret lên Radar.

## 2026-09-23 — Kiểm thử và funding devnet

Node 25 trên máy làm hỏng một test cache thuộc baseline; cùng bộ 153 test đạt với Node 24 (CI nguồn cấu hình Node 22). RPC devnet trả 429 cho request airdrop 0,05 test SOL; không giả lập số dư, Memo hay explorer badge. Job evidence sẽ đợi ví operator được nạp test SOL thật.

## 2026-09-23 — Kolosseum là thương hiệu của trang đấu trường

Theo yêu cầu mới, /scex và trang report dùng nhận diện Kolosseum: bỏ banner sự kiện, bỏ các tab VN KOLs/SCEX/Events ở header đấu trường, thay hero SCEX bằng biểu tượng và kiến trúc La Mã, đồng bộ title/OG/favicons của route. Ma trận, live feed, chỉ số, bộ lọc và URL nguồn vẫn giữ nguyên. SCEX chỉ còn là tên nguồn dữ liệu được theo dõi; liên kết tới Radar gốc vẫn còn để ghi nhận xuất xứ. Trang Radar/map và event cũ vẫn hoạt động qua URL riêng, không bị đổi dữ liệu hay luồng.

## 2026-09-23 — English Kolosseum and retirement of public legacy pages

The latest user request supersedes the earlier decision to keep public Radar and Events routes. The root and former Events URLs now open /scex, and the Kolosseum header has no legacy navigation or Radar attribution badge. Existing KOL/post data, scoring, storage, and the internal /admin editor remain intact. Original X post text, KOL names, notes, and previously published report content remain in their source language so research evidence is not silently altered. Kolosseum interface copy, new report templates, generation instructions, and the fixed disclaimer are English.

Avatar reads keep using the same R2 bucket. Local Vite now proxies /r2/*, and the UI prefers existing avatarUrl values. The avatar sync script audits the live SCEX dataset and uploads only missing keys via the existing authenticated API. It does not create a local image store. A read-only audit found 561 of 597 handles in R2 and 36 missing. With the user-provided FEED_ADMIN_TOKEN in ignored .env.local, the existing API uploaded all 36; a second read-only audit confirmed 597/597 image keys and zero errors. The weekly SCEX refresh now runs the same --apply sync after data updates.
