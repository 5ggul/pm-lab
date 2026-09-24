import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import Header from "@/components/Header";
import DraftForm from "@/components/DraftForm";
import CommunityAccess from "@/components/CommunityAccess";
import PlayIcon from "@/components/PlayIcon";
import { submitCommunityPost } from "@/app/actions/extra-composers";
import { getGameCatalog } from "@/lib/catalog";
import { getCurrentAccessToken,getCurrentUser } from "@/lib/auth/session";
import { getCommunityPermissions,getCommunityPostFeed } from "@/lib/community/queries";
import { writeAccess } from "@/lib/community/experience-model";
import { formatKstDateTime } from "@/lib/format";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"자유 톡",description:"로블록스 게임 이야기를 자유롭게 나누는 로블잼 커뮤니티",robots:{index:false,follow:true}};
export default async function FreePage(){
 const [games,user,token,posts]=await Promise.all([getGameCatalog(),getCurrentUser(),getCurrentAccessToken(),getCommunityPostFeed({limit:40}).catch(()=>null)]);
 const permissions=token?await getCommunityPermissions(token).catch(()=>null):null;
 const access=writeAccess(Boolean(user&&token),permissions);
 return <><Header games={games}/><main className="page free-board-page">
  <div className="community-hero free-hero"><span className="community-kicker"><PlayIcon name="chat"/> 자유롭게 놀아요</span><h1>자유 톡</h1><p>좋아하는 게임, 오늘 있었던 일, 추천하고 싶은 맵까지. 개인정보나 외부 연락처는 올리지 말아 주세요.</p></div>
  <nav className="community-switcher" aria-label="커뮤니티 메뉴"><Link aria-current="page" href="/community/free">자유</Link><Link href="/community">질문답변</Link><Link href="/guides">공략</Link><Link href="/updates">업데이트</Link><Link href="/games?intent=party">파티 모집</Link></nav>
  {user&&access==="ready"?<details className="panel free-compose" id="write"><summary>새 자유글 쓰기</summary><DraftForm userId={user.id} scope="global" kind="freePost" initialRequestId={randomUUID()} fields={["title","body"]} action={submitCommunityPost} submitLabel="자유글 등록"><label>제목<input name="title" minLength={2} maxLength={120} required placeholder="무슨 이야기를 나눌까요?"/></label><label>내용<textarea name="body" minLength={2} maxLength={5000} rows={7} required placeholder="게임 이야기, 자랑, 추천, 오늘 있었던 일을 자유롭게 적어 주세요."/></label></DraftForm></details>:<CommunityAccess access={access} next="/community/free"/>}
  <div className="section-head"><h2><PlayIcon name="spark"/>최근 자유글</h2><span>{posts===null?"불러오는 중":posts.length+"개 표시"}</span></div>
  {posts===null?<div className="callout danger">자유글을 불러오지 못했습니다.</div>:posts.length?<div className="free-post-list">{posts.map(post=><Link className="free-post-row" href={"/community/free/"+post.id} key={post.id}><div><div className="free-post-meta">{post.game_name_ko&&<span>{post.game_name_ko}</span>}<small>{post.author_name} · {formatKstDateTime(post.created_at)}</small></div><strong>{post.title}</strong><p>{post.body}</p></div><span className="free-comment-count">댓글 {post.comment_count}</span></Link>)}</div>:<div className="community-empty-state"><strong>아직 자유글이 없습니다.</strong><p>첫 글부터 진짜 이용자가 채우는 공간으로 시작합니다.</p>{user&&access==="ready"&&<a className="primary-button" href="#write">첫 자유글 쓰기</a>}</div>}
 </main></>;
}
