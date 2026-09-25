# M1 live-data runbook

The code path reads real KOL and SCEX posts from the existing Radar API, calls Surf, stores an encrypted report in PostgreSQL, and writes a SHA-256 evidence Memo on Solana devnet. On 25 September 2026, both the private quick report and paid MPP/x402 reports were verified end to end for @luong4101992. The working replacement Surf key passes an authenticated Data preflight and real Chat; the documented balance route still returns HTTP 401 for that key. See [Surf API notes](./SURF_AUTH.md) and the [recorded walkthrough](./DEMO_REPLAY.md).

## Prepare

```powershell
cd D:\VibeCode\Kolosseum
npm ci
npm run research:init-devnet
```

The init command creates Git-ignored `.env.local` and `.operator-keypair.local` and prints only the operator public address. Follow [PostgreSQL setup](./DATABASE_SETUP.md), then put `DATABASE_URL` and a live `SURF_API_KEY` into `.env.local`. Keep the generated `REPORT_ENC_KEY` and `ADMIN_TOKEN` private. Retain the encryption key after reports exist; changing it prevents old reports from being read.

```powershell
npm run research:migrate
npm run research:fund-devnet
```

The funding command checks the devnet cluster and requests test SOL. If the RPC airdrop is rate limited, use the [official Solana devnet faucet](https://faucet.solana.com/) with the printed operator address and rerun the balance check. Use devnet test funds only. The Memo worker checks the balance before signing. An ambiguous signed transaction is checked by its original signature instead of automatically signing a second Memo.

## Run locally

Start the research sidecar and Vite in separate PowerShell terminals:

```powershell
npm run research:dev
```

```powershell
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/scex`. With `DEEP_RESEARCH_ENABLED=true`, the local Vite proxy forwards read-only Radar API requests and `/dr-api/*` research requests to the sidecar. The Radar write methods are blocked locally. A production deployment needs a separately hosted research sidecar and `VITE_RESEARCH_API_URL` pointing to it.

Select a KOL in the live feed, open Deep Research, choose a template, and enter your local `ADMIN_TOKEN` for the private M1 route. Once Surf generates a report, open `/reports/<id>` to inspect its content hash, Memo status, and devnet explorer link. If the evidence job remains pending, run `npm run research:evidence` or use the protected `POST /research/evidence/run` route. The job reuses a previously signed transaction.

For the sandbox payment route, follow the [README demo steps](../README.md#deep-research-sandbox-demo). Do not treat a gateway protocol fixture as proof that a Kolosseum report has been purchased end to end.

## What has been checked

The local Radar proxy returned real SCEX data and blocked write methods. The top-KOL context adapter supplied 20 real posts; Surf returned an English report; Neon stored encrypted content; hash and Solana devnet Memo matched. The paid MPP session and x402 upto paths both created Kolosseum reports and reconciled sandbox receipts. Build, lint, typecheck, unit tests, client-secret scanning, and Chrome UI checks are tracked in [the walkthrough](./DEMO_REPLAY.md).
