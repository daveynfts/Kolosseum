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

## M2 sandbox integration in progress (24 Sep 2026)

The installed pay.sh CLI was verified with this exact command:

~~~powershell
npx --yes @solana/pay@1.0.26 --version
# pay 0.26.0
~~~

The current paywall.yml uses the documented YAML fields from [pay.sh YAML specification](https://pay.sh/docs/building-with-pay/yaml-specification), [MPP sessions](https://pay.sh/docs/building-with-pay/payment-channels/sessions), and [x402 upto](https://pay.sh/docs/building-with-pay/payment-channels/upto). The gateway injects PAY_ORIGIN_TOKEN as an upstream HTTP header only after payment verification. Its essential meter settings are:

~~~yaml
session:
  cap_usdc: 2.0
  modes: [push]
  settlement_authority: delegated
  close_delay_ms: 5000
metering:
  schemes: [x402-upto]
  upto:
    max_usd: 1.0
    min_usd: 0.10
    missing_usage: error
    response_body:
      mode: buffer
      max_bytes: 1048576
  dimensions:
    - direction: usage
      unit: quota_units
      scale: 1
      meter:
        source: response_json
        path: /surfUsage/creditsUsed
      tiers:
        - price_usd: 0.006
~~~

Quick reports use MPP session at $0.45 per report, above the documented $0.30 low-reasoning Surf cost. Deep reports authorize up to $1.00 and meter Surf credits at $0.006 each, with a $0.10 minimum. Missing credits cause an error before report storage; the gateway is configured to refund on missing usage. This pricing must be checked against a real Surf response before M2 is marked complete.

The spec passed the actual sandbox validator and booted five endpoints (two metered, three free):

~~~powershell
npx --yes @solana/pay@1.0.26 --sandbox gate api paywall.yml --bind 127.0.0.1:1402
~~~

Observed HTTP results: GET /health returned 200 from the real sidecar; POST /research/quick returned 402 with an MPP session challenge, $0.45 request price, and a 2,000,000-micro-USDC channel cap; POST /research/deep returned 402 with x402 scheme upto and a 1,000,000-micro-USDC ceiling. With gateway mode enabled on a temporary origin, a direct call and the old M1 admin token each returned 401; the gateway secret reached the real handler and returned 503 because DATABASE_URL is still missing. A trading-advice prompt returned 400. No sandbox payment was made against an unavailable report service.

Before a real Kolosseum paid report test, set SURF_API_KEY and DATABASE_URL in the ignored .env.local, run the migration, set PAY_GATEWAY_ENABLED=true, start the research sidecar, then run npm run pay:sandbox. The launcher checks origin health and templates before it accepts payments. The operator devnet wallet has 5 test SOL from the official faucet; this is separate from pay.sh localnet sandbox funds. M2 still needs paid CLI purchases against real Kolosseum reports, actual receipt parsing, verified payer/channel persistence, and the UI demo path.

### Sandbox payment observations (24 Sep 2026)

The official bundled pay.sh debugger demo was run on port 1402. An unauthenticated `curl.exe` to `GET /api/v1/reports/usage` returned HTTP 402. The documented built-in client command succeeded:

~~~powershell
npx --yes @solana/pay@1.0.26 --sandbox fetch http://127.0.0.1:1402/api/v1/reports/usage
# {"status":"ok"}
npx --yes @solana/pay@1.0.26 --sandbox account list
# sandbox buyer 999.99 USDC; gateway 1000.01 USDC
~~~

Both wallets began at 1000.00 sandbox USDC, so this confirms one $0.01 sandbox payment to the official demo, not a Kolosseum report purchase. The first Windows `pay --sandbox curl` attempt reported `Command not found: curl. Is it installed?`. The pay CLI invokes the separate `which` utility to locate curl; Git for Windows provides `C:\Program Files\Git\usr\bin\which.exe`. Prepending that directory to PATH made `pay curl` work. The built-in `pay fetch` also works without it.

A separate isolated payment test copied the current paywall spec to a temporary file and pointed it to a temporary local capture origin. `pay --sandbox fetch -X POST --content-type application/json --body ... http://127.0.0.1:1403/research/quick` opened a sandbox channel but ended with `Server returned 402 again after payment`; the origin saw no request. The buyer sandbox balance changed from 999.99 to 998.99 USDC and the gateway balance from 1000.01 to 1000.00 USDC, consistent with 1 USDC in the test channel escrow; there is no successful report charge or receipt. The original push/client-voucher configuration was incompatible with the CLI single retry; the delegated-voucher fix is verified below. Both temporary servers were stopped. Do not present real Kolosseum quick purchases as working or enable real funds. The production project remains devnet/sandbox only.

A successful Kolosseum paid report test additionally requires SURF_API_KEY and DATABASE_URL in ignored .env.local, migration, a real Surf report, and confirmed devnet Memo. The gateway launcher currently refuses to start without these dependencies. Receipt extraction, verified payer/channel persistence, and report UI purchase remain M2/M3 work.

### x402 upto and wallet access observations (24 Sep 2026)

A second isolated protocol test used the current x402 upto gateway spec and a temporary local origin that returned `surfUsage.creditsUsed: 50`. This was a meter fixture, not a Surf report. `pay --sandbox fetch -X POST --content-type application/json --body '{}' http://127.0.0.1:1403/research/deep` returned HTTP 200 with the origin JSON. The sandbox balance check showed buyer 999.70 and gateway 1000.30 USDC after the call, consistent with the configured 50 × $0.006 = $0.30 charge. The origin received only standard HTTP headers plus `X-Kolosseum-Gateway`; it did not receive a buyer wallet, payment signature, channel ID, or receipt. Thus the pay.sh proxy can establish that a request passed payment verification, but cannot by itself populate a verified payer or channel record in this app. The temporary origin/gateway were stopped.

For the next code increment, a paid generation request must supply a valid on-curve `buyerWallet`; the gateway still decides whether the request reaches the origin. That address is the selected **report owner**, not yet a verified payment payer. The content is returned in the successful purchase response for CLI clients and stored encrypted for later reads. A subsequent report read requires an Ed25519 signature from the owner wallet over the report ID and a timestamp valid for two minutes; the M1 admin path remains available. A Phantom/Solflare wallet-adapter connection and signed unlock button are present on the report page. These changes do not prove a receipt or settlement for a real Kolosseum report, vote weight, or resale rights. Future receipt reconciliation must distinguish the report owner from the actual payment payer.

Validation for this increment: 162/162 Vitest tests on Node 24, research TypeScript check, lint, and production build passed. The bundle secret check scanned 288 files and found no configured secrets. Headless Chrome rendered the report page with both wallet connection buttons and no page errors while the research service was intentionally offline; it displayed HTTP 502 rather than a fabricated report.

### MPP session protocol fix (24 Sep 2026)

The [pay.sh provider schema](https://pay.sh/docs-assets/provider.schema.json) documents `session.settlement_authority: delegated` independently of `session.modes`. With `modes: [push]`, the buyer still funds a sandbox channel escrow; the operator can sign cumulative vouchers for successful metered responses. The previous default `client_voucher` returned another 402 after opening because a client voucher was needed. The CLI's one paid retry stopped there. A separate `modes: [pull]` experiment did not work without its additional `pull_voucher_strategy`; it was not adopted.

The current `paywall.yml` sets `settlement_authority: delegated`. An isolated copy of this exact configuration, pointed at a temporary origin, completed two real pay.sh sandbox quick calls. The second used the documented curl pass-through and showed both receipt headers:

~~~powershell
$env:PATH = 'C:\Program Files\Git\usr\bin;' + $env:PATH
npx --yes @solana/pay@1.0.26 --sandbox --no-dna curl -i -sS -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:1403/research/quick
# HTTP/1.1 200 OK
# Payment-Receipt: present
# Payment-Receipt-Url: present
# {"ok":true,"originHeaderNames":["accept","content-type","user-agent","content-length","x-kolosseum-gateway","accept-encoding","host"]}
~~~

The temporary origin returned fixture JSON solely to verify the protocol, never as an app report. These calls prove gateway entry, one paid retry, origin forwarding, and receipt-header emission for MPP sessions. They do not prove a real Surf report purchase, on-chain close/settlement, receipt reconciliation, buyer/payer equality, or UI checkout. The two temporary processes were stopped. [pay.sh session docs](https://pay.sh/docs/building-with-pay/payment-channels/sessions) describe the off-chain voucher and idle-close settlement model; the actual close transaction must be inspected when the live report flow is available.

### Surf output rights before resale (24 Sep 2026)

[Surf Terms of Service](https://asksurf.ai/terms-of-service), section 3(a), currently limits use of Output to personal or non-commercial purposes unless Surf gives prior written consent for commercial use. The terms expressly cover the API. Kolosseum's paid report and resale design is commercial in intent, even though current payment tests use worthless sandbox USDC. Keep resale disabled and do not claim commercial distribution rights until the project has written permission covering paid reports and downstream resale, or replaces the restricted output with an appropriately licensed source. This is a project dependency, not a substitute for the missing SURF_API_KEY/DATABASE_URL end-to-end checks.
