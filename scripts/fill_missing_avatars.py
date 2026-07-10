#!/usr/bin/env python3
"""Fill missing Tier 1–2 avatars: multi-source fetch, then generated fallback."""

from __future__ import annotations

import io
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = None  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / "data" / "kols-from-sheet.json"
OUT = ROOT / "public" / "avatars"
MIN = 2500
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# Niche-ish gradient pairs for generated fallbacks
PALETTES = [
    ((34, 211, 238), (15, 23, 42)),
    ((167, 139, 250), (15, 23, 42)),
    ((244, 114, 182), (15, 23, 42)),
    ((251, 191, 36), (15, 23, 42)),
    ((52, 211, 153), (15, 23, 42)),
    ((96, 165, 250), (30, 27, 75)),
    ((251, 146, 60), (15, 23, 42)),
    ((232, 121, 249), (15, 23, 42)),
]


def http_get(url: str, accept: str = "*/*") -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": accept,
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read()


def upgrade_twimg(url: str) -> str:
    for a, b in (
        ("_normal.", "_400x400."),
        ("_bigger.", "_400x400."),
        ("_mini.", "_400x400."),
        ("_normal.", "_200x200."),
    ):
        if a in url:
            return url.replace(a, b).split("?")[0]
    return url.split("?")[0]


def from_fxtwitter(handle: str) -> str | None:
    for host in ("api.fxtwitter.com", "api.vxtwitter.com"):
        try:
            raw = http_get(f"https://{host}/{handle}", accept="application/json")
            data = json.loads(raw.decode("utf-8", "replace"))
            user = data.get("user") or data
            if not isinstance(user, dict):
                continue
            img = (
                user.get("avatar_url")
                or user.get("profile_image_url_https")
                or user.get("avatar")
                or user.get("profile_image_url")
            )
            if img:
                return upgrade_twimg(img)
        except Exception:
            continue
    return None


def from_unavatar(handle: str) -> bytes | None:
    try:
        data = http_get(
            f"https://unavatar.io/twitter/{handle}",
            accept="image/avif,image/webp,image/*,*/*",
        )
        if len(data) >= MIN:
            return data
    except Exception:
        pass
    return None


def download_image(url: str) -> bytes | None:
    try:
        data = http_get(url, accept="image/avif,image/webp,image/*,*/*")
        return data if len(data) >= MIN else None
    except Exception:
        return None


def initials(name: str, handle: str) -> str:
    parts = [p for p in (name or "").strip().split() if p]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    if parts:
        return parts[0][:2].upper()
    return (handle[:2] if handle else "??").upper()


def generate_avatar(name: str, handle: str, size: int = 400) -> bytes:
    if Image is None:
        raise RuntimeError("Pillow required for fallback: pip install Pillow")

    idx = sum(ord(c) for c in handle) % len(PALETTES)
    c1, c2 = PALETTES[idx]
    img = Image.new("RGB", (size, size), c2)
    draw = ImageDraw.Draw(img)

    # radial-ish gradient by rings
    cx = cy = size // 2
    for r in range(size // 2, 0, -2):
        t = r / (size / 2)
        col = tuple(int(c1[i] * t + c2[i] * (1 - t)) for i in range(3))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)

    # soft ring
    draw.ellipse(
        [12, 12, size - 12, size - 12],
        outline=(248, 250, 252),
        width=6,
    )

    text = initials(name, handle)
    try:
        font = ImageFont.truetype("arial.ttf", size // 3)
    except Exception:
        try:
            font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", size // 3)
        except Exception:
            font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - tw) / 2, (size - th) / 2 - size * 0.04),
        text,
        fill=(255, 255, 255),
        font=font,
    )

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def main() -> None:
    if Image is None:
        print("Installing Pillow…")
        import subprocess
        import sys

        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "-q"])
        from PIL import Image as _Image, ImageDraw as _ImageDraw, ImageFont as _ImageFont

        globals()["Image"] = _Image
        globals()["ImageDraw"] = _ImageDraw
        globals()["ImageFont"] = _ImageFont

    rows = json.loads(SHEET.read_text(encoding="utf-8"))
    rows = [r for r in rows if str(r.get("tier")) in ("1", "2")]
    OUT.mkdir(parents=True, exist_ok=True)

    missing = []
    for r in rows:
        dest = OUT / f"{r['handle']}.jpg"
        if not dest.exists() or dest.stat().st_size < MIN:
            missing.append(r)

    print(f"Missing: {len(missing)} / {len(rows)}")
    fetched = generated = 0

    for i, r in enumerate(missing, 1):
        handle = r["handle"]
        name = r.get("name") or handle
        dest = OUT / f"{handle}.jpg"
        print(f"[{i}/{len(missing)}] @{handle}")

        data = None
        img_url = from_fxtwitter(handle)
        if img_url:
            print(f"  fxtwitter → {img_url}")
            data = download_image(img_url)
            time.sleep(0.3)

        if not data:
            print("  try unavatar…")
            data = from_unavatar(handle)
            time.sleep(0.8)

        if data:
            dest.write_bytes(data)
            fetched += 1
            print(f"  OK real photo ({len(data)}b)")
        else:
            data = generate_avatar(name, handle)
            dest.write_bytes(data)
            generated += 1
            print(f"  generated fallback ({len(data)}b)")

    total = len([p for p in OUT.glob("*.jpg") if p.stat().st_size >= MIN])
    print(f"done fetched={fetched} generated={generated} total_files={total}")


if __name__ == "__main__":
    main()
