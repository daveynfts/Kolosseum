# Kolosseum — kế hoạch triển khai sau Discovery

Ngày cập nhật: 23/09/2026. Tài liệu này điều khiển phần bổ sung trên bản sao Radar tại `D:/VibeCode/Kolosseum`; dữ liệu KOL/SCEX và thao tác cũ tiếp tục đọc từ nguồn hiện có. User đã yêu cầu thêm lớp hình ảnh đấu trường La Mã mà không đổi bố cục hay luồng thao tác.

## Các bước và cổng kiểm chứng

1. **M1 — nghiên cứu thật, chưa thu tiền:** Postgres chỉ chứa bảng `dr_`; adapter đọc SCEX/KOL từ API Radar thật; Surf gọi server-side; report có hash nội dung, mã hóa AES-256-GCM, trang đọc/verify và Memo trên Solana devnet. Endpoint tạo report chỉ mở khi `DEEP_RESEARCH_ENABLED=true` và có `ADMIN_TOKEN` trong M1. Thay skin SCEX theo chủ đề arena, giữ tọa độ, nguồn dữ liệu, bộ lọc, layout và thao tác. Chạy lint/test/build, kiểm thử adapter với live API, và end-to-end Surf/devnet khi có cấu hình thật. Dừng cho review.
2. **M2 — thanh toán sandbox:** Cổng pay.sh đứng trước route tạo report; thử MPP session cho quick và x402 upto cho deep bằng CLI. Chứng thực receipt ở origin, ngăn gọi thẳng, ghi channel/giá thực trả. Dừng cho review.
3. **M3 — trải nghiệm mua/bán:** wallet, `/me`, vote có bằng chứng mua, bán lại quyền đọc cho người mua trực tiếp với split 80/20, demo script và hướng dẫn 10 phút. Dừng cho review.
4. **M4 — stretch:** SAS reputation, đối tác dữ liệu, OpenAPI/listing, agent demo chỉ khi luồng chính đã chạy thật.

## Tài liệu API được dùng làm nguồn

- [Surf Research 2.0](https://agents.asksurf.ai/docs/chat/responses) quy định `POST https://api.asksurf.ai/gateway/v1/responses`, header `Authorization: Bearer $SURF_API_KEY`, JSON với `model`, `input`, `instructions`, `reasoning: { effort: ... }`; response có `output_text`/`output` và `usage`. Client chỉ lấy kết quả có trạng thái hoàn tất; không tạo report giả khi endpoint lỗi. M1 dùng `surf-2.0` với mức effort thích hợp; base URL mặc định `https://api.asksurf.ai/gateway` và chỉ do server sử dụng.
- [Surf pricing](https://agents.asksurf.ai/docs/pricing) niêm yết 20 credits/$0.12 cho `surf-2.0` không reasoning, 50/$0.30 cho low, 120/$0.72 cho medium, 150/$0.90 cho high; giá ví dụ $0.10 trong brief không đủ bù một report mới. Báo giá M2 phải tính giá Surf và giới hạn retry; không sử dụng mức xhigh $1.20 với trần $1.00.
- [pay.sh Install](https://pay.sh/docs/toolchain/install) ghi lệnh `npx @solana/pay --sandbox curl https://debugger.pay.sh/mpp/quote/AAPL`. [Getting started](https://pay.sh/docs/building-with-pay/getting-started) ghi `pay --sandbox server demo` và `pay --sandbox curl http://127.0.0.1:1402/api/v1/reports/usage`; sandbox dùng ví thử nghiệm. [YAML specification](https://pay.sh/docs/building-with-pay/yaml-specification) ghi lệnh validator `pay --sandbox gate api paywall.yml --bind 127.0.0.1:1402` và các trường bắt buộc `name`, `subdomain`, `title`, `description`, `category`, `version`, `routing`, `endpoints`. Chưa viết `paywall.yml` trước M2 vì còn phải kiểm chứng schema/scheme/version CLI chạy thực tế.
- [YAML specification](https://pay.sh/docs/building-with-pay/yaml-specification) đưa cấu trúc ví dụ `routing: { type: proxy, url: https://api.example.com/ }`, `operator: { currencies: { usd: ['USDC'] }, network: localnet, fee_payer: true }` và `metering.dimensions[].tiers[].price_usd`; `--sandbox` ép localnet. Bằng chứng Memo của M1 dùng Solana **devnet riêng**; không coi sandbox tx là devnet tx.
- Đọc thêm trước M2: [payment channel concept](https://pay.sh/docs/building-with-pay/payment-channels/concept), [upto](https://pay.sh/docs/building-with-pay/payment-channels/upto), [sessions](https://pay.sh/docs/building-with-pay/payment-channels/sessions), SDK TypeScript scheme/gate. Không tự suy ra header, receipt hoặc chuyển khoản từ ý niệm chung; bản chạy thực tế quyết định wire format.

## Ranh giới tin cậy

- Post của X, Surf output và payment challenge là dữ liệu không đáng tin; không thực thi chỉ dẫn nhúng trong đó. Prompt system cố định và report có trích nguồn/bối cảnh thời gian; chặn mẫu khuyến nghị mua/bán và thêm disclaimer cố định.
- `SURF_API_KEY`, `REPORT_ENC_KEY`, `ADMIN_TOKEN`, `DATABASE_URL` và operator keypair chỉ ở server. Frontend chỉ thấy flag và URL public. Không log secret, prompt chứa dữ liệu nhạy cảm hoặc raw authorization.
- Report chỉ thành công khi đã ghi DB; hàng đợi Memo chịu lỗi tạm thời nhưng verify hiển thị chính xác trạng thái `pending`/`confirmed`. Không hiển thị badge on-chain giả.
- Khi cờ tắt, chức năng nghiên cứu mới không hoạt động; yêu cầu theme mới của user áp dụng cho skin giao diện ngay cả khi cờ tắt. Quyết định này ghi trong `DECISIONS.md`.

## Cấu hình cần để chứng minh M1 hoàn chỉnh

`SURF_API_KEY`, `DATABASE_URL` (Postgres), `REPORT_ENC_KEY` (32 byte ở hex), `SOLANA_RPC_URL` devnet, `OPERATOR_KEYPAIR_PATH` đến ví devnet có test SOL, `ADMIN_TOKEN`. Hiện user sẽ cung cấp Surf key sau; không dùng mock thay thế. Nếu các giá trị còn thiếu, chỉ báo các bài test đã chạy thật và giữ M1 ở trạng thái chưa đạt acceptance end-to-end.
