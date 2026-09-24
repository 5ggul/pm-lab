import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import DraftForm from "@/components/DraftForm";
import CommunityAccess from "@/components/CommunityAccess";
import { submitCommunityPost } from "@/app/actions/extra-composers";
import { getGameBySlug,getGameCatalog } from "@/lib/catalog";
import { getCurrentAccessToken,getCurrentUser } from "@/lib/auth/session";
import { getCommunityPermissions,getCommunityPostFeed } from "@/lib/community/queries";
import { writeAccess } from "@/lib/community/experience-model";
import { formatKstDateTime } from "@/lib/format";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"게임 자유 톡",robots:{index:false,follow:true}};
export default async function GameFreePage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const [game,games,user,token]=await Promise.all([getGameBySlug(slug),getGameCatalog(),getCurrentUser(),getCurrentAccessToken()]);if(!game)notFound();const posts=await getCommunityPostFeed({gameUniverseId:game.universeId,limit:40}).catch(()=>null);const permissions=token?await getCommunityPermissions(token).catch(()=>null):null;const access=writeAccess(Boolean(user&&token),permissions);const path="/game/"+game.slug+"/free";
 return <><Header games={games}/><main className="page free-board-page"><div className="breadcrumb"><Link prefetch={false} href={"/game/"+game.slug}>{game.nameKo}</Link> / 자유 톡</div><div className="page-title"><h1>{game.nameKo} 자유 톡</h1><p>이 게임 얘기라면 질문이 아니어도 괜찮아요. 플레이 이야기, 자랑, 추천을 나눠 보세요.</p></div>
 {user&&access==="ready"?<details className="panel free-compose" id="write"><summary>{game.nameKo} 이야기 쓰기</summary><DraftForm userId={user.id} scope={game.slug} kind="freePost" initialRequestId={randomUUID()} fields={["title","body"]} action={submitCommunityPost} submitLabel="자유글 등록"><input type="hidden" name="game_slug" value={game.slug}/><label>제목<input name="title" minLength={2} maxLength={120} required/></label><label>내용<textarea name="body" minLength={2} maxLength={5000} rows={7} required/></label></DraftForm></details>:<CommunityAccess access={access} mode="post" next={path}/>}
 {posts===null?<div className="callout danger">자유글을 불러오지 못했습니다.</div>:posts.length?<div className="free-post-list">{posts.map(post=><Link className="free-post-row" href={"/community/free/"+post.id} key={post.id}><div><div className="free-post-meta"><small>{post.author_name} · {formatKstDateTime(post.created_at)}</small></div><strong>{post.title}</strong><p>{post.body}</p></div><span className="free-comment-count">댓글 {post.comment_count}</span></Link>)}</div>:<div className="community-empty-state"><strong>아직 이 게임 자유글이 없습니다.</strong><p>첫 이야기를 남겨 보세요.</p></div>}
 </main></>;}
