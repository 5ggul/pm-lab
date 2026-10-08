import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {title: "커뮤니티 가이드라인", alternates: { canonical: "/guidelines" }};

export default async function GuidelinesPage() {
  const games = await getGameCatalog();
  return (
    <InfoPage
      games={games}
      title="커뮤니티 가이드라인"
      intro="후속 Sprint의 질문·댓글·파티 기능에 동일하게 적용할 기본 운영 기준입니다."
    >
      <div className="callout">
        현재 Sprint 01에는 사용자 게시글 기능이 공개되어 있지 않습니다. 아래
        기준은 커뮤니티 기능을 열기 전부터 고정하는 안전 원칙입니다.
      </div>
      <h2>허용되는 활동</h2>
      <ul>
        <li>게임 질문과 답변, 공략, 팁, 업데이트 토론</li>
        <li>게임 플레이를 위한 공개 파티 모집</li>
        <li>출처를 밝힌 오류 제보와 데이터 정정 요청</li>
      </ul>
      <h2>허용하지 않는 활동</h2>
      <ul>
        <li>계정·Robux·아이템 현금 거래 및 사기</li>
        <li>핵, Executor, Exploit, 악성 스크립트 배포</li>
        <li>전화번호, 이메일, 카카오톡 ID, 정확한 위치 등 개인정보 공유</li>
        <li>성적 콘텐츠, 괴롭힘, 혐오, 사칭, 신상 공개</li>
        <li>스팸, 반복 광고, 악성 링크</li>
      </ul>
      <h2>파티 모집</h2>
      <p>
        파티 글은 만료 시간을 가지며 공개 게시글을 기본으로 합니다. 초기
        서비스에서는 1:1 DM과 외부 연락처 교환을 기본 기능으로 제공하지
        않습니다.
      </p>
      <h2>운영 조치</h2>
      <p>
        신고된 콘텐츠는 위험도에 따라 제한·숨김·삭제될 수 있습니다. 운영
        조치는 작성자, 시각, 사유를 Audit 가능한 형태로 기록하는 것을
        원칙으로 합니다.
      </p>
    </InfoPage>
  );
}
