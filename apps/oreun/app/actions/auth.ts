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
    const message = caught instanceof Error ? caught.message : "";
    error = /profiles_handle_lower_unique|duplicate key|already exists/i.test(message)
      ? "이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요."
      : /restricted contact|credential pattern/i.test(message)
        ? "소개나 표시 이름에 연락처 또는 계정 인증정보가 포함되어 있지 않은지 확인해 주세요."
        : /permission denied|insufficient privilege/i.test(message)
          ? "프로필 저장 권한을 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요."
          : "프로필을 저장하지 못했습니다. 입력한 내용은 유지됩니다. 잠시 뒤 다시 시도해 주세요.";
  }

  if (error) redirect(profileErrorPath(error, next));
  if (next !== "/me") redirect(next);
  redirect("/me?saved=1");
}
