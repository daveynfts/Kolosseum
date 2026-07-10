#!/usr/bin/env python3
"""Merge 7d activity into Top-30 KOLs in sheetKols.ts.

Uses:
  - data/activity-7d-samples.json when present (sampled X posts)
  - else estimate posts7d ≈ tweetsPerDay * 7 (capped), labeled 'estimated'
"""

from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TS = ROOT / "src" / "data" / "sheetKols.ts"
SAMPLES = ROOT / "data" / "activity-7d-samples.json"
OUT_JSON = ROOT / "data" / "activity-7d.json"


def clamp(n: float, a: float, b: float) -> float:
    return max(a, min(b, n))


def load_kols() -> tuple[str, list[dict]]:
    text = TS.read_text(encoding="utf-8")
    m = re.search(r"export const SHEET_KOLS: Kol\[\] = (\[[\s\S]*)", text)
    if not m:
        raise SystemExit("Cannot parse SHEET_KOLS")
    body = m.group(1).strip()
    kols = json.loads(body)
    pre = text[: m.start(1)]
    # keep only header before array
    pre = text.split("export const SHEET_KOLS")[0]
    return pre, kols


def activity7d_score(posts: int, likes: int, views: int) -> float:
    # 0–100
    return clamp(
        math.log10(1 + posts) * 28
        + math.log10(1 + likes) * 14
        + math.log10(1 + views) * 8,
        0,
        100,
    )


def main() -> None:
    pre, kols = load_kols()
    samples = {}
    if SAMPLES.exists():
        samples = json.loads(SAMPLES.read_text(encoding="utf-8")).get("byHandle", {})

    ranked = sorted(kols, key=lambda k: (-k.get("score", 0), -k.get("followers", 0)))
    top30_handles = {k["handle"].lower() for k in ranked[:30]}

    activity_export = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "windowDays": 7,
        "topN": 30,
        "handles": [],
    }

    for k in kols:
        h = k["handle"]
        is_top = h.lower() in top30_handles
        k["isTop30"] = is_top

        if not is_top:
            k.pop("activity7dPosts", None)
            k.pop("activity7dLikes", None)
            k.pop("activity7dViews", None)
            k.pop("activity7dReplies", None)
            k.pop("activity7dReposts", None)
            k.pop("activity7dScore", None)
            k.pop("activity7dSource", None)
            continue

        s = samples.get(h) or samples.get(h.lower())
        if s:
            posts = int(s.get("posts") or 0)
            likes = int(s.get("likes") or 0)
            views = int(s.get("views") or 0)
            replies = int(s.get("replies") or 0)
            reposts = int(s.get("reposts") or 0)
            source = "sampled"
            # sampled is lower bound (search cap ~10)
            note = s.get("note") or "X search sample (may be capped ~10 posts)"
        else:
            tpd = float(k.get("tweetsPerDay") or 0)
            posts = int(clamp(round(tpd * 7), 0, 70))
            # rough engagement proxy from lifetime intensity
            likes = int(posts * 12 * (1 + (k.get("followers") or 0) / 400_000))
            views = int(likes * 40)
            replies = int(likes * 0.12)
            reposts = int(likes * 0.08)
            source = "estimated"
            note = "estimated from lifetime tweets/day × 7"

        a7 = activity7d_score(posts, likes, views)
        k["activity7dPosts"] = posts
        k["activity7dLikes"] = likes
        k["activity7dViews"] = views
        k["activity7dReplies"] = replies
        k["activity7dReposts"] = reposts
        k["activity7dScore"] = round(a7, 1)
        k["activity7dSource"] = source

        # Blend hot/score with 7d signal for Top 30
        old_hot = float(k.get("hotScore") or 50)
        new_hot = clamp(0.45 * old_hot + 0.55 * a7, 8, 98)
        k["hotScore"] = round(new_hot, 1)
        base = float(k.get("baseScore") or 50)
        k["score"] = round(clamp(0.55 * base + 0.45 * new_hot, 10, 100), 1)

        # Refine status from 7d posts when sampled
        if source == "sampled":
            if posts >= 20:
                k["statusLabel"] = "hot"
            elif posts >= 8:
                k["statusLabel"] = "active"
            elif posts >= 3:
                k["statusLabel"] = "stable"
            elif posts >= 1:
                k["statusLabel"] = "quiet"
            else:
                k["statusLabel"] = "dormant"
            k["activityLevel"] = round(clamp(a7, 10, 98), 1)

        activity_export["handles"].append(
            {
                "handle": h,
                "posts": posts,
                "likes": likes,
                "views": views,
                "replies": replies,
                "reposts": reposts,
                "activity7dScore": k["activity7dScore"],
                "source": source,
                "note": note,
            }
        )

    # re-sort after score update
    kols.sort(key=lambda x: (-x.get("score", 0), -x.get("followers", 0)))

    OUT_JSON.write_text(
        json.dumps(activity_export, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    n = len(kols)
    sampled_n = sum(1 for h in activity_export["handles"] if h["source"] == "sampled")
    ts = f"""import type {{ Kol }} from '../types'

/** Live X profiles + Top-30 7d activity merge.
 *  activity7dSource: sampled | estimated
 *  Regenerate: python scripts/merge_activity_7d.py
 */
export const SNAPSHOT_DATE = '{date}'
export const SNAPSHOT_LABEL = 'X live · Top30 7d activity ({sampled_n} sampled / {30 - sampled_n} est.) · {n} KOLs'

export const SHEET_KOLS: Kol[] = {json.dumps(kols, ensure_ascii=False, indent=2)}
"""
    TS.write_text(ts, encoding="utf-8")
    print(f"Top30 merged: sampled={sampled_n} estimated={30 - sampled_n}")
    print(f"wrote {OUT_JSON}")
    print(f"wrote {TS}")


if __name__ == "__main__":
    main()
