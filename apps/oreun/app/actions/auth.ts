'use server';

import { redirect, unstable_rethrow } from "next/navigation";
import {
  getCurrentAccessToken,
  getCurrentUser,
  signOutCurrentSession,
} from "@/lib/auth/session";
import { userPatch } from "@/lib/community/rest";
import { normalizeAuthNext } from "@/lib/auth/oauth";
import { profileErrorPath } from "@/lib/auth/navigation";

export async function logoutAction() {
  await signOutCurrentSession();
  redirect("/");
}

export async function updateProfileAction(formData: FormData) {
  const [user, token] = await Promise.all([
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);
  if (!user || !token) redirect("/login?next=/me");

  const handle = String(formData.get("handle") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const next = normalizeAuthNext(String(formData.get("next") ?? ""));

  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    redirect(profileErrorPath("아이디는 영문 소문자·숫자·밑줄 3~20자로 입력해 주세요.", next));
  }
  if (displayName.length > 30 || bio.length > 300) {
    redirect(profileErrorPath("프로필 입력 길이를 확인해 주세요.", next));
  }

  let error: string | null = null;
  try {
    await userPatch("profiles", token, { id: `eq.${user.id}` }, {
      handle,
      display_name: displayName || null,
      bio,
    });
  } catch (caught) {
    unstable_rethrow(caught);
    error = caught instanceof Error ? caught.message : "프로필 저장 실패";
  }

  if (error) redirect(profileErrorPath(error, next));
  if (next !== "/me") redirect(next);
  redirect("/me?saved=1");
}
