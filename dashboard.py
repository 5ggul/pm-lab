# -*- coding: utf-8 -*-
"""
Polymarket 페이퍼 트레이딩 실시간 대시보드

paper_trader.py가 쌓는 paper_ledger.jsonl / scan_stats.jsonl을 읽어
브라우저에서 30초마다 자동 갱신되는 대시보드로 보여준다. 표준 라이브러리만 사용.

실행:  python dashboard.py          # http://localhost:8899
       python dashboard.py --port 8899
"""

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime
# 브라우저 preconnect가 싱글스레드 서버를 붙잡아 전체가 멈추므로 스레딩 서버 필수
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.path.dirname(os.path.abspath(__file__))
LEDGER = os.path.join(BASE, "paper_ledger.jsonl")
STATS = os.path.join(BASE, "scan_stats.jsonl")


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


def build_data():
    rows = load_jsonl(LEDGER)
    trades = [r for r in rows if r["kind"] == "trade"]
    rejected = [r for r in rows if r["kind"] == "rejected"]
    stats = load_jsonl(STATS)

    capital = sum(t["capital_needed_usd"] for t in trades)
    profit = sum(t["locked_profit_usd"] for t in trades)
    locks = [d for d in (lockup_days(t) for t in trades) if d is not None]

    # 누적 고정수익 시계열
    cum, acc = [], 0.0
    for t in trades:
        acc += t["locked_profit_usd"]
        cum.append({"ts": t["ts"], "cum_profit": round(acc, 2)})

    reject_reasons = defaultdict(int)
    for r in rejected:
        reject_reasons[str(r.get("reject_reason"))[:40]] += 1

    by_grade = defaultdict(lambda: {"n": 0, "capital": 0.0, "profit": 0.0})
    for t in trades:
        g = by_grade[t["grade"]]
        g["n"] += 1
        g["capital"] += t["capital_needed_usd"]
        g["profit"] += t["locked_profit_usd"]

    return {
        "summary": {
            "n_trades": len(trades),
            "capital_usd": round(capital, 2),
            "locked_profit_usd": round(profit, 2),
            "roi_pct": round(profit / capital * 100, 4) if capital else 0,
            "avg_lockup_days": round(sum(locks) / len(locks), 1) if locks else None,
            "n_rejected": len(rejected),
            "scans": len(stats),
            "first_scan": stats[0]["ts"] if stats else None,
            "last_scan": stats[-1]["ts"] if stats else None,
        },
        "by_grade": by_grade,
        "cum_profit": cum,
        "scan_series": [
            {"ts": s["ts"], "structural": s["structural_arbs"],
             "conditional": s["conditional_arbs"],
             "best_edge": s.get("best_structural_edge")}
            for s in stats[-500:]
        ],
        "trades": sorted(trades, key=lambda t: t["ts"], reverse=True)[:100],
        "reject_reasons": dict(reject_reasons),
    }


HTML = """<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8">
<title>Polymarket 아비트라지 — 페이퍼 트레이딩 대시보드</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  :root { --bg:#0d1117; --panel:#161b22; --border:#30363d; --text:#e6edf3;
          --dim:#8b949e; --green:#3fb950; --red:#f85149; --amber:#d29922; --blue:#58a6ff; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--text);
         font-family:'Segoe UI',Pretendard,sans-serif; padding:20px; }
  h1 { font-size:18px; font-weight:600; margin-bottom:4px; }
  .sub { color:var(--dim); font-size:12px; margin-bottom:18px; }
  .grid { display:grid; gap:14px; }
  .kpis { grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); margin-bottom:14px; }
  .card { background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:14px 16px; }
  .kpi .label { color:var(--dim); font-size:11px; letter-spacing:.5px; text-transform:uppercase; }
  .kpi .value { font-size:26px; font-weight:700; margin-top:4px; font-variant-numeric:tabular-nums; }
  .kpi .note { color:var(--dim); font-size:11px; margin-top:2px; }
  .green{color:var(--green)} .red{color:var(--red)} .amber{color:var(--amber)} .blue{color:var(--blue)}
  .charts { grid-template-columns:1fr 1fr; margin-bottom:14px; }
  .card h2 { font-size:13px; color:var(--dim); font-weight:600; margin-bottom:10px; }
  canvas { max-height:220px; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; }
  th { text-align:left; color:var(--dim); font-weight:500; padding:6px 8px; border-bottom:1px solid var(--border); }
  td { padding:6px 8px; border-bottom:1px solid #21262d; font-variant-numeric:tabular-nums; }
  .tag { padding:1px 7px; border-radius:10px; font-size:11px; }
  .tag.st { background:#1a7f3722; color:var(--green); border:1px solid #1a7f3766; }
  .tag.co { background:#9e6a0322; color:var(--amber); border:1px solid #9e6a0366; }
  .banner { background:#4d2d0322; border:1px solid #9e6a0355; color:var(--amber);
            border-radius:10px; padding:10px 14px; font-size:12.5px; margin-bottom:14px; }
  @media (max-width:900px){ .charts{grid-template-columns:1fr} }
</style></head><body>
<h1>Polymarket 아비트라지 — 페이퍼 트레이딩 대시보드</h1>
<div class="sub" id="range">로딩 중…</div>
<div class="banner">⚠️ 페이퍼 트레이딩입니다. 실주문 없음 — 아래 수익은 "그 시점에 체결했다면 확정됐을" 가상 수익입니다.</div>

<div class="grid kpis">
  <div class="card kpi"><div class="label">가상 체결</div><div class="value blue" id="k-trades">–</div><div class="note" id="k-rejected"></div></div>
  <div class="card kpi"><div class="label">고정 수익 (가상)</div><div class="value green" id="k-profit">–</div><div class="note" id="k-roi"></div></div>
  <div class="card kpi"><div class="label">필요 자본</div><div class="value" id="k-capital">–</div><div class="note" id="k-lockup"></div></div>
  <div class="card kpi"><div class="label">스캔 횟수</div><div class="value" id="k-scans">–</div><div class="note" id="k-last"></div></div>
</div>

<div class="grid charts">
  <div class="card"><h2>누적 고정 수익 (USD)</h2><canvas id="c-profit"></canvas></div>
  <div class="card"><h2>스캔별 아비트라지 기회 수</h2><canvas id="c-opps"></canvas></div>
</div>

<div class="card">
  <h2>가상 체결 내역 (최근 100건)</h2>
  <div style="overflow-x:auto"><table id="t-trades">
    <thead><tr><th>시각(UTC)</th><th>이벤트</th><th>타입</th><th>등급</th>
    <th style="text-align:right">edge/세트</th><th style="text-align:right">자본</th>
    <th style="text-align:right">고정수익</th><th style="text-align:right">잠김</th></tr></thead>
    <tbody></tbody>
  </table></div>
</div>

<script>
let cProfit, cOpps;
const fmt$ = v => '$' + Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const hhmm = ts => ts ? ts.slice(5,16).replace('T',' ') : '';

async function refresh(){
  const d = await (await fetch('/api/data')).json();
  const s = d.summary;
  document.getElementById('range').textContent =
    (s.first_scan ? `관측: ${s.first_scan} ~ ${s.last_scan}` : '데이터 없음') + ' · 30초마다 자동 갱신';
  document.getElementById('k-trades').textContent = s.n_trades;
  document.getElementById('k-rejected').textContent = `검증 탈락 ${s.n_rejected}건`;
  document.getElementById('k-profit').textContent = fmt$(s.locked_profit_usd);
  document.getElementById('k-roi').textContent = `자본 대비 ${s.roi_pct}%`;
  document.getElementById('k-capital').textContent = fmt$(s.capital_usd);
  document.getElementById('k-lockup').textContent = s.avg_lockup_days ? `평균 자금 잠김 ${s.avg_lockup_days}일` : '';
  document.getElementById('k-scans').textContent = s.scans;
  document.getElementById('k-last').textContent = s.last_scan ? `마지막 스캔 ${hhmm(s.last_scan)}` : '';

  const css = getComputedStyle(document.documentElement);
  const dim = css.getPropertyValue('--dim'), border = css.getPropertyValue('--border');
  const axis = { ticks:{color:dim,font:{size:10}}, grid:{color:border} };

  const cum = d.cum_profit;
  cProfit ??= new Chart(document.getElementById('c-profit'), {
    type:'line',
    data:{labels:[],datasets:[{data:[],borderColor:css.getPropertyValue('--green'),
      backgroundColor:'#3fb95022',fill:true,tension:.25,pointRadius:0,borderWidth:2}]},
    options:{plugins:{legend:{display:false}},scales:{x:axis,y:axis},animation:false}});
  cProfit.data.labels = cum.map(r=>hhmm(r.ts));
  cProfit.data.datasets[0].data = cum.map(r=>r.cum_profit);
  cProfit.update();

  const sc = d.scan_series;
  cOpps ??= new Chart(document.getElementById('c-opps'), {
    type:'line',
    data:{labels:[],datasets:[
      {label:'구조적(확정)',data:[],borderColor:css.getPropertyValue('--green'),pointRadius:0,borderWidth:2,tension:.25},
      {label:'조건부',data:[],borderColor:css.getPropertyValue('--amber'),pointRadius:0,borderWidth:2,tension:.25}]},
    options:{plugins:{legend:{labels:{color:dim,font:{size:11}}}},scales:{x:axis,y:axis},animation:false}});
  cOpps.data.labels = sc.map(r=>hhmm(r.ts));
  cOpps.data.datasets[0].data = sc.map(r=>r.structural);
  cOpps.data.datasets[1].data = sc.map(r=>r.conditional);
  cOpps.update();

  const tb = document.querySelector('#t-trades tbody');
  tb.innerHTML = d.trades.map(t=>{
    const lock = t.end_date ? Math.max(0,Math.round((new Date(t.end_date)-new Date(t.ts))/864e5))+'일' : '–';
    const grade = t.grade==='structural' ? '<span class="tag st">구조적</span>' : '<span class="tag co">조건부</span>';
    return `<tr><td>${hhmm(t.ts)}</td><td>${t.event_title}</td><td>${t.type}</td><td>${grade}</td>
      <td style="text-align:right">${(+t.exec_edge_per_set).toFixed(4)}</td>
      <td style="text-align:right">${fmt$(t.capital_needed_usd)}</td>
      <td style="text-align:right" class="green">+${fmt$(t.locked_profit_usd)}</td>
      <td style="text-align:right">${lock}</td></tr>`;
  }).join('');
}
refresh();
setInterval(refresh, 30000);
</script>
</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/data":
            body = json.dumps(build_data(), ensure_ascii=False).encode("utf-8")
            ctype = "application/json; charset=utf-8"
        elif self.path in ("/", "/index.html"):
            body = HTML.encode("utf-8")
            ctype = "text/html; charset=utf-8"
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # 요청 로그 소음 제거
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8899)
    args = ap.parse_args()
    print(f"대시보드: http://localhost:{args.port}  (Ctrl+C로 종료)")
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
