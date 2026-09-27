# SurfAI report editions on Solana Devnet

The new checkout purchases a collectible edition of an already prepared report. It does not generate a new paid Surf response for every buyer. The original free recording remains a separate option. No mainnet payments are implemented.

## Price and wallet flow

Connect → sign a short-lived wallet authentication message → request a quote → review credit cost, exchange rate, recipient, mint estimate and network fee → approve a single transaction → confirmation slideshow → report and NFT links.

The server computes `ceil(credits × 6000 USD micro-units × 1e9 / SOL price in USD micro-units)` lamports. Surf's published list rate is $0.006/credit; xhigh is 200 credits ($1.20). This is list pricing, not a claim about account-specific volume discounts. CoinGecko SOL/USD quotes include source timestamps; stale, unavailable or invalid prices block checkout. Quotes expire after 60 seconds and also depend on a valid Solana blockhash. Mint/rent has a conservative 0.01 SOL estimate, shown separately from the report price and transaction fee. The wallet simulates the actual transaction.

One transaction contains a native SOL transfer, a Metaplex Core asset creation and a report-hash memo. The buyer pays all fees and receives the NFT. Its immutable metadata URI and immutable SHA-256 attribute identify the report. SOL Devnet has no monetary value. The complete report is public off-chain content; NFT ownership is a collectible edition, not exclusive copyright or a private content license.

## Configuration

Server and Vite build: `SURF_NFT_ENABLED=true`. Default is disabled. This flag is independent of the free recorded demo and can run without `DEEP_RESEARCH_ENABLED`. In local development `/dr-api` proxies to the research sidecar.

Required server configuration:

- `DATABASE_URL`: application PostgreSQL. Run `npm run research:migrate` to apply the additive `dr_nft_purchases` ledger.
- `SOLANA_RPC_URL`: HTTPS Devnet RPC. The server verifies the genesis hash; a mainnet endpoint is rejected.
- `REPORT_SOL_TREASURY`: the SOL recipient. If omitted, use the public address of the existing `OPERATOR_KEYPAIR_PATH`. Never put this keypair in client code.
- `VITE_RESEARCH_API_URL`: public HTTPS sidecar URL in deployed builds if `/dr-api` is not reverse-proxied. Deploying the static app alone does not deploy the research sidecar.

## Prepare and store the report

`npm run nft:prepare-report` makes **one billable Surf xhigh request** using configured credits, with a 30-minute absolute timeout and no automatic retries. It writes an exclusive marker under `.demo-captures/premium-xhigh/` before the request. A timeout may still consume credits; the marker intentionally blocks a repeat. Do not remove it and retry without operator cost approval. An explicitly authorized additional attempt uses `-- --attempt=2` and a separate marker directory, preserving the first attempt. The full raw response is encrypted before parsing or format validation; invalid sections should be repaired/reviewed from the saved response rather than buying another response automatically. The bounded HTTPS transport permits long research responses without Node fetch's separate headers timeout.

The validated result is exported as `public/demo/nbaluong-premium.json`, with actual provider usage when available, otherwise the explicitly labelled published credit rate. No token, receipt or buyer key is exported.

**Current preparation status:** the authorized third attempt completed using SSE on 27 September 2026, after the first two attempts timed out. It captured 1,592 events and provider response `resp_842f035c43e098b96b11bf8b98367cd3`. The source-reviewed edition contains 6,368 words, nine tables, eight sections and all 36 source URLs. `meta.credits_used` was absent, so 200 credits is labelled as the published rate, not a confirmed balance deduction. The first two failed attempts' credit consumption remains unverified.

The reviewed report and metadata were uploaded through Irys Devnet; `public/demo/nft-storage.json` records the public URLs and hashes. No buyer payment or NFT mint has been executed. The free recorded replay remains available, with a link to the new complete dossier.

The encrypted original Surf result remains unchanged. `scripts/research/refine-premium.ts` records source-based editorial changes (ambiguous referral wording, citation dates and a prize-schedule discrepancy), preserves the original content hash in `editorialReview`, and computes a new hash for the reviewed edition. Numerical totals, monthly distributions and medians were independently recalculated. This review is not independent verification of the author's underlying claims.

The supporting snapshot is available separately as `public/demo/nbaluong-sourcebook.html` and `.json`: 36 original-language posts with dates, links and recorded engagement. This evidence appendix is not a completed Surf analysis. Regenerate it locally with `tsx scripts/research/export-sourcebook.ts`; this reads the encrypted saved request and does not call Surf.

After a successful response, `npm run nft:review-report` exports a readable HTML dossier and Markdown download, and writes an automated coverage audit to the private attempt directory. Review numerical aggregates, named claims and source links before publishing; structural checks alone do not guarantee factual accuracy.

The third authorized attempt uses SSE (`stream: true`) and a client request ID. Each event is encrypted into an exclusive numbered file as it arrives; HTTP status and allowlisted request-ID headers are saved separately. Only `response.completed` with a completed response can become a report. EOF, `[DONE]` alone, partial text, failed or incomplete events cannot be published. The client limit remains 30 minutes; there are no automatic retries. Review defaults to attempt 3; pass `-- --attempt=N` to review a different captured request.

Storage options:

1. `npm run nft:upload` uses Metaplex's official Irys uploader on **Irys Devnet** and the configured Devnet operator. It uploads the artwork, report and metadata, then writes `public/demo/nft-storage.json`. It rejects upload quotes above 0.001 test SOL per file and records progress to avoid repeating completed uploads. Irys Devnet is test storage, not a permanence guarantee; use durable storage before a mainnet launch.
2. Alternatively configure `REPORT_NFT_PUBLIC_BASE_URL=https://your-public-site.example` and run `npm run nft:export`. Publish the resulting content-addressed report and metadata files along with the artwork. Keep old hashes available indefinitely. The server fetches and verifies the hosted metadata and report before accepting payment. Localhost URLs are not allowed.

If an Irys manifest exists, it takes precedence over the hosted-file option. A mismatch or unavailable storage blocks new purchases.

## Recovery and privacy boundaries

Quotes are serialized per buyer and report hash in PostgreSQL. Repeated clicks reuse the same quote. The server accepts only a fully signed transaction whose exact message matches the saved quote. Signed bytes and signature are persisted **before** broadcast; retries rebroadcast only those same bytes. A different wallet cannot read or submit a purchase.

After a lost response or reload, use **Recover my purchase** or **My Reports → Report NFTs**. A submitted transaction is never replaced by a new charge automatically. Failed or expired ambiguous transactions require review; report payment and mint are atomic, but a failed transaction can still cost a network fee. The purchase library records the original buyer, not current ownership after an NFT transfer. Confirmed report content is hash-checked again in the browser.

## Verification

- `npm run nft:simulate`: real Devnet RPC simulation of transfer + Core NFT + memo. No operator signature or broadcast.
- `npx vitest run lib/payments/solPricing.test.ts lib/payments/reportNft.test.ts lib/payments/reportNft.integration.test.ts`: rounding, stale rates, tamper rejection, concurrent quote reuse, expiry, wrong-wallet rejection, ambiguous broadcast recovery and ownership checks. Integration tests require an isolated `kolosseum_test` database and mock RPC responses.
- Start Vite with `SURF_NFT_ENABLED=true` on `127.0.0.1:5175`, then run `npm run test:nft`. Browser tests inject a test wallet and mock the API; they do not use a personal extension or broadcast a purchase.
- Before release, complete a real Phantom/Solflare approval on Devnet after publishing the report, verify the transaction and NFT in Explorer, then reopen it through My Reports. This manual wallet/mint check has not yet been completed.

Sources: [Surf pricing](https://platform.asksurf.ai/docs/pricing), [Metaplex Core](https://www.metaplex.com/docs/smart-contracts/core/create-asset), [Metaplex storage](https://www.metaplex.com/docs/dev-tools/umi/storage), [CoinGecko quote timestamps](https://docs.coingecko.com/reference/simple-price).
