# Surf API authentication diagnosis

On 25 September 2026, Kolosseum's saved key was present once in the ignored .env.local, had no whitespace, quotes, or ellipsis, and the client used the documented HTTPS gateway and Bearer header. The key is not printed here or in the diagnostic command.

The authenticated GET https://api.asksurf.ai/gateway/v1/me/credit-balance returned HTTP 401 with error.code UNAUTHORIZED and message "invalid API key". The same GET without a key returned 401 "unauthorized". GET /v1/market/price?symbol=SOL returned 401 "invalid API key" with the saved key but 200 without a key, charging one anonymous free-tier credit. This corrects the earlier inference that a Data API 200 proved the key worked. The earlier 200 could have been an anonymous request. Surf's documentation explicitly permits anonymous trial calls, says 401 means a missing or invalid key, and assigns exhausted credits HTTP 402.

The Chat integration already targets POST https://api.asksurf.ai/gateway/v1/responses with Authorization: Bearer, model surf-2.0, and the documented input field. The old chat/completions endpoint is retired. Changing the request JSON, model, or reasoning effort will not make the saved key pass the authenticated balance check. The dashboard's ACTIVE label and gateway rejection disagree; the precise reason for that discrepancy is not observable from this project.

## Restore authentication

1. In the Surf console, create a fresh API key under API keys. Copy the complete secret when it is shown once. Keep the existing key active until the new one passes the test.
2. Replace SURF_API_KEY in the ignored .env.local. Do not include Bearer, quotes, spaces, an ellipsis, or a dashboard-masked preview. Do not send the key in chat, commit it, or paste it into an issue.
3. Run npm run research:check-surf-auth. It makes one authenticated balance request, does not call Chat or spend Chat credits, and prints only an acceptance category. A valid result is "Surf API key accepted by the authenticated balance endpoint."
4. Restart the research sidecar, then confirm /health has surfAuthStatus valid. Only then enable the pay.sh sandbox gateway or make one low-cost real report request.
5. If a fresh key also returns 401, ask Surf support to reconcile the console key with the gateway. Give the UTC time, endpoint, HTTP 401, and error.code UNAUTHORIZED, but never the full key.

The sidecar now blocks report generation and the local demo buyer while authentication is invalid. The pay.sh launcher also refuses to start a paid gateway without a valid authentication preflight. The recorded walkthrough remains a source-data snapshot until a real Surf report succeeds.

Official references: [Surf Data API authentication and error codes](https://platform.asksurf.ai/docs/data-api/overview), [Chat API endpoint and request](https://platform.asksurf.ai/docs/chat/overview), [credit pricing](https://platform.asksurf.ai/docs/pricing).