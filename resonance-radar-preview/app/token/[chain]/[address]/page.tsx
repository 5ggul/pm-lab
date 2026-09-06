import Link from "next/link";
import { TopNav } from "../../../../components/TopNav";
import { getRadarSnapshot } from "../../../../lib/radar";

export const dynamic = "force-dynamic";

const money = (value: number | null) => {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${value < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export default async function TokenPage({ params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;
  const snapshot = await getRadarSnapshot();
  const row = snapshot.signals.find((signal) => signal.chain === decodeURIComponent(chain) && signal.tokenAddress === decodeURIComponent(address));

  return (
    <>
      <TopNav />
      <main className="shell page-grid">
        <Link href="/" className="backlink">← Live Radar</Link>
        {!row ? (
          <div className="panel"><div className="empty">현재 Radar snapshot에서 이 토큰을 찾지 못했습니다.</div></div>
        ) : (
          <>
            <section className="detail-head">
              <div className="detail-title">
                <span className="token-icon" style={{ width: 48, height: 48 }}>{row.symbol.slice(0, 2)}</span>
                <div><h1>{row.symbol}</h1><div className="muted" style={{ fontSize: 11 }}>{row.chain} · {row.tokenAddress}</div></div>
              </div>
              <div className="hero-side"><span className={`score ${row.score >= 85 ? "hot" : row.score >= 70 ? "mid" : "low"}`}>{row.score}</span><span className="badge">{row.signalType}</span></div>
            </section>

            <section className="detail-columns">
              <div className="metric"><span>5m buyers</span><strong>{row.buyers5m}</strong></div>
              <div className="metric"><span>15m buyers</span><strong>{row.buyers15m}</strong></div>
              <div className="metric"><span>60m buyers</span><strong>{row.buyers60m}</strong></div>
              <div className="metric"><span>15m sellers</span><strong>{row.sellers15m}</strong></div>
              <div className="metric"><span>15m net flow</span><strong className={row.netFlow15m >= 0 ? "flow-up" : "flow-down"}>{row.netFlow15m >= 0 ? "+" : ""}{money(row.netFlow15m)}</strong></div>
              <div className="metric"><span>Top traders</span><strong>{row.topTraders}</strong></div>
            </section>

            <section className="section-grid">
              <div className="panel">
                <div className="panel-head"><div><div className="panel-title">Flow breakdown</div><div className="panel-sub">15분 rolling window</div></div></div>
                <div className="panel-body health-list">
                  <div className="health-row"><span className="health-label">Buy volume</span><span className="health-value flow-up">{money(row.buyVolume15m)}</span></div>
                  <div className="health-row"><span className="health-label">Sell volume</span><span className="health-value flow-down">{money(row.sellVolume15m)}</span></div>
                  <div className="health-row"><span className="health-label">Net</span><span className={`health-value ${row.netFlow15m >= 0 ? "flow-up" : "flow-down"}`}>{money(row.netFlow15m)}</span></div>
                  <div className="health-row"><span className="health-label">Liquidity</span><span className="health-value">{money(row.liquidityUsd)}</span></div>
                  <div className="health-row"><span className="health-label">Market cap</span><span className="health-value">{money(row.marketCapUsd)}</span></div>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head"><div><div className="panel-title">Risk flags</div><div className="panel-sub">점수와 별도로 확인</div></div></div>
                <div className="panel-body">
                  {row.flags.length === 0 ? <span className="badge live">No active flags</span> : <div className="hero-side" style={{ justifyContent: "flex-start" }}>{row.flags.map((flag) => <span className="badge warn" key={flag}>{flag}</span>)}</div>}
                </div>
              </div>
            </section>
          </>
        )}
        <footer className="footer">신호는 관측된 거래 흐름을 요약한 지표이며 투자 자문이 아닙니다.</footer>
      </main>
    </>
  );
}
