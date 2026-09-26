import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "청소년 보호 원칙", alternates: { canonical: "/youth" } };
export default async function YouthPage() {
 const games = await getGameCatalog();
 return <InfoPage games={games} title="청소년 보호 원칙" intro="미성년 이용자가 많은 게임 생태계를 전제로 안전 기능과 게시 규칙을 운영합니다.">
  <h2>가입·작성 기준</h2><p>게임 정보는 로그인 없이 볼 수 있고, 질문·답변·댓글·파티 작성은 Google 로그인한 활성 계정에서 이용할 수 있습니다. 생년월일, 실명, 학교, 정확한 위치는 가입 필수 정보로 요구하지 않습니다.</p>
  <h2>제품 경계</h2><ul><li>1:1 DM 기능을 제공하지 않습니다.</li><li>전화번호·이메일·카카오톡·Telegram·Discord 초대 패턴을 제한합니다.</li><li>Roblox 세션 쿠키와 인증정보 공유를 제한합니다.</li><li>신고 기능과 운영 큐를 질문·답변·댓글에 연결합니다.</li></ul>
  <h2>유해 행위</h2><p>성적 콘텐츠, 개인정보 노출, 괴롭힘, 사기, 계정·현금 거래, 핵·Exploit 배포와 악성 링크는 허용하지 않습니다. 신고가 접수된 콘텐츠는 운영 검토를 통해 숨김·복원·신고 종결 상태로 관리할 수 있습니다.</p>
 </InfoPage>;
}
