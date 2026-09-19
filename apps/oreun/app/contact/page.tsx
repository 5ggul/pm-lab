import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "연락처·오류 제보",
  description: "오름의 게임 데이터 오류, 잘못된 미디어, 권리 관련 문제를 제보하는 방법입니다.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const games = await getGameCatalog();

  return (
    <InfoPage
      games={games}
      title="연락처·오류 제보"
      intro="게임 수치, 이름, 미디어, 출처가 잘못되어 있으면 확인할 수 있도록 구체적인 정보를 보내주세요."
    >
      <h2>데이터·게임 정보 오류</h2>
      <p>
        게임 이름, 오름의 페이지 주소, 잘못된 항목과 확인 가능한 출처를 함께
        남기면 재검수하기 쉽습니다.
      </p>
      <p>
        <a
          className="secondary-button"
          href="https://github.com/5ggul/pm-lab/issues/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          오류 제보하기 ↗
        </a>
      </p>

      <h2>이미지·영상·권리 관련 요청</h2>
      <p>
        잘못 연결된 게임 미디어나 권리 관련 문제가 있다면 대상 게임과 자료의
        위치를 함께 알려주세요. 확인 후 필요한 조치를 검토합니다.
      </p>

      <h2>계정·커뮤니티 신고</h2>
      <p>
        Q&amp;A와 파티 모집의 개별 게시물은 해당 화면의 신고 기능을 이용하는
        것이 가장 빠릅니다.
      </p>
    </InfoPage>
  );
}
