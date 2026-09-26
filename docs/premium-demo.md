# Kolosseum Premium replay

Run `npm run dev`, then open `/scex?kol=luong4101992&tab=surfai`. Connect Phantom or Solflare on desktop, or use the wallet's mobile browser. The public demo requests no signature, balance, transaction, research job or payment. Devnet describes the application's configuration; connection alone does not verify the wallet's network.

`SURF_DEMO_ENABLED` defaults to true and is independent of `DEEP_RESEARCH_ENABLED`. Set it to false and restart/rebuild to use existing public reports only. Research operator tools live under `/#/admin/research` and retain server authentication. Purchased reports retain the existing signed wallet authentication.

The replay takes 12 seconds. Pausing stops animation only; closing the profile or changing tabs preserves progress. Disconnecting pauses progress until reconnection. Progress and viewed demos are saved in session storage, with an in-memory fallback. Replay resets that demo's progress. Viewed demos are not purchases.

## Public fixture

`npm run demo:export-public` verifies and decrypts the private `.demo-captures/flow-mpp.json` locally using `REPORT_ENC_KEY` from `.env.local`, then exports only approved public fields to `public/demo/nbaluong.json`. Never publish the private capture or environment file. The browser verifies the exact report content's SHA-256 before showing it. The fixture records 25 September 2026, source snapshot 20 September, 20 cited posts out of 36, and all eight original sections.

The Three.js scene is a separate lazy chunk. It is prefetched only when the featured demo is focused/hovered or nbaluong is selected. The static poster is captured from that scene. Reduced motion, WebGL creation failure and context loss preserve the independent HTML progress and report controls. Low quality starts on mobile; performance monitoring lowers resolution and disables shadows when necessary.

## Validation

Use Node 24 for the repository's checks:

```
npm run build
npm run lint
npm run research:typecheck
npm test
npm run research:check-secrets
```

With a dev server at `http://127.0.0.1:5173` and Chrome installed, run `npm run test:premium`. This uses the real Phantom adapter with an injected test provider; it never accesses a personal wallet. Screenshots are saved to the OS temporary directory under `kolosseum-premium-review`. `--capture-poster` passed to the script refreshes the public arena poster.

Before release, manually approve/reject connections with both real Phantom and Solflare, including their mobile browsers. Measure FPS on the actual desktop/mobile hardware; software-rendered headless Chrome is not a hardware performance certification. The existing DOCX test skips content verification when its sample file is absent.
