import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import DraftForm from "@/components/DraftForm";
import CommunityAccess from "@/components/CommunityAccess";
import ReportForm from "@/components/community/ReportForm";
import { submitCommunityPostComment } from "@/app/actions/extra-composers";
import { getGameCatalog } from "@/lib/catalog";
import { getCurrentAccessToken,getCurrentUser } from "@/lib/auth/session";
import { getCommunityPermissions,getCommunityPost,getCommunityPostComments } from "@/lib/community/queries";
import { writeAccess } from "@/lib/community/experience-model";
import { formatKstDateTime } from "@/lib/format";
export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const {id}=await params;const post=await getCommunityPost(id).catch(()=>null);return post?{title:post.title,description:post.body.replace(/\s+/g," ").slice(0,160),robots:{index:false,follow:true}}:{title:"자유글",robots:{index:false,follow:true}};}
export default async function FreePostPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{reported?:string;error?:string}>}){
 const [{id},query]=await Promise.all([params,searchParams]);const [post,comments,games,user,token]=await Promise.all([getCommunityPost(id),getCommunityPostComments(id),getGameCatalog(),getCurrentUser(),getCurrentAccessToken()]);if(!post)notFound();
 const permissions=token?await getCommunityPermissions(token).catch(()=>null):null;const access=writeAccess(Boolean(user&&token),permissions);const returnPath="/community/free/"+id;
 return <><Header games={games}/><main className="page free-post-page">
  <div className="breadcrumb"><Link href="/community/free">자유 톡</Link>{post.game_slug&&<> / <Link href={"/game/"+post.game_slug+"/free"}>{post.game_name_ko}</Link></>}</div>
  {query.reported&&<div className="callout">신고가 접수됐습니다.</div>}{query.error&&<div className="callout danger">{query.error.slice(0,180)}</div>}
  <article className="free-post-detail"><div className="free-post-meta">{post.game_name_ko&&<span>{post.game_name_ko}</span>}<small>{post.author_name} · {formatKstDateTime(post.created_at)}</small></div><h1>{post.title}</h1><p className="ugc-body">{post.body}</p><ReportForm targetType="post" targetId={post.id} returnPath={returnPath}/></article>
  <section className="thread-section"><div className="section-head"><h2>댓글</h2><span>{comments.length}개</span></div>{comments.map(comment=><div className="comment-row" id={"comment-"+comment.id} key={comment.id}><div><strong>{comment.author_name}</strong><p>{comment.body}</p><small>{formatKstDateTime(comment.created_at)}</small></div><ReportForm targetType="post_comment" targetId={comment.id} returnPath={returnPath}/></div>)}
  {user&&access==="ready"?<DraftForm userId={user.id} scope={id} kind="freeComment" initialRequestId={randomUUID()} fields={["body"]} action={submitCommunityPostComment} submitLabel="댓글 등록"><input type="hidden" name="post_id" value={id}/><label>댓글<input name="body" minLength={2} maxLength={1500} required placeholder="서로 기분 좋게 이야기해 주세요."/></label></DraftForm>:<CommunityAccess access={access} next={returnPath}/>}</section>
 </main></>;
}
