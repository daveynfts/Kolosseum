#!/usr/bin/env python3
"""Fetch VN KOL Google Sheet and export cleaned JSON."""

from __future__ import annotations

import csv
import io
import json
import re
import urllib.request
from collections import Counter
from pathlib import Path

SHEET_ID = "1opstP7DZX2Gwkncu3JdP6X_cFDC3_kgDCnVZhW0VKRA"
URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv"
OUT_DIR = Path(__file__).resolve().parents[1] / "data"


def parse_followers(raw: str) -> int | None:
    s = (raw or "").strip().upper().replace(",", "")
    if not s:
        return None
    m = re.match(r"^([\d.]+)\s*([KMB])?$", s)
    if not m:
        # bare number
        try:
            return int(float(s))
        except ValueError:
            return None
    n = float(m.group(1))
    unit = m.group(2)
    if unit == "K":
        n *= 1_000
    elif unit == "M":
        n *= 1_000_000
    elif unit == "B":
        n *= 1_000_000_000
    return int(n)


def handle_from_link(link: str) -> str | None:
    if not link:
        return None
    # First x.com / twitter.com handle in the cell (may contain multi-line / multi-links)
    m = re.search(r"(?:x\.com|twitter\.com)/@?([A-Za-z0-9_]{1,15})", link, re.I)
    return m.group(1) if m else None


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw = urllib.request.urlopen(URL, timeout=60).read()
    (OUT_DIR / "kols-raw.csv").write_bytes(raw)

    text = raw.decode("utf-8-sig", errors="replace")
    rows = list(csv.DictReader(io.StringIO(text)))

    valid: list[dict] = []
    skipped: list[dict] = []
    seen_handles: set[str] = set()

    for i, r in enumerate(rows, start=2):
        name = (r.get("Name") or "").strip()
        link = r.get("Link") or ""
        handle = handle_from_link(link)
        if not name and not handle:
            continue
        if not handle:
            skipped.append({"row": i, "name": name, "link": link, "reason": "no_x_handle"})
            continue
        key = handle.lower()
        if key in seen_handles:
            skipped.append({"row": i, "name": name, "handle": handle, "reason": "duplicate_handle"})
            continue
        seen_handles.add(key)

        followers_raw = (r.get("Followers") or "").strip()
        valid.append(
            {
                "name": name,
                "handle": handle,
                "link": f"https://x.com/{handle}",
                "followers_raw": followers_raw,
                "followers": parse_followers(followers_raw),
                "tier": (r.get("Tier") or "").strip(),
                "type": (r.get("Type") or "").strip(),
                "note": (r.get("Note") or "").strip(),
                "engagement": (r.get("Engagement") or "").strip(),
                "sheet_row": i,
            }
        )

    out_json = OUT_DIR / "kols-from-sheet.json"
    out_json.write_text(json.dumps(valid, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_DIR / "kols-skipped.json").write_text(
        json.dumps(skipped, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"Total CSV data rows: {len(rows)}")
    print(f"Valid KOLs with X handle: {len(valid)}")
    print(f"Skipped: {len(skipped)}")
    print("Tiers:", dict(Counter(v["tier"] or "?" for v in valid)))
    print("Top types:", Counter((v["type"] or "empty") for v in valid).most_common(15))
    print(f"Wrote {out_json}")
    print("--- sample (first 20) ---")
    for v in valid[:20]:
        print(
            f"T{v['tier'] or '?'} | {v['followers_raw'] or '-':>6} | "
            f"@{v['handle']:<22} | {v['name'][:36]:<36} | {v['type'][:28]}"
        )
    print("--- last 10 ---")
    for v in valid[-10:]:
        print(
            f"T{v['tier'] or '?'} | {v['followers_raw'] or '-':>6} | "
            f"@{v['handle']:<22} | {v['name'][:36]:<36} | {v['type'][:28]}"
        )


if __name__ == "__main__":
    main()
