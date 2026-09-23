# M1 — chạy Kolosseum với dữ liệu thật

M1 hiện có mã cho report từ Surf, lưu PostgreSQL, hash + mã hóa và Memo devnet. **Chưa xác nhận end-to-end** vì `SURF_API_KEY` và `DATABASE_URL` chưa được cấu hình; ví operator cũng chưa có test SOL do RPC devnet trả 429 khi xin airdrop. Giao diện hiển thị lỗi 503 khi thiếu database, không dựng template/report giả.

## Chuẩn bị

```powershell
cd D:\VibeCode\Kolosseum
npm ci
npm run research:init-devnet
```

Lệnh init tạo `.env.local` và `.operator-keypair.local` (cả hai được Git bỏ qua), in **chỉ** địa chỉ public của ví. Đọc [hướng dẫn tạo PostgreSQL](./DATABASE_SETUP.md), rồi điền `DATABASE_URL` vào `.env.local`. Điền `SURF_API_KEY` khi có key/credits Surf thật. Không gửi các giá trị này trong chat. `REPORT_ENC_KEY` và `ADMIN_TOKEN` đã được init sinh ngẫu nhiên; giữ nguyên sau khi có report, nếu đổi khóa sẽ không đọc được report cũ.

```powershell
npm run research:migrate
npm run research:fund-devnet
```

The `research:fund-devnet` command requests only devnet test SOL and checks the cluster genesis hash. If the public RPC rejects the airdrop (HTTP 429 or Internal error), the command still prints the public operator address. Enter that address at the [official Solana Devnet Faucet](https://faucet.solana.com/) and request devnet SOL, then rerun the command to check the balance. [Solana recommends the web faucet when RPC airdrops fail](https://solana.com/docs/intro/quick-start). Never use mainnet or real funds. The Memo worker estimates the fee and checks the balance before signing. Without enough test SOL, its job remains pending; rerun `npm run research:evidence` after funding. A previously ambiguous signed transaction is checked by its original signature and never signed again automatically.

## Chạy local

Terminal 1:

```powershell
npm run research:dev
```

Terminal 2:

```powershell
npm run dev -- --host 127.0.0.1
```

Mở `http://127.0.0.1:5173/scex`. Khi `DEEP_RESEARCH_ENABLED=true`, Vite local chuyển **GET/HEAD** `/api/*` tới Radar production để UI hiển thị dữ liệu thật; các method ghi bị chặn HTTP 405. Vite chuyển `/dr-api/*` tới research sidecar `127.0.0.1:4174`. Production Vercel hiện cần một sidecar research được host riêng và `VITE_RESEARCH_API_URL` trỏ đến nó; chưa có deployment M1.

Chọn một KOL từ live feed, mở tab **Deep Research**, chọn template và nhập `ADMIN_TOKEN` từ `.env.local` của bạn. M1 là demo riêng chưa thu phí; không chia sẻ token hoặc link report riêng. Sau khi Surf tạo report, mở `/reports/<id>`: trang hiển thị SHA-256 nội dung, trạng thái Memo, và link explorer devnet khi giao dịch đã xác nhận. `POST /research/evidence/run` có thể chạy lại bằng admin token nếu Memo đang chờ; job dùng lại giao dịch đã ký, không tự tạo Memo thứ hai sau tình huống broadcast mơ hồ.

## Kiểm chứng đã chạy ngày 23/09/2026

```text
GET http://127.0.0.1:5173/api/scex-tracking → HTTP 200; actors=596; posts=1023; asOf=2026-09-20
PUT http://127.0.0.1:5173/api/scex-tracking → HTTP 405; Local Radar proxy is read-only
GET http://127.0.0.1:4174/health → enabled=true; surfConfigured=false; databaseConfigured=false; evidenceConfigured=true
GET http://127.0.0.1:5173/dr-api/templates → HTTP 503, vì chưa có DATABASE_URL
```

Trang SCEX từ Chrome hiển thị 467 KOL sau bộ lọc mặc định và 1.023 mention; mở KOL từ feed được, tab Deep Research hiển thị đúng lỗi dịch vụ chưa sẵn sàng. Khi chạy Vite riêng với `DEEP_RESEARCH_ENABLED=false`, `/api` và `/dr-api` không proxy; Chrome vẫn mở tab Surf AI cũ và có 0 panel Deep Research. Adapter server đọc Radar thật với KOL `phamduydong179`, nhận 11 bài SCEX và timestamp nguồn. Chưa có report Surf hoặc tx Memo thực tế.

`npm run build`, `npm run lint -- --quiet`, `npm run research:typecheck` đều đạt. Vitest toàn bộ đạt **153/153** khi chạy bằng Node 24; Node 25 trên máy có một lỗi cache test đã có từ baseline (`convictionEventsStore.test.ts`). `npm run research:check-secrets` kiểm tra giá trị secret đã cấu hình không xuất hiện trong `dist`; khi Surf/database còn trống, hai giá trị đó chưa được kiểm tra.

Khi đã điền key/database, chạy lại migration, tạo report thật, chờ Memo devnet và kiểm tra verify trước khi đánh dấu M1 hoàn thành. Dừng để review M1 trước M2/payment.
