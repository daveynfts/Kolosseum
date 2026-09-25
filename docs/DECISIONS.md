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

## 2026-09-24 — pay.sh sandbox gateway constraints

The user authorized continuing with independent M2 work while Surf and PostgreSQL credentials are pending. The current pay.sh npm package 1.0.26 installs CLI 0.26.0. Adding the package to this application's dependency tree failed because its Solana peer dependencies require TypeScript 5 while the app uses TypeScript 6, so the sandbox script invokes the pinned package through npx. On this Windows host, Git for Windows supplies unzip for the CLI's checksum-verified binary installer.

The pay.sh validator rejected an explicit 100% session split: its percent must convert to 1–9999 basis points. It also rejected a fixed recipient distinct from the sandbox settlement signer. The spec therefore omits explicit splits and recipient overrides, so the gateway's operator signer receives the full settlement by default. A future partner split must be configured with valid percentages and a compatible recipient. The session is configured for push mode; sandbox payment channels are localnet and remain separate from the devnet Memo wallet.

PAY_GATEWAY_ENABLED and PAY_ORIGIN_TOKEN are new server-only controls. When gateway mode is on, the origin ignores the former M1 admin token for report generation and accepts only the gateway-injected secret header. The pay:sandbox launcher refuses to accept paid calls until the real Surf key, PostgreSQL connection, healthy origin, and migrated templates are present. No paid report or receipt is claimed until a real end-to-end sandbox purchase succeeds.

## 2026-09-24 — Initial sandbox MPP session failure

The official pay.sh bundled demo accepted one $0.01 sandbox payment through `pay --sandbox fetch`, proving the local CLI and hosted sandbox USDC path. The same client against Kolosseum's MPP session paywall opened a test channel but received HTTP 402 again and never reached the temporary capture origin. One sandbox USDC remains in that test channel escrow. This was a protocol integration blocker, not an application report purchase; do not claim M2 completion. The Windows `pay --sandbox curl` pass-through initially could not locate curl because the CLI invokes an external `which` utility. Subsequent delegated-voucher configuration and Git-for-Windows PATH setup resolved both issues in an isolated sandbox test. No mainnet wallet or funds were used.

## 2026-09-24 — Gateway proxy does not identify the payer to the origin

A real sandbox x402 upto call with 50 fixture credits charged $0.30 and reached an isolated origin, but its forwarded request had no buyer wallet or payment proof header. The origin therefore records a buyer-selected report owner only after the gateway verifies payment. Ownership is validated for later report reads by a time-limited Ed25519 signature from that wallet. The origin does not claim the owner was the USDC payer, and votes/resale must wait for receipt reconciliation. The paid POST returns the report content to the purchasing agent so a client without a general wallet message-signing command can still receive the paid result. No fixture content or fake channel status is shown in the product.

## 2026-09-24 — Use delegated vouchers for MPP quick reports

The default client-voucher session opened escrow but the pay CLI stopped after its first paid retry received another 402. The official provider schema permits `settlement_authority: delegated` with client-funded `modes: [push]`. An isolated sandbox test of that configuration returned 200 from the origin with Payment-Receipt headers, so Kolosseum now uses delegated voucher authority. This does not change the sandbox-only policy or claim report-level settlement. Git for Windows `which.exe` must be in PATH for this version of `pay curl` on Windows; the built-in `pay fetch` avoids that dependency.

## 2026-09-24 — Surf permission is required before commercial report distribution

Surf's published terms currently permit Output for personal/non-commercial use and require prior written consent for commercial use. The API is included in those terms. Therefore the resale marketplace stays disabled until written permission covers sale and resale of Surf-assisted reports, or the report pipeline uses a commercially permitted alternative. Sandbox protocol tests do not establish output rights.

## 24 Sep 2026 — Record paid proofs only after sandbox chain reconciliation

The pay.sh proxy adds receipt headers after the origin responds, so the origin cannot store a verified payer or price inside `POST /research/*`. The purchaser submits the header value afterward to `POST /reports/:id/payment`. The service verifies x402 settlement transaction and beneficiary USDC delta, or MPP channel payer/payee/cap/cumulative spend on the sandbox chain, then records one unique payment reference. For repeated MPP purchases, each claimed cumulative voucher must increase by exactly the report price; a settled channel total alone would allow fabricated overlapping claims. Reopening a paid-mode report requires this recorded proof. Browser checkout remains future M2 work.

A fixed `operator.recipient` works for x402 payouts but did not change the MPP channel's payee in the tested sandbox. MPP verification uses the public gateway signer (`PAY_GATEWAY_SIGNER_WALLET`); the gateway prints it and `pay --sandbox account list` shows it. No private key or receipt is placed in the client bundle. The operator recipient receives sandbox settlement funds after a channel closes, so product copy must say the deposit is held in escrow **until settlement**, not that funds can never reach the operator.

## 24 Sep 2026 — Keep the demo buyer sandbox-only and fail before paying

The current Windows demo buyer uses `pay --sandbox curl` to buy one quick report with the pay CLI's own sandbox address and uses the local admin token only for the receipt-claim step. It refuses remote gateway URLs, missing real Surf/PostgreSQL readiness, or a gateway signer mismatch before paying. This gives a real-data fallback when browser wallet payment is unavailable; it is not evidence of a completed report purchase until the missing credentials are configured and the script succeeds end-to-end.

## 24 Sep 2026 — Buyer records and weighted votes use claimed payment proof

The buyer dashboard uses a separate, short-lived wallet signature so a dashboard request cannot unlock a report. It returns only records tied to that wallet and never returns encrypted report content. Channel balances are labeled as the last verified database snapshot. The KOL panel continues to expose the private admin preview while gateway mode is off; when gateway mode is on, it shows a guarded local CLI demo command because Phantom/Solflare cannot currently fund the pay.sh sandbox channel in the browser.

A report may receive a support/challenge vote only after its payment receipt has been reconciled against sandbox-chain state and stored with a unique payment reference. The server takes vote weight and proof from that stored report row, not from the user's request. The existing `proof_tx` column stores a prefixed x402 transaction or MPP channel/voucher reference. The same buyer can change their vote, but cannot multiply their weight across duplicate rows.

## 24 Sep 2026 — Guard the UI sandbox buyer behind a local admin action

The browser cannot directly pay the pay.sh sandbox from its Phantom/Solflare connection. The optional UI demo action therefore calls a loopback-only Windows sidecar route protected by `ADMIN_TOKEN` and an explicit default-off `PAY_DEMO_BUY_ENABLED` flag. It invokes the existing pay.sh CLI buyer, which pays from the CLI sandbox wallet and verifies the receipt and devnet Memo. The admin page never receives raw receipt headers or keys. A second status route reports the latest purchase in this server session so a browser timeout does not encourage blind re-purchasing. In-memory status is a demo safeguard, not durable transaction recovery; production checkout still needs a proper payment client and persistent idempotency.

## 25 Sep 2026 — Cost-controlled, truthful local replay

The user requested a full test against the top SCEX poster and a saved flow that can be used as a mockup without repeated provider charges. The live SCEX snapshot ranks `@luong4101992` first with 36 posts. Neon is migrated and the operator has devnet test SOL. The Surf gateway rejects the saved key with HTTP 401 UNAUTHORIZED on authenticated balance, Data, and Chat requests; the earlier Data API 200 was anonymous and did not validate the key. No Surf-backed report, sandbox purchase, or Memo was claimed. The local admin-only recorded walkthrough shows source, quote, and blocked/pending steps until a real successful run exists. A future completed report can be recorded with encrypted content, sandbox payment metadata, and devnet evidence. Captures are Git-ignored and must not be presented as live. The Surf client now uses one attempt by default after ambiguous timeouts and optionally caches completed results encrypted in a local directory; local demo effort can be set to the documented 20-credit mode. The npm lockfile received only the two peer entries missing from npm 10 Linux resolution because GitHub Actions npm ci was failing; npm 10 and npm 11 dry-run validation now pass.

## 25 Sep 2026 — Keep research requests responsive while loading the arena

The 596-avatar matrix could consume the browser's connections to the local Vite origin, delaying /dr-api/health and /dr-api/templates even though the sidecar answered directly. Only matrix avatars now enter a three-at-a-time low-priority image queue; selected KOL and other profile avatars retain their previous path. A real Chrome run with images enabled opened the top KOL's Deep Research tab, loaded all three database templates and the recorded-walkthrough link in about four seconds after opening, with both API routes returning 200 and no page errors. The image sources, R2 bucket, data, and arena layout are unchanged.

## 25 Sep 2026 — Authenticate before any paid report

The Surf documentation permits unauthenticated Data API trial calls, so a price request returning HTTP 200 without a key was a false-positive credential check. An authenticated balance request and an authenticated price request both returned HTTP 401 UNAUTHORIZED with "invalid API key"; the same price request without Authorization returned HTTP 200. HTTP 402 is the documented exhausted-credit case. The saved key is well formed in one ignored .env.local entry, and the Chat URL and Bearer header match Surf's current docs. The project cannot repair a key rejected by Surf's gateway locally. An authenticated balance preflight now reports validity, the panel displays the exact category, and the sandbox gateway, demo buyer, and report routes fail before initiating a purchase when authentication is invalid. Replacing the key and rechecking is required before a real report.
