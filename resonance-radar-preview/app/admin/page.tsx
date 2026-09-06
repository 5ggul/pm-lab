import { TopNav } from "../../components/TopNav";

export default function AdminPage() {
  return (
    <>
      <TopNav />
      <main className="shell page-grid">
        <div><div className="eyebrow">operator setup</div><h1 style={{ fontSize: 42 }}>Admin / Wiring</h1><p className="muted">프리뷰에서는 쓰기 기능을 잠가두고 연결 상태와 필요한 환경변수만 보여줍니다.</p></div>
        <div className="section-grid">
          <section className="panel">
            <div className="panel-head"><div><div className="panel-title">Vercel web environment</div><div className="panel-sub">Dashboard reads only</div></div></div>
            <div className="panel-body"><pre className="code">SUPABASE_URL=...{"\n"}SUPABASE_ANON_KEY=...</pre></div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><div className="panel-title">Cloudflare Worker secrets</div><div className="panel-sub">Collector + alerts</div></div></div>
            <div className="panel-body"><pre className="code">SUPABASE_URL=...{"\n"}SUPABASE_SERVICE_ROLE_KEY=...{"\n"}DATA_PROVIDER_URL=...{"\n"}DATA_PROVIDER_KEY=...{"\n"}TELEGRAM_BOT_TOKEN=...{"\n"}TELEGRAM_CHAT_ID=...</pre></div>
          </section>
        </div>
        <div className="notice">외부 FOMO 데이터 API의 실제 응답 스키마가 확정되면 <strong>worker/src/provider.ts</strong>의 normalize 함수 한 곳만 수정하도록 어댑터를 분리해 두었습니다.</div>
        <footer className="footer">Service role key와 provider key는 브라우저에 노출하지 않습니다.</footer>
      </main>
    </>
  );
}
