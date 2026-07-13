# -*- coding: utf-8 -*-
"""
Polymarket 아비트라지 페이퍼 트레이더 (2단계)

scanner.py를 재사용해 주기적으로 스캔하고, 검출된 아비트라지를
실오더북 기준으로 '가상 체결'해 장부(paper_ledger.jsonl)에 기록한다.
실제 주문은 단 한 건도 내지 않는다. 목적은 단 하나 —
"이 전략이 하루에 실제로 몇 건 / 총 얼마를 잡을 수 있는가"의 측정.

기록 원칙:
  - 아비트라지는 진입 시점에 손익이 확정되므로, 체결 시뮬레이션이 성공하면
    그 시점의 exec edge로 수익을 장부에 고정한다.
  - 같은 기회(event_slug + type)는 한 번만 booking (재출현해도 중복 기록 안 함).
  - 구조적(structural)과 조건부(conditional)는 분리 집계할 수 있게 grade를 남긴다.
  - 스캔마다 scan_stats.jsonl에 시장 전반 통계도 남긴다 (기회 밀도 추적).

사용:
  python paper_trader.py                     # 기본 5분 간격 무한 루프
  python paper_trader.py --interval 180 --size 100 --min-liquidity 20000
  python paper_trader.py --once              # 1사이클만 (테스트)

결과 확인:
  python report.py
"""

import argparse
import json
import os
import time
from datetime import datetime, timezone

from scanner import (
    fetch_events, screen_event, verify_with_books, now_iso,
)

LEDGER = "paper_ledger.jsonl"
STATS = "scan_stats.jsonl"
STATE = "paper_state.json"


def load_state():
    if os.path.exists(STATE):
        with open(STATE, encoding="utf-8") as f:
            return json.load(f)
    return {"booked_keys": []}


def save_state(state):
    with open(STATE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=1)


def append_jsonl(path, rec):
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def hours_to_end(candidate):
    if not candidate.get("end_date"):
        return None
    try:
        end = datetime.fromisoformat(candidate["end_date"].replace("Z", "+00:00"))
        return (end - datetime.now(timezone.utc)).total_seconds() / 3600
    except ValueError:
        return None


def cycle(args, state):
    ts = now_iso()
    events = fetch_events(args.min_liquidity, args.max_events)
    neg_risk = [e for e in events if e.get("negRisk") and len(e.get("markets", [])) >= 2]

    candidates = []
    for e in neg_risk:
        candidates.extend(screen_event(e, args.buffer))

    # 자금 잠김 제한: 정산까지 max_hours 이내인 이벤트만 (0 이하면 필터 없음)
    if args.max_hours > 0:
        candidates = [c for c in candidates
                      if (h := hours_to_end(c)) is not None and h <= args.max_hours]

    structural = [c for c in candidates if c["is_arb"] and c["grade"] == "structural"]
    conditional = [c for c in candidates
                   if c["is_arb"] and c["grade"] == "conditional"
                   and not c["likely_false_positive"]]

    append_jsonl(STATS, {
        "ts": ts,
        "events": len(events),
        "neg_risk_events": len(neg_risk),
        "structural_arbs": len(structural),
        "conditional_arbs": len(conditional),
        "best_structural_edge": max((c["edge"] for c in structural), default=None),
        "best_conditional_edge": max((c["edge"] for c in conditional), default=None),
    })

    todo = (sorted(structural, key=lambda c: c["edge"], reverse=True)
            + sorted(conditional, key=lambda c: c["edge"], reverse=True))

    booked, skipped_dup, failed = 0, 0, 0
    for c in todo[: args.verify_limit]:
        key = f"{c['event_slug']}|{c['type']}"
        if key in state["booked_keys"]:
            skipped_dup += 1
            continue
        v = verify_with_books(c, args.size, buffer=args.buffer)
        if not v or v.get("error") or v["exec_edge_per_set"] <= 0:
            failed += 1
            # 검증 실패도 기록 (top-of-book 신호가 얼마나 허수인지 측정용)
            append_jsonl(LEDGER, {
                "ts": ts, "kind": "rejected", "key": key,
                "event_title": c["event_title"], "type": c["type"], "grade": c["grade"],
                "screen_edge": c["edge"],
                "reject_reason": (v or {}).get("error", "실체결 edge ≤ 0"),
                "exec_edge_per_set": (v or {}).get("exec_edge_per_set"),
            })
            continue
        state["booked_keys"].append(key)
        booked += 1
        append_jsonl(LEDGER, {
            "ts": ts, "kind": "trade", "key": key,
            "event_title": c["event_title"], "type": c["type"], "grade": c["grade"],
            "n_outcomes": c["n_outcomes"],
            "end_date": c.get("end_date"),
            "screen_edge": c["edge"],
            "exec_edge_per_set": v["exec_edge_per_set"],
            "sets": v["sets"],
            "capital_needed_usd": v["capital_needed_usd"],
            "locked_profit_usd": v["expected_profit_usd"],
        })

    save_state(state)
    print(f"[{ts}] 스캔: 구조적 {len(structural)} / 조건부 {len(conditional)} | "
          f"신규 booking {booked} | 중복 스킵 {skipped_dup} | 검증 탈락 {failed}")


def main():
    ap = argparse.ArgumentParser(description="Polymarket 아비트라지 페이퍼 트레이더")
    ap.add_argument("--interval", type=int, default=300, help="스캔 간격 초 (기본 300)")
    ap.add_argument("--min-liquidity", type=float, default=20000)
    ap.add_argument("--max-events", type=int, default=600)
    ap.add_argument("--buffer", type=float, default=0.005)
    ap.add_argument("--size", type=float, default=100, help="세트 수량=주식수 (기본 100)")
    ap.add_argument("--verify-limit", type=int, default=10, help="사이클당 오더북 검증 상한")
    ap.add_argument("--max-hours", type=float, default=0,
                    help="정산까지 남은 시간 상한 (예: 24 = 하루 내 정산 마켓만, 0 = 제한 없음)")
    ap.add_argument("--once", action="store_true", help="1사이클만 실행")
    args = ap.parse_args()

    state = load_state()
    print(f"페이퍼 트레이더 시작 | 간격 {args.interval}s | 장부: {LEDGER} | 기존 booking {len(state['booked_keys'])}건")

    while True:
        try:
            cycle(args, state)
        except Exception as e:  # 네트워크 등 일시 오류는 다음 주기에 재시도
            print(f"[{now_iso()}] 오류, 다음 주기 재시도: {e}")
        if args.once:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
