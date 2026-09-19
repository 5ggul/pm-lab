'use server';

import { redirect, unstable_rethrow } from "next/navigation";
import {
  getCurrentAccessToken,
  getCurrentUser,
} from "@/lib/auth/session";
import { getCommunityPermissions } from "@/lib/community/queries";
import {
  userInsert,
  userPatch,
} from "@/lib/community/rest";

function msg(value: string) {
  return encodeURIComponent(value.slice(0, 180));
}

async function requireAdmin() {
  const [user, token] = await Promise.all([
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);
  if (!user || !token) redirect("/login?next=/admin/content");
  const permissions = await getCommunityPermissions(token);
  if (permissions.role !== "admin" || !permissions.active) redirect("/");
  return { user, token };
}

function universe(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function createContentSourceAction(formData: FormData) {
  const { token } = await requireAdmin();
  const gameUniverseId = universe(formData.get("universe_id"));
  const sourceType = String(formData.get("source_type") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const sourceUrl = String(formData.get("source_url") ?? "").trim();
  const allowed = new Set([
    "official_game_page",
    "official_group",
    "official_social",
    "official_docs",
    "in_game_verified",
    "other",
  ]);

  let validUrl = false;
  try {
    validUrl = new URL(sourceUrl).protocol === "https:";
  } catch {}

  if (!gameUniverseId || !allowed.has(sourceType) || label.length < 2 || !validUrl) {
    redirect("/admin/content?error=" + msg("출처 입력값을 확인해 주세요."));
  }

  try {
    await userInsert("content_sources", token, {
      universe_id: gameUniverseId,
      source_type: sourceType,
      label,
      source_url: sourceUrl,
      last_checked_at: new Date().toISOString(),
    });
  } catch (caught) {
    unstable_rethrow(caught);
    redirect(
      "/admin/content?error=" +
        msg(caught instanceof Error ? caught.message : "출처 등록 실패"),
    );
  }
  redirect("/admin/content?source_saved=1");
}

export async function createGuideAction(formData: FormData) {
  const { token } = await requireAdmin();
  const gameUniverseId = universe(formData.get("universe_id"));
  const sourceId = String(formData.get("source_id") ?? "");
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const guideType = String(formData.get("guide_type") ?? "guide");
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const publish = formData.get("publish") === "on";
  const indexable = formData.get("indexable") === "on";

  if (
    !gameUniverseId ||
    !sourceId ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    title.length < 5 ||
    summary.length < 20 ||
    body.length < 100
  ) {
    redirect("/admin/content?error=" + msg("가이드 입력값을 확인해 주세요."));
  }

  try {
    await userInsert("game_guides", token, {
      universe_id: gameUniverseId,
      source_id: sourceId,
      slug,
      guide_type: guideType,
      title,
      summary,
      body,
      content_status: publish ? "published" : "draft",
      index_state: publish && indexable ? "indexable" : "noindex",
    });
  } catch (caught) {
    unstable_rethrow(caught);
    redirect(
      "/admin/content?error=" +
        msg(caught instanceof Error ? caught.message : "가이드 저장 실패"),
    );
  }
  redirect("/admin/content?guide_saved=1");
}

export async function createCodeAction(formData: FormData) {
  const { token } = await requireAdmin();
  const gameUniverseId = universe(formData.get("universe_id"));
  const sourceId = String(formData.get("source_id") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const rewardText = String(formData.get("reward_text") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const codeStatus = String(formData.get("code_status") ?? "unknown");
  const publish = formData.get("publish") === "on";
  const allowed = new Set(["active", "expired", "unknown"]);

  if (
    !gameUniverseId ||
    !sourceId ||
    !code ||
    !allowed.has(codeStatus) ||
    rewardText.length > 500 ||
    notes.length > 1000
  ) {
    redirect("/admin/content?error=" + msg("코드 입력값을 확인해 주세요."));
  }

  const now = new Date().toISOString();
  try {
    await userInsert("game_codes", token, {
      universe_id: gameUniverseId,
      source_id: sourceId,
      code,
      reward_text: rewardText,
      notes,
      code_status: codeStatus,
      visibility: publish ? "published" : "draft",
      last_checked_at: now,
      verified_at: codeStatus === "active" ? now : null,
    });
  } catch (caught) {
    unstable_rethrow(caught);
    redirect(
      "/admin/content?error=" +
        msg(caught instanceof Error ? caught.message : "코드 저장 실패"),
    );
  }
  redirect("/admin/content?code_saved=1");
}

export async function archiveGuideAction(formData: FormData) {
  const { token } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/content");
  await userPatch(
    "game_guides",
    token,
    { id: `eq.${id}` },
    { content_status: "archived", index_state: "noindex" },
  );
  redirect("/admin/content?guide_archived=1");
}

export async function expireCodeAction(formData: FormData) {
  const { token } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/content");
  await userPatch(
    "game_codes",
    token,
    { id: `eq.${id}` },
    {
      code_status: "expired",
      last_checked_at: new Date().toISOString(),
    },
  );
  redirect("/admin/content?code_expired=1");
}

export async function reverifyCodeAction(formData: FormData) {
  const { token } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "on";
  if (!id) redirect("/admin/content");
  const now = new Date().toISOString();
  await userPatch(
    "game_codes",
    token,
    { id: `eq.${id}` },
    {
      code_status: active ? "active" : "unknown",
      last_checked_at: now,
      verified_at: active ? now : null,
    },
  );
  redirect("/admin/content?code_checked=1");
}
