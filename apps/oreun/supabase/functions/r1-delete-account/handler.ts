// Every request is authenticated by Auth getUser, then tied to a recent server session.
export interface DeleteEnvironment { url: string; anonKey: string; serviceKey: string; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (status: number, code: string) => new Response(JSON.stringify({ code }), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
});
export async function handleDeleteAccount(request: Request, env: DeleteEnvironment, fetcher: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  if (request.method !== "POST") return reply(405,"method_not_allowed");
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [^\s]+$/.test(authorization)) return reply(401,"login_required");
  if (!env.url || !env.anonKey || !env.serviceKey) return reply(503,"not_ready");
  if (!request.headers.get("content-type")?.includes("application/json")) return reply(400,"invalid_confirmation");
  try {
    const reader=request.body?.getReader(); let raw="";
    if(!reader) return reply(400,"invalid_confirmation");
    const decoder=new TextDecoder();
    for(;;){const {value,done}=await reader.read();if(done)break;raw+=decoder.decode(value,{stream:true});if(raw.length>2048){await reader.cancel();return reply(413,"invalid_confirmation");}}
    const body=JSON.parse(raw);
    if(body.confirmation!=="탈퇴" || body.acknowledged!==true) return reply(400,"invalid_confirmation");
    const url=env.url.replace(/\/$/,"");
    const userResponse=await fetcher(url+"/auth/v1/user",{headers:{apikey:env.anonKey,authorization},cache:"no-store"});
    if(!userResponse.ok) return reply(401,"login_required");
    const user=await userResponse.json() as {id?:string;last_sign_in_at?:string;app_metadata?:{provider?:string;providers?:string[]}};
    if(!user.id || !UUID.test(user.id)) return reply(401,"login_required");
    const signedAt=new Date(user.last_sign_in_at ?? "").getTime();
    if(!Number.isFinite(signedAt)||signedAt>now+60_000||now-signedAt>10*60_000) return reply(401,"reauth_required");
    if(user.app_metadata?.provider!=="google"&&!user.app_metadata?.providers?.includes("google")) return reply(403,"google_required");
    const permsResponse=await fetcher(url+"/rest/v1/rpc/r1_my_community_permissions",{method:"POST",headers:{apikey:env.anonKey,authorization,"content-type":"application/json"},body:"{}",cache:"no-store"});
    if(!permsResponse.ok) return reply(503,"not_ready");
    const perms=await permsResponse.json() as {authenticated?:boolean;role?:string};
    if(!perms.authenticated||perms.role!=="user") return reply(403,"operator_account");
    let sessionId = "";
    try {
      const segment=authorization.slice(7).split(".")[1];
      const normalized=segment.replace(/-/g,"+").replace(/_/g,"/");
      sessionId=JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,"="))).session_id;
    } catch { return reply(401,"reauth_required"); }
    if(!UUID.test(sessionId)) return reply(401,"reauth_required");
    const adminHeaders={apikey:env.serviceKey,authorization:"Bearer "+env.serviceKey,"content-type":"application/json"};
    const ready=await fetcher(url+"/rest/v1/rpc/r1_account_erasure_ready",{method:"POST",headers:adminHeaders,body:"{}",cache:"no-store"});
    if(!ready.ok || await ready.json()!==true) return reply(503,"not_ready");
    const recent=await fetcher(url+"/rest/v1/rpc/r1_account_recent_session",{method:"POST",headers:adminHeaders,body:JSON.stringify({p_user_id:user.id,p_session_id:sessionId}),cache:"no-store"});
    if(!recent.ok) return reply(503,"not_ready");
    if(await recent.json()!==true) return reply(401,"reauth_required");
    const result=await fetcher(url+"/auth/v1/admin/users/"+user.id,{method:"DELETE",headers:adminHeaders,body:JSON.stringify({should_soft_delete:false}),cache:"no-store"});
    if(!result.ok) return reply(503,"delete_failed");
    return reply(200,"deleted");
  } catch { return reply(503,"delete_failed"); }
}
