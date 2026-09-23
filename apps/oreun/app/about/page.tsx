import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "로블잼 소개",
  description: "로블잼에서 Roblox 게임을 찾고 현재 플레이 인원, 최근 변화, 공식 미디어와 게임별 정보를 확인하는 방법을 안내합니다.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const games = await getGameCatalog();
  return (
    <InfoPage
      games={games}
      title="로블잼 소개"
      intro="Roblox 게임을 찾고, 지금 얼마나 플레이하는지와 최근 변화를 한곳에서 확인하는 한국어 게임 허브입니다."
    >
      <h2>게임을 고를 때 필요한 것부터</h2>
      <p>
        현재 플레이 인원, 장르, 최대 인원, 최근 업데이트, 공식 이미지와 영상을
        함께 보여줍니다. 영문 이름뿐 아니라 한국어 별칭으로도 게임을
        찾을 수 있습니다.
      </p>

      <h2>시간에 따라 어떻게 변했는지도</h2>
      <p>
        로블잼이 직접 쌓은 시간대별 기록으로 플레이 인원 변화를 확인합니다.
        관측이 부족한 구간은 정상 추이처럼 이어 붙이지 않고, 충분한 기록이
        쌓이지 않은 기간은 수집 중으로 표시합니다.
      </p>

      <h2>게임마다 이어지는 정보</h2>
      <p>
        게임 상세에서 공식 미디어를 본 뒤 Roblox로 바로 이동하거나, 업데이트
        기록·검증된 코드·공략·Q&amp;A·파티 모집으로 이어갈 수 있습니다.
        공개할 내용이 없는 메뉴를 억지로 채우지 않습니다.
      </p>

      <h2>Roblox 비제휴 서비스</h2>
      <p>
        로블잼은 Roblox Corporation의 공식 서비스가 아닙니다. 게임명, 이미지,
        영상과 공개 게임 정보의 권리는 각 권리자에게 있습니다.
      </p>
    </InfoPage>
  );
}
