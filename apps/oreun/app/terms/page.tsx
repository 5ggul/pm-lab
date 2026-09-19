import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "이용약관" };

export default async function TermsPage() {
  const games = await getGameCatalog();
  return (
    <InfoPage
      games={games}
      title="이용약관"
      intro="시행 기준일 2026-09-19 · Preview 단계의 기본 이용 조건입니다."
    >
      <h2>1. 서비스 성격</h2>
      <p>
        오름은 공개적으로 접근 가능한 게임 데이터와 자체 계산 데이터를
        정리하는 독립 서비스입니다. Roblox Corporation의 공식 서비스가
        아닙니다.
      </p>
      <h2>2. 데이터 제공</h2>
      <p>
        외부 API 장애, 지연, 정책 변경에 따라 데이터가 늦거나 일시적으로
        제공되지 않을 수 있습니다. 오름은 데이터 없음과 실제 0을 구분하고,
        마지막 확인 시각을 표시하기 위해 합리적으로 노력합니다.
      </p>
      <h2>3. 금지 행위</h2>
      <p>
        서비스 방해, 자동화된 과도한 요청, 보안 우회, 악성 코드 배포, 사기,
        계정·Robux 거래 등 관련 법령 또는 플랫폼 규칙에 위배되는 사용을
        금지합니다.
      </p>
      <h2>4. 외부 서비스</h2>
      <p>
        “Roblox에서 플레이”와 같은 외부 링크를 누르면 제3자 서비스로
        이동합니다. 해당 서비스 이용에는 그 서비스의 약관과 정책이
        적용됩니다.
      </p>
      <h2>5. 변경</h2>
      <p>
        회원·커뮤니티 기능이 추가되면 실제 처리 범위에 맞춰 약관과 정책을
        발행 전에 갱신합니다.
      </p>
    </InfoPage>
  );
}
