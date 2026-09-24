import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import DeleteAccountForm from "@/components/DeleteAccountForm";
import { deleteOwnAccount } from "@/app/actions/account";
import { getCurrentUser } from "@/lib/auth/session";
import { getGameCatalog } from "@/lib/catalog";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"회원 탈퇴",robots:{index:false,follow:false}};
export default async function DeleteAccountPage(){const user=await getCurrentUser();if(!user)redirect("/login?next=%2Fme%2Fdelete");const games=await getGameCatalog();return <><Header games={games}/><main className="page account-page"><div className="page-title"><h1>회원 탈퇴</h1><p>현재 로그인한 로블잼 계정만 삭제합니다.</p></div><section className="panel deletion-explanation"><h2>삭제되는 내용</h2><p>Google 연결 정보, 로블잼 프로필·소개, 내 팔로우·개인 알림·신고가 삭제됩니다. 내가 쓴 자유글·자유글 댓글·질문·답변·댓글의 원문은 지워지고 ‘작성자가 삭제한 글’ 안내만 남습니다. 내가 연 파티는 닫히며 모집 내용과 Roblox 링크도 지워집니다.</p><h2>다른 사람이 쓴 답변은 남아요</h2><p>내 자유글에 다른 사람이 쓴 댓글과 내 질문에 다른 사람이 쓴 답변·댓글은 그 사람의 글입니다. 함께 삭제하지 않고, 내 계정과 연결되지 않은 대화 틀 안에 남깁니다.</p><h2>이 작업은 되돌릴 수 없어요</h2><p>Google 계정과 Roblox 계정 자체는 삭제되지 않습니다. 로블잼에 다시 가입해도 이전 프로필과 글이 복원되지 않습니다. 공개 기기의 다른 탭에 남은 초안은 해당 탭을 닫아 지워 주세요.</p><p>로블잼 서비스 DB 삭제와 호스팅의 백업·보안 로그 보관은 별개입니다.</p></section><DeleteAccountForm userId={user.id} action={deleteOwnAccount}/></main></>}
