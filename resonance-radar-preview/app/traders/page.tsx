import { TopNav } from "../../components/TopNav";

const demo = [
  ["Trader A", 92, "+38.4%", "71%", 48],
  ["Trader B", 87, "+24.1%", "67%", 33],
  ["Trader C", 81, "+19.8%", "64%", 41],
  ["Trader D", 76, "+12.6%", "59%", 27]
];

export default function TradersPage() {
  return (
    <>
      <TopNav />
      <main className="shell page-grid">
        <div><div className="eyebrow">quality layer</div><h1 style={{ fontSize: 42 }}>Tracked Traders</h1><p className="muted">공진 점수에서 단순 인원 수보다 중요한 트레이더 품질 레이어입니다. 현재 프리뷰에서는 예시 데이터만 표시합니다.</p></div>
        <div className="panel">
          <div className="table-wrap" style={{ border: 0, borderRadius: 0, boxShadow: "none" }}>
            <table style={{ minWidth: 720 }}>
              <thead><tr><th>Trader</th><th>Quality score</th><th>30D PnL</th><th>30D Win rate</th><th>30D Trades</th></tr></thead>
              <tbody>{demo.map(([name, score, pnl, win, count]) => <tr key={String(name)}><td><strong>{name}</strong></td><td><span className={`score ${Number(score) >= 85 ? "hot" : "mid"}`}>{score}</span></td><td className="flow-up">{pnl}</td><td>{win}</td><td>{count}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <footer className="footer">실데이터 단계에서는 수익률·승률·거래 횟수·최근 활동·과거 공진 적중률을 정규화해 Quality Score로 계산합니다.</footer>
      </main>
    </>
  );
}
