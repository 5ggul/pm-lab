import { privateContact } from "@/lib/private-contact";
import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "연락처·오류 제보",
  description: "로블잼의 게임 데이터 오류, 잘못된 미디어, 권리 관련 문제를 제보하는 방법입니다.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const games = await getGameCatalog();
  const contact = privateContact();

  return (
    <InfoPage
      games={games}
      title="연락처·오류 제보"
      intro="게임 수치, 이름, 미디어, 출처가 잘못되어 있으면 확인할 수 있도록 구체적인 정보를 보내주세요."
    >
      <h2>데이터·게임 정보 오류</h2>
      <p>
        게임 이름, 로블잼의 페이지 주소, 잘못된 항목과 확인 가능한 출처를 함께
        남기면 재검수하기 쉽습니다.
      </p>
      <p>
        <a
          className="secondary-button"
          href="https://github.com/5ggul/pm-lab/issues/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          공개 오류 제보 · GitHub ↗
        </a>
      </p>

      <p>이메일, 계정 정보 등 개인정보는 공개 제보에 적지 마세요.</p>
      <h2 id="private">계정·개인정보 관련 비공개 문의</h2>
      {contact ? <p><a className="secondary-button" href={contact.href}>{contact.label} ↗</a></p>
        : <p>비공개 문의 창구가 아직 설정되지 않았습니다. 계정·개인정보 관련 요청을 공개 GitHub 제보로 보내지 마세요.</p>}
      <p>프로필 수정과 탈퇴는 <a href="/me">내 정보</a>에서 직접 진행할 수 있습니다.</p>
      <h2>이미지·영상·권리 관련 요청</h2>
      <p>
        잘못 연결된 게임 미디어나 권리 관련 문제가 있다면 대상 게임과 자료의
        위치를 비공개 문의 창구로 알려주세요. 창구가 없는 동안 개인정보가 포함된 자료를 공개 제보에 올리지 마세요.
      </p>

      <h2>계정·커뮤니티 신고</h2>
      <p>
        Q&amp;A와 파티 모집의 개별 게시물은 해당 화면의 신고 기능을 이용하는
        것이 가장 빠릅니다.
      </p>
    </InfoPage>
  );
}
