# Surf usage diagnosis — 27 September 2026

## Verified observations

- The effective API base is `https://api.asksurf.ai/gateway`. The current environment key matches `.env.local`; its suffix `191e` matches the dashboard filter in the supplied screenshot. Full credentials were not logged.
- Research requests use `POST /v1/responses`, Bearer authentication, JSON `model: "surf-2.0"`, `input`, `instructions`, `reasoning: { effort: "xhigh" }`, and `stream: false`. This matches the official request examples.
- The second authorized research attempt began at 08:04 UTC and received HTTP 504 at approximately 08:24 UTC. The encrypted saved response contains only gateway-timeout HTML, no completed report, usage object or recovery ID. A 30-minute client timeout does not override an upstream gateway timeout.
- The supplied dashboard screenshot shows 72 credits / 11 calls: 60 credits for three instant research calls, 12 for six market-price calls, and two zero-credit data calls. It shows no full-research/xhigh entry. This is historical screenshot evidence, not a current ledger read.
- A read-only `GET /v1/me/credit-balance` with the configured API key returned HTTP 401 (`UNAUTHORIZED`), despite the documentation naming this route for balance checks. Its exact account-auth requirements could not be verified from the public Data API OpenAPI schema; that schema did not list the balance or research routes.
- A subsequent single authenticated `GET /v1/market/price?symbol=SOL` returned HTTP 200, `meta.credits_used: 1`, `meta.cached: false`. This confirms current Data API access and one additional diagnostic credit consumed. The published market tier says two credits; the actual response reported one.

## Conclusion and limits

The configured request shape is correct and current Data API authentication works. There is no evidence that either failed research attempt consumed 200 credits. The dashboard is consistent with unsuccessful requests not reaching successful usage accounting, but the reviewed public docs do not specify timeout billing or failed-call visibility. A provider ledger/support confirmation is needed for a definitive retrospective billing conclusion. No third research call was made during diagnosis.

Streaming SSE is documented and is a reasonable next transport experiment for long research. It is not a confirmed fix for the provider timeout. A robust implementation should persist events, require a terminal completed response, record provider request IDs/allowlisted headers, and distinguish published cost estimates from confirmed usage. It must not silently retry a billable request.

## Official references

### Subsequent authorized streaming attempt

The user approved the streaming approach. Attempt 3 subsequently completed with 1,592 captured events and response ID `resp_842f035c43e098b96b11bf8b98367cd3`. The provider confirmed `surf-2.0`, `reasoning.effort: xhigh` and terminal `status: completed`. Usage reported 39,501 input tokens and 39,019 output tokens (78,520 total), but no `meta.credits_used`; the 200-credit price therefore remains explicitly labelled as the published rate. The source-reviewed edition has 6,368 words, nine tables and all 36 source URLs. Its public report and NFT metadata were uploaded to Irys Devnet and downloaded again to verify their hashes. No buyer payment or NFT mint was performed. Streaming succeeded for this attempt; it is not a guarantee that future upstream requests will complete.

- https://docs.asksurf.ai/chat/responses
- https://docs.asksurf.ai/chat/overview
- https://docs.asksurf.ai/pricing
- https://docs.asksurf.ai/data-api/overview
- https://api.asksurf.ai/gateway/openapi.json
