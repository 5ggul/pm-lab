import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getGameCatalog } from "@/lib/catalog";
import { privacyRetentionStatement } from "@/lib/privacy-retention";
import { privateContact } from "@/lib/private-contact";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"개인정보 처리 안내",alternates:{canonical:"/privacy"}};
export default async function PrivacyPage(){const games=await getGameCatalog();const retention=privacyRetentionStatement();const contact=privateContact();return <InfoPage games={games} title="개인정보 처리 안내" intro="시행 기준일 2026-09-23 · 현재 서비스 구조 기준입니다.">
 <div className="callout">로블잼은 게임 데이터와 커뮤니티 계정 데이터를 분리합니다. Roblox 로그인 정보, .ROBLOSECURITY, 사용자 Roblox API Key는 요구하지 않습니다.</div>
 <h2>Google 로그인·계정</h2><p>신규 계정 로그인은 Google OAuth와 Supabase Auth를 사용합니다. 인증 과정에서 Google 계정의 식별자, 이메일과 기본 프로필 정보가 Supabase Auth에 전달될 수 있습니다. 로블잼은 Google 비밀번호를 받거나 저장하지 않으며 Google Drive, Gmail, 연락처 같은 추가 Google 데이터 접근 권한을 요청하지 않습니다.</p><p>로블잼의 공개 프로필은 Google 프로필과 별도로 관리합니다. 자동 생성 아이디와 사용자가 직접 설정한 표시 이름·소개를 저장하며, Google 프로필 이름이나 사진을 공개 프로필에 자동 게시하지 않습니다. 이메일·비밀번호 로그인은 제공하지 않습니다.</p>
 <h2>커뮤니티 활동</h2><p>자유글·자유글 댓글, 질문, 답변, 댓글, 게임 팔로우, 알림 상태, 신고 내용과 필요한 운영 조치 기록이 저장될 수 있습니다. 공개 글의 작성자 아이디와 표시 이름은 다른 이용자에게 보입니다. 신고·운영 정보와 개인 알림은 본인 또는 권한이 있는 운영자만 접근하도록 데이터베이스 정책을 적용합니다.</p>
 <h2>회원 탈퇴와 작성글</h2><p>내 정보의 회원 탈퇴 메뉴에서 Google로 본인을 다시 확인한 뒤 탈퇴할 수 있습니다. 로블잼 인증 계정·프로필·팔로우·개인 알림·신고를 삭제하고, 직접 쓴 자유글·자유글 댓글·질문·답변·댓글 원문은 삭제 안내로 바꿉니다. 작성자 연결은 제거합니다. 해당 글에 다른 이용자가 쓴 답변과 댓글은 함께 지우지 않습니다. 본인이 연 파티는 닫고 모집 내용과 링크를 삭제합니다. 실제로 삭제를 확인하기 전에는 이 처리를 실행하지 않습니다.</p><p>서비스 데이터베이스의 삭제와 호스팅 백업·보안 로그의 보관은 별개입니다. 운영 권한이 있는 계정은 먼저 권한을 정리해야 합니다.</p>
 <h2>이 기기에 보관하는 초안</h2><p>작성 중인 글은 해당 브라우저 탭의 sessionStorage에 계정과 작성 대상별로 임시 보관합니다. 마지막 저장 후 24시간이 지난 초안은 복원하지 않습니다. 같은 탭에서 탈퇴가 완료되면 해당 계정 초안을 지웁니다. 다른 탭·기기의 초안은 그 탭을 닫아 제거할 수 있습니다.</p>
 <h2>기술 로그</h2><p>호스팅·보안 시스템에서 요청 시각, IP 주소, User-Agent 등 일반적인 기술 로그가 발생할 수 있습니다. 서비스 안정성, 장애 분석과 보안 목적으로 필요한 범위에서 다룹니다.</p>
 <h2>게임 데이터</h2><p>로블잼의 Roblox 데이터 수집은 Game/Experience 중심의 공개 통계입니다. 개별 Roblox 사용자의 비밀번호, 친구 그래프, 정확한 위치를 수집하지 않습니다.</p>
 <h2>처리 목적과 보유·삭제 기준</h2><p>로그인 식별 정보는 계정 인증에, 공개 프로필과 작성글은 커뮤니티 제공에, 계정 상태는 작성 권한·안전 관리에 사용합니다. 신고와 필요한 운영 기록은 게시물 검토에 사용합니다.</p><p>계정과 커뮤니티 자료는 해당 기능을 제공하는 동안 저장합니다. 탈퇴 시의 서비스 DB 처리와 같은 탭의 24시간 초안 처리 방식은 위 안내를 따릅니다.</p>{retention?<p>{retention}</p>:<div className="callout danger">호스팅 백업·보안 로그의 실제 보관 기간과 별도 보존 기준이 아직 운영 확인 전입니다. 이 값이 확정되기 전에는 공개 출시·색인 전환을 진행하지 않습니다.</div>}
 <h2>이용자의 확인·정정·삭제 요청</h2><p><a href="/me">내 정보</a>에서 공개 프로필을 확인·수정하고 회원 탈퇴를 진행할 수 있습니다. 그 밖의 개인정보 열람·정정·삭제·처리정지 관련 문의는 <a href="/contact#private">비공개 문의 안내</a>를 확인해 주세요. {contact?"검증된 비공개 문의 창구가 연결되어 있습니다.":"비공개 문의 창구가 아직 운영 확인 전이므로 공개 출시·색인 전환을 진행하지 않습니다."} 이메일이나 계정 정보를 GitHub 공개 이슈에 올리지 마세요.</p>
 <h2>외부 서비스와 처리 관계</h2><p>Google은 로그인 인증에, Supabase는 인증·데이터베이스·서버 함수 처리에 사용합니다. 현재 프리뷰는 Vercel에서 제공하며 Cloudflare는 데이터 수집·보조 호스팅에 사용됩니다. 게임 이미지·영상 등을 열면 해당 제공자에 요청이 전달될 수 있습니다.</p>{retention?<p>운영자가 확인한 보관·삭제·처리 관련 기준은 위 검증 문구에 반영합니다.</p>:<div className="callout danger">처리 위탁 관계, 보관 지역·국외 처리와 보안 로그 보관 설정의 운영 확인이 아직 끝나지 않았습니다. 확인 전에는 공개 출시·색인 전환을 진행하지 않습니다.</div>}
 </InfoPage>;}
