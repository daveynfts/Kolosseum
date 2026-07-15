#!/usr/bin/env python3
"""Download avatars for a list of X handles into public/avatars/."""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "avatars"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
MIN = 800


def get(url: str, accept: str = "*/*") -> bytes:
    req = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept": accept}
    )
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()


def upgrade(url: str) -> str:
    for a, b in (
        ("_normal.", "_400x400."),
        ("_bigger.", "_400x400."),
        ("_mini.", "_400x400."),
    ):
        if a in url:
            return url.replace(a, b).split("?")[0]
    return url.split("?")[0]


def fetch_avatar(handle: str) -> bytes | None:
    for host in ("api.fxtwitter.com", "api.vxtwitter.com"):
        try:
            raw = get(f"https://{host}/{handle}", "application/json")
            d = json.loads(raw.decode("utf-8", "replace"))
            user = d.get("user") or d
            img = (
                user.get("avatar_url")
                or user.get("profile_image_url_https")
                or user.get("avatar")
                or user.get("profile_image_url")
            )
            if img:
                data = get(upgrade(img), "image/*")
                if data and len(data) >= MIN:
                    return data
        except Exception:
            continue
    for path in (
        f"https://unavatar.io/x/{handle}",
        f"https://unavatar.io/twitter/{handle}",
    ):
        try:
            data = get(path, "image/*")
            if data and len(data) >= MIN:
                return data
        except Exception:
            continue
    return None


def main() -> None:
    handles = [h.strip().lstrip("@") for h in sys.argv[1:] if h.strip()]
    if not handles:
        print("Usage: python scripts/download_follower_avatars.py handle1 handle2 ...")
        sys.exit(1)
    OUT.mkdir(parents=True, exist_ok=True)
    ok = fail = 0
    new: list[str] = []
    for h in handles:
        dest = OUT / f"{h}.jpg"
        if dest.exists() and dest.stat().st_size >= MIN:
            print(f"OK exists {h}")
            ok += 1
            continue
        data = fetch_avatar(h)
        if data:
            dest.write_bytes(data)
            print(f"OK {h} {len(data)}")
            new.append(h)
            ok += 1
        else:
            print(f"FAIL {h}")
            fail += 1
    print(f"done ok={ok} fail={fail} new={len(new)}")


if __name__ == "__main__":
    main()
