#!/usr/bin/env python3
"""Add next 10 sheet KOLs (not yet on map) with live X profiles + avatars.

Preserves existing sheetKols entries (7d activity, enriched bios).
Then re-runs enrich_assessments for all.

Usage:
  python scripts/add_next10.py
  python scripts/add_next10.py --n 10
"""

from __future__ import annotations

import argparse
import json
import math
import re
import time
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
TS = ROOT / "src" / "data" / "sheetKols.ts"
SHEET = ROOT / "data" / "kols-from-sheet.json"
LIVE = ROOT / "data" / "kol-live-profiles.json"
AVATARS = ROOT / "public" / "avatars"


def http_json(url: str) -> dict:
    req = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def http_bytes(url: str) -> bytes:
    req = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept": "image/*,*/*"}
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def clamp(n: float, a: float, b: float) -> float:
    return max(a, min(b, n))


def log10(n: float) -> float:
    return math.log10(1 + max(0, n))


def parse_joined(s: str | None):
    if not s:
        return None
    try:
        return parsedate_to_datetime(s)
    except Exception:
        return None


def map_niche(type_str: str, desc: str = "", name: str = "") -> str:
    t = f"{type_str} {desc} {name}".lower()
    order = [
        ("otc", "OTC"),
        ("research", "Research"),
        ("trading", "Trading"),
        ("airdrop", "Airdrop"),
        ("news", "News"),
        ("defi", "DeFi"),
        ("gamefi", "GameFi"),
        ("nft", "NFT"),
        ("meme", "Meme"),
    ]
    for key, label in order:
        if key in t:
            return label
    return "Multi"


def load_kols() -> list[dict]:
    text = TS.read_text(encoding="utf-8")
    m = re.search(r"export const SHEET_KOLS: Kol\[\] = (\[[\s\S]*)", text)
    if not m:
        raise SystemExit("Cannot parse SHEET_KOLS")
    return json.loads(m.group(1).strip())


def score_profile(user: dict, tier: int) -> dict:
    followers = int(user.get("followers") or 0)
    following = int(user.get("following") or 0)
    tweets = int(user.get("tweets") or 0)
    likes = int(user.get("likes") or 0)
    media = int(user.get("media_count") or 0)
    verified = bool((user.get("verification") or {}).get("verified"))
    joined = parse_joined(user.get("joined"))
    now = datetime.now(timezone.utc)
    age_days = max(30, (now - joined).days) if joined else 365 * 2
    tpd = tweets / age_days
    media_ratio = media / max(1, tweets)
    follow_ratio = following / max(1, followers)

    if tpd >= 8:
        activity, status = 92, "hot"
    elif tpd >= 3:
        activity, status = 78, "active"
    elif tpd >= 1:
        activity, status = 62, "stable"
    elif tpd >= 0.3:
        activity, status = 42, "quiet"
    else:
        activity, status = 22, "dormant"
    if followers >= 200_000 and tpd >= 5:
        status = "hot"
        activity = max(activity, 88)

    quality = 0.55
    if verified:
        quality += 0.12
    if follow_ratio < 0.05:
        quality += 0.1
    elif follow_ratio > 0.4:
        quality -= 0.12
    if media_ratio > 0.25:
        quality += 0.08
    if followers >= 100_000:
        quality += 0.05
    quality = clamp(quality, 0.25, 0.95)
    est_smart = max(20, min(int(followers * quality * 0.02), int(followers * 0.08)))

    tier_boost = 8 if tier == 1 else (4 if tier == 2 else 0)
    base = clamp(log10(followers) * 18 + tier_boost + (4 if verified else 0), 8, 98)
    hot = clamp(activity * 0.75 + log10(tpd * 30) * 12 + media_ratio * 15, 8, 98)
    score = clamp(0.58 * base + 0.42 * hot, 10, 100)
    posts_est = int(clamp(round(tpd), 0, 40))
    likes_est = int(
        clamp(
            posts_est * (8 + (likes / max(1, tweets)) * 20) * (1 + followers / 500_000),
            0,
            50_000,
        )
    )

    return {
        "followers": followers,
        "following": following,
        "tweets": tweets,
        "likes": likes,
        "media_count": media,
        "verified": verified,
        "joined": user.get("joined"),
        "age_days": age_days,
        "tweets_per_day": round(tpd, 3),
        "media_ratio": round(media_ratio, 3),
        "follow_ratio": round(follow_ratio, 4),
        "activityLevel": round(activity, 1),
        "statusLabel": status,
        "est_smart": est_smart,
        "quality": round(quality, 3),
        "baseScore": round(base, 1),
        "hotScore": round(hot, 1),
        "score": round(score, 1),
        "posts24h": posts_est,
        "likes24h": likes_est,
        "replies24h": int(likes_est * 0.12),
        "reposts24h": int(likes_est * 0.08),
        "description": (user.get("description") or "")[:280],
        "avatar_url": user.get("avatar_url"),
        "name_x": user.get("name"),
    }


def write_kols(kols: list[dict], label: str) -> None:
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    n = len(kols)
    ts = f"""import type {{ Kol }} from '../types'

/** Live X profiles + activity assessments.
 *  Add batch: python scripts/add_next10.py
 *  Enrich bios: python scripts/enrich_assessments.py
 */
export const SNAPSHOT_DATE = '{date}'
export const SNAPSHOT_LABEL = '{label} · {n} KOLs'

export const SHEET_KOLS: Kol[] = {json.dumps(kols, ensure_ascii=False, indent=2)}
"""
    TS.write_text(ts, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument(
        "--handles",
        nargs="*",
        help="Optional explicit handles; default = top N missing by sheet followers",
    )
    args = ap.parse_args()

    kols = load_kols()
    existing = {k["handle"].lower() for k in kols}
    sheet = json.loads(SHEET.read_text(encoding="utf-8"))

    if args.handles:
        want = []
        by_h = {r.get("handle", "").lower(): r for r in sheet}
        for h in args.handles:
            r = by_h.get(h.lower())
            if not r:
                # invent minimal row
                r = {
                    "name": h,
                    "handle": h,
                    "followers": 0,
                    "tier": "2",
                    "type": "ALL",
                    "link": f"https://x.com/{h}",
                }
            want.append(r)
    else:
        missing = [r for r in sheet if r.get("handle", "").lower() not in existing]
        missing.sort(key=lambda r: int(r.get("followers") or 0), reverse=True)
        want = missing[: args.n]

    print(f"Map now: {len(kols)}. Adding {len(want)} KOLs…")
    AVATARS.mkdir(parents=True, exist_ok=True)

    live = (
        json.loads(LIVE.read_text(encoding="utf-8"))
        if LIVE.exists()
        else {"profiles": []}
    )
    live_by = {p["handle"].lower(): p for p in live.get("profiles", [])}

    added: list[dict] = []
    failed: list[str] = []

    for i, row in enumerate(want, 1):
        h = row["handle"]
        if h.lower() in existing:
            print(f"[{i}] skip @{h} (already on map)")
            continue
        print(f"[{i}/{len(want)}] @{h}")
        user = None
        for host in ("api.fxtwitter.com", "api.vxtwitter.com"):
            try:
                data = http_json(f"https://{host}/{h}")
                user = (data or {}).get("user")
                if not user and data and data.get("screen_name"):
                    user = {
                        "screen_name": data.get("screen_name"),
                        "name": data.get("name"),
                        "followers": data.get("followers_count") or data.get("followers"),
                        "following": data.get("following_count") or data.get("following"),
                        "tweets": data.get("statuses_count") or data.get("tweets"),
                        "likes": data.get("favourites_count") or data.get("likes"),
                        "media_count": data.get("media_count") or 0,
                        "verification": {"verified": bool(data.get("verified"))},
                        "joined": data.get("created_at") or data.get("joined"),
                        "description": data.get("description") or "",
                        "avatar_url": data.get("profile_image_url_https")
                        or data.get("avatar_url"),
                    }
                if user:
                    break
            except Exception as e:
                print(f"  {host} fail: {e}")
        if not user:
            print("  FAIL no user")
            failed.append(h)
            continue

        tier = int(row.get("tier") or 2)
        m = score_profile(user, tier)
        sheet_f = int(row.get("followers") or 0)
        live_f = m["followers"]
        delta = (
            round((live_f - sheet_f) / sheet_f * 100, 1) if sheet_f > 0 else 0.0
        )
        type_raw = (row.get("type") or "").strip() or "ALL"
        niche = map_niche(type_raw, m.get("description") or "", row.get("name") or "")
        display = row.get("name") or m.get("name_x") or h

        kol = {
            "id": f"sheet-{h.lower()}",
            "handle": h,
            "displayName": display,
            "niche": niche,
            "tier": tier,
            "typeRaw": type_raw,
            "smartFollowers": m["est_smart"],
            "followers": live_f,
            "posts24h": m["posts24h"],
            "likes24h": m["likes24h"],
            "replies24h": m["replies24h"],
            "reposts24h": m["reposts24h"],
            "baseScore": m["baseScore"],
            "hotScore": m["hotScore"],
            "score": m["score"],
            "deltaPct": delta,
            "bio": "",  # filled by enrich_assessments
            "statusLabel": m["statusLabel"],
            "activityLevel": m["activityLevel"],
            "verified": m["verified"],
            "tweetsTotal": m["tweets"],
            "tweetsPerDay": m["tweets_per_day"],
            "xFollowing": m["following"],
            "dataSource": "x-live",
        }
        kols.append(kol)
        existing.add(h.lower())
        added.append(kol)

        live_by[h.lower()] = {
            "handle": h,
            "sheet_name": display,
            "tier": tier,
            "type": type_raw,
            "sheet_followers_raw": row.get("followers_raw") or str(sheet_f),
            "sheet_followers": sheet_f,
            **m,
            "deltaPct": delta,
            "assessment": "",
        }

        # avatar
        av = (m.get("avatar_url") or "").replace("_normal.", "_400x400.").replace(
            "_bigger.", "_400x400."
        )
        dest = AVATARS / f"{h}.jpg"
        try:
            if av:
                img = http_bytes(av)
                if len(img) > 2000:
                    dest.write_bytes(img)
                    print(f"  avatar ok {len(img)}b")
                else:
                    print(f"  avatar small")
        except Exception as e:
            print(f"  avatar fail: {e}")

        print(
            f"  {display} · T{tier} · {live_f:,} foll · {m['statusLabel']} · "
            f"score {m['score']} · {niche} · Δ{delta:+.1f}%"
        )
        time.sleep(0.35)

    kols.sort(key=lambda x: (-x.get("score", 0), -x.get("followers", 0)))
    write_kols(kols, f"X live + next batch (+{len(added)})")

    live["profiles"] = list(live_by.values())
    live["generatedAt"] = datetime.now(timezone.utc).isoformat()
    live["count"] = len(live["profiles"])
    live["source"] = "api.fxtwitter.com profile"
    LIVE.write_text(json.dumps(live, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nAdded {len(added)} · failed {len(failed)} · map total {len(kols)}")
    if failed:
        print("Failed:", failed)
    for k in added:
        print(f"  + @{k['handle']:<22} T{k['tier']} {k['followers']:>8,} {k['statusLabel']}")


if __name__ == "__main__":
    main()
