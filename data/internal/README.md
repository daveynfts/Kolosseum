# Internal data (Radar)

Structured **internal datasets** for admin control and agent/analysis tasks.

| Dataset | Repo seed | R2 key | API | Admin |
|---------|-----------|--------|-----|--------|
| **TwitterScore Top N (100→200+)** | `src/data/internal/twitterscore-top100.json` (+ mirror here) | `internal/twitterscore-top100/v1.json` | `GET/PUT /api/twitterscore-top100` | Admin tab **★ Data / TwitterScore** (`#/admin/data`) |
| **Recent Followers** (per KOL) | `src/data/recentFollowers.ts` → `RECENT_FOLLOWERS_BY_HANDLE` | `recent-followers/v1.json` (`map`) | `GET/PUT /api/recent-followers` | Smart Followers tab |
| **Smart Followers** (per KOL) | `src/data/recentFollowers.ts` → `SMART_FOLLOWERS_BY_HANDLE` | `recent-followers/v1.json` (`smartMap`) | same | Map UI sub-tab (seed/R2) |
| **KOL bios / ranks** | `src/data/sheetKols.ts`, `data/bio-patches/*.txt` | `kols/v1.json` | `GET/PUT /api/kols` | KOL Editor |
| **X Feed** | `public/feed/tier1-feed.json` | `feed/v1.json` | `GET/PUT /api/feed` | X Feed tab |

## TwitterScore Top N (currently ~300)

- **Meaning:** network influence of follower graph (0–1000), **not** content trust or trade skill.
- **Snapshot:** ranks 1–300 (duplicates merged by handle → listSize may be &lt; 300).
- Approx thresholds: **#100 ≈ 740** · **#200 ≈ 592** · floor ≈ **518**.
- **Seed JSON schema:**

```json
{
  "version": 1,
  "kind": "twitterscore-top300",
  "asOf": "ISO",
  "source": "https://twitterscore.io/topScored/",
  "sourceNote": "…",
  "maxScore": 1000,
  "top100Threshold": 740,
  "top200Threshold": 592,
  "top300Threshold": 518,
  "listSize": 298,
  "median": 0,
  "mean": 0,
  "atMax": 17,
  "accounts": [
    { "rank": 1, "handle": "VitalikButerin", "displayName": "vitalik.eth", "score": 1000 }
  ],
  "updatedAt": "ISO",
  "note": "optional"
}
```

### For agents (future KOL analysis)

```ts
// Prefer runtime store (R2-aware)
import { getTwitterScoreDataset, getTwitterScoreAccounts } from '../src/lib/twitterScoreStore'
import { getTwitterScoreAccount, isTwitterScoreTop100 } from '../src/data/twitterScoreTop100'

// Offline / scripts
// read data/internal/twitterscore-top100.json
```

- Check if a smart follower is elite graph: `isTwitterScoreTop100('cobie')`
- Lookup score: `getTwitterScoreAccount('cz_binance')?.score`
- Full list: `getTwitterScoreAccounts()` or JSON file above

### Admin workflow

1. Open **Admin → ★ Data / TwitterScore** (`#/admin/data`)
2. List (trái) + form chi tiết (phải): identity, role, category, tags, notes…
3. **Save (R2)** with token
4. Optional: **Export JSON** → commit to `src/data/internal/` + `data/internal/` to refresh seed
5. Per-KOL Smart Followers vẫn ở tab **Smart Followers** (badge TwitterScore nếu match)

### Sync seed after admin export

```bash
# After downloading JSON from admin:
cp path/to/export.json src/data/internal/twitterscore-top100.json
cp path/to/export.json data/internal/twitterscore-top100.json
```

## Principles

1. **R2 = live truth** for visitors when published.
2. **Repo seed** = offline fallback + git history.
3. Scores/lists are **benchmarks** for densifying Smart Followers / KOL scoring — always combine with SurfAI bios, disclosure, and on-chain.
