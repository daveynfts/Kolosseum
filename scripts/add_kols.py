#!/usr/bin/env python3
"""Add KOL handles to sheet + live profiles + avatars + regenerate map data."""

from __future__ import annotations

import json
import math
import time
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# Default list; override via CLI args
DEFAULT_HANDLES = [
    "Lecter_XFinance",
    "YiwiJR",
    "LensMoso",
    "DaveyNFTsAI",
    "mintt_34",
    "DG_doodles",
]


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


def map_niche(desc: str, name: str, type_raw: str = "", handle: str = "") -> str:
    t = f"{type_raw} {desc} {name} {handle}".lower()
    if any(k in t for k in ["nft", "doodle", "mint", "pfp", "collector"]):
        return "NFT"
    if any(k in t for k in ["defi", "yield", "onchain"]):
        return "DeFi"
    if any(k in t for k in ["trade", "perp", "chart"]):
        return "Trading"
    if "research" in t:
        return "Research"
    if "news" in t:
        return "News"
    if "airdrop" in t:
        return "Airdrop"
    if "otc" in t:
        return "OTC"
    if "meme" in t:
        return "Meme"
    if any(k in t for k in ["ai ", " a.i", "artificial"]):
        return "Multi"
    return "Multi"


def assess(user: dict, tier: int = 2) -> dict:
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
    est_smart = int(followers * quality * 0.02)
    est_smart = max(20, min(est_smart, int(followers * 0.08)))

    base = clamp(
        log10(followers) * 18 + (6 if tier == 1 else 0) + (4 if verified else 0),
        8,
        98,
    )
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
        "rất dày"
        if tpd >= 5
        else "đều đặn"
        if tpd >= 1.5
        else "vừa phải"
        if tpd >= 0.5
        else "thưa"
    )
    auth = "có tick verified" if verified else "chưa verified"
    moods = {
        "hot": "Hiện đang ở nhóm visibility cao — tần suất đăng mạnh, phù hợp lead narrative ngắn hạn.",
        "active": "Đang active ổn định; đủ để giữ mindshare nếu nội dung không loãng.",
        "stable": "Ở mức duy trì audience hơn là bùng nổ; hợp brand awareness dài hạn hơn raid hàng ngày.",
        "quiet": "Output thấp so với quy mô account — cần kiểm tra gần đây có pivot channel không.",
        "dormant": "Dấu hiệu dormant / ít tiếng trên X; cân nhắc trước khi dùng làm KOL lead campaign.",
    }
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
    assessment = (
        f"Audience {size} (~{followers:,} followers), {auth}. "
        f"Tần suất ước tính ~{tpd:.1f} post/ngày ({pace}); {ratio_note}; {media_note}. "
        f"Account ~{years} năm, tổng ~{tweets:,} posts. {moods[status]}"
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
        "assessment": assessment,
        "description": (user.get("description") or "")[:280],
        "avatar_url": user.get("avatar_url"),
        "name_x": user.get("name"),
    }


def type_from_niche(niche: str) -> str:
    return {
        "NFT": "NFT",
        "DeFi": "Defi",
        "Trading": "Trading",
        "Research": "Research",
        "News": "News",
        "Airdrop": "Airdrop",
        "OTC": "OTC",
        "Meme": "meme",
        "Multi": "ALL",
    }.get(niche, "ALL")


def main(handles: list[str] | None = None) -> None:
    handles = handles or DEFAULT_HANDLES
    sheet_path = ROOT / "data" / "kols-from-sheet.json"
    sheet: list[dict] = json.loads(sheet_path.read_text(encoding="utf-8"))
    avatars = ROOT / "public" / "avatars"
    avatars.mkdir(parents=True, exist_ok=True)

    profiles_add: list[dict] = []

    for h in handles:
        print(f"--- @{h}")
        try:
            data = http_json(f"https://api.fxtwitter.com/{h}")
        except Exception as e:
            print(f"  FAIL fetch: {e}")
            continue
        user = (data or {}).get("user")
        if not user:
            print("  FAIL no user")
            continue

        m = assess(user, tier=2)
        name = user.get("name") or h
        niche = map_niche(user.get("description") or "", name, handle=h)
        type_raw = type_from_niche(niche)
        followers = m["followers"]
        followers_raw = (
            f"{round(followers / 1000)}K" if followers >= 1000 else str(followers)
        )

        row = {
            "name": name,
            "handle": h,
            "link": f"https://x.com/{h}",
            "followers_raw": followers_raw,
            "followers": followers,
            "tier": "2",
            "type": type_raw,
            "note": "manual add",
            "engagement": "",
        }

        found = False
        for i, r in enumerate(sheet):
            if r.get("handle", "").lower() == h.lower():
                sheet[i] = {**r, **row}
                found = True
                break
        if not found:
            sheet.append(row)

        profiles_add.append(
            {
                "handle": h,
                "sheet_name": name,
                "tier": 2,
                "type": type_raw,
                "sheet_followers_raw": followers_raw,
                "sheet_followers": followers,
                **m,
                "deltaPct": 0.0,
            }
        )

        av = (m.get("avatar_url") or "").replace("_normal.", "_400x400.").replace(
            "_bigger.", "_400x400."
        )
        dest = avatars / f"{h}.jpg"
        try:
            if av:
                img = http_bytes(av)
                if len(img) > 2000:
                    dest.write_bytes(img)
                    print(f"  avatar {len(img)}b")
                else:
                    print(f"  avatar small {len(img)}b")
        except Exception as e:
            print(f"  avatar fail: {e}")

        print(
            f"  {name} · {followers:,} foll · {m['statusLabel']} · score {m['score']} · {niche}"
        )
        time.sleep(0.3)

    sheet_path.write_text(json.dumps(sheet, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"sheet rows: {len(sheet)}")

    live_path = ROOT / "data" / "kol-live-profiles.json"
    live = (
        json.loads(live_path.read_text(encoding="utf-8"))
        if live_path.exists()
        else {"profiles": []}
    )
    by = {p["handle"].lower(): p for p in live.get("profiles", [])}
    for p in profiles_add:
        by[p["handle"].lower()] = p
    live["profiles"] = list(by.values())
    live["generatedAt"] = datetime.now(timezone.utc).isoformat()
    live["count"] = len(live["profiles"])
    live["source"] = "api.fxtwitter.com profile"
    live_path.write_text(json.dumps(live, ensure_ascii=False, indent=2), encoding="utf-8")

    # Rebuild map from live profiles ∩ tier 1–2 sheet
    sheet_t12 = {
        r["handle"].lower(): r
        for r in sheet
        if str(r.get("tier")) in ("1", "2") and r.get("handle")
    }
    kols: list[dict] = []
    for p in live["profiles"]:
        h = p["handle"]
        if h.lower() not in sheet_t12:
            continue
        r = sheet_t12[h.lower()]
        niche = map_niche(
            p.get("description") or "",
            p.get("sheet_name") or "",
            r.get("type") or "",
            h,
        )
        kols.append(
            {
                "id": f"sheet-{h.lower()}",
                "handle": h,
                "displayName": p.get("sheet_name") or p.get("name_x") or h,
                "niche": niche,
                "tier": int(r.get("tier") or p.get("tier") or 2),
                "typeRaw": r.get("type") or "—",
                "smartFollowers": p.get("est_smart") or 20,
                "followers": p.get("followers") or 0,
                "posts24h": p.get("posts24h") or 0,
                "likes24h": p.get("likes24h") or 0,
                "replies24h": p.get("replies24h") or 0,
                "reposts24h": p.get("reposts24h") or 0,
                "baseScore": p.get("baseScore") or 50,
                "hotScore": p.get("hotScore") or 50,
                "score": p.get("score") or 50,
                "deltaPct": p.get("deltaPct") or 0,
                "bio": p.get("assessment") or "",
                "statusLabel": p.get("statusLabel") or "stable",
                "activityLevel": p.get("activityLevel") or 50,
                "verified": p.get("verified") or False,
                "tweetsTotal": p.get("tweets") or 0,
                "tweetsPerDay": p.get("tweets_per_day") or 0,
                "xFollowing": p.get("following") or 0,
                "dataSource": "x-live",
            }
        )
    kols.sort(key=lambda x: (-x["score"], -x["followers"]))

    status = [
        {
            "handle": k["handle"],
            "name": k["displayName"],
            "tier": k["tier"],
            "status": k["statusLabel"],
            "followers": k["followers"],
            "tweets_per_day": k["tweetsPerDay"],
            "verified": k["verified"],
            "score": k["score"],
            "deltaPct_vs_sheet": k["deltaPct"],
            "assessment": k["bio"],
        }
        for k in kols
    ]
    (ROOT / "data" / "kol-status.json").write_text(
        json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    ts = f"""import type {{ Kol }} from '../types'

/** Auto-generated from LIVE X profiles (fxtwitter).
 *  Regenerate: python scripts/analyze_kols_live.py or scripts/add_kols.py
 */
export const SNAPSHOT_DATE = '{datetime.now(timezone.utc).strftime("%Y-%m-%d")}'
export const SNAPSHOT_LABEL = 'X live profiles · {len(kols)} KOLs · assessments real · 24h metrics estimated'

export const SHEET_KOLS: Kol[] = {json.dumps(kols, ensure_ascii=False, indent=2)}
"""
    (ROOT / "src" / "data" / "sheetKols.ts").write_text(ts, encoding="utf-8")

    print(f"map kols: {len(kols)}")
    print("status", dict(Counter(k["statusLabel"] for k in kols)))
    print("added/updated:")
    for p in profiles_add:
        print(
            f"  @{p['handle']:<18} {p['followers']:>8,}  {p['statusLabel']:<8} score={p['score']}"
        )


if __name__ == "__main__":
    import sys

    args = [a for a in sys.argv[1:] if a]
    main(args or None)
