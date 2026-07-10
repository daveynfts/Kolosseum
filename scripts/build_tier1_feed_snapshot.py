#!/usr/bin/env python3
"""Build public/feed/tier1-feed.json demo snapshot (curated from live X search).

Re-run after manual refresh of post list, or replace with Surf/X API pipeline later.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "feed" / "tier1-feed.json"
SHEET = ROOT / "data" / "kols-from-sheet.json"


def add(
    posts: list,
    id: int | str,
    handle: str,
    name: str,
    text: str,
    ts: str,
    likes: int = 0,
    reposts: int = 0,
    replies: int = 0,
    views: int = 0,
    media: list | None = None,
    is_reply: bool = False,
) -> None:
    posts.append(
        {
            "id": str(id),
            "handle": handle,
            "displayName": name,
            "text": text.strip(),
            "createdAt": ts,
            "likes": likes,
            "reposts": reposts,
            "replies": replies,
            "views": views,
            "media": media or [],
            "isReply": is_reply,
            "url": f"https://x.com/{handle}/status/{id}",
            "avatarLocal": f"/avatars/{handle}.jpg",
        }
    )


def main() -> None:
    posts: list[dict] = []

    add(
        posts,
        2075399609745375334,
        "phamduydong179",
        "Đông Phạm",
        """💰 Paradigm vừa huy động thành công 1,2 tỷ USD cho quỹ đầu tư mạo hiểm thứ tư – quy mô lớn nhất trong lịch sử của hãng.

Quỹ mới mở rộng sang AI và robotics, phản ánh xu hướng hội tụ Crypto + AI + Robotics.""",
        "2026-07-10T02:00:00Z",
        1,
        0,
        0,
        461,
        ["https://pbs.twimg.com/media/HMy30i2b0AAEOvD.png"],
    )
    add(
        posts,
        2075400711186337819,
        "henvaibta",
        "Hên Vãi",
        """$LINK: Oracle infrastructure vững chắc giữa thị trường biến động

$LINK quanh $7.88. CCIP xử lý $18B volume Q1 (+319% YoY). Tích hợp Robinhood Chain, DTCC Collateral Chain sắp ra mắt. TVS ATH $33B.

Chỉ là thông tin tham khảo, không phải lời khuyên đầu tư.""",
        "2026-07-10T02:04:23Z",
        0,
        0,
        1,
        217,
    )
    add(
        posts,
        2075398264359367120,
        "henvaibta",
        "Hên Vãi",
        """🚀 ARB Revenue Catalyst Unlocked

Robinhood Chain (Arbitrum Orbit) routes 10% net sequencer revenue: 8% ARB DAO treasury, 2% Developer Guild.

This is not investment advice. Vietnamese investors please comply with Resolution 05/2025/NQ-CP VN""",
        "2026-07-10T01:54:39Z",
        0,
        0,
        0,
        376,
        ["https://pbs.twimg.com/media/HM1LbVCbgAASTgD.jpg"],
    )
    add(
        posts,
        2075396810127118617,
        "henvaibta",
        "Hên Vãi",
        """Dạo này mình thấy cái ảnh cycle crypto hơi nhiều. Nó cũng trùng với vài người PTKT Việt Nam mình follow — liệu cycle này đã vỡ, hay lại lặp 4 năm?""",
        "2026-07-10T01:48:53Z",
        1,
        0,
        2,
        363,
    )
    add(
        posts,
        2075381288182464846,
        "ThuanCapital",
        "ThuanCapital",
        """Các công ty niêm yết đã mua thêm 110K BTC trong quý 2/2026, tương đương gấp 1,8X tổng lượng mua của hai quý trước cộng lại.

Tổng lượng Bitcoin do các doanh nghiệp nắm giữ hiện đã vượt 1,26 triệu BTC, chiếm hơn 6% tổng nguồn cung Bitcoin đang lưu hành.""",
        "2026-07-10T00:47:12Z",
        38,
        0,
        6,
        3740,
    )
    add(
        posts,
        2075380584264994957,
        "ThuanCapital",
        "ThuanCapital",
        """Stablecoin PYUSD của PayPal hiện đã được phát hành dưới dạng native trên mạng Polygon.

PYUSD trước đó đã được phát hành dưới dạng native trên mạng Ethereum, Arbitrum và Solana.""",
        "2026-07-10T00:44:24Z",
        19,
        0,
        3,
        3359,
    )
    add(
        posts,
        2075378260373065812,
        "ThuanCapital",
        "ThuanCapital",
        """🇺🇸 Eleanor Terrett: Để CLARITY Act có thể được thông qua, các cuộc đàm phán hiện phụ thuộc chủ yếu vào việc đạt được thỏa thuận về quy tắc đạo đức (chống xung đột lợi ích).""",
        "2026-07-10T00:35:10Z",
        25,
        1,
        2,
        1163,
    )
    add(
        posts,
        2075377965177970956,
        "TuanNguyen_6789",
        "Minhtuan | AlphaBack.net",
        """Dù đã qua nhiều năm, huyền thoại $LUNA vẫn là sự kiện ám ảnh nhất mọi thời đại ngành Crypto.

Mình nhớ khi đó cũng mua 1 số lượng kha khá $LUNA, sáng hôm sau mở tài khoản thấy về 0 đồng.""",
        "2026-07-10T00:34:00Z",
        16,
        0,
        13,
        1457,
        ["https://pbs.twimg.com/media/HMyh-l9bYAAVwhJ.jpg"],
    )
    add(
        posts,
        2075369410035126618,
        "phamduydong179",
        "Đông Phạm",
        """🚨 AscendEX chính thức dừng hoạt động, ngừng đăng ký tài khoản mới, giao dịch và nạp tiền. Từ ngày 6/7, mọi yêu cầu rút tiền đều phải xử lý thủ công.

"Not your keys, not your coins" vẫn là nguyên tắc quan trọng.""",
        "2026-07-10T00:00:00Z",
        8,
        0,
        3,
        1892,
        ["https://pbs.twimg.com/media/HMy3NRabMAAW47E.png"],
    )
    add(
        posts,
        2075339212468224439,
        "phamduydong179",
        "Đông Phạm",
        """🚀 CAP đang trở thành hiện tượng mới của DeFi.

Chỉ 10 ngày sau khi ra mắt, token quản trị CAP đã ghi nhận 862 triệu USD khối lượng giao dịch tích lũy, vươn lên vị trí số 2 trong mảng lending/borrowing, chỉ đứng sau Aave.""",
        "2026-07-09T22:00:00Z",
        10,
        0,
        3,
        1770,
        ["https://pbs.twimg.com/media/HMy2vz8bAAAyOM5.jpg"],
    )
    add(
        posts,
        2075309011218374867,
        "phamduydong179",
        "Đông Phạm",
        """🚨 Adam Back và Cantor đang điều chỉnh kế hoạch đưa Bitcoin Standard Treasury (BSTR) lên sàn thông qua SPAC.

BSTR vẫn đặt mục tiêu trở thành một trong những công ty nắm giữ Bitcoin lớn nhất thế giới, với hơn 30.000 BTC.""",
        "2026-07-09T20:00:00Z",
        4,
        0,
        1,
        914,
    )
    add(
        posts,
        2075289612243849562,
        "ThuanCapital",
        "ThuanCapital",
        """JPMorgan cho rằng Michael Saylor và Strategy KHÔNG phải là rủi ro dài hạn lớn nhất đối với Bitcoin. Rủi ro lớn hơn là các ngân hàng sẽ áp dụng công nghệ blockchain nhưng không sử dụng Bitcoin hoặc Ethereum.""",
        "2026-07-09T18:42:55Z",
        78,
        0,
        11,
        6792,
    )
    add(
        posts,
        2075287681006023136,
        "ThuanCapital",
        "ThuanCapital",
        """Cathie Wood vừa mua khoảng 27 triệu USD cổ phiếu SpaceX thông qua 4 quỹ ARK ETF, nâng SpaceX lên vị trí nắm giữ lớn thứ 4 trong danh mục.""",
        "2026-07-09T18:35:14Z",
        27,
        0,
        1,
        4214,
    )
    add(
        posts,
        2075049389517902144,
        "Martin_bml",
        "Martin",
        """Chính xác luôn =)))""",
        "2026-07-09T02:48:21Z",
        4,
        1,
        1,
        4925,
    )
    add(
        posts,
        2074855634516766824,
        "jackvi810",
        "Jack Vĩ",
        """CÁCH ĐỂ TỔ CHỨC WORKSHOP TRONG 1 NỐT NHẠC!

Cái khó không phải setup sự kiện 100 người, mà là làm sao mọi người thấy 3–4 tiếng đó xứng đáng — skill mới, kết nối mới, muốn quay lại.

AI Foundation · Thứ 7 11.07.2026 · Phú Nhuận, TP.HCM""",
        "2026-07-08T13:58:26Z",
        13,
        0,
        1,
        1753,
        ["https://pbs.twimg.com/media/HMtdPkTaIAE6kd8.jpg"],
    )
    add(
        posts,
        2074860623066959904,
        "jackvi810",
        "Jack Vĩ",
        """POV bạn là người tham gia Nghiên AI Workshop #2 với chủ đề Agentic Coding Framework

Tổ chức cũng không khó nhưng đằng sau đó cũng kỳ công lắm à nha 😁""",
        "2026-07-08T14:18:16Z",
        6,
        1,
        0,
        1060,
    )
    add(
        posts,
        2074815123093684650,
        "Martin_bml",
        "Martin",
        """Các CEX mờ ám thu lợi nhuận từ thao túng giá thì sao mà hợp tác?""",
        "2026-07-08T11:17:28Z",
        9,
        1,
        5,
        6223,
    )
    add(
        posts,
        2074343428528468126,
        "jackvi810",
        "Jack Vĩ",
        """Dân non-tech đã sử dụng hết 30% sức mạnh của AI chưa?

Hơn 50% thành viên offline chỉ dùng AI như chatbot. Workshop AI Foundation giúp non-tech build AI Skill & AI Agent thay vì chỉ hỏi đáp.""",
        "2026-07-07T04:03:07Z",
        24,
        1,
        7,
        3387,
        ["https://pbs.twimg.com/media/HMmMNhtboAAB2Ct.jpg"],
    )
    add(
        posts,
        2074142162049187893,
        "Martin_bml",
        "Martin",
        """Saylor vẫn còn nguyên 2 quả thận.""",
        "2026-07-06T14:43:21Z",
        9,
        0,
        3,
        4444,
        ["https://pbs.twimg.com/media/HMjVOptbsAA4KIj.png"],
    )
    add(
        posts,
        2073962170241728558,
        "Martin_bml",
        "Martin",
        """$LIT đang tăng rất ổn — ethereum:0x232ce3bd40fcd6f80f3d55a522d03f25df784ee2 sắp tạo ATH. Quá ổn cho sóng perp dex.""",
        "2026-07-06T02:48:08Z",
        18,
        0,
        4,
        6183,
    )
    add(
        posts,
        2073311205394092135,
        "Martin_bml",
        "Martin",
        """Sóng trên Solana""",
        "2026-07-04T07:41:26Z",
        18,
        1,
        6,
        6959,
    )
    add(
        posts,
        2072948092920528979,
        "HakResearch",
        "Hak Research",
        """SQUID PRE SALE: DÀNH CHO AE THÍCH SỔ XỐ!

$QUID Pre Sale FDV 45M. Nếu lên Binance Alpha, FDV có thể 100–200M. Nếu không, ROI có thể giảm đáng kể.

Chỉ chia sẻ thông tin, không phải lời khuyên đầu tư.""",
        "2026-07-03T07:38:33Z",
        12,
        0,
        5,
        6007,
    )
    add(
        posts,
        2072969372017320412,
        "nambitdefi",
        "Nambit",
        """World SOL war với World Sam, ai thắng đây anh em :)))""",
        "2026-07-03T09:03:06Z",
        26,
        0,
        2,
        8238,
    )
    add(
        posts,
        2072876004339769513,
        "HakResearch",
        "Hak Research",
        """ETHEREUM CHUẨN BỊ COMEBACK, $ETH?

Ethereum Institutional ra mắt 01/07/2026 — cầu nối với ngân hàng, quỹ, RWA. Ethereum Foundation tái cấu trúc, thu hẹp scope, cut 20% headcount.

Mình bullish $ETH trở lại cho chu kì sắp tới xoay quanh RWA.""",
        "2026-07-03T02:52:06Z",
        47,
        4,
        12,
        7631,
    )
    add(
        posts,
        2072899152770638242,
        "Martin_bml",
        "Martin",
        """Mức lương cũng nâng cao đáng kể từ khi các doanh nghiệp nội địa phát triển mạnh. Việt Nam cơ bản đã là nước có mức thu nhập trung bình cao.""",
        "2026-07-03T04:24:05Z",
        15,
        0,
        3,
        8926,
    )

    posts.sort(key=lambda p: p["createdAt"], reverse=True)

    rows = json.loads(SHEET.read_text(encoding="utf-8"))
    t1 = [r for r in rows if str(r.get("tier")) == "1"]

    feed = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "X live search (from: Tier-1 handles) — demo snapshot for map UI",
        "mode": "demo",
        "tier": 1,
        "kolCount": len(t1),
        "handles": [r["handle"] for r in t1],
        "postCount": len(posts),
        "posts": posts,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(feed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} posts={len(posts)} tier1={len(t1)}")


if __name__ == "__main__":
    main()
