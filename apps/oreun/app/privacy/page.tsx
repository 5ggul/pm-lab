import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {title: "개인정보 처리 안내", alternates: { canonical: "/privacy" }};

export default async function PrivacyPage() {
  const games = await getGameCatalog();
  return (
    <InfoPage
      games={games}
      title="개인정보 처리 안내"
      intro="시행 기준일 2026-09-19 · 현재 Sprint 01 공개 기능 기준입니다."
    >
      <div className="callout">
        현재 공개 Preview에는 회원가입·로그인·댓글·DM 기능이 없습니다.
      </div>
      <h2>현재 서비스가 요구하지 않는 정보</h2>
      <p>
        실명, 전화번호, 학교, 정확한 위치, Roblox 비밀번호,
        <code>.ROBLOSECURITY</code>, 사용자 API Key를 요구하지 않습니다.
      </p>
      <h2>기술적으로 발생할 수 있는 정보</h2>
      <p>
        호스팅·보안 시스템의 일반적인 접속 로그에는 요청 시각, IP 주소,
        User-Agent와 같은 기술 정보가 제한적으로 포함될 수 있습니다. 이러한
        정보는 서비스 안정성·보안 목적 범위에서 다룹니다.
      </p>
      <h2>게임 데이터</h2>
      <p>
        Sprint 01에서 수집하는 Roblox 데이터는 Game 중심의 공개 경험 통계이며
        개별 Roblox 사용자의 프레즌스, 친구 그래프, 위치를 추적하지 않습니다.
      </p>
      <h2>향후 회원 기능</h2>
      <p>
        Sprint 02에서 계정 기능을 도입하기 전 수집 항목, 보유 기간, 처리 목적,
        삭제 절차와 만 14세 미만 정책을 실제 구현과 일치하도록 별도로
        확정합니다.
      </p>
    </InfoPage>
  );
}
