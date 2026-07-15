#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BIO = (ROOT / "data/bio-patches/lensmoso.txt").read_text(encoding="utf-8").strip()
HANDLE = "LensMoso"
FOLLOWERS = 27352


def replace_ts_string_field(text: str, handle: str, field: str, new_value: str | int) -> str:
    hpos = text.find(f'"handle": "{handle}"')
    if hpos < 0:
        raise SystemExit(f"handle {handle} not found")
    next_id = text.find('\n  {\n    "id":', hpos + 1)
    region_end = next_id if next_id > 0 else len(text)
    fkey = f'"{field}": '
    b = text.find(fkey, hpos, region_end)
    if b < 0:
        raise SystemExit(f"field {field} not found")
    start = b + len(fkey)
    if text[start] != '"':
        m = re.match(r"-?\d+(\.\d+)?", text[start:region_end])
        if not m:
            raise SystemExit(f"unexpected value for {field}")
        return text[:start] + str(new_value) + text[start + m.end() :]
    j = start + 1
    while j < len(text):
        c = text[j]
        if c == "\\":
            j += 2
            continue
        if c == '"':
            end = j + 1
            break
        j += 1
    else:
        raise SystemExit(f"unclosed {field}")
    return text[:start] + json.dumps(new_value, ensure_ascii=False) + text[end:]


def main() -> None:
    sheet = ROOT / "src/data/sheetKols.ts"
    text = sheet.read_text(encoding="utf-8")
    text = replace_ts_string_field(text, HANDLE, "followers", FOLLOWERS)
    text = replace_ts_string_field(text, HANDLE, "bio", BIO)
    sheet.write_text(text, encoding="utf-8")
    print("sheet ok", len(BIO))

    snap_path = ROOT / "data/kols-server-snapshot.json"
    snap = json.loads(snap_path.read_text(encoding="utf-8"))
    for k in snap.get("kols", []):
        if str(k.get("handle", "")).lower() == HANDLE.lower():
            k["bio"] = BIO
            k["followers"] = FOLLOWERS
            break
    else:
        raise SystemExit("not in snapshot")
    snap_path.write_text(json.dumps(snap, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("snapshot ok")


if __name__ == "__main__":
    main()
