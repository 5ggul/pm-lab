import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "이용약관",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const games = await getGameCatalog();
  return (
    <InfoPage
      games={games}
      title="이용약관"
      intro="시행 기준일 2026-09-21 · 현재 서비스 범위의 기본 이용 조건입니다."
    >
      <h2>1. 서비스 성격</h2>
      <p>
        로블잼은 공개적으로 접근 가능한 게임 데이터, 자체 계산 데이터와
        게임별 Q&A를 제공하는 독립 서비스입니다. Roblox Corporation의 공식
        서비스가 아닙니다.
      </p>

      <h2>2. 외부 데이터</h2>
      <p>
        외부 API 장애, 지연, 정책 변경에 따라 게임 데이터가 늦거나
        일시적으로 제공되지 않을 수 있습니다. 데이터 없음과 실제 0은
        구분하고 마지막 확인 시각을 표시하는 것을 원칙으로 합니다.
      </p>

      <h2>3. 계정·커뮤니티</h2>
      <p>
        신규 계정은 Google 로그인으로 인증하며, 질문·답변·댓글·파티 등
        커뮤니티 쓰기 기능에는 만 14세 이상 자기 확인이 추가로 필요합니다.
        Google 로그인만으로 연령 확인이 완료되는 것은 아닙니다. 이용자는
        자신이 게시하는 내용에 책임이 있으며 가이드라인을 따라야 합니다.
        신고 또는 안전상 필요에 따라 콘텐츠 노출이 제한될 수 있습니다.
      </p>

      <h2>4. 금지 행위</h2>
      <p>
        서비스 방해, 보안 우회, 자동화된 과도한 요청, 사기, 계정·Robux
        거래, 개인정보 노출, 악성 코드·Exploit 배포 등 관련 규칙을 해치는
        사용을 금지합니다.
      </p>

      <h2>5. 외부 서비스</h2>
      <p>
        “Roblox에서 플레이”와 같은 링크는 제3자 서비스로 이동합니다.
        로그인에는 Google과 Supabase Auth가 사용될 수 있습니다. 각 외부
        서비스에는 해당 서비스의 약관과 개인정보 정책이 적용됩니다.
      </p>
    </InfoPage>
  );
}
