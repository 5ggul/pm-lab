# -*- coding: utf-8 -*-
"""Up/Down 워처 결과 요약: python updown_report.py"""

import json
import os
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def load(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(x) for x in f if x.strip()]


def main():
    trades = load("updown_trades.jsonl")
    windows = load("updown_windows.jsonl")
    settles = [t for t in trades if t["kind"] == "settle"]
    entries = [t for t in trades if t["kind"] == "entry"]

    print("=" * 68)
    print("Up/Down 워처 리포트 (페이퍼)")
    print("=" * 68)

    if settles:
        by = defaultdict(list)
        for t in settles:
            by[f"{t['asset']}/{t['win']//60}m"].append(t)
        total_pnl = sum(t["pnl_usd"] for t in settles)
        wins = sum(1 for t in settles if t["won"])
        print(f"\n[전략1: 괴리 진입] 정산 {len(settles)}건 "
              f"(미정산 {len(entries) - len(settles)}건)")
        print(f"  승률 {wins}/{len(settles)} ({wins/len(settles)*100:.0f}%) | "
              f"누적 손익 ${total_pnl:+.2f}")
        for k, rows in sorted(by.items()):
            w = sum(1 for t in rows if t["won"])
            pnl = sum(t["pnl_usd"] for t in rows)
            avg_edge = sum(t["edge_at_entry"] for t in rows) / len(rows)
            print(f"    {k:<8} {len(rows):>3}건 | 승률 {w/len(rows)*100:>3.0f}% | "
                  f"손익 ${pnl:+8.2f} | 평균 진입 edge {avg_edge:+.3f}")
    else:
        print("\n[전략1] 정산된 트레이드 없음")

    if windows:
        pairs = [w for w in windows if w.get("temporal_pair_min")]
        arbs = [w for w in pairs if w["temporal_arb_possible"]]
        print(f"\n[전략2: 시점분리 페어] 관측 윈도우 {len(windows)}개")
        if pairs:
            best = min(p["temporal_pair_min"] for p in pairs)
            avg = sum(p["temporal_pair_min"] for p in pairs) / len(pairs)
            print(f"  페어 최저합 평균 {avg:.3f} | 최고 기록 {best:.3f} | "
                  f"$1 미만 성립 {len(arbs)}/{len(pairs)}개 "
                  f"({len(arbs)/len(pairs)*100:.0f}%)")
        snipes = [w["snipe_obs"] for w in windows if w.get("snipe_obs")]
        cheap = [s for s in snipes if s["fav_cost"] and s["fav_cost"] < 0.99]
        if snipes:
            print(f"\n[전략3: 마감 스나이핑 관측] 마감 15초 전 관측 {len(snipes)}회 | "
                  f"우세 아웃컴 99¢ 미만 {len(cheap)}회")


if __name__ == "__main__":
    main()
