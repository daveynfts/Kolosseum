#!/usr/bin/env python3
"""Fetch live X profiles for Tier 1–2 KOLs, score them, write assessments, regenerate map data."""

from __future__ import annotations

import json
import math
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / "data" / "kols-from-sheet.json"
OUT_PROFILES = ROOT / "data" / "kol-live-profiles.json"
OUT_STATUS = ROOT / "data" / "kol-status.json"
OUT_TS = ROOT / "src" / "data" / "sheetKols.ts"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def http_json(url: str) -> dict | None:
    req = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode("utf-8", "replace"))
    except Exception as e:
        print(f"  fail {url}: {e}")
        return None


def clamp(n: float, a: float, b: float) -> float:
    return max(a, min(b, n))


def log10(n: float) -> float:
    return math.log10(1 + max(0, n))


def parse_joined(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return parsedate_to_datetime(s)
    except Exception:
        return None


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


def activity_and_status(user: dict, tier: int, type_raw: str) -> dict:
    followers = int(user.get("followers") or 0)
    following = int(user.get("following") or 0)
    tweets = int(user.get("tweets") or 0)
    likes = int(user.get("likes") or 0)
    media = int(user.get("media_count") or 0)
    verified = bool((user.get("verification") or {}).get("verified"))
    joined = parse_joined(user.get("joined"))
    now = datetime.now(timezone.utc)
    age_days = max(30, (now - joined).days) if joined else 365 * 3

    tweets_per_day = tweets / age_days
    media_ratio = media / max(1, tweets)
    follow_ratio = following / max(1, followers)
    like_intensity = likes / max(1, tweets)

    # Activity 0–100 from lifetime output rate (proxy; not true 24h)
    if tweets_per_day >= 8:
        activity = 92
        status = "hot"
    elif tweets_per_day >= 3:
        activity = 78
        status = "active"
    elif tweets_per_day >= 1:
        activity = 62
        status = "stable"
    elif tweets_per_day >= 0.3:
        activity = 42
        status = "quiet"
    else:
        activity = 22
        status = "dormant"

    # Mega accounts that post constantly (news desks)
    if followers >= 200_000 and tweets_per_day >= 5:
        status = "hot"
        activity = max(activity, 88)

    # Quality / "smart" proxy: not real smart-followers
    # Higher when not pure mass-follow, verified, more media substance
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
    est_smart = int(followers * quality * 0.02)  # conservative proxy band
    est_smart = max(20, min(est_smart, int(followers * 0.08)))

    base = clamp(log10(followers) * 18 + (6 if tier == 1 else 0) + (4 if verified else 0), 8, 98)
    hot = clamp(activity * 0.75 + log10(tweets_per_day * 30) * 12 + media_ratio * 15, 8, 98)
    score = clamp(0.58 * base + 0.42 * hot, 10, 100)

    # posts24h estimate from rate (capped for UI honesty)
    posts_est = int(clamp(round(tweets_per_day), 0, 40))
    likes_est = int(clamp(posts_est * (8 + like_intensity * 20) * (1 + followers / 500_000), 0, 50_000))
    replies_est = int(likes_est * 0.12)
    reposts_est = int(likes_est * 0.08)

    assessment = build_assessment(
        name=user.get("name") or "",
        handle=user.get("screen_name") or "",
        followers=followers,
        following=following,
        tweets=tweets,
        tweets_per_day=tweets_per_day,
        media_ratio=media_ratio,
        follow_ratio=follow_ratio,
        verified=verified,
        status=status,
        tier=tier,
        type_raw=type_raw,
        description=user.get("description") or "",
        age_days=age_days,
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
        "tweets_per_day": round(tweets_per_day, 3),
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
        "replies24h": replies_est,
        "reposts24h": reposts_est,
        "assessment": assessment,
        "description": (user.get("description") or "")[:280],
        "avatar_url": user.get("avatar_url"),
        "name_x": user.get("name"),
    }


def build_assessment(
    *,
    name: str,
    handle: str,
    followers: int,
    following: int,
    tweets: int,
    tweets_per_day: float,
    media_ratio: float,
    follow_ratio: float,
    verified: bool,
    status: str,
    tier: int,
    type_raw: str,
    description: str,
    age_days: int,
) -> str:
    size = (
        "mega (100k+)"
        if followers >= 100_000
        else "lớn (30–100k)"
        if followers >= 30_000
        else "trung bình (10–30k)"
        if followers >= 10_000
        else "nhỏ (<10k)"
    )
    pace = (
        "rất dày (kiểu news desk / content machine)"
        if tweets_per_day >= 5
        else "đều đặn"
        if tweets_per_day >= 1.5
        else "vừa phải"
        if tweets_per_day >= 0.5
        else "thưa"
    )
    auth = "có tick verified" if verified else "chưa verified"
    niche = type_raw or "chưa gắn type"

    if status == "hot":
        mood = "Hiện đang ở nhóm visibility cao — tần suất đăng mạnh, phù hợp lead narrative ngắn hạn."
    elif status == "active":
        mood = "Đang active ổn định; đủ để giữ mindshare nếu nội dung không loãng."
    elif status == "stable":
        mood = "Ở mức duy trì audience hơn là bùng nổ; hợp brand awareness dài hạn hơn raid hàng ngày."
    elif status == "quiet":
        mood = "Output thấp so với quy mô account — cần kiểm tra gần đây có pivot channel (Telegram/TikTok) không."
    else:
        mood = "Dấu hiệu dormant / ít tiếng trên X; cân nhắc trước khi dùng làm KOL lead campaign."

    ratio_note = (
        "tỉ lệ following/followers thấp (kiểu broadcast)"
        if follow_ratio < 0.08
        else "following tương đối cao (network-heavy)"
        if follow_ratio > 0.25
        else "cân bằng follow graph"
    )
    media_note = (
        "thiên media/visual"
        if media_ratio > 0.3
        else "chủ yếu text/thread"
        if media_ratio < 0.1
        else "mix text–media"
    )

    years = max(1, round(age_days / 365, 1))
    return (
        f"Audience {size} (~{followers:,} followers), {auth}, type sheet: {niche}. "
        f"Tần suất ước tính ~{tweets_per_day:.1f} post/ngày ({pace}); "
        f"{ratio_note}; {media_note}. "
        f"Account ~{years} năm, tổng ~{tweets:,} posts. "
        f"{mood}"
    )


def main() -> None:
    rows = [
        r
        for r in json.loads(SHEET.read_text(encoding="utf-8"))
        if str(r.get("tier")) in ("1", "2")
    ]
    print(f"Analyzing {len(rows)} KOLs…")

    profiles: list[dict] = []
    failed: list[dict] = []

    for i, r in enumerate(rows, 1):
        handle = r["handle"]
        print(f"[{i}/{len(rows)}] @{handle}")
        data = http_json(f"https://api.fxtwitter.com/{handle}")
        if not data or not data.get("user"):
            data = http_json(f"https://api.vxtwitter.com/{handle}")
            # vxtwitter shape differs — normalize if needed
            if data and not data.get("user") and data.get("screen_name"):
                data = {"user": {
                    "screen_name": data.get("screen_name"),
                    "name": data.get("name"),
                    "followers": data.get("followers_count") or data.get("followers"),
                    "following": data.get("following_count") or data.get("following"),
                    "tweets": data.get("tweet_count") or data.get("tweets") or 0,
                    "likes": data.get("likes") or data.get("favourites_count") or 0,
                    "media_count": data.get("media_count") or 0,
                    "description": data.get("description") or "",
                    "joined": data.get("created_at") or data.get("joined"),
                    "avatar_url": data.get("profile_image_url") or data.get("avatar_url"),
                    "verification": {"verified": bool(data.get("verified"))},
                }}

        if not data or not data.get("user"):
            failed.append(r)
            print("  DEAD/unreadable")
            time.sleep(0.25)
            continue

        user = data["user"]
        tier = int(r.get("tier") or 2)
        metrics = activity_and_status(user, tier, r.get("type") or "")
        profiles.append(
            {
                "handle": handle,
                "sheet_name": r.get("name"),
                "tier": tier,
                "type": r.get("type") or "",
                "sheet_followers_raw": r.get("followers_raw"),
                "sheet_followers": r.get("followers"),
                **metrics,
            }
        )
        print(
            f"  followers={metrics['followers']:,} status={metrics['statusLabel']} "
            f"tpd={metrics['tweets_per_day']} score={metrics['score']}"
        )
        time.sleep(0.28)

    # Delta vs sheet followers
    for p in profiles:
        sf = p.get("sheet_followers") or 0
        lf = p.get("followers") or 0
        if sf > 0:
            p["deltaPct"] = round((lf - sf) / sf * 100, 1)
        else:
            p["deltaPct"] = 0.0

    OUT_PROFILES.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "source": "api.fxtwitter.com profile",
                "count": len(profiles),
                "failed": [{"handle": f["handle"], "name": f.get("name")} for f in failed],
                "profiles": profiles,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    # Compact status report for reading
    status_rows = [
        {
            "handle": p["handle"],
            "name": p["sheet_name"],
            "tier": p["tier"],
            "status": p["statusLabel"],
            "followers": p["followers"],
            "tweets_per_day": p["tweets_per_day"],
            "verified": p["verified"],
            "score": p["score"],
            "deltaPct_vs_sheet": p.get("deltaPct"),
            "assessment": p["assessment"],
        }
        for p in sorted(profiles, key=lambda x: (-x["tier"] == 1, -x["score"]))
    ]
    OUT_STATUS.write_text(
        json.dumps(status_rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Map Kols for frontend
    kols = []
    for p in profiles:
        niche = map_niche(p.get("type") or "")
        kols.append(
            {
                "id": f"sheet-{p['handle'].lower()}",
                "handle": p["handle"],
                "displayName": p["sheet_name"] or p.get("name_x") or p["handle"],
                "niche": niche,
                "tier": p["tier"],
                "typeRaw": p.get("type") or "—",
                "smartFollowers": p["est_smart"],
                "followers": p["followers"],
                "posts24h": p["posts24h"],
                "likes24h": p["likes24h"],
                "replies24h": p["replies24h"],
                "reposts24h": p["reposts24h"],
                "baseScore": p["baseScore"],
                "hotScore": p["hotScore"],
                "score": p["score"],
                "deltaPct": p.get("deltaPct") or 0,
                "bio": p["assessment"],
                "statusLabel": p["statusLabel"],
                "activityLevel": p["activityLevel"],
                "verified": p["verified"],
                "tweetsTotal": p["tweets"],
                "tweetsPerDay": p["tweets_per_day"],
                "xFollowing": p["following"],
                "dataSource": "x-live",
            }
        )

    kols.sort(key=lambda x: (-x["score"], -x["followers"]))

    body = json.dumps(kols, ensure_ascii=False, indent=2)
    ts = f"""import type {{ Kol }} from '../types'

/** Auto-generated from LIVE X profiles (fxtwitter) — not mock engagement.
 *  smartFollowers = quality proxy (not official X Smart Followers).
 *  posts24h/likes24h = estimated from lifetime rate (see assessment).
 *  Regenerate: python scripts/analyze_kols_live.py
 */
export const SNAPSHOT_DATE = '{datetime.now(timezone.utc).strftime("%Y-%m-%d")}'
export const SNAPSHOT_LABEL = 'X live profiles · {len(kols)} KOLs · assessments real · 24h metrics estimated'

export const SHEET_KOLS: Kol[] = {body}
"""
    OUT_TS.write_text(ts, encoding="utf-8")

    # Summary counts
    from collections import Counter

    c = Counter(p["statusLabel"] for p in profiles)
    print("status", dict(c))
    print(f"ok={len(profiles)} failed={len(failed)}")
    print(f"wrote {OUT_PROFILES}")
    print(f"wrote {OUT_STATUS}")
    print(f"wrote {OUT_TS}")


if __name__ == "__main__":
    main()
