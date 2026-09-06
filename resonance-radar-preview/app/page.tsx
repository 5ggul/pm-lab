import { LiveRadar } from "../components/LiveRadar";
import { TopNav } from "../components/TopNav";
import { getRadarSnapshot } from "../lib/radar";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initial = await getRadarSnapshot();
  return (
    <>
      <TopNav />
      <main className="shell">
        <LiveRadar initial={initial} />
        <footer className="footer">데이터 모니터링 도구입니다. 투자 권유 또는 수익을 보장하지 않습니다. Preview는 robots noindex 및 X-Robots-Tag noindex가 적용되어 있습니다.</footer>
      </main>
    </>
  );
}
