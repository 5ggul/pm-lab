# -*- coding: utf-8 -*-
"""페이퍼 트레이딩 장부 리포트: python report.py"""

import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

LEDGER = "paper_ledger.jsonl"
STATS = "scan_stats.jsonl"


def load_jsonl(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def lockup_days(rec):
    if not rec.get("end_date"):
        return None
    try:
        end = datetime.fromisoformat(rec["end_date"].replace("Z", "+00:00"))
        start = datetime.fromisoformat(rec["ts"])
        return max(0.0, (end - start).total_seconds() / 86400)
    except ValueError:
        return None


def main():
    trades = [r for r in load_jsonl(LEDGER) if r["kind"] == "trade"]
    rejected = [r for r in load_jsonl(LEDGER) if r["kind"] == "rejected"]
    stats = load_jsonl(STATS)

    print("=" * 72)
    print("Polymarket 페이퍼 트레이딩 리포트")
    print("=" * 72)

    if stats:
        first, last = stats[0]["ts"], stats[-1]["ts"]
        t0 = datetime.fromisoformat(first)
        t1 = datetime.fromisoformat(last)
        hours = max((t1 - t0).total_seconds() / 3600, 1e-9)
        print(f"관측 구간 : {first} ~ {last} ({hours:.1f}시간, 스캔 {len(stats)}회)")

    if not trades:
        print("\nbooking된 페이퍼 트레이드 없음.")
    else:
        by_grade = defaultdict(list)
        for t in trades:
            by_grade[t["grade"]].append(t)

        for grade, rows in by_grade.items():
            cap = sum(r["capital_needed_usd"] for r in rows)
            pnl = sum(r["locked_profit_usd"] for r in rows)
            locks = [d for d in (lockup_days(r) for r in rows) if d is not None]
            avg_lock = sum(locks) / len(locks) if locks else float("nan")
            label = "구조적(확정)" if grade == "structural" else "조건부(망라성 확인 필요)"
            print(f"\n[{label}] {len(rows)}건")
            print(f"  투입 자본 합계   : ${cap:,.2f}")
            print(f"  고정 수익 합계   : ${pnl:,.2f}  (자본 대비 {pnl/cap*100 if cap else 0:.3f}%)")
            print(f"  평균 자금 잠김   : {avg_lock:.0f}일")
            for r in sorted(rows, key=lambda r: r["locked_profit_usd"], reverse=True)[:10]:
                ld = lockup_days(r)
                print(f"    +${r['locked_profit_usd']:>7.2f} | 자본 ${r['capital_needed_usd']:>10,.2f} | "
                      f"잠김 {ld:>5.0f}일 | {r['event_title'][:48]} [{r['type']}]")

    if rejected:
        print(f"\n검증 탈락 {len(rejected)}건 (top-of-book 신호가 실체결로 이어지지 않음)")
        reasons = defaultdict(int)
        for r in rejected:
            reasons[str(r.get("reject_reason"))[:40]] += 1
        for reason, n in sorted(reasons.items(), key=lambda x: -x[1]):
            print(f"    {n:>3}건  {reason}")

    if stats:
        with_s = sum(1 for s in stats if s["structural_arbs"])
        with_c = sum(1 for s in stats if s["conditional_arbs"])
        print(f"\n스캔 {len(stats)}회 중 구조적 기회 존재 {with_s}회 / 조건부 존재 {with_c}회")


if __name__ == "__main__":
    main()
