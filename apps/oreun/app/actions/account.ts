"use server";
import { unstable_rethrow } from "next/navigation";
import { clearAuthSession, getCurrentAccessToken, getCurrentUser } from "@/lib/auth/session";
import { communityConfig } from "@/lib/community/rest";
export type DeletionResult = { status: "error" | "reauth" | "success"; message: string; href?: string };
export async function deleteOwnAccount(form: FormData): Promise<DeletionResult> {
  if(form.get("confirmation")!=="탈퇴"||form.get("acknowledged")!=="on") return {status:"error",message:"삭제되는 내용을 확인하고 ‘탈퇴’를 입력해 주세요."};
  try {
    const [user,token]=await Promise.all([getCurrentUser(),getCurrentAccessToken()]);
    if(!user||!token) return {status:"reauth",message:"계정 보호를 위해 Google로 다시 로그인해 주세요.",href:"/auth/google?next=%2Fme%2Fdelete"};
    const config=communityConfig();
    if(!config) return {status:"error",message:"계정 삭제를 지금 처리할 수 없습니다. 잠시 뒤 다시 시도해 주세요."};
    const response=await fetch(config.url+"/functions/v1/r1-delete-account",{method:"POST",headers:{apikey:config.publishableKey,authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({confirmation:"탈퇴",acknowledged:true}),cache:"no-store"});
    const data=await response.json() as {code?:string};
    if(response.ok&&data.code==="deleted") { await clearAuthSession();return {status:"success",message:"오름 계정과 직접 작성한 내용을 삭제했습니다."}; }
    if(data.code==="reauth_required"||data.code==="login_required") return {status:"reauth",message:"Google로 다시 로그인한 뒤 10분 안에 탈퇴를 확인해 주세요.",href:"/auth/google?next=%2Fme%2Fdelete"};
    if(data.code==="operator_account") return {status:"error",message:"운영 권한이 있는 계정은 권한 정리 후 탈퇴할 수 있습니다. 지금 계정은 삭제되지 않았습니다."};
    return {status:"error",message:"탈퇴를 완료하지 못했습니다. 완료 안내가 나오기 전에는 삭제가 끝난 것이 아닙니다. 잠시 뒤 다시 확인해 주세요."};
  } catch(error) { unstable_rethrow(error);return {status:"error",message:"연결이 끊어져 결과를 확인하지 못했습니다. 다시 로그인해 계정 상태를 확인해 주세요."}; }
}
