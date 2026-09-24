import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "커뮤니티 가이드라인",
  alternates: { canonical: "/guidelines" },
};

export default async function GuidelinesPage() {
  const games = await getGameCatalog();
  return (
    <InfoPage
      games={games}
      title="커뮤니티 가이드라인"
      intro="자유글, 질문·답변·댓글, 파티 모집에 적용하는 운영 기준입니다."
    >
      <div className="callout">
        자유글은 전체 또는 게임별로 이야기할 수 있고, 질문과 답변은 게임별로 모입니다. 게시물은 신고와 운영 검토에 따라 숨김 처리될 수 있습니다.
      </div>

      <h2>허용되는 활동</h2>
      <ul>
        <li>게임 이야기, 자랑, 추천 같은 자유글과 댓글</li><li>게임 질문과 답변, 공략, 팁, 업데이트 토론</li>
        <li>직접 확인한 방법과 출처를 밝힌 정보 공유</li>
        <li>데이터 오류 제보와 정정 요청</li>
      </ul>

      <h2>허용하지 않는 활동</h2>
      <ul>
        <li>계정·Robux·아이템 현금 거래, 사기와 대리 결제 유도</li>
        <li>핵, Executor, Exploit, 악성 스크립트 배포</li>
        <li>전화번호, 이메일, 카카오톡 ID 등 직접 연락처 공개</li>
        <li>Discord 초대 등 외부 비공개 대화로 유도하는 링크</li>
        <li>Roblox 쿠키·세션·인증 정보 공유 또는 요구</li>
        <li>성적 콘텐츠, 괴롭힘, 혐오, 사칭, 신상 공개</li>
        <li>스팸, 반복 광고, 악성 링크</li>
      </ul>

      <h2>게시 전 확인</h2>
      <p>
        자유글·질문·답변·댓글·신고에는 계정 상태 확인, 쓰기 횟수 제한과 일부
        개인정보·인증정보·외부 연락처 패턴 차단을 적용합니다. 일부 패턴은 자동으로 막지만 놓칠 수 있으므로 신고 기능과 운영 검토도 함께 사용합니다.
      </p>

      <h2>운영 조치</h2>
      <p>
        신고된 콘텐츠는 숨김 또는 복원될 수 있고, 신고 처리 상태와 운영
        사유는 별도 기록합니다. 운영자가 사용자 글 내용을 대신 고쳐 쓰는
        방식보다 원문 보존과 공개 상태 변경을 우선합니다.
      </p>
    </InfoPage>
  );
}
