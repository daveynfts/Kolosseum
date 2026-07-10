#!/usr/bin/env python3
"""Pick top 10 sheet KOLs not yet on the map (by followers)."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
text = (ROOT / "src/data/sheetKols.ts").read_text(encoding="utf-8")
m = re.search(r"export const SHEET_KOLS: Kol\[\] = (\[[\s\S]*)", text)
kols = json.loads(m.group(1).strip())
handles = {k["handle"].lower() for k in kols}
raw = json.loads((ROOT / "data/kols-from-sheet.json").read_text(encoding="utf-8"))
missing = [r for r in raw if r.get("handle", "").lower() not in handles]
missing.sort(key=lambda r: int(r.get("followers") or 0), reverse=True)
print(f"current map: {len(kols)} | missing with X: {len(missing)}")
for r in missing[:20]:
    print(
        f"  T{r.get('tier')} @{r.get('handle'):25} {str(r.get('name'))[:22]:22} "
        f"f={r.get('followers')} type={r.get('type')}"
    )
top10 = missing[:10]
print("WILL ADD:", [r["handle"] for r in top10])
(ROOT / "data/_next10.json").write_text(
    json.dumps(top10, ensure_ascii=False, indent=2), encoding="utf-8"
)
