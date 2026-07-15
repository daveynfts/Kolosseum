#!/usr/bin/env python3
"""Update Emily Vuong bio from SurfAI DOCX report (bullet overview)."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BIO = """Emily Vuong (@emilyyvuong) — Đánh giá công tâm KOL · niche News/Trading · Band T2 · SurfAI Jul/2026.

TL;DR
• High-quality macro voice VN: vĩ mô (Fed, CPI, địa chính trị) + ETF/dòng tiền + cấu trúc thị trường — giáo dục, data-driven, NFA rõ; không shill coin.
• SurfAI KOL Signal Score: 82/100 — “High Quality Macro Voice” (depth + timely + data mạnh; tương tác 2 chiều còn yếu).
• Phù hợp theo dõi làm nguồn macro context / KOL watchlist; không phải call group hay news spam.

Chân dung
• ~182.3K followers · Blue Verified · self-bio: “For informational purposes only — NFA”.
• Tiếng Việt chuyên nghiệp, data-heavy, chart/biểu đồ, giọng phân tích khách quan.
• Nhóm Analyst/Educator (không shiller, không pure aggregator) — giá trị dài hạn cao cho trader “serious”.

Điểm mạnh
• Data-driven: CPI MoM, ETF flows, P/E, so sánh lịch sử, chart kèm bài.
• Kết nối TradFi macro → implication crypto (Fed, Hormuz, risk assets) rõ và timely.
• Uy tín: NFA, ít drama, không shill low-cap; trình bày dễ skim.
• Peak gần đây: ~54 likes / ~5.9K views (contrarian BTC/Gold, geopolitics).

Điểm yếu / rủi ro
• Engagement 2 chiều thấp (replies ~2–8); eng rate ước ~0.014% — audience passive.
• Ít CTA (poll/câu hỏi); phụ thuộc chart — mobile dễ overload nếu thiếu TL;DR.
• Chủ đề nặng vĩ mô/geopolitics (50%+); ít on-chain / alt rotation → reach hẹp hơn.
• Concentration risk content; flywheel cộng đồng yếu; áp lực duy trì depth + tần suất.

Mẫu nội dung (12–14/07/2026)
• ~35% vĩ mô · ~25% crypto/ETF · ~15% địa chính trị.
• Ví dụ: CPI 6 “tốt bất ngờ” nhưng cảnh báo tháng 7; KOSPI/chip concentration; BTC/Gold -1.81 SD (contrarian); Hormuz + Fed RMP “QE trá hình” quy mô nhỏ.

Radar SurfAI (gợi ý)
• Tin cậy/NFA & cân bằng ~9.5/10 · Macro–crypto ~9.3/10 · Tương tác cộng đồng ~6.8/10 (điểm thấp nhất).
• Dùng như: macro signal context, narrative detection, trust/depth leaderboard — không chỉ ranking eng.

Cách dùng
• Đọc để lấy context vĩ mô–crypto trước khi trade; tự verify số liệu & cập nhật sự kiện.
• Không dùng làm tín hiệu entry/exit độc lập.
• Kết luận: KOL “blue-chip” quality trong hệ sinh thái VN — theo dõi sát; cải thiện engagement là cơ hội chính."""


def replace_ts_string_field(text: str, handle: str, field: str, new_value: str | int) -> str:
    hpos = text.find(f'"handle": "{handle}"')
    if hpos < 0:
        raise SystemExit(f"handle {handle} not found")
    next_id = text.find('\n  {\n    "id":', hpos + 1)
    region_end = next_id if next_id > 0 else len(text)
    fkey = f'"{field}": '
    b = text.find(fkey, hpos, region_end)
    if b < 0:
        raise SystemExit(f"field {field} not found for {handle}")
    start = b + len(fkey)
    if text[start] != '"':
        m = re.match(r"-?\d+(\.\d+)?", text[start:region_end])
        if not m:
            raise SystemExit(f"unexpected value for {field}")
        end = start + m.end()
        return text[:start] + str(new_value) + text[end:]
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
        raise SystemExit(f"unclosed string for {field}")
    return text[:start] + json.dumps(new_value, ensure_ascii=False) + text[end:]


def main() -> None:
    sheet = ROOT / "src" / "data" / "sheetKols.ts"
    text = sheet.read_text(encoding="utf-8")
    text = replace_ts_string_field(text, "emilyyvuong", "followers", 182312)
    text = replace_ts_string_field(text, "emilyyvuong", "bio", BIO)
    sheet.write_text(text, encoding="utf-8")
    print("wrote", sheet, "bio_len", len(BIO))

    snap_path = ROOT / "data" / "kols-server-snapshot.json"
    snap = json.loads(snap_path.read_text(encoding="utf-8"))
    found = False
    for k in snap.get("kols", []):
        if str(k.get("handle", "")).lower() == "emilyyvuong":
            k["bio"] = BIO
            k["followers"] = 182312
            found = True
            break
    if not found:
        raise SystemExit("emilyyvuong missing in snapshot")
    snap_path.write_text(
        json.dumps(snap, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("wrote", snap_path)

    # cleanup temp extract if any
    tmp = ROOT / "data" / "_emily_report.txt"
    if tmp.exists():
        tmp.unlink()
        print("removed", tmp)


if __name__ == "__main__":
    main()
