'use server';

import { redirect, unstable_rethrow } from "next/navigation";
import {
  getCurrentAccessToken,
  getCurrentUser,
  signInWithPassword,
  signOutCurrentSession
} from "@/lib/auth/session";
import { userPatch, userRpc } from "@/lib/community/rest";
import { normalizeAuthNext } from "@/lib/auth/oauth";

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanPassword(value: FormDataEntryValue | null) {
  return String(value ?? "");
}

function message(value: string) {
  return encodeURIComponent(value.slice(0, 180));
}

function safeNext(value: FormDataEntryValue | null) {
  return normalizeAuthNext(String(value ?? ""));
}

export async function loginAction(formData: FormData) {
  const email = cleanEmail(formData.get("email"));
  const password = cleanPassword(formData.get("password"));
  const next = safeNext(formData.get("next"));

  if (!email.includes("@") || password.length < 8) {
    redirect("/login?error=" + message("이메일과 비밀번호를 확인해 주세요."));
  }

  const result = await signInWithPassword(email, password);
  if (result.error) {
    redirect("/login?error=" + message(result.error));
  }

  redirect(next);
}

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

  const handle = String(formData.get("handle") ?? "")
    .trim()
    .toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const ageConfirmed = formData.get("age_confirmed_14_plus") === "on";
  const next = safeNext(formData.get("next"));

  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    redirect(
      "/me?error=" +
        message("아이디는 영문 소문자·숫자·밑줄 3~20자로 입력해 주세요."),
    );
  }
  if (displayName.length > 30 || bio.length > 300) {
    redirect("/me?error=" + message("프로필 입력 길이를 확인해 주세요."));
  }

  let error: string | null = null;
  try {
    await userPatch(
      "profiles",
      token,
      { id: `eq.${user.id}` },
      {
        handle,
        display_name: displayName || null,
        bio,
      },
    );
    await userRpc("r1_set_age_confirmation", token, {
      p_confirmed: ageConfirmed,
    });
  } catch (caught) {
    unstable_rethrow(caught);
    error = caught instanceof Error ? caught.message : "프로필 저장 실패";
  }

  if (error) redirect("/me?error=" + message(error));
  if (ageConfirmed && next !== "/me") redirect(next);
  redirect("/me?saved=1");
}
