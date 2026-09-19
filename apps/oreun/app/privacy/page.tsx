import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "개인정보 처리 안내",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const games = await getGameCatalog();
  return (
    <InfoPage
      games={games}
      title="개인정보 처리 안내"
      intro="시행 기준일 2026-09-19 · 현재 서비스 구조 기준입니다."
    >
      <div className="callout">
        오름은 게임 데이터와 커뮤니티 계정 데이터를 분리합니다. Roblox 로그인
        정보, .ROBLOSECURITY, 사용자 Roblox API Key는 요구하지 않습니다.
      </div>

      <h2>계정</h2>
      <p>
        로그인 기능은 Supabase Auth를 사용합니다. 가입 시 이메일과 비밀번호가
        인증 서비스로 전달되며, 오름 애플리케이션 데이터베이스에는 평문
        비밀번호를 저장하지 않습니다. 공개 프로필에는 자동 생성 아이디,
        사용자가 설정한 표시 이름과 소개만 저장합니다.
      </p>

      <h2>만 14세 이상 확인</h2>
      <p>
        커뮤니티 쓰기 기능을 열기 위한 “만 14세 이상” 자기 확인값을
        저장합니다. 이 값은 공개 프로필 테이블에 두지 않고 내부 계정 상태와
        함께 별도 보관합니다. 생년월일은 요구하지 않습니다.
      </p>

      <h2>커뮤니티 활동</h2>
      <p>
        질문, 답변, 댓글, 게임 팔로우, 알림 상태, 신고 내용과 필요한 운영
        조치 기록이 저장될 수 있습니다. 공개 글의 작성자 아이디와 표시 이름은
        다른 이용자에게 보입니다. 신고·운영 정보와 개인 알림은 본인 또는
        권한이 있는 운영자만 접근하도록 데이터베이스 정책을 적용합니다.
      </p>

      <h2>기술 로그</h2>
      <p>
        호스팅·보안 시스템에서 요청 시각, IP 주소, User-Agent 등 일반적인
        기술 로그가 발생할 수 있습니다. 서비스 안정성, 장애 분석과 보안
        목적으로 필요한 범위에서 다룹니다.
      </p>

      <h2>게임 데이터</h2>
      <p>
        오름의 Roblox 데이터 수집은 Game/Experience 중심의 공개 통계입니다.
        개별 Roblox 사용자의 비밀번호, 친구 그래프, 정확한 위치를 수집하지
        않습니다.
      </p>
    </InfoPage>
  );
}
