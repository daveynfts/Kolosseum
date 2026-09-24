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

### M2 receipt reconciliation increment (24 Sep 2026)

The sandbox protocol was inspected with the installed `@solana/pay@1.0.26` and an isolated capture origin. These are payment-protocol fixtures, **not Kolosseum/Surf reports**. The live `.env.local` still has no `SURF_API_KEY` or `DATABASE_URL`, so no real report purchase or database migration was claimed.

`Payment-Receipt` from the MPP quick call decoded to a Solana localnet session: `reference=Gj2ZCweVQTJFetWHRBwkwvKQfSXL2jeboujKxckK8u5C`, `amount=450000`, `acceptedCumulative=spent=450000`, `authorized=1000000`, `remaining=550000`, with the canonical USDC mint. The unit is one millionth USDC. The gateway's `GET /__402/payment-channels/receipt/{channelId}` returned `{"finalized":true,"settledSignature":"4SUVM9dwfEKaCfLJzVx5v5Q8xFVcXeo6RGUnYcGrYahL8FU8QoGAUG4sgHQvcxt9TQokmxcdefC4np5s8Z2Q1XB2"}` after idle close. A confirmed sandbox RPC read showed the channel account owned by the payment-channel program, status `distributed`, deposit `1000000`, settled `450000`, payer `DXPtMmFPQbHQhrxyT4jUDqFVRdULN1q9Hpf5zKg4E1xF` and payee `GiyMxR1YqJSV5rEWF3tJ9SeNrGPrmpdidMe5M5jBi4Vb`. The on-chain decoder uses the byte offsets documented in pay.sh's `pay-api-core/channel_state.rs` source, and treats the receipt's unsigned JSON as a claim until the channel state matches. A channel may remain unfinalized for several seconds; the claim route returns HTTP 202 then.

`PAYMENT-RESPONSE` from the x402 deep fixture decoded to `payer=DXPtMmFPQbHQhrxyT4jUDqFVRdULN1q9Hpf5zKg4E1xF`, `amount=300000`, `transaction=24JFZRxwZpQgdFV1zpPAPAnBDPrZUx5e2EhbzYZo4KdcW7cst72En37MBEtLEeSXSYEaq1foD6zcukPXU2nt1BW4`. The confirmed transaction contains the payment-channel program and raised the configured recipient's USDC token balance by exactly `300000`. This matches 50 fixture credits × $0.006. [pay.sh upto docs](https://pay.sh/docs/building-with-pay/payment-channels/upto) describe the `PAYMENT-RESPONSE` settlement fields; the receipt's actual wire fields were read rather than inferred.

`operator.recipient` directs the x402 sandbox payout to a fixed wallet derived from `OPERATOR_KEYPAIR_PATH` by `npm run pay:sandbox`. In this tested delegated MPP setup, the channel payee remained the pay.sh gateway signer even with `operator.recipient` present. The sidecar therefore requires the public `PAY_GATEWAY_SIGNER_WALLET` from `pay --sandbox account list` for MPP reconciliation. Do not use the devnet Memo RPC for sandbox payments: `PAY_SANDBOX_RPC_URL` defaults to the tested `https://402.surfnet.dev:8899`. [pay.sh session docs](https://pay.sh/docs/building-with-pay/payment-channels/sessions) cover idle-close settlement; [provider spec](https://pay.sh/docs/accept-payments/provider-spec) covers the operator recipient.

The new `POST /reports/:id/payment` accepts the buyer wallet's existing signed report-access headers (or the M1 admin token), plus `{ "protocol": "mpp-session" | "x402-upto", "receipt": "<base64url header value>" }`. It checks the on-chain channel payer and signer payee, payout recipient USDC delta, mint/network and price before recording `payment_ref`, `price_charged`, and `dr_channels`. MPP claims additionally advance `claimed_usdc` by exactly one quick-report price per cumulative voucher; a partial increment or replay is rejected, and a unique payment reference prevents the same x402 transaction or MPP cumulative voucher from being attached to two reports. A report owner cannot reopen a paid-mode report until a settled proof has been recorded. The successful paid POST still returns content directly to the purchasing agent. The report page can attach a receipt, display pending settlement, and show the verified price/channel totals. The receipt is not written to browser storage.

This is **not complete M2 acceptance**: the real Surf/PostgreSQL report path, CLI purchase of a Kolosseum report, browser checkout, cross-process discovery of the gateway signer, and full transaction-bound report attribution remain unverified. The MPP proof establishes that enough cumulative spend was settled on the payer's channel and consumed once in order; pay.sh does not bind a particular report ID into the voucher exposed to this proxy origin. The sandbox gateway and capture origin were temporary, and should be stopped after testing. Current code does not claim resale or voting rights from these receipts.

Validation for this increment: Node 24 Vitest `166 passed`, `npm run research:typecheck` passed, production `npm run build` passed, and `npm run research:check-secrets` found no configured secrets in 288 client files. `npm run lint` exited 0 with pre-existing repository warnings. Direct live RPC inspection of the two transactions above passed; no PostgreSQL integration run was possible without `DATABASE_URL`.

### Guarded Windows demo buyer (24 Sep 2026)

`scripts/research/demo-buyer.ps1` is a local, sandbox-only buyer for one real quick report. After configuring `SURF_API_KEY`, `DATABASE_URL`, `PAY_GATEWAY_SIGNER_WALLET`, and the paid feature flags in the ignored `.env.local`, apply `npm run research:migrate`, run `npm run research:dev`, run `npm run pay:sandbox`, and keep Vite running. Obtain the public `PAY_GATEWAY_SIGNER_WALLET` value from the `gateway [localnet ...]` line of `pay --sandbox account list`; restart the research sidecar after changing the env file. Then run:

~~~powershell
npm run pay:demo-buy -- -KolHandle <real-X-handle> -TemplateSlug risk-profile
~~~

The script rejects any non-loopback gateway or non-sandbox mode, checks readiness before paying, reads the CLI's sandbox buyer address, submits exactly one paid `POST /research/quick`, captures `Payment-Receipt`, polls the claim route for idle-close settlement, then checks the report hash and devnet Memo. It does not print the admin token, receipt header, or report content. The CLI request-body path was tested against an isolated sandbox capture origin and returned `HTTP/1.1 201 Created`, the exact JSON body (including `kolHandle`, `templateSlug`, and `buyerWallet`), and `Payment-Receipt: present`. The full script currently exits before payment with `Configure SURF_API_KEY and DATABASE_URL...`; no Kolosseum report was generated by this script yet. It supports quick template reports only; x402 deep purchases still need a separate live demo path.
