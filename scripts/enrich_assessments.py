#!/usr/bin/env python3
"""Rewrite KOL bio/assessment to be detailed & activity-specific (not template-y).

Sources:
  - src/data/sheetKols.ts (metrics, 7d, scores, status)
  - data/kol-live-profiles.json (X profile description)
  - data/activity-7d.json (7d notes)
  - public/feed/tier1-feed.json (recent post themes for Tier-1 sample)

Regenerate:
  python scripts/enrich_assessments.py
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TS = ROOT / "src" / "data" / "sheetKols.ts"
PROFILES = ROOT / "data" / "kol-live-profiles.json"
ACTIVITY = ROOT / "data" / "activity-7d.json"
FEED = ROOT / "public" / "feed" / "tier1-feed.json"


def fmt(n: float | int | None) -> str:
    if n is None:
        return "—"
    n = float(n)
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}K"
    if abs(n - round(n)) < 0.05:
        return str(int(round(n)))
    return f"{n:.1f}"


def load_kols() -> list[dict]:
    text = TS.read_text(encoding="utf-8")
    m = re.search(r"export const SHEET_KOLS: Kol\[\] = (\[[\s\S]*)", text)
    if not m:
        raise SystemExit("Cannot parse SHEET_KOLS")
    return json.loads(m.group(1).strip())


def load_profiles() -> dict[str, dict]:
    if not PROFILES.exists():
        return {}
    data = json.loads(PROFILES.read_text(encoding="utf-8"))
    out = {}
    for p in data.get("profiles") or []:
        h = (p.get("handle") or "").lower()
        if h:
            out[h] = p
    return out


def load_activity_notes() -> dict[str, dict]:
    if not ACTIVITY.exists():
        return {}
    data = json.loads(ACTIVITY.read_text(encoding="utf-8"))
    out = {}
    for h in data.get("handles") or []:
        key = (h.get("handle") or "").lower()
        if key:
            out[key] = h
    return out


def load_feed_by_handle() -> dict[str, list[dict]]:
    if not FEED.exists():
        return {}
    data = json.loads(FEED.read_text(encoding="utf-8"))
    by: dict[str, list[dict]] = defaultdict(list)
    for p in data.get("posts") or []:
        h = (p.get("handle") or "").lower()
        if h:
            by[h].append(p)
    return by


def niche_playbook(niche: str, type_raw: str) -> str:
    n = (niche or "Multi").lower()
    raw = (type_raw or "").lower()
    if "otc" in raw or n == "otc":
        return (
            "Góc OTC/liquidity: thường dùng khi cần trust + volume narrative "
            "(deal flow, P2P, desk) hơn pure hype meme."
        )
    if "research" in raw or n == "research":
        return (
            "Góc research: hợp thread phân tích, due diligence, narrative dài; "
            "kém hơn nếu campaign chỉ cần spam short-form."
        )
    if "airdrop" in raw or n == "airdrop":
        return (
            "Góc airdrop/quest: tốc độ + instruction-style content; "
            "tốt cho launch farming / checklist, cần check quality audience."
        )
    if "news" in raw or n == "news":
        return (
            "Góc news desk: coverage dày, phù hợp announce + mindshare realtime; "
            "engagement từng post có thể loãng nếu volume quá cao."
        )
    if "meme" in raw or n == "meme":
        return (
            "Góc meme/culture: viral potential cao, narrative ngắn; "
            "khó đo conversion nhưng mạnh awareness cộng đồng VN."
        )
    if "defi" in raw or n == "defi":
        return (
            "Góc DeFi: hợp product education, protocol explainers, yield narrative."
        )
    if "gamefi" in raw or n == "gamefi":
        return (
            "Góc GameFi/NFT: community + alpha game; phù hợp campaign có visual/quest."
        )
    if "nft" in raw:
        return (
            "Góc NFT/collectibles: visual-first, community drop; check timing market NFT."
        )
    if "trading" in raw or n == "trading":
        return (
            "Góc trading: chart/TA + market call; audience nhạy price action — "
            "hợp khi campaign gắn market timing."
        )
    return (
        "Multi-topic: linh hoạt campaign nhưng cần brief rõ pillar nội dung "
        "tránh loãng positioning."
    )


def clean_x_bio(desc: str) -> str:
    if not desc:
        return ""
    d = re.sub(r"\s+", " ", desc).strip()
    d = d.replace("\n", " · ")
    if len(d) > 160:
        d = d[:157].rstrip() + "…"
    return d


def summarize_recent_posts(posts: list[dict], max_n: int = 3) -> str | None:
    if not posts:
        return None
    # pick highest engagement first
    ranked = sorted(
        posts,
        key=lambda p: (p.get("likes") or 0) + (p.get("reposts") or 0) * 2 + (p.get("views") or 0) / 1000,
        reverse=True,
    )[:max_n]
    themes: list[str] = []
    for p in ranked:
        text = (p.get("text") or "").strip().replace("\n", " ")
        text = re.sub(r"https?://\S+", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) > 90:
            text = text[:87].rstrip() + "…"
        if text:
            themes.append(f"«{text}»")
    if not themes:
        return None
    return "Bài gần đây (sample feed): " + " · ".join(themes)


def growth_line(delta: float | None, followers: int) -> str:
    if delta is None:
        return f"Quy mô ~{fmt(followers)} followers trên X."
    if delta >= 80:
        return (
            f"Tăng trưởng rất mạnh so với sheet (+{delta:.0f}% → ~{fmt(followers)} followers) "
            f"— account đang scale audience nhanh, cần đối chiếu organic vs paid growth."
        )
    if delta >= 20:
        return (
            f"Followers live ~{fmt(followers)}, cao hơn sheet khoảng +{delta:.0f}% "
            f"— momentum tăng khá rõ."
        )
    if delta >= 5:
        return f"Followers live ~{fmt(followers)} (+{delta:.0f}% vs sheet) — tăng nhẹ, ổn định."
    if delta >= -5:
        return f"Followers live ~{fmt(followers)} (~phẳng so sheet, {delta:+.1f}%) — base audience giữ được."
    if delta >= -20:
        return (
            f"Followers live ~{fmt(followers)} ({delta:.0f}% vs sheet) — hơi co lại; "
            f"vẫn usable nhưng nên check churn/content shift."
        )
    return (
        f"Followers live ~{fmt(followers)} ({delta:.0f}% vs sheet) — sụt so dữ liệu sheet; "
        f"ưu tiên verify account còn active và audience quality."
    )


def pace_line(tpd: float, tweets: int, years: float) -> str:
    if tpd >= 20:
        bucket = "cực dày (content/news machine — gần realtime desk)"
        tip = "Volume cao: tốt cho coverage, nhưng từng post dễ bị loãng; brief cần CTA rõ."
    elif tpd >= 8:
        bucket = "rất dày"
        tip = "Nhịp post mạnh — phù hợp push narrative ngắn hạn / announce window."
    elif tpd >= 3:
        bucket = "đều, chuyên nghiệp"
        tip = "Nhịp ổn để giữ mindshare; dễ collab thread/series hơn one-off spam."
    elif tpd >= 1:
        bucket = "vừa phải"
        tip = "Không spam; campaign cần lead time và content quality cao hơn tần suất."
    elif tpd >= 0.4:
        bucket = "thưa"
        tip = "Ít post trên X — có thể pivot Telegram/YouTube; đừng kỳ vọng raid hàng ngày."
    else:
        bucket = "rất thưa / gần dormant trên X"
        tip = "Rủi ro silent period cao nếu dùng làm KOL lead chính trên Twitter/X."
    return (
        f"Pace lifetime ~{tpd:.1f} post/ngày ({bucket}); "
        f"tổng ~{fmt(tweets)} posts · account ~{years:.1f} năm. {tip}"
    )


def network_line(follow_ratio: float | None, following: int | None, media_ratio: float | None) -> str:
    parts = []
    if follow_ratio is not None:
        if follow_ratio < 0.05:
            parts.append(
                f"Follow graph broadcast (following/followers ~{follow_ratio:.2%}) — "
                f"kiểu one-to-many media."
            )
        elif follow_ratio > 0.3:
            parts.append(
                f"Network-heavy (following/followers ~{follow_ratio:.2%}, following ~{fmt(following or 0)}) — "
                f"có thể reply/network nhiều hơn pure broadcast."
            )
        else:
            parts.append(
                f"Follow graph cân bằng (~{follow_ratio:.2%}); following ~{fmt(following or 0)}."
            )
    if media_ratio is not None:
        if media_ratio > 0.35:
            parts.append("Nội dung thiên media/visual (ảnh/video/chart).")
        elif media_ratio < 0.12:
            parts.append("Thiên text/thread hơn visual.")
        else:
            parts.append("Mix text + media.")
    return " ".join(parts) if parts else ""


def window_7d(k: dict, act_note: dict | None) -> str | None:
    posts = k.get("activity7dPosts")
    if posts is None:
        return None
    likes = k.get("activity7dLikes") or 0
    views = k.get("activity7dViews") or 0
    replies = k.get("activity7dReplies") or 0
    reposts = k.get("activity7dReposts") or 0
    score = k.get("activity7dScore")
    source = k.get("activity7dSource") or "estimated"
    followers = max(1, k.get("followers") or 1)

    eng_per_post = (likes / posts) if posts else 0
    view_per_post = (views / posts) if posts else 0
    # rough reach proxy vs followers
    reach = (view_per_post / followers * 100) if followers else 0

    if source == "sampled":
        src = "mẫu post X (search, có thể bị cap ~10)"
    else:
        src = "ước từ pace lifetime × 7 (chưa sample full search)"

    extra = ""
    if act_note and act_note.get("note"):
        extra = f" Ghi chú sample: {act_note['note']}."

    if posts >= 25:
        pulse = "Cửa sổ 7 ngày: volume rất cao"
    elif posts >= 12:
        pulse = "Cửa sổ 7 ngày: volume cao"
    elif posts >= 6:
        pulse = "Cửa sổ 7 ngày: volume trung bình–khá"
    elif posts >= 2:
        pulse = "Cửa sổ 7 ngày: volume thấp"
    else:
        pulse = "Cửa sổ 7 ngày: gần im trên X"

    eng_note = (
        f"~{fmt(eng_per_post)} like/post, ~{fmt(view_per_post)} view/post"
        f"{f', reach proxy ~{reach:.2f}% followers/post' if views else ''}."
    )
    if eng_per_post >= 40 and posts >= 3:
        eng_note += " Engagement/post khá tốt so pace."
    elif posts >= 8 and eng_per_post < 5:
        eng_note += " Volume cao nhưng like/post thấp — có thể spam/loãng hoặc audience passive."

    return (
        f"{pulse}: ~{posts} posts · {fmt(likes)} likes · {fmt(views)} views"
        f" · {fmt(replies)} replies · {fmt(reposts)} reposts"
        f"{f' · 7d score {score}' if score is not None else ''} "
        f"({src}). {eng_note}{extra}"
    )


def status_read(
    status: str | None,
    tpd: float,
    posts7d: int | None,
    score: float,
    is_top30: bool,
) -> str:
    st = status or "stable"
    bits = []
    if is_top30:
        bits.append("Nằm Top 30 score/activity trên map (nhóm visibility cao trong list).")

    if st == "hot":
        bits.append(
            "Trạng thái HOT: nhịp gần đây mạnh — ưu tiên khi cần bật narrative trong 24–72h."
        )
    elif st == "active":
        bits.append(
            "Trạng thái ACTIVE: duy trì presence đều; phù hợp collab series / keep mindshare."
        )
    elif st == "stable":
        bits.append(
            "Trạng thái STABLE: base audience ổn, không bùng nổ short-term; "
            "hợp brand awareness / thought leadership hơn raid."
        )
    elif st == "quiet":
        bits.append(
            "Trạng thái QUIET: output X thấp gần đây — campaign lead trên X rủi ro; "
            "nên confirm channel chính (TG/YT) trước brief."
        )
    else:
        bits.append(
            "Trạng thái DORMANT trên tín hiệu X hiện tại — không khuyến nghị làm sole lead "
            "nếu KPI phụ thuộc post/engagement Twitter."
        )

    if posts7d is not None:
        if posts7d >= 15 and tpd < 3:
            bits.append(
                "Lưu ý: 7d bận hơn pace lifetime → đang trong phase đẩy content / event."
            )
        elif posts7d <= 2 and tpd >= 5:
            bits.append(
                "Lưu ý: 7d chậm hơn pace lifetime (hoặc sample cap) → verify trước khi book slot."
            )

    bits.append(f"Composite score map ~{score:.1f}/100 (blend base size + hot/activity).")
    return " ".join(bits)


def campaign_fit(
    niche: str,
    type_raw: str,
    status: str | None,
    followers: int,
    tpd: float,
    verified: bool,
) -> str:
    st = status or "stable"
    size = (
        "mega-audience"
        if followers >= 100_000
        else "large"
        if followers >= 30_000
        else "mid"
        if followers >= 10_000
        else "niche/small"
    )
    fit = niche_playbook(niche, type_raw)
    auth = "Verified giúp trust signal." if verified else "Chưa verified — dựa reputation/community."
    if st in ("quiet", "dormant"):
        use = "Hiện tại: chỉ cân nhắc secondary / offline hoặc chờ reactivation."
    elif st == "hot" and tpd >= 3:
        use = "Hiện tại: primary cho push ngắn hạn nếu budget/brief khớp niche."
    elif followers >= 50_000 and st in ("active", "stable"):
        use = "Hiện tại: brand/awareness hoặc co-lead; đừng chỉ dựa vanity followers."
    else:
        use = "Hiện tại: mid-funnel / community — test 1–2 post đo eng trước scale."
    return f"Định vị dùng KOL ({size}): {fit} {auth} {use}"


def build_assessment(
    k: dict,
    profile: dict | None,
    act_note: dict | None,
    feed_posts: list[dict] | None,
) -> str:
    handle = k.get("handle") or ""
    name = k.get("displayName") or handle
    niche = k.get("niche") or "Multi"
    type_raw = k.get("typeRaw") or niche
    tier = k.get("tier") or 2
    followers = int(k.get("followers") or 0)
    following = k.get("xFollowing")
    tweets = int(k.get("tweetsTotal") or 0)
    tpd = float(k.get("tweetsPerDay") or 0)
    verified = bool(k.get("verified"))
    delta = k.get("deltaPct")
    status = k.get("statusLabel")
    score = float(k.get("score") or 0)
    is_top30 = bool(k.get("isTop30"))
    posts7d = k.get("activity7dPosts")

    # profile enrich
    follow_ratio = None
    media_ratio = None
    age_days = None
    x_desc = ""
    if profile:
        follow_ratio = profile.get("follow_ratio")
        media_ratio = profile.get("media_ratio")
        age_days = profile.get("age_days")
        x_desc = clean_x_bio(profile.get("description") or "")
        if following is None:
            following = profile.get("following")
        if not tweets:
            tweets = int(profile.get("tweets") or 0)
        if not tpd:
            tpd = float(profile.get("tweets_per_day") or 0)

    years = (age_days / 365.0) if age_days else max(0.5, tweets / max(tpd * 365, 1) if tpd else 2.0)

    # fallback follow ratio
    if follow_ratio is None and following is not None and followers:
        follow_ratio = following / max(followers, 1)

    # Paragraph 1 — who
    who = (
        f"{name} (@{handle}) — Tier {tier}, positioning sheet «{type_raw}» → map niche {niche}."
    )
    if verified:
        who += " Account verified trên X."
    if x_desc:
        who += f" Self-bio X: {x_desc}"

    # Paragraph 2 — scale + growth
    scale = growth_line(float(delta) if delta is not None else None, followers)
    net = network_line(follow_ratio, following, media_ratio)
    if net:
        scale = scale + " " + net

    # Paragraph 3 — cadence
    cadence = pace_line(tpd, tweets, years)

    # Paragraph 4 — 7d window
    w7 = window_7d(k, act_note)

    # Paragraph 5 — recent content (if feed)
    recent = summarize_recent_posts(feed_posts or [])

    # Paragraph 6 — status read
    read = status_read(status, tpd, posts7d, score, is_top30)

    # Paragraph 7 — campaign fit
    fit = campaign_fit(niche, type_raw, status, followers, tpd, verified)

    parts = [who, scale, cadence]
    if w7:
        parts.append(w7)
    if recent:
        parts.append(recent)
    parts.append(read)
    parts.append(fit)

    # Separator for UI multi-line readability
    return "\n\n".join(parts)


def main() -> None:
    kols = load_kols()
    profiles = load_profiles()
    activity = load_activity_notes()
    feed = load_feed_by_handle()

    for k in kols:
        h = (k.get("handle") or "").lower()
        k["bio"] = build_assessment(
            k,
            profiles.get(h),
            activity.get(h),
            feed.get(h),
        )

    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    n = len(kols)
    top30 = sum(1 for k in kols if k.get("isTop30"))
    sampled = sum(1 for k in kols if k.get("activity7dSource") == "sampled")
    estimated = sum(1 for k in kols if k.get("activity7dSource") == "estimated")

    ts = f"""import type {{ Kol }} from '../types'

/** Live X profiles + Top-30 7d activity + detailed activity assessments.
 *  bio = multi-paragraph AI assessment (metrics + 7d + X self-bio + feed sample).
 *  Regenerate bios: python scripts/enrich_assessments.py
 *  Regenerate 7d: python scripts/merge_activity_7d.py
 */
export const SNAPSHOT_DATE = '{date}'
export const SNAPSHOT_LABEL = 'Detailed assessments · Top30 7d ({sampled} sampled / {estimated} est.) · {n} KOLs'

export const SHEET_KOLS: Kol[] = {json.dumps(kols, ensure_ascii=False, indent=2)}
"""
    TS.write_text(ts, encoding="utf-8")

    lengths = [len(k["bio"]) for k in kols]
    print(f"Enriched {n} bios (top30={top30})")
    print(f"bio length min/avg/max: {min(lengths)} / {sum(lengths)//n} / {max(lengths)}")
    print("Sample @ThuanCapital:")
    sample = next(k for k in kols if k["handle"] == "ThuanCapital")
    print(sample["bio"][:900])
    print("…")
    print(f"wrote {TS}")


if __name__ == "__main__":
    main()
