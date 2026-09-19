import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "청소년 보호 원칙" };

export default async function YouthPage() {
  const games = await getGameCatalog();
  return (
    <InfoPage
      games={games}
      title="청소년 보호 원칙"
      intro="미성년 이용자가 많은 게임 생태계를 전제로 제품 기능을 제한합니다."
    >
      <h2>현재 단계</h2>
      <p>
        Sprint 01은 읽기 중심 데이터 서비스이며 회원·DM·파티 채팅 기능을
        제공하지 않습니다.
      </p>
      <h2>회원 기능 도입 시</h2>
      <ul>
        <li>만 14세 미만 계정 가입을 초기 정책상 받지 않습니다.</li>
        <li>실명·학교·정확한 위치 등 불필요한 개인정보를 요구하지 않습니다.</li>
        <li>1:1 DM을 초기 핵심 기능으로 만들지 않습니다.</li>
        <li>전화번호·이메일·카카오톡·Discord 초대 패턴을 제한합니다.</li>
      </ul>
      <h2>유해 행위</h2>
      <p>
        성적 콘텐츠, 개인정보 노출, 괴롭힘, 사기, 계정 거래, 현금 거래,
        핵·Exploit 배포는 허용하지 않습니다. 고위험 신고는 공개 상태를
        유지한 채 방치하지 않는 운영 구조를 적용합니다.
      </p>
    </InfoPage>
  );
}
