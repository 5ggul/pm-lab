import test from "node:test";
import assert from "node:assert/strict";
import { submitWithRecovery, findOwnWriteReceipt, type WriteKind, type Submission, type Receipt } from "../lib/community/write-recovery";
const userId="bd9ea736-f636-4570-8ee9-e48c4fce100f",requestId="bd9ea736-f636-4570-8ee9-e48c4fce101f";
for(const kind of ["question","answer","comment","party"] as WriteKind[]){test(kind+": committed-but-lost original recovers without a second insert; edited draft is conflict not success",async()=>{
 let stored:string|null=null,inserts=0;const sub:Submission={kind,userId,requestId,token:"test",values:{body:"original"}};
 const lookup=async(s:Submission):Promise<Receipt|null>=>stored===null?null:{id:requestId,href:"/existing/"+kind,same:s.values.body===stored};
 const insert=async()=>{inserts++;stored=String(sub.values.body);throw new Error("RPC response lost AFTER COMMIT");};
 const recovered=await submitWithRecovery(sub,insert,lookup);assert.equal(recovered.status,"success");assert.equal(recovered.href,"/existing/"+kind);assert.equal(inserts,1);
 const retry=await submitWithRecovery(sub,insert,lookup);assert.equal(retry.status,"success");assert.equal(inserts,1);
 const edited=await submitWithRecovery({...sub,values:{body:"modified and UNSAVED"}},insert,lookup);assert.equal(edited.status,"conflict");assert.equal(edited.href,"/existing/"+kind);assert.equal(edited.canStartNew,true);assert.equal(inserts,1);assert.equal(stored,"original");
 });
 test(kind+": network or real server failure never fabricates receipt or success",async()=>{const sub:Submission={kind,userId,requestId,token:"test",values:{}};for(const error of [new Error("network"),new Error("server constraint")])await assert.rejects(submitWithRecovery(sub,async()=>{throw error;},async()=>null),error);});
}
test("receipt lookup uses actual owner + nonce + visible filter with caller token, not service privilege",async(t)=>{
 const old=globalThis.fetch,oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,oldKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 process.env.NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co";process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="public";
 t.after(()=>{globalThis.fetch=old;if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=oldKey;});
 globalThis.fetch=(async(input:unknown,init?:RequestInit)=>{const u=new URL(String(input));assert.equal(u.searchParams.get("author_id"),"eq."+userId);assert.equal(u.searchParams.get("client_request_id"),"eq."+requestId);assert.equal(u.searchParams.get("moderation_status"),"eq.visible");assert.equal(new Headers(init?.headers).get("authorization"),"Bearer actual-user");return Response.json([]);}) as typeof fetch;
 assert.equal(await findOwnWriteReceipt({kind:"question",userId,requestId,token:"actual-user",values:{}}),null);
 await assert.rejects(findOwnWriteReceipt({kind:"question",userId:"forged invalid id",requestId,token:"actual-user",values:{}}));
});
