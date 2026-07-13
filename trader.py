# -*- coding: utf-8 -*-
"""
Polymarket 아비트라지 실거래 봇 (4단계)

전략: 24시간 내 정산되는 negRisk 멀티아웃컴 이벤트의 구조적 아비트라지(SHORT_ALL)만.
  - 전체 YES bid 합 > $1 이면 모든 아웃컴의 NO를 FAK(즉시 체결, 잔량 취소)로 매수
  - 정산 시 최소 N-1개의 NO가 $1이 되므로 진입가 합 < N-1 이면 차익 확정

안전장치:
  - 기본 dry-run: 주문 생성 직전까지 계산하고 "보낼 주문 목록"만 출력, 전송 0건
  - --live 일 때만 실주문. 실행 시 'yes' 타이핑 확인 필수
  - --budget 상한 (기본 $10) 초과 자본이 필요한 기회는 자동 스킵
  - 세트당 실체결 edge(버퍼 차감 후) ≤ 0 이면 스킵
  - 최소 주문 수량(주당 5주) 미달이면 스킵
  - 같은 이벤트 재진입 금지 (live_state.json)

사용:
  python trader.py                  # dry-run 1회
  python trader.py --loop 120       # dry-run 상시
  python trader.py --live --loop 120   # ★ 실주문 (사용자 본인이 직접 실행)

필요 .env:
  POLY_PRIVATE_KEY=0x...   (지갑 프라이빗 키)
  POLY_FUNDER=0x...        (Polymarket 프로필의 지갑 주소 = 입금 주소)
"""

import argparse
import json
import math
import os
import sys
import time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from scanner import fetch_events, screen_event, fetch_book, walk_levels, now_iso
from paper_trader import hours_to_end

BASE = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE, ".env")
STATE_PATH = os.path.join(BASE, "live_state.json")
LOG_PATH = os.path.join(BASE, "live_trades.jsonl")

CLOB_HOST = "https://clob.polymarket.com"
CHAIN_ID = 137          # Polygon
MIN_SHARES = 5          # CLOB 최소 주문 수량


def load_env():
    env = {}
    if not os.path.exists(ENV_PATH):
        sys.exit(".env 파일 없음 — README 참고")
    with open(ENV_PATH, encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {"done_events": []}


def save_state(st):
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(st, f, ensure_ascii=False, indent=1)


def log_jsonl(rec):
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def make_client(env):
    # CLOB V2 (2026-04-28 이후 필수). 신형 스마트지갑 계정은 signature_type=3 (EIP-1271)
    from py_clob_client_v2.client import ClobClient
    funder = env.get("POLY_FUNDER")
    sig_type = int(env.get("POLY_SIG_TYPE", "3"))
    if not (funder and funder.startswith("0x") and len(funder) == 42):
        sys.exit("POLY_FUNDER(Polymarket 지갑 주소) 필요")
    client = ClobClient(CLOB_HOST, chain_id=CHAIN_ID, key=env["POLY_PRIVATE_KEY"],
                        signature_type=sig_type, funder=funder)
    client.set_api_creds(client.create_or_derive_api_key())
    return client


def usdc_balance(client):
    from py_clob_client_v2.clob_types import BalanceAllowanceParams, AssetType
    p = BalanceAllowanceParams(asset_type=AssetType.COLLATERAL)
    try:
        client.update_balance_allowance(p)
    except Exception:
        pass
    r = client.get_balance_allowance(p)
    return float(r.get("balance", 0)) / 1e6


def plan_short_all(cand, budget, buffer):
    """
    SHORT_ALL 기회 → 실행 계획.
    각 다리: NO 토큰을 (1 - YES bid) 가격에 매수. 오더북 깊이로 실체결가 계산,
    예산 내 최대 세트 수 산정. 반환: 주문 리스트 or None(사유 포함).
    """
    legs = cand["legs"]
    n = len(legs)

    # 오더북 실체결가 확인 (YES bids → NO asks 미러)
    books = []
    for leg in legs:
        if not leg["token_yes"]:
            return None, "토큰ID 없음"
        try:
            book = fetch_book(leg["token_yes"])
        except Exception as e:
            return None, f"오더북 조회 실패: {e}"
        bids = sorted(book.get("bids") or [], key=lambda x: float(x["price"]), reverse=True)
        if not bids:
            return None, f"'{leg['question'][:30]}' bid 없음"
        books.append(bids)
        time.sleep(0.12)

    # 세트당 비용 상한 → 예산 내 세트 수 (최소 주문 수량 이상)
    top_cost_per_set = sum(1 - float(b[0]["price"]) for b in books)
    if top_cost_per_set <= 0:
        return None, "비용 계산 이상"
    sets = math.floor(budget / top_cost_per_set)
    if sets < MIN_SHARES:
        return None, (f"예산 부족: 세트당 ${top_cost_per_set:.2f} × 최소 {MIN_SHARES}세트 "
                      f"= ${top_cost_per_set*MIN_SHARES:.2f} > 예산 ${budget:.2f}")

    # 깊이 반영 실체결가로 edge 재계산
    exec_sum_yes = 0.0
    orders = []
    for leg, bids in zip(legs, books):
        avg_bid, filled = walk_levels(
            [{"price": b["price"], "size": b["size"]} for b in bids], sets)
        if avg_bid is None:
            return None, f"'{leg['question'][:30]}' 깊이 부족 ({filled:.0f}/{sets}주)"
        exec_sum_yes += avg_bid
        no_price = round(1 - avg_bid, 3)
        orders.append({"question": leg["question"], "token_yes": leg["token_yes"],
                       "no_price": no_price, "shares": sets})

    edge = exec_sum_yes - 1.0 - buffer
    cost = (n - exec_sum_yes) * sets
    if edge <= 0:
        return None, f"실체결 edge {edge:+.4f} ≤ 0"
    return {"orders": orders, "sets": sets, "edge_per_set": round(edge, 4),
            "cost_usd": round(cost, 2), "profit_usd": round(edge * sets, 2)}, None


def execute(client, cand, plan, live):
    """계획을 주문으로 변환. live=False면 출력만."""
    from py_clob_client_v2.clob_types import OrderArgsV2, OrderType
    from py_clob_client_v2.order_builder.constants import BUY

    results = []
    for o in plan["orders"]:
        # NO 토큰 매수 = YES 토큰을 bid에 매도와 동일하지만, 잔고에 YES가 없으므로
        # NO 토큰을 직접 매수한다. NO 토큰ID는 시장의 두 번째 토큰.
        no_token = cand["token_no_map"][o["token_yes"]]
        desc = (f"BUY NO {o['shares']}주 @ {o['no_price']} | {o['question'][:44]}")
        if not live:
            print(f"    [DRY-RUN] {desc}")
            results.append({"dry_run": True, **o})
            continue
        args = OrderArgsV2(token_id=no_token, price=o["no_price"],
                           size=float(o["shares"]), side=BUY)
        resp = client.create_and_post_order(args, order_type=OrderType.FAK)
        ok = bool(resp.get("success", False)) if isinstance(resp, dict) else False
        print(f"    [LIVE] {desc} → {'체결요청 OK' if ok else 'FAIL'} {resp.get('errorMsg','')}")
        results.append({"dry_run": False, "resp_success": ok,
                        "order_id": resp.get("orderID"), **o})
        time.sleep(0.3)
    return results


def scan_and_trade(client, args, state):
    events = fetch_events(args.min_liquidity, args.max_events)
    neg = [e for e in events if e.get("negRisk") and len(e.get("markets", [])) >= 2]
    cands = []
    for e in neg:
        for c in screen_event(e, args.buffer):
            if (c["grade"] == "structural" and c["is_arb"]
                    and (h := hours_to_end(c)) is not None and h <= args.max_hours):
                # NO 토큰ID 매핑 준비
                token_no_map = {}
                for m in e.get("markets", []):
                    try:
                        toks = json.loads(m.get("clobTokenIds") or "[]")
                        if len(toks) == 2:
                            token_no_map[toks[0]] = toks[1]
                    except ValueError:
                        pass
                c["token_no_map"] = token_no_map
                cands.append(c)

    print(f"[{now_iso()}] 24h 내 구조적 아비트라지 {len(cands)}건")
    for c in sorted(cands, key=lambda c: c["edge"], reverse=True):
        if c["event_slug"] in state["done_events"]:
            continue
        if any(t not in c["token_no_map"] for t in
               (l["token_yes"] for l in c["legs"] if l["token_yes"])):
            continue
        plan, why = plan_short_all(c, args.budget, args.buffer)
        title = c["event_title"][:50]
        if not plan:
            print(f"  스킵: {title} — {why}")
            continue
        print(f"  ▶ {title}: {plan['sets']}세트, 자본 ${plan['cost_usd']}, "
              f"edge {plan['edge_per_set']:+.4f}/세트, 기대차익 ${plan['profit_usd']}")
        results = execute(client, c, plan, args.live)
        log_jsonl({"ts": now_iso(), "live": args.live, "event": c["event_title"],
                   "slug": c["event_slug"], "plan": {k: v for k, v in plan.items()
                                                     if k != "orders"},
                   "orders": results})
        if args.live:
            state["done_events"].append(c["event_slug"])
            save_state(state)


def main():
    ap = argparse.ArgumentParser(description="Polymarket 아비트라지 실거래 봇")
    ap.add_argument("--live", action="store_true", help="실주문 모드 (기본 dry-run)")
    ap.add_argument("--budget", type=float, default=10.0, help="기회당 최대 투입 USD (기본 10)")
    ap.add_argument("--max-hours", type=float, default=24)
    ap.add_argument("--min-liquidity", type=float, default=10000)
    ap.add_argument("--max-events", type=int, default=600)
    ap.add_argument("--buffer", type=float, default=0.005)
    ap.add_argument("--loop", type=int, default=0, help="반복 간격 초 (0=1회)")
    args = ap.parse_args()

    env = load_env()
    if not env.get("POLY_PRIVATE_KEY", "").startswith("0x"):
        sys.exit("POLY_PRIVATE_KEY 형식 오류")
    if args.live and not env.get("POLY_FUNDER"):
        sys.exit("--live 모드는 .env에 POLY_FUNDER(Polymarket 지갑 주소) 필요")

    print(f"모드: {'★ LIVE (실주문)' if args.live else 'DRY-RUN (전송 없음)'} | "
          f"예산/기회 ${args.budget}")
    if args.live:
        if input("실제 자금으로 주문합니다. 계속하려면 yes 입력: ").strip().lower() != "yes":
            sys.exit("취소됨")

    client = make_client(env)
    print(f"CLOB 연결 OK | 서버시간 {client.get_server_time()}")
    try:
        bal = usdc_balance(client)
        print(f"USDC 잔고: ${bal:.2f}")
        if args.live and bal < 1:
            sys.exit("잔고 부족 — 입금 확인 필요")
    except Exception as e:
        print(f"잔고 조회 실패 (POLY_FUNDER 확인 필요): {e}")
        if args.live:
            sys.exit(1)

    state = load_state()
    while True:
        try:
            scan_and_trade(client, args, state)
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"[{now_iso()}] 오류, 계속: {type(e).__name__}: {e}")
        if not args.loop:
            break
        time.sleep(args.loop)


if __name__ == "__main__":
    main()
