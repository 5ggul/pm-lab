# -*- coding: utf-8 -*-
"""
Polymarket 단기 크립토 Up/Down 마켓 워처 + 페이퍼 트레이더 (3단계)

바이럴 글들이 주장하는 "5분/15분 Up/Down 봇" 엣지가 우리 폴링 속도(수 초)에서
실존하는지 측정한다. 실주문 없음 — 전부 가상 체결.

측정 3축:
  1. 시세지연 괴리 (stale quote): Binance 실시간가 기반 공정확률 vs 폴리마켓 호가.
     공정확률 p_up = Φ( ln(S/K) / (σ·√T) )  — K=윈도우 시가, σ=최근 1분봉 변동성
     edge = 공정확률 − 실체결가(VWAP) − 수수료. 임계 초과 시 가상 매수 → 윈도우 종료 시
     Binance 종가로 정산해 승률·손익 측정. (실제 정산은 Chainlink — 오차 존재, 캐비앳)
  2. 시점분리 페어 (temporal arb): 윈도우 내에서 관측된 Up 최저 체결가 + Down 최저
     체결가 합의 최소값 기록. 합 < $1 이면 "시점을 나눠 샀다면 무위험 세트 가능했다"
     — 단, 두 시점 사이 방향 리스크를 진 대가라는 점이 본질.
  3. 마감 직전 스나이핑 관측: 종료 N초 전 우세 아웃컴 호가가 99¢ 미만인 빈도 기록만.
     (1¢ 먹으려고 99¢ 리스크 지는 전략이라 가상 체결도 하지 않음 — 관측만)

사용:
  python updown_watcher.py                          # BTC 5m+15m, 폴링 4초
  python updown_watcher.py --assets btc,eth --windows 300,900 --poll 4
  python updown_watcher.py --edge 0.04 --fee 0.01 --size 10

출력:
  updown_trades.jsonl   가상 체결 + 정산 결과 (전략 1)
  updown_windows.jsonl  윈도우별 요약: 페어 최저합, 스나이핑 관측, 괴리 통계
  updown_positions.json 미정산 포지션 (재시작 안전)
"""

import argparse
import json
import math
import os
import sys
import time
from datetime import datetime, timezone

import requests

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

GAMMA = "https://gamma-api.polymarket.com"
CLOB = "https://clob.polymarket.com"
BINANCE = "https://api.binance.com/api/v3"
COINBASE = "https://api.exchange.coinbase.com"

# binance(기본) | coinbase — GitHub Actions 등 미국 IP에서는 Binance가 막히므로 coinbase 사용
PRICE_SOURCE = os.environ.get("PRICE_SOURCE", "binance")

TRADES = "updown_trades.jsonl"
WINDOWS = "updown_windows.jsonl"
POSITIONS = "updown_positions.json"

SYMBOL = {"btc": "BTCUSDT", "eth": "ETHUSDT", "sol": "SOLUSDT"}
CB_SYMBOL = {"btc": "BTC-USD", "eth": "ETH-USD", "sol": "SOL-USD"}
INTERVAL = {300: "5m", 900: "15m", 3600: "1h"}
SLUG = {("btc", 300): "btc-updown-5m", ("btc", 900): "btc-updown-15m",
        ("eth", 300): "eth-updown-5m", ("eth", 900): "eth-updown-15m",
        ("btc", 3600): "btc-updown-hourly", ("eth", 3600): "eth-updown-hourly",
        ("sol", 300): "sol-updown-5m", ("sol", 900): "sol-updown-15m"}

session = requests.Session()
session.headers.update({"User-Agent": "updown-watcher/1.0"})


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def append_jsonl(path, rec):
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def norm_cdf(x):
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


# ---------- 데이터 ----------

def spot_price(asset):
    if PRICE_SOURCE == "coinbase":
        r = session.get(f"{COINBASE}/products/{CB_SYMBOL[asset]}/ticker", timeout=8)
        r.raise_for_status()
        return float(r.json()["price"])
    r = session.get(f"{BINANCE}/ticker/price", params={"symbol": SYMBOL[asset]}, timeout=8)
    r.raise_for_status()
    return float(r.json()["price"])


def kline_open_close(asset, win, start_epoch):
    """해당 윈도우 캔들의 (시가, 종가). 진행 중이면 종가는 현재가."""
    if PRICE_SOURCE == "coinbase":
        # Coinbase 캔들: [time, low, high, open, close, volume]
        iso = lambda t: datetime.fromtimestamp(t, tz=timezone.utc).isoformat()
        r = session.get(f"{COINBASE}/products/{CB_SYMBOL[asset]}/candles",
                        params={"granularity": win, "start": iso(start_epoch),
                                "end": iso(start_epoch + win)}, timeout=8)
        r.raise_for_status()
        rows = [k for k in r.json() if k[0] == start_epoch]
        if not rows:
            return None, None
        return float(rows[0][3]), float(rows[0][4])
    r = session.get(f"{BINANCE}/klines",
                    params={"symbol": SYMBOL[asset], "interval": INTERVAL[win],
                            "startTime": start_epoch * 1000, "limit": 1}, timeout=8)
    r.raise_for_status()
    k = r.json()
    if not k:
        return None, None
    return float(k[0][1]), float(k[0][4])


def minute_vol(asset, cache={}, ttl=300):
    """최근 120개 1분봉 로그수익률 표준편차 (분당 σ). 5분 캐시."""
    ent = cache.get(asset)
    if ent and time.time() - ent[0] < ttl:
        return ent[1]
    if PRICE_SOURCE == "coinbase":
        r = session.get(f"{COINBASE}/products/{CB_SYMBOL[asset]}/candles",
                        params={"granularity": 60}, timeout=8)
        r.raise_for_status()
        closes = [float(k[4]) for k in sorted(r.json())[-120:]]
    else:
        r = session.get(f"{BINANCE}/klines",
                        params={"symbol": SYMBOL[asset], "interval": "1m", "limit": 120}, timeout=8)
        r.raise_for_status()
        closes = [float(k[4]) for k in r.json()]
    rets = [math.log(b / a) for a, b in zip(closes, closes[1:]) if a > 0]
    mean = sum(rets) / len(rets)
    var = sum((x - mean) ** 2 for x in rets) / max(len(rets) - 1, 1)
    sigma = math.sqrt(var)
    cache[asset] = (time.time(), sigma)
    return sigma


def find_market(asset, win, start_epoch, cache={}):
    """윈도우 시작 epoch로 마켓 조회 → (Up 토큰ID, 이벤트 슬러그). 결과 캐시."""
    key = (asset, win, start_epoch)
    if key in cache:
        return cache[key]
    slug = f"{SLUG[(asset, win)]}-{start_epoch}"
    r = session.get(f"{GAMMA}/events", params={"slug": slug}, timeout=10)
    evs = r.json() if r.ok else []
    if not evs or not evs[0].get("markets"):
        cache[key] = None
        return None
    m = evs[0]["markets"][0]
    try:
        token_up = json.loads(m["clobTokenIds"])[0]
    except (KeyError, ValueError, IndexError):
        cache[key] = None
        return None
    cache[key] = (token_up, slug)
    return cache[key]


def up_book(token_up):
    """Up 토큰 오더북 → (asks 최저가순, bids 최고가순). 실패 시 None."""
    r = session.get(f"{CLOB}/book", params={"token_id": token_up}, timeout=8)
    if not r.ok:
        return None
    b = r.json()
    asks = sorted(([float(x["price"]), float(x["size"])] for x in b.get("asks", [])))
    bids = sorted(([float(x["price"]), float(x["size"])] for x in b.get("bids", [])),
                  reverse=True)
    if not asks or not bids:
        return None
    return asks, bids


def vwap_fill(levels, shares):
    filled, cost = 0.0, 0.0
    for p, s in levels:
        take = min(s, shares - filled)
        cost += take * p
        filled += take
        if filled >= shares - 1e-9:
            return cost / shares
    return None


# ---------- 상태 ----------

def load_positions():
    if os.path.exists(POSITIONS):
        with open(POSITIONS, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_positions(pos):
    with open(POSITIONS, "w", encoding="utf-8") as f:
        json.dump(pos, f, ensure_ascii=False, indent=1)


# ---------- 메인 루프 ----------

def run(args):
    assets = args.assets.split(",")
    wins = [int(w) for w in args.windows.split(",")]
    positions = load_positions()
    win_stats = {}   # (asset,win,epoch) -> 윈도우 관측 통계
    pnl_total, n_win, n_lose = 0.0, 0, 0

    print(f"Up/Down 워처 시작 | {assets} × {[INTERVAL[w] for w in wins]} | "
          f"edge 임계 {args.edge} | 수수료 가정 {args.fee}/주 | 페이퍼 전용")

    while True:
        loop_t0 = time.time()
        now = int(time.time())
        try:
            for asset in assets:
                spot = spot_price(asset)
                sigma = minute_vol(asset)

                for win in wins:
                    start = now - now % win
                    remain_s = start + win - now
                    if remain_s < args.min_remain:
                        continue  # 마감 임박 윈도우는 신규 진입 금지

                    mk = find_market(asset, win, start)
                    if not mk:
                        continue
                    token_up, slug = mk
                    open_px, _ = kline_open_close(asset, win, start)
                    if not open_px:
                        continue
                    book = up_book(token_up)
                    if not book:
                        continue
                    asks, bids = book

                    # 공정확률
                    t_min = remain_s / 60.0
                    if sigma <= 0 or t_min <= 0:
                        continue
                    d = math.log(spot / open_px) / (sigma * math.sqrt(t_min))
                    p_up = norm_cdf(d)

                    # 실체결가 (VWAP, 미러북: Down ask = 1 - Up bid)
                    up_cost = vwap_fill(asks, args.size)
                    down_cost_src = vwap_fill(bids, args.size)
                    down_cost = (1 - down_cost_src) if down_cost_src else None

                    # 윈도우 통계 갱신 (temporal arb / 스나이핑 관측)
                    wkey = f"{asset}|{win}|{start}"
                    st = win_stats.setdefault(wkey, {
                        "asset": asset, "win": win, "start": start, "slug": slug,
                        "min_up_cost": 9, "min_down_cost": 9, "obs": 0,
                        "max_abs_edge": 0, "snipe_obs": None})
                    st["obs"] += 1
                    if up_cost:
                        st["min_up_cost"] = min(st["min_up_cost"], up_cost)
                    if down_cost:
                        st["min_down_cost"] = min(st["min_down_cost"], down_cost)
                    if remain_s <= 15 and st["snipe_obs"] is None:
                        fav_cost = up_cost if p_up >= 0.5 else down_cost
                        st["snipe_obs"] = {"p_up": round(p_up, 3),
                                           "fav_cost": round(fav_cost, 3) if fav_cost else None,
                                           "remain_s": remain_s}

                    # 전략 1: 괴리 가상 진입 (윈도우당 1회)
                    open_here = any(p["wkey"] == wkey for p in positions)
                    if not open_here:
                        for side, cost in (("Up", up_cost), ("Down", down_cost)):
                            if cost is None:
                                continue
                            fair = p_up if side == "Up" else 1 - p_up
                            edge = fair - cost - args.fee
                            st["max_abs_edge"] = max(st["max_abs_edge"], round(edge, 4))
                            if edge >= args.edge:
                                pos = {"ts": now_iso(), "wkey": wkey, "slug": slug,
                                       "asset": asset, "win": win, "start": start,
                                       "side": side, "shares": args.size,
                                       "entry_cost": round(cost, 4),
                                       "fair_at_entry": round(fair, 4),
                                       "edge_at_entry": round(edge, 4),
                                       "spot": spot, "open_px": open_px,
                                       "sigma_min": round(sigma, 6),
                                       "remain_s": remain_s}
                                positions.append(pos)
                                save_positions(positions)
                                append_jsonl(TRADES, {**pos, "kind": "entry"})
                                print(f"[{now_iso()}] 진입 {asset}/{INTERVAL[win]} {side} "
                                      f"{args.size}주 @ {cost:.3f} (fair {fair:.3f}, "
                                      f"edge {edge:+.3f}, 잔여 {remain_s}s)")
                                break

            # 정산: 종료 지난 포지션 → Binance 종가로 판정
            still = []
            for p in positions:
                end_t = p["start"] + p["win"]
                if now < end_t + args.settle_delay:
                    still.append(p)
                    continue
                o, c = kline_open_close(p["asset"], p["win"], p["start"])
                if o is None:
                    still.append(p)
                    continue
                up_won = c >= o
                won = (p["side"] == "Up") == up_won
                pnl = p["shares"] * ((1 - p["entry_cost"]) if won else -p["entry_cost"]) \
                    - p["shares"] * args.fee
                pnl_total += pnl
                n_win += won
                n_lose += (not won)
                append_jsonl(TRADES, {**p, "kind": "settle", "settle_ts": now_iso(),
                                      "close_px": c, "up_won": up_won, "won": won,
                                      "pnl_usd": round(pnl, 4)})
                print(f"[{now_iso()}] 정산 {p['asset']}/{INTERVAL[p['win']]} {p['side']} "
                      f"→ {'승' if won else '패'} {pnl:+.3f} | 누적 {pnl_total:+.2f} "
                      f"({n_win}승 {n_lose}패)")
            if len(still) != len(positions):
                positions = still
                save_positions(positions)

            # 끝난 윈도우 통계 기록
            for wkey in list(win_stats):
                st = win_stats[wkey]
                if now >= st["start"] + st["win"] + args.settle_delay:
                    pair = (st["min_up_cost"] + st["min_down_cost"]
                            if st["min_up_cost"] < 9 and st["min_down_cost"] < 9 else None)
                    append_jsonl(WINDOWS, {
                        "ts": now_iso(), **st,
                        "temporal_pair_min": round(pair, 4) if pair else None,
                        "temporal_arb_possible": bool(pair and pair < 1 - args.fee * 2)})
                    del win_stats[wkey]

        except requests.RequestException as e:
            print(f"[{now_iso()}] 네트워크 오류, 계속: {e}")
        except Exception as e:
            print(f"[{now_iso()}] 오류, 계속: {type(e).__name__}: {e}")

        time.sleep(max(0.5, args.poll - (time.time() - loop_t0)))


def main():
    ap = argparse.ArgumentParser(description="Polymarket Up/Down 워처 (페이퍼 전용)")
    ap.add_argument("--assets", default="btc", help="btc,eth,sol (기본 btc)")
    ap.add_argument("--windows", default="300,900", help="윈도우 초: 300,900,3600")
    ap.add_argument("--poll", type=float, default=4, help="폴링 간격 초 (기본 4)")
    ap.add_argument("--size", type=float, default=10, help="가상 주문 주식 수 (기본 10)")
    ap.add_argument("--edge", type=float, default=0.04, help="진입 edge 임계 (기본 0.04)")
    ap.add_argument("--fee", type=float, default=0.01,
                    help="주당 수수료 가정 (기본 0.01 — 실제 테이커 수수료 확인 필요)")
    ap.add_argument("--min-remain", type=int, default=45,
                    help="잔여 N초 미만 윈도우 신규 진입 금지 (기본 45)")
    ap.add_argument("--settle-delay", type=int, default=10, help="종료 후 정산 대기 초")
    args = ap.parse_args()
    run(args)


if __name__ == "__main__":
    main()
