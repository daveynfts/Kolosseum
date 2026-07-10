#!/usr/bin/env python3
"""Generate src/data/sheetKols.ts from kols-from-sheet.json (Tier 1–2 only)."""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "kols-from-sheet.json"
OUT = ROOT / "src" / "data" / "sheetKols.ts"


def map_niche(type_str: str) -> str:
    t = (type_str or "").lower()
    if not t or t == "all":
        return "Multi"
    parts = [p.strip() for p in re.split(r"[,/|]", t) if p.strip()]
    order = [
        "otc",
        "research",
        "trading",
        "airdrop",
        "news",
        "defi",
        "gamefi",
        "nft",
        "meme",
    ]
    labels = {
        "otc": "OTC",
        "research": "Research",
        "trading": "Trading",
        "airdrop": "Airdrop",
        "news": "News",
        "defi": "DeFi",
        "gamefi": "GameFi",
        "nft": "NFT",
        "meme": "Meme",
    }
    for key in order:
        for p in parts:
            if key in p:
                return labels[key]
    return "Multi"


def hfloat(s: str, salt: int = 0) -> float:
    h = hashlib.md5(f"{s}:{salt}".encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def log10(n: float) -> float:
    return math.log10(1 + max(0, n))


def clamp(n: float, a: float, b: float) -> float:
    return max(a, min(b, n))


def main() -> None:
    rows = json.loads(SRC.read_text(encoding="utf-8"))
    rows = [r for r in rows if str(r.get("tier")) in ("1", "2")]

    kols: list[dict] = []
    for r in rows:
        handle = r["handle"]
        followers = r.get("followers") or 5_000
        tier = int(r.get("tier") or 2)
        niche = map_niche(r.get("type") or "")
        ratio = (0.018 if tier == 1 else 0.012) * (0.7 + hfloat(handle, 1) * 0.8)
        smart = max(40, int(followers * ratio))
        posts = int(1 + hfloat(handle, 2) * (14 if tier == 1 else 10))
        likes = int((80 + hfloat(handle, 3) * followers * 0.012) * (1.4 if tier == 1 else 1.0))
        replies = int(likes * (0.08 + hfloat(handle, 4) * 0.12))
        reposts = int(likes * (0.05 + hfloat(handle, 5) * 0.1))
        base = clamp(log10(smart) * 22 + (8 if tier == 1 else 0), 8, 98)
        hot = clamp(log10(likes + 2 * replies + 3 * reposts) * 18 + posts * 2.0, 4, 98)
        score = clamp(0.55 * base + 0.45 * hot, 10, 100)
        delta = clamp((hfloat(handle, 6) - 0.42) * 50, -25, 45)
        types = (r.get("type") or "").strip() or "—"
        bio = f"{types} · Tier {tier} · sheet data"

        kols.append(
            {
                "id": f"sheet-{handle.lower()}",
                "handle": handle,
                "displayName": r["name"],
                "niche": niche,
                "tier": tier,
                "typeRaw": types,
                "smartFollowers": smart,
                "followers": followers,
                "posts24h": posts,
                "likes24h": likes,
                "replies24h": replies,
                "reposts24h": reposts,
                "baseScore": round(base, 1),
                "hotScore": round(hot, 1),
                "score": round(score, 1),
                "deltaPct": round(delta, 1),
                "bio": bio,
            }
        )

    kols.sort(key=lambda x: (-x["score"], -x["followers"]))

    # TypeScript: niche strings must match union in types.ts
    body = json.dumps(kols, ensure_ascii=False, indent=2)
    ts = f"""import type {{ Kol }} from '../types'

/** Auto-generated from Google Sheet — Tier 1 & 2 only.
 *  Followers/tier/type from sheet. smartFollowers + 24h engagement = mock until Surf.
 *  Regenerate: python scripts/generate_tier12_data.py
 */
export const SNAPSHOT_DATE = '2026-07-09'
export const SNAPSHOT_LABEL = 'Sheet Tier 1–2 · {len(kols)} KOLs · engagement mock until Surf'

export const SHEET_KOLS: Kol[] = {body}
"""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(ts, encoding="utf-8")

    print(f"count={len(kols)} t1={sum(1 for k in kols if k['tier']==1)} t2={sum(1 for k in kols if k['tier']==2)}")
    print("niches:", dict(Counter(k["niche"] for k in kols)))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
