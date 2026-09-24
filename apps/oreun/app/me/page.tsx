import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { logoutAction, updateProfileAction } from "@/app/actions/auth";
import { getGameCatalog } from "@/lib/catalog";
import { getCurrentAccessToken,getCurrentUser } from "@/lib/auth/session";
import { getCommunityPermissions,getProfile,getUnreadNotificationCount } from "@/lib/community/queries";
import { getRecentUpdateEvents } from "@/lib/content/queries";
import { relativeTime } from "@/lib/format";
import { normalizeAuthNext } from "@/lib/auth/oauth";
import { userSelect } from "@/lib/community/rest";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"내 계정",robots:{index:false,follow:false}};
export default async function MePage({searchParams}:{searchParams:Promise<{error?:string;saved?:string;welcome?:string;next?:string}>}){
 const [user,token,games,params]=await Promise.all([getCurrentUser(),getCurrentAccessToken(),getGameCatalog(),searchParams]);
 if(!user||!token)redirect("/login?next=/me");
 const onboardingNext=normalizeAuthNext(params.next);
 const [profile,permissions,follows,unreadNotifications,recentUpdates]=await Promise.all([getProfile(user.id),getCommunityPermissions(token),userSelect<{universe_id:number|string}>("game_follows",token,{select:"universe_id",user_id:`eq.${user.id}`,order:"created_at.desc",limit:100}),getUnreadNotificationCount(token).catch(()=>null),getRecentUpdateEvents(500).catch(()=>[])]);
 if(!profile)redirect("/login?error=프로필을+불러오지+못했습니다.");
 const followedIds=new Set(follows.map(row=>Number(row.universe_id)));const followedGames=games.filter(game=>followedIds.has(game.universeId));const latestUpdateByGame=new Map<number,string>();for(const event of recentUpdates){const id=Number(event.universe_id);if(!latestUpdateByGame.has(id))latestUpdateByGame.set(id,event.first_observed_at);}
 return <><Header games={games}/><main className="page account-page"><div className="page-title"><h1>내 계정</h1><p>{user.email??"로그인 계정"} · @{profile.handle}</p></div>
 {params.error&&<div className="callout danger">{params.error}</div>}{params.saved&&<div className="callout">저장했습니다.</div>}
 {params.welcome&&<div className="callout">로그인이 완료됐습니다. 공개 프로필은 언제든 수정할 수 있습니다.</div>}
 <div className="status-grid"><div className="status-cell"><strong>{permissions.active?"정상":"제한"}</strong><span>계정 상태</span></div><div className="status-cell"><strong>{permissions.role}</strong><span>권한</span></div><div className="status-cell"><strong>{followedGames.length}</strong><span>팔로우 게임</span></div></div>
 <section className="panel profile-panel"><h2>공개 프로필</h2><form action={updateProfileAction} className="stack-form"><input type="hidden" name="next" value={onboardingNext}/><label>아이디<input name="handle" defaultValue={profile.handle} minLength={3} maxLength={20} pattern="[a-z0-9_]+" required/><small>영문 소문자·숫자·밑줄 3~20자</small></label><label>표시 이름<input name="display_name" defaultValue={profile.display_name??""} maxLength={30}/></label><label>소개<textarea name="bio" defaultValue={profile.bio} maxLength={300} rows={4}/></label><button className="primary-button" type="submit">프로필 저장</button></form></section>
 <div className="section-head"><h2>팔로우한 게임</h2><span className="section-note"><Link href="/notifications">알림 {unreadNotifications!=null&&unreadNotifications>0?unreadNotifications+"개":"보기"}</Link>{" · "}<Link href="/games">게임 찾기</Link></span></div>
 {followedGames.length?<div className="follow-grid">{followedGames.map(game=><Link key={game.universeId} className="follow-card" href={`/game/${game.slug}`}><strong>{game.nameKo}</strong><span>{game.name}</span>{latestUpdateByGame.has(game.universeId)&&<small>업데이트 감지 {relativeTime(latestUpdateByGame.get(game.universeId)??null)}</small>}</Link>)}</div>:<div className="no-data">아직 팔로우한 게임이 없습니다.</div>}
 {["moderator","admin"].includes(permissions.role??"")&&<div className="button-row"><Link className="secondary-button" href="/admin/moderation">신고·운영 큐</Link>{permissions.role==="admin"&&<Link className="secondary-button" href="/admin/content">Content Studio</Link>}</div>}
 <p className="account-delete-link"><Link href="/me/delete">회원 탈퇴 및 내 글 삭제</Link></p><form action={logoutAction}><button type="submit" className="text-button">로그아웃</button></form></main></>;
}
