import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "비제휴·데이터 고지" };

export default async function DisclaimerPage() {
  const games = await getGameCatalog();
  return (
    <InfoPage
      games={games}
      title="비제휴·데이터 고지"
      intro="오름의 브랜드 관계와 데이터 해석 범위를 명확하게 안내합니다."
    >
      <div className="callout">
        <strong>
          본 서비스는 Roblox Corporation과 제휴 또는 공식 관계가 없는 독립
          서비스입니다.
        </strong>
      </div>
      <h2>상표와 게임 자산</h2>
      <p>
        Roblox 및 각 게임·제작자 명칭과 게임 아이콘은 식별 목적으로만
        표시합니다. 오름 자체 브랜드에는 Roblox 공식 로고를 사용하지
        않습니다.
      </p>
      <h2>데이터 시차</h2>
      <p>
        표시 숫자는 마지막 정상 수집 시각 기준입니다. 외부 API 장애나
        Rate Limit으로 최신 상태와 차이가 날 수 있으며 지연 상태를 별도로
        표시합니다.
      </p>
      <h2>자체 계산</h2>
      <p>
        Trend, 변화율, 커버리지와 순위는 오름이 저장한 Snapshot에서 계산한
        값이며 Roblox 공식 순위가 아닙니다. 산정 방식과 버전을 별도 공개합니다.
      </p>
    </InfoPage>
  );
}
