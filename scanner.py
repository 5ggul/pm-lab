# -*- coding: utf-8 -*-
"""
Polymarket 멀티아웃컴(negRisk) 아비트라지 스캐너 v1

원리:
  상호배타적 아웃컴 N개짜리 이벤트에서
  - LONG_ALL_YES : 모든 아웃컴 YES 최우선매도호가(ask) 합 < $1
                   → 전부 사면 정확히 하나가 $1로 정산되어 차익 확정
                   (단, 아웃컴 목록이 '전체를 커버(exhaustive)'해야 성립)
  - SHORT_ALL    : 모든 아웃컴 YES 최우선매수호가(bid) 합 > $1
                   → 모든 아웃컴의 NO를 사면 (NO ask = 1 - YES bid)
                   비용 N - sum(bids), 정산 최소 N-1 → sum(bids) - 1 만큼 차익
                   ('최대 하나만 YES'인 negRisk 구조에서는 exhaustive 아니어도 성립)

  Gamma API의 top-of-book(bestBid/bestAsk)으로 1차 스크리닝 후,
  후보에 한해 CLOB 오더북을 직접 읽어 목표 수량 기준 실체결가를 재계산한다.

사용:
  python scanner.py                     # 1회 스캔
  python scanner.py --loop 300          # 300초 간격 무한 스캔
  python scanner.py --min-liquidity 5000 --size 100 --top 15

출력:
  콘솔 요약 + opportunities.jsonl (기회 레코드 누적, 페이퍼 트레이딩 입력용)
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone

import requests

# Windows cp949 콘솔에서 한글/특수문자 출력 깨짐 방지
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

GAMMA_API = "https://gamma-api.polymarket.com"
CLOB_API = "https://clob.polymarket.com"

session = requests.Session()
session.headers.update({"User-Agent": "polymarket-arb-scanner/1.0"})


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def fetch_events(min_liquidity, max_events):
    """활성 이벤트를 유동성 내림차순으로 페이지네이션 수집."""
    events, offset, limit = [], 0, 100
    while len(events) < max_events:
        r = session.get(
            f"{GAMMA_API}/events",
            params={
                "closed": "false",
                "active": "true",
                "limit": limit,
                "offset": offset,
                "order": "liquidity",
                "ascending": "false",
            },
            timeout=30,
        )
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        for e in batch:
            if (e.get("liquidity") or 0) and float(e.get("liquidity") or 0) < min_liquidity:
                # 유동성 내림차순이므로 기준 미달이 나오면 이후는 전부 미달
                return events
            events.append(e)
        if len(batch) < limit:
            break
        offset += limit
    return events[:max_events]


def parse_multi_outcome(event):
    """negRisk 이벤트에서 (마켓, YES 토큰ID, bid, ask) 목록 추출. 호가 없는 다리는 None."""
    legs = []
    for m in event.get("markets", []):
        if m.get("closed") or not m.get("active"):
            continue
        try:
            token_yes = json.loads(m.get("clobTokenIds") or "[]")[0]
        except (ValueError, IndexError):
            token_yes = None
        legs.append({
            "question": m.get("question"),
            "token_yes": token_yes,
            "bid": m.get("bestBid"),
            "ask": m.get("bestAsk"),
        })
    return legs


def screen_event(event, buffer):
    """top-of-book 기준 1차 스크리닝. 기회 후보 리스트 반환."""
    legs = parse_multi_outcome(event)
    if len(legs) < 2:
        return []

    candidates = []
    asks = [l["ask"] for l in legs]
    bids = [l["bid"] for l in legs]

    if all(a is not None and a > 0 for a in asks):
        sum_asks = sum(asks)
        edge = 1.0 - sum_asks - buffer
        # LONG_ALL_YES는 아웃컴이 전체를 커버(exhaustive)해야만 확정 차익.
        # 합이 1에서 크게 모자라면(edge가 크면) 사실상 '나열 안 된 결과로 끝날'
        # 비망라 이벤트라는 뜻이므로 가짜 아비트라지로 본다.
        candidates.append({
            "type": "LONG_ALL_YES",
            "grade": "conditional",
            "sum": round(sum_asks, 4),
            "edge": round(edge, 4),
            "is_arb": edge > 0,
            "likely_false_positive": edge > 0.05,
            "caveat": "아웃컴 목록이 exhaustive해야 확정 차익 — 수동 확인 필수",
        })

    if all(b is not None and b > 0 for b in bids):
        sum_bids = sum(bids)
        edge = sum_bids - 1.0 - buffer
        # SHORT_ALL은 negRisk('최대 하나만 YES') 구조만으로 성립 → 구조적 확정 차익
        candidates.append({
            "type": "SHORT_ALL",
            "grade": "structural",
            "sum": round(sum_bids, 4),
            "edge": round(edge, 4),
            "is_arb": edge > 0,
            "likely_false_positive": False,
            "caveat": None,
        })

    for c in candidates:
        c.update({
            "event_slug": event.get("slug"),
            "event_title": event.get("title"),
            "end_date": event.get("endDate"),
            "n_outcomes": len(legs),
            "liquidity": float(event.get("liquidity") or 0),
            "volume24hr": float(event.get("volume24hr") or 0),
            "legs": legs,
        })
    return candidates


def fetch_book(token_id):
    r = session.get(f"{CLOB_API}/book", params={"token_id": token_id}, timeout=15)
    r.raise_for_status()
    return r.json()


def walk_levels(levels, shares_wanted):
    """호가 레벨을 걸어가며 shares_wanted 체결 시 평균단가. 부족하면 (None, 채운수량)."""
    filled, cost = 0.0, 0.0
    for lv in levels:
        p, s = float(lv["price"]), float(lv["size"])
        take = min(s, shares_wanted - filled)
        cost += take * p
        filled += take
        if filled >= shares_wanted - 1e-9:
            return cost / shares_wanted, shares_wanted
    return None, filled


def verify_with_books(cand, size_usd, buffer=0.0, pause=0.15):
    """
    후보 기회를 CLOB 실오더북으로 재계산.
    size_usd: 세트당 목표 투입액 기준으로 세트 수(주식 수) 결정.
    LONG_ALL_YES → 각 다리 YES asks 워킹.
    SHORT_ALL    → NO 매수 = YES에 bid로 매도와 동일하므로 각 다리 YES bids 워킹.
    """
    shares = max(1.0, size_usd)  # 1세트 = 아웃컴당 1주, $1 정산 기준 → size_usd주
    detail, exec_sum = [], 0.0
    side = "asks" if cand["type"] == "LONG_ALL_YES" else "bids"

    for leg in cand["legs"]:
        if not leg["token_yes"]:
            return None
        try:
            book = fetch_book(leg["token_yes"])
        except requests.RequestException as e:
            return {"error": f"book fetch 실패: {e}", "leg": leg["question"]}
        levels = book.get(side) or []
        # CLOB은 bids를 낮은가격→높은가격으로 줄 때가 있어 정렬 보정
        levels = sorted(levels, key=lambda x: float(x["price"]), reverse=(side == "bids"))
        avg, filled = walk_levels(levels, shares)
        if avg is None:
            return {
                "error": "깊이 부족",
                "leg": leg["question"],
                "wanted_shares": shares,
                "available_shares": filled,
            }
        exec_sum += avg
        detail.append({"leg": leg["question"], "avg_price": round(avg, 4)})
        time.sleep(pause)

    if cand["type"] == "LONG_ALL_YES":
        edge = 1.0 - exec_sum - buffer
        cost = exec_sum * shares
    else:
        edge = exec_sum - 1.0 - buffer
        n = len(cand["legs"])
        cost = (n - exec_sum) * shares

    return {
        "exec_sum": round(exec_sum, 4),
        "exec_edge_per_set": round(edge, 4),
        "sets": shares,
        "capital_needed_usd": round(cost, 2),
        "expected_profit_usd": round(edge * shares, 2),
        "legs_detail": detail,
    }


def scan_once(args, log_path):
    t0 = time.time()
    events = fetch_events(args.min_liquidity, args.max_events)
    neg_risk = [e for e in events if e.get("negRisk") and len(e.get("markets", [])) >= 2]

    all_candidates = []
    for e in neg_risk:
        all_candidates.extend(screen_event(e, args.buffer))

    structural = [c for c in all_candidates if c["is_arb"] and c["grade"] == "structural"]
    conditional = [c for c in all_candidates
                   if c["is_arb"] and c["grade"] == "conditional" and not c["likely_false_positive"]]
    false_pos = [c for c in all_candidates if c["is_arb"] and c.get("likely_false_positive")]
    near = sorted((c for c in all_candidates if c["grade"] == "structural"),
                  key=lambda c: c["edge"], reverse=True)[: args.top]

    print(f"\n[{now_iso()}] 스캔 완료 ({time.time()-t0:.1f}s)")
    print(f"  이벤트 {len(events)}개 (유동성 ≥ ${args.min_liquidity:,.0f}) | 멀티아웃컴 {len(neg_risk)}개 | "
          f"구조적 아비트라지 {len(structural)}건 | 조건부 {len(conditional)}건 | "
          f"비망라 추정 제외 {len(false_pos)}건")

    arbs = structural + conditional
    verified_records = []
    if arbs:
        print(f"\n  ★ 아비트라지 감지 — CLOB 오더북으로 실체결 검증 (세트당 ${args.size})")
        # 구조적 아비트라지 우선, 그다음 조건부 (각각 edge 내림차순)
        order = (sorted(structural, key=lambda c: c["edge"], reverse=True)
                 + sorted(conditional, key=lambda c: c["edge"], reverse=True))
        for c in order[: args.verify_limit]:
            v = verify_with_books(c, args.size, buffer=args.buffer)
            c["verification"] = v
            verified_records.append(c)
            tag = "구조적" if c["grade"] == "structural" else "조건부(망라성 수동확인 필요)"
            title = f"{c['event_title']} [{c['type']}/{tag}]"
            if v and not v.get("error"):
                print(f"    {title}: top-of-book edge {c['edge']:+.4f} → "
                      f"실체결 edge {v['exec_edge_per_set']:+.4f}/세트, "
                      f"필요자본 ${v['capital_needed_usd']:,.2f}, "
                      f"기대차익 ${v['expected_profit_usd']:,.2f}")
            else:
                err = (v or {}).get("error", "검증 불가")
                print(f"    {title}: edge {c['edge']:+.4f} → 검증 실패 ({err})")
    else:
        print("\n  아비트라지 없음. 구조적(SHORT_ALL) edge 상위 (0에 가까울수록 근접):")
        for c in near:
            print(f"    {c['edge']:+.4f}  {c['type']:<13} n={c['n_outcomes']:<3} "
                  f"${c['liquidity']:>12,.0f}  {c['event_title'][:60]}")

    # JSONL 로깅: 확정 아비트라지 전건 + near-miss 상위
    ts = now_iso()
    with open(log_path, "a", encoding="utf-8") as f:
        for c in (verified_records or []) + [c for c in near if not c["is_arb"]]:
            rec = {k: v for k, v in c.items() if k != "legs"}
            rec["ts"] = ts
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    return len(arbs)


def main():
    ap = argparse.ArgumentParser(description="Polymarket negRisk 아비트라지 스캐너")
    ap.add_argument("--min-liquidity", type=float, default=10000, help="이벤트 최소 유동성 USD (기본 10000)")
    ap.add_argument("--max-events", type=int, default=1000, help="최대 수집 이벤트 수 (기본 1000)")
    ap.add_argument("--buffer", type=float, default=0.005, help="가스/슬리피지 버퍼 (기본 0.005)")
    ap.add_argument("--size", type=float, default=100, help="검증용 세트 수량=주식수 (기본 100)")
    ap.add_argument("--top", type=int, default=10, help="near-miss 표시/로깅 상위 N (기본 10)")
    ap.add_argument("--verify-limit", type=int, default=5, help="스캔당 오더북 검증 최대 건수 (기본 5)")
    ap.add_argument("--loop", type=int, default=0, help="반복 간격 초 (0이면 1회)")
    args = ap.parse_args()

    log_path = "opportunities.jsonl"
    print(f"Polymarket 아비트라지 스캐너 시작 | 로그: {log_path}")

    while True:
        try:
            scan_once(args, log_path)
        except requests.RequestException as e:
            print(f"[{now_iso()}] API 오류, 다음 주기에 재시도: {e}", file=sys.stderr)
        except KeyboardInterrupt:
            print("\n종료")
            return
        if not args.loop:
            break
        time.sleep(args.loop)


if __name__ == "__main__":
    main()
