#!/usr/bin/env python3
"""Remove X accounts that no longer resolve (dead-handles.json) from map data."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEAD = ROOT / "data" / "dead-handles.json"
SHEET = ROOT / "data" / "kols-from-sheet.json"
AVATARS = ROOT / "public" / "avatars"
REMOVED_OUT = ROOT / "data" / "removed-nonexistent.json"


def main() -> None:
    dead = json.loads(DEAD.read_text(encoding="utf-8"))
    dead_handles = {d["handle"].lower() for d in dead}
    print(f"Dead handles: {len(dead_handles)}")

    rows = json.loads(SHEET.read_text(encoding="utf-8"))
    kept = [r for r in rows if r["handle"].lower() not in dead_handles]
    removed = [r for r in rows if r["handle"].lower() in dead_handles]
    SHEET.write_text(json.dumps(kept, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"kols-from-sheet.json: {len(rows)} → {len(kept)} (−{len(removed)})")

    REMOVED_OUT.write_text(json.dumps(removed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {REMOVED_OUT.name}")

    deleted = 0
    for d in dead:
        p = AVATARS / f"{d['handle']}.jpg"
        if p.exists():
            p.unlink()
            deleted += 1
            print(f"  deleted avatar {p.name}")
    print(f"Avatars deleted: {deleted}, remaining: {len(list(AVATARS.glob('*.jpg')))}")

    for r in removed:
        print(f"  − T{r.get('tier')} @{r['handle']} · {r.get('name')}")


if __name__ == "__main__":
    main()
