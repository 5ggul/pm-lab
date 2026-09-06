import { TopNav } from "../../components/TopNav";

export default function AdminPage() {
  return (
    <>
      <TopNav />
      <main className="shell page-grid">
        <div>
          <div className="eyebrow">operator setup</div>
          <h1 style={{ fontSize: 42 }}>Admin / Wiring</h1>
          <p className="muted">프리뷰에서는 브라우저에 비밀키를 넣지 않습니다. 실시간 수집과 watchlist 변경은 Cloudflare Worker의 보호된 endpoint에서 처리합니다.</p>
        </div>

        <div className="section-grid">
          <section className="panel">
            <div className="panel-head"><div><div className="panel-title">Vercel web environment</div><div className="panel-sub">Dashboard read-only</div></div></div>
            <div className="panel-body"><pre className="code">SUPABASE_URL=...{"\n"}SUPABASE_ANON_KEY=...</pre></div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><div className="panel-title">Cloudflare Worker secrets</div><div className="panel-sub">Real-time collector + alerts</div></div></div>
            <div className="panel-body"><pre className="code">SUPABASE_URL=...{"\n"}SUPABASE_SERVICE_ROLE_KEY=...{"\n"}HELIUS_API_KEY=...{"\n"}HELIUS_WEBHOOK_URL=https://.../webhook/helius{"\n"}HELIUS_WEBHOOK_AUTH=...{"\n"}TELEGRAM_BOT_TOKEN=...{"\n"}TELEGRAM_CHAT_ID=...{"\n"}COLLECTOR_SECRET=...</pre></div>
          </section>
        </div>

        <section className="panel">
          <div className="panel-head"><div><div className="panel-title">Live data activation</div><div className="panel-sub">Solana · Helius push-first</div></div></div>
          <div className="panel-body health-list">
            <div className="health-row"><span className="health-label">1</span><span className="health-value">Supabase에서 schema.sql 실행</span></div>
            <div className="health-row"><span className="health-label">2</span><span className="health-value">Worker secrets 등록 후 배포</span></div>
            <div className="health-row"><span className="health-label">3</span><span className="health-value">POST /watchlist 로 추적 지갑 추가</span></div>
            <div className="health-row"><span className="health-label">4</span><span className="health-value">POST /helius/sync 로 Helius webhook 주소 목록 동기화</span></div>
            <div className="health-row"><span className="health-label">5</span><span className="health-value">거래 확정 → Webhook → DEX market enrichment → Score → Telegram</span></div>
          </div>
        </section>

        <div className="notice">
          <strong>속도 원칙:</strong> Helius Webhook이 주 수집원이고, Cloudflare의 매 1분 Cron은 5m/15m/60m rolling window가 거래가 없을 때도 정확히 감쇠되도록 재계산합니다. 별도 FOMO/Fomoscope polling API를 연결하면 같은 Cron이 누락 복구용 fallback으로도 작동합니다.
        </div>

        <div className="notice">
          <strong>FOMO 신원 레이어:</strong> FomoScan/FomoAPI 등에서 확보한 검증 지갑을 watchlist에 넣습니다. API 공급처가 바뀌어도 Helius 온체인 감시·DEX 시장 데이터·공진 점수는 그대로 유지됩니다.
        </div>

        <footer className="footer">Service role, Helius key, Telegram token과 collector secret은 브라우저 번들에 포함하지 않습니다.</footer>
      </main>
    </>
  );
}
