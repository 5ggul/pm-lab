"use server";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentAccessToken,getCurrentUser } from "@/lib/auth/session";
import { getCommunityPermissions } from "@/lib/community/queries";
import { getGameBySlug } from "@/lib/catalog";
import { submitWithRecovery } from "@/lib/community/write-recovery";
import { userRpc } from "@/lib/community/rest";
import { uuidPattern,writeAccess,type WriteResult } from "@/lib/community/experience-model";
async function authorize(form:FormData,next:string):Promise<{token:string;userId:string}|WriteResult>{const [user,token]=await Promise.all([getCurrentUser(),getCurrentAccessToken()]);if(!user||!token)return {status:"login",message:"로그인이 만료됐습니다. 같은 계정으로 돌아오면 초안을 이어서 쓸 수 있습니다.",href:"/login?next="+encodeURIComponent(next)};if(form.get("draft_user_id")!==user.id)return {status:"login",message:"작성 중인 계정과 현재 계정이 다릅니다.",href:"/me?next="+encodeURIComponent(next)};const access=writeAccess(true,await getCommunityPermissions(token));if(access!=="ready")return {status:access==="restricted"?"restricted":"unavailable",message:"현재 이 계정으로 글을 등록할 수 없습니다.",href:access==="restricted"?"/contact":next};return {token,userId:user.id};}
function failure(error:unknown):WriteResult {unstable_rethrow(error);const text=error instanceof Error?error.message:"";return {status:"error",message:/restricted contact|credential/.test(text)?"연락처나 계정 인증정보가 포함되어 있지 않은지 확인해 주세요.":/request_conflict/.test(text)?"이 요청으로 이미 다른 내용이 등록됐습니다. 등록된 글을 먼저 확인해 주세요.":/question_unavailable/.test(text)?"닫히거나 숨겨진 질문에는 댓글을 등록할 수 없습니다.":"등록하지 못했습니다. 입력은 유지됩니다. 잠시 뒤 다시 시도해 주세요."};}
export async function submitComment(form:FormData):Promise<WriteResult>{const questionId=String(form.get("question_id")??""),answerId=String(form.get("answer_id")??""),requestId=String(form.get("request_id")??""),body=String(form.get("body")??"").trim();const next="/questions/"+questionId;
 if(!uuidPattern.test(questionId)||!uuidPattern.test(requestId)||(answerId&&!uuidPattern.test(answerId))||body.length<2||body.length>1500)return {status:"error",message:"댓글은 2~1,500자로 적어 주세요."};
 try{const auth=await authorize(form,next);if("status" in auth)return auth;return await submitWithRecovery({kind:"comment",token:auth.token,userId:auth.userId,requestId,values:{question_id:answerId?null:questionId,answer_id:answerId||null,body}},async()=>{const id=await userRpc<string>("r1_submit_comment",auth.token,{p_question_id:questionId,p_answer_id:answerId||null,p_body:body,p_request_id:requestId});if(!uuidPattern.test(id))throw new Error("invalid response");revalidatePath(next);return {status:"success",message:"댓글을 등록했어요.",href:next+"#comment-"+id};});}catch(e){return failure(e);}}
export async function submitParty(form:FormData):Promise<WriteResult>{const slug=String(form.get("game_slug")??""),requestId=String(form.get("request_id")??""),title=String(form.get("title")??"").trim(),note=String(form.get("note")??"").trim(),style=String(form.get("playstyle")??"casual"),capacity=Number(form.get("max_members")),duration=Number(form.get("duration_minutes")),join=String(form.get("roblox_join_url")??"").trim();
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!uuidPattern.test(requestId)||title.length<5||title.length>100||note.length>1000||join.length>2048||!['casual','competitive','learning','quest','grind'].includes(style)||![2,3,4,5,6,8,10,12].includes(capacity)||![30,60,120,180,360].includes(duration))return {status:"error",message:"제목과 모집 조건을 확인해 주세요."};
 const next="/game/"+slug+"/party";try{const auth=await authorize(form,next);if("status" in auth)return auth;const game=await getGameBySlug(slug);if(!game||game.universeId!==Number(form.get("game_universe_id")))return {status:"error",message:"게임을 다시 확인해 주세요."};return await submitWithRecovery({kind:"party",token:auth.token,userId:auth.userId,requestId,values:{game_universe_id:game.universeId,title,note,playstyle:style,max_members:capacity,requested_duration_minutes:duration,roblox_join_url:join||null}},async()=>{const id=await userRpc<string>("r1_submit_party",auth.token,{p_game_universe_id:game.universeId,p_title:title,p_note:note,p_playstyle:style,p_max_members:capacity,p_duration_minutes:duration,p_join_url:join||null,p_request_id:requestId});if(!uuidPattern.test(id))throw new Error("invalid response");revalidatePath(next);return {status:"success",message:"파티 모집을 등록했어요.",href:next+"?created=1#party-"+id};});}catch(e){return failure(e);}}

export async function submitCommunityPost(form:FormData):Promise<WriteResult>{
 const requestId=String(form.get("request_id")??""),title=String(form.get("title")??"").trim(),body=String(form.get("body")??"").trim(),slug=String(form.get("game_slug")??"").trim();
 if(!uuidPattern.test(requestId)||title.length<2||title.length>120||body.length<2||body.length>5000)return {status:"error",message:"제목은 2~120자, 내용은 2~5,000자로 적어 주세요."};
 const next=slug?"/game/"+slug+"/free":"/community/free";
 try{
   const auth=await authorize(form,next);if("status" in auth)return auth;
   let universeId:number|null=null;
   if(slug){const game=await getGameBySlug(slug);if(!game)return {status:"error",message:"게임을 다시 확인해 주세요."};universeId=game.universeId;}
   return await submitWithRecovery({kind:"freePost",token:auth.token,userId:auth.userId,requestId,values:{game_universe_id:universeId,title,body}},async()=>{
     const id=await userRpc<string>("r1_submit_community_post",auth.token,{p_game_universe_id:universeId,p_title:title,p_body:body,p_request_id:requestId});
     if(!uuidPattern.test(id))throw new Error("invalid response");
     revalidatePath("/community");revalidatePath("/community/free");if(slug)revalidatePath(next);
     return {status:"success",message:"자유글을 등록했어요.",href:"/community/free/"+id};
   });
 }catch(e){return failure(e);}
}
export async function submitCommunityPostComment(form:FormData):Promise<WriteResult>{
 const postId=String(form.get("post_id")??""),requestId=String(form.get("request_id")??""),body=String(form.get("body")??"").trim(),next="/community/free/"+String(form.get("post_id")??"");
 if(!uuidPattern.test(postId)||!uuidPattern.test(requestId)||body.length<2||body.length>1500)return {status:"error",message:"댓글은 2~1,500자로 적어 주세요."};
 try{
   const auth=await authorize(form,next);if("status" in auth)return auth;
   return await submitWithRecovery({kind:"freeComment",token:auth.token,userId:auth.userId,requestId,values:{post_id:postId,body}},async()=>{
     const id=await userRpc<string>("r1_submit_community_post_comment",auth.token,{p_post_id:postId,p_body:body,p_request_id:requestId});
     if(!uuidPattern.test(id))throw new Error("invalid response");
     revalidatePath(next);revalidatePath("/community/free");
     return {status:"success",message:"댓글을 등록했어요.",href:next+"#comment-"+id};
   });
 }catch(e){return failure(e);}
}
