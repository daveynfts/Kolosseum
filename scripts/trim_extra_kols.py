#!/usr/bin/env python3
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TS = ROOT / "src" / "data" / "sheetKols.ts"
DROP = {"epid_community", "im_communityitw"}

text = TS.read_text(encoding="utf-8")
m = re.search(r"export const SHEET_KOLS: Kol\[\] = (\[[\s\S]*)", text)
kols = json.loads(m.group(1).strip())
before = len(kols)
kols = [k for k in kols if k["handle"].lower() not in DROP]
kols.sort(key=lambda x: (-x.get("score", 0), -x.get("followers", 0)))
print(f"removed {before - len(kols)}, now {len(kols)}")

date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
label = f"X live + Tier3 batch (+10) · {len(kols)} KOLs"
out = f"""import type {{ Kol }} from '../types'

/** Live X profiles + activity assessments.
 *  Add batch: python scripts/add_next10.py
 *  Enrich bios: python scripts/enrich_assessments.py
 */
export const SNAPSHOT_DATE = '{date}'
export const SNAPSHOT_LABEL = '{label}'

export const SHEET_KOLS: Kol[] = {json.dumps(kols, ensure_ascii=False, indent=2)}
"""
TS.write_text(out, encoding="utf-8")
print("T3:", [k["handle"] for k in kols if k.get("tier") == 3])
