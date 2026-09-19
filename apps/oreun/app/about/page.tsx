import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {title: "오름 소개",
  description: "오름이 어떤 데이터를 기록하고 어떤 원칙으로 Roblox 게임 정보를 보여주는지 안내합니다.",, alternates: { canonical: "/about" }};

export default async function AboutPage() {
  const games = await getGameCatalog();
  return (
    <InfoPage
      games={games}
      title="오름 소개"
      intro="게임의 현재 숫자와 변화 기록을 먼저 보여주는 독립 데이터 서비스입니다."
    >
      <div className="callout">
        <strong>Search → Data → Content → Community → Return</strong>
        <br />
        현재 Sprint는 이 흐름의 기반인 Game Data Foundation에 집중합니다.
      </div>
      <h2>무엇을 제공하나요?</h2>
      <p>
        공개 Roblox 경험 데이터를 수집해 현재 플레이 인원, 방문 수, 즐겨찾기,
        업데이트 시각을 기록하고 Hourly·Daily 히스토리로 축적합니다. 한국어
        이름과 별칭을 연결해 검색하기 쉽게 만듭니다.
      </p>
      <h2>무엇이 다른가요?</h2>
      <p>
        API 값을 그대로 복사하는 대신 수집 시각, 데이터 상태, 누락 구간,
        커버리지와 계산 버전을 함께 관리합니다. 과거 데이터가 부족하면 변화율을
        만들어내지 않습니다.
      </p>
      <h2>앞으로</h2>
      <p>
        데이터 기반 위에 코드, 공략, Q&amp;A, 게임별 커뮤니티와 파티 모집을
        단계적으로 결합합니다. 큰 자유게시판보다 Game Entity가 각 커뮤니티의
        중심이 됩니다.
      </p>
    </InfoPage>
  );
}
