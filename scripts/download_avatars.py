#!/usr/bin/env python3
"""Download real X profile photos for Tier 1–2 KOLs.

Pipeline:
  1) api.fxtwitter.com/{handle} → profile avatar URL (pbs.twimg.com)
  2) upgrade _normal → _400x400
  3) save to public/avatars/{handle}.jpg
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / "data" / "kols-from-sheet.json"
OUT = ROOT / "public" / "avatars"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
MIN_BYTES = 2500  # discard tiny placeholders


def http_get(url: str, accept: str = "*/*") -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": accept,
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def avatar_url_from_fxtwitter(handle: str) -> str | None:
    url = f"https://api.fxtwitter.com/{handle}"
    try:
        raw = http_get(url, accept="application/json")
        data = json.loads(raw.decode("utf-8", "replace"))
    except Exception as e:
        print(f"  fxtwitter fail @{handle}: {e}")
        return None

    user = data.get("user") or data
    if not isinstance(user, dict):
        return None
    img = (
        user.get("avatar_url")
        or user.get("profile_image_url_https")
        or user.get("avatar")
        or user.get("profile_image_url")
    )
    if not img or not isinstance(img, str):
        return None

    # Prefer higher-res variants
    for a, b in (
        ("_normal.", "_400x400."),
        ("_bigger.", "_400x400."),
        ("_mini.", "_400x400."),
        ("_normal.", "_200x200."),
    ):
        if a in img:
            img = img.replace(a, b)
            break
    # drop :name suffix if any
    img = img.split("?")[0]
    return img


def main() -> None:
    rows = json.loads(SHEET.read_text(encoding="utf-8"))
    rows = [r for r in rows if str(r.get("tier")) in ("1", "2")]
    OUT.mkdir(parents=True, exist_ok=True)

    # remove tiny junk from previous unavatar run
    for p in OUT.glob("*.jpg"):
        if p.stat().st_size < MIN_BYTES:
            p.unlink()
            print(f"removed tiny {p.name}")

    ok = fail = skip = 0
    for i, r in enumerate(rows, 1):
        handle = r["handle"]
        dest = OUT / f"{handle}.jpg"
        if dest.exists() and dest.stat().st_size >= MIN_BYTES:
            skip += 1
            print(f"[{i}/{len(rows)}] exists @{handle}")
            continue

        print(f"[{i}/{len(rows)}] @{handle}")
        img_url = avatar_url_from_fxtwitter(handle)
        if not img_url:
            fail += 1
            time.sleep(0.4)
            continue

        try:
            data = http_get(img_url, accept="image/avif,image/webp,image/*,*/*")
            if len(data) < MIN_BYTES:
                print(f"  too small ({len(data)}b) {img_url}")
                fail += 1
            else:
                dest.write_bytes(data)
                ok += 1
                print(f"  saved {dest.name} ({len(data)}b) ← {img_url}")
        except urllib.error.HTTPError as e:
            print(f"  image HTTP {e.code} {img_url}")
            fail += 1
        except Exception as e:
            print(f"  image err: {e}")
            fail += 1

        time.sleep(0.35)

    print(f"done ok={ok} fail={fail} skipped={skip} dir={OUT}")
    print(f"files now: {len(list(OUT.glob('*.jpg')))}")


if __name__ == "__main__":
    main()
