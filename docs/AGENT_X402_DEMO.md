# Kolosseum agent demo

The website prepares a private order and a copyable agent prompt. An external agent purchases it through **x402-upto on pay.sh sandbox**. Sandbox uses Surfpool/localnet, not Solana Devnet. Surf generation is real and consumes provider credits.

## Presenter flow

1. Open a KOL's SurfAI tab, connect a wallet, scroll to **Use with an agent**.
2. Click **Prepare agent prompt** and approve the wallet sign-in message. This does not pay or call Surf.
3. Copy the private prompt into an agent launched with `pay --sandbox claude` (or another compatible Pay-enabled agent).
4. The agent checks the order, pays **0.72 test USDC** through the gateway once, saves the curl write-out receipt marker, and submits the exact `PAYMENT-RESPONSE` value to the receipt endpoint.
5. The website polls the same order. It shows receipt verification, queue/running state and the completed report with SHA-256.

Never paste the order capability into a public issue, screenshot or recording. It permits access to the order/report. A recording should crop or mask the private prompt. Keep a receipt if the connection drops; retry receipt submission or status polling, never blindly purchase again.

The **verified sandbox payer** is the report author. The website wallet is invited to read it. This distinction is intentional: preparing an order does not make the website wallet the payer. Minting or changing NFT transfer controls remains a separate Devnet transaction signed by the author wallet; this agent MVP does not automatically bridge or import a sandbox wallet into Phantom.

## Deployed services

- Research API: `https://surfai-api-production.up.railway.app`
- x402 gateway: `https://kolosseum-x402-production.up.railway.app`
- Frontend: local changes until the branch is deployed; `vercel.json` already includes the live API rewrite.

The gateway uses `Dockerfile.agent-gateway` and `deploy/agent-paywall.yml`. It advertises only the paid purchase route. The research API uses `Dockerfile.research`; receipt/status routes do not charge. The frontend and all agent prompts use public API URLs; agents do not need access to the presenter's localhost.

Gateway startup seeds a stable sandbox `gateway` account from `PAY_SANDBOX_ACCOUNTS_JSON`, a Railway secret derived from the dedicated sandbox key. The CLI otherwise generates a different gateway account after container replacement. The shell runs as the non-root `pay` user, creates an owner-only account file, and never prints its contents.

Required gateway secrets/settings: `AGENT_ORIGIN_TOKEN`, `AGENT_PAYEE`, `PAY_SANDBOX_ACCOUNTS_JSON`; the provider also accepts `PAY_OPERATOR_KEYPAIR`. Backend settings: `AGENT_X402_ENABLED=true`, `AGENT_ORIGIN_TOKEN` (same secret), `AGENT_PAYEE`, `AGENT_CHANNEL_PAYEE` (the stable gateway public key), `AGENT_GATEWAY_URL`. Optional `AGENT_SANDBOX_RPC_URL` defaults to the hosted Surfpool RPC.

## Verification and limitations

The origin does not call Surf when the gateway forwards a purchase. After the gateway settles and returns its receipt, the backend checks the sandbox network, exact 720000 base-unit USDC amount, successful on-chain transaction, payer/channel/payee binding and recipient balance change. Only then does it atomically create one research job. A unique payment reference and transaction locks prevent duplicate jobs and cross-order receipt reuse. The original SOL payment and refund routes cannot refund a sandbox USDC purchase as Devnet SOL.

The demo is fixed at medium/120 credits and uses the existing 30-minute Surf worker with no automatic paid retry. Daily credit limits include agent jobs. Failed sandbox jobs retain their receipt for diagnosis; automatic sandbox USDC refunds are not implemented. The hosted sandbox can reset, so retain the recorded verification metadata for a demo and recheck network availability before presenting.

Integration tests mock Surf/RPC and use an isolated PostgreSQL schema. Browser tests cover prompt preparation without payment, capability instructions, wallet rejection and responsive layout. `scripts/research/agent-demo.ts` is a deliberately separate operator smoke tool: `prepare`, `probe`, `pay`, `claim`, `status`. Its ignored capture file prevents automatic repayment. `claim` starts real Surf work and requires explicit spend authorization. Do not delete the capture to retry an ambiguous payment.

This is a sandbox integration, not a mainnet catalog listing. References: [Pay agent quickstart](https://pay.sh/docs/get-started/agent-quickstart), [sandbox networks](https://pay.sh/docs/pay-for-apis/sandbox-and-networks), [provider configuration](https://pay.sh/docs/accept-payments/provider-spec).

## Reproducible Pay version

Pin both gateway and buyer to Pay **0.28.0**. Install the official release binary and verify its SHA-256 against the release checksums; the npm wrapper can still download CLI 0.26.0. The operator tool accepts `PAY_BINARY` and checks the version and 402 price/network before any payment attempt. Wait for Railway deployment **SUCCESS** before testing: during rollout the domain can still serve the previous image.

On 2026-09-28, the two attempted payments were rejected before origin acceptance (`verification_failed`: accepted requirement mismatch). No settlement receipt or Surf job was created. The first used CLI 0.26.0; the second reached the previous gateway while the pinned deployment was still rolling out. The now-active 0.28.0 challenge no longer includes the newer `transactionVersions` field. On 2026-09-29, the authorized retry succeeded with the pinned gateway. The verified 0.72 test-USDC settlement produced one completed medium report: 32,260 characters, 1,124 stream events, SHA-256 `097f5d25a8474b118b26fad03b157eb0738c5e27fb91f90918a109c6a4734817`.

## Private replay capture

Run `npx tsx scripts/research/export-agent-replay.ts` to save a standalone presentation in `.demo-captures/agent-replay/index.html` plus allowlisted `recording.json`. It performs authenticated status retrieval only, never a payment or Surf creation. The private output is ignored by Git and excluded from Docker builds. Do not move it to public hosting without permission. The page has Play/Next/Reset, works offline, and marks incomplete/failed attempts honestly. If the order completes, export again to include the unchanged report after SHA-256 validation. Capabilities, wallet private keys, requester/payer wallet addresses and full receipt headers are excluded.

## Receipt capture and recovery

Pay CLI overrides curl `-D` and `-o`. Use `--write-out` with `\nKOLOSSEUM_RECEIPT:%header{payment-response}\n`, capture stdout privately, and extract the final receipt marker. The script and website prompt use this format; a local HTTP test verified receipt preservation without payment. The successful smoke payment initially lost its header; its receipt fields were reconstructed from the actual transaction and independently passed the same on-chain verifier before claim. It was not repaid.

When an order is accepted, the website offers **Recover an existing payment**: paste the saved receipt and verify it to continue. This never signs or sends another payment. Expired unpaid orders can be replaced; settled orders must be reused. The complete private replay is available locally, including the unchanged report. No NFT was minted during the x402 smoke run.
