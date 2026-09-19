import type { Metadata } from "next";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "데이터·급상승 산정 기준",
  alternates: { canonical: "/methodology" },
};

export default async function Methodology() {
  const games = await getGameCatalog();

  return (
    <>
      <Header games={games} />
      <main className="page methodology">
        <div className="page-title">
          <h1>산정 기준</h1>
          <p>현재값과 급상승 지표가 어떻게 만들어지는지 설명합니다.</p>
        </div>

        <div className="callout">
          <strong>현재 플레이 인원과 급상승 지표는 서로 다른 값입니다.</strong>
          <br />
          현재 플레이 인원은 Roblox 공개 경험 데이터를 우선 사용하고,
          변화율과 급상승 지표는 오름이 시간대별로 저장한 관측값에서 계산합니다.
        </div>

        <h2>데이터 출처</h2>
        <p>
          게임명, 현재 플레이 인원, 방문, 즐겨찾기, 제작자와 업데이트 시각 등은
          Roblox의 공개 경험 데이터를 사용합니다. 화면에서는 외부 응답을 그대로
          노출하지 않고 게임별 식별 정보와 수집 시각을 함께 관리합니다.
        </p>

        <h2>갱신 상태</h2>
        <ul>
          <li><b>정상 갱신</b>: 기대 수집 주기 안에서 최근 응답을 확보했습니다.</li>
          <li><b>갱신 지연</b>: 마지막 정상 관측값은 있지만 목표 시각을 넘겼습니다.</li>
          <li><b>오래된 데이터</b>: 현재값으로 보기 어려운 상태입니다.</li>
          <li><b>데이터 없음</b>: 정상 관측값을 아직 확보하지 못했습니다.</li>
        </ul>
        <p>0명과 데이터 없음은 다른 상태로 처리합니다.</p>

        <h2>플레이어 추이</h2>
        <p>
          시간대별 관측값을 모아 기간별 추이를 계산합니다. 수집 신뢰도가 낮은
          구간은 정상 추이선에서 제외하고, 관측이 끊긴 구간을 0명으로 채우거나
          임의로 연결하지 않습니다. 기간별 데이터가 충분하지 않으면 변화율 대신
          수집 중 상태를 표시합니다.
        </p>

        <h2>급상승 산정</h2>
        <p>
          단순 현재 인기순과 상승 흐름을 구분합니다. 상대 성장률만 큰 소규모
          게임이 무조건 상위에 오르지 않도록 현재 규모, 변화량, 관측 신뢰도와
          최근 업데이트 시각을 함께 반영합니다.
        </p>
        <ul>
          <li>절대 모멘텀 30%</li>
          <li>상대 성장 25%</li>
          <li>기준 플레이 규모 15%</li>
          <li>데이터 커버리지 10%</li>
          <li>업데이트 신선도 10%</li>
          <li>사이트 내 이용 신호 10% — 데이터가 부족하면 제외하고 나머지 가중치를 재계산</li>
        </ul>
        <p>
          상대 성장률에는 최소 기준값과 상한을 적용해 극단적인 비율 변화가 전체
          순위를 왜곡하지 않도록 합니다.
        </p>
      </main>
    </>
  );
}
