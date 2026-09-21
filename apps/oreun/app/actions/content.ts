'use server';

import { redirect, unstable_rethrow } from "next/navigation";
import {
  getCurrentAccessToken,
  getCurrentUser,
} from "@/lib/auth/session";
import { getCommunityPermissions } from "@/lib/community/queries";
import type { ContentSource, GameGuide } from "@/lib/content/queries";
import {
  VERIFIED_EDITORIAL_GUIDES,
  VERIFIED_EDITORIAL_SOURCES,
} from "@/lib/content/verified-guides";
import {
  userInsert,
  userPatch,
  userSelect,
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

function rowId(formData: FormData) {
  return String(formData.get("id") ?? "").trim();
}

function reviewNote(formData: FormData) {
  return String(formData.get("review_note") ?? "").trim().slice(0, 1000);
}

export async function importVerifiedEditorialContentAction() {
  const { token } = await requireAdmin();

  try {
    const [existingSources, existingGuides] = await Promise.all([
      userSelect<ContentSource>("content_sources", token, {
        select: "*",
        order: "last_checked_at.desc",
        limit: 500,
      }),
      userSelect<GameGuide>("game_guides", token, {
        select: "*",
        order: "updated_at.desc",
        limit: 500,
      }),
    ]);

    const sourceByKey = new Map(
      existingSources.map((source) => [
        String(source.universe_id) + "|" + source.source_url,
        source,
      ]),
    );
    const dbSourceIdByVerifiedId = new Map<string, string>();
    let importedSources = 0;

    for (const source of VERIFIED_EDITORIAL_SOURCES) {
      const key = String(source.universe_id) + "|" + source.source_url;
      let dbSource = sourceByKey.get(key);

      if (!dbSource) {
        const inserted = await userInsert<ContentSource>(
          "content_sources",
          token,
          {
            universe_id: Number(source.universe_id),
            source_type:
              source.source_type === "official_roblox_experience"
                ? "official_game_page"
                : source.source_type,
            label: source.label,
            source_url: source.source_url,
            last_checked_at: source.last_checked_at,
          },
        );
        dbSource = inserted[0];
        if (!dbSource) throw new Error("검증 출처 저장 결과가 없습니다.");
        sourceByKey.set(key, dbSource);
        importedSources += 1;
      }

      dbSourceIdByVerifiedId.set(source.id, dbSource.id);
    }

    const guideKeys = new Set(
      existingGuides.map(
        (guide) => String(guide.universe_id) + "|" + guide.slug,
      ),
    );
    let importedGuides = 0;

    for (const guide of VERIFIED_EDITORIAL_GUIDES) {
      const key = String(guide.universe_id) + "|" + guide.slug;
      if (guideKeys.has(key)) continue;

      const sourceId = guide.source_id
        ? dbSourceIdByVerifiedId.get(guide.source_id)
        : null;
      if (!sourceId) {
        throw new Error("가이드에 대응하는 DB 출처를 찾지 못했습니다.");
      }

      await userInsert<GameGuide>("game_guides", token, {
        universe_id: Number(guide.universe_id),
        source_id: sourceId,
        slug: guide.slug,
        guide_type: guide.guide_type,
        title: guide.title,
        summary: guide.summary,
        body: guide.body,
        content_status: "draft",
        index_state: "noindex",
        review_status: "pending",
        review_note: "",
      });
      guideKeys.add(key);
      importedGuides += 1;
    }

    redirect(
      "/admin/content?verified_imported=1&sources=" +
        importedSources +
        "&guides=" +
        importedGuides,
    );
  } catch (caught) {
    unstable_rethrow(caught);
    redirect(
      "/admin/content?error=" +
        msg(
          caught instanceof Error
            ? caught.message
            : "검증 콘텐츠 가져오기 실패",
        ),
    );
  }
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
  const submitReview = formData.get("submit_review") === "on";

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
      content_status: "draft",
      index_state: "noindex",
      review_status: submitReview ? "pending" : "draft",
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
  const submitReview = formData.get("submit_review") === "on";
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
      visibility: "draft",
      review_status: submitReview ? "pending" : "draft",
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

export async function submitGuideReviewAction(formData: FormData) {
  const { token } = await requireAdmin();
  const id = rowId(formData);
  if (!id) redirect("/admin/content");
  await userPatch(
    "game_guides",
    token,
    { id: `eq.${id}` },
    {
      review_status: "pending",
      reviewed_at: null,
      reviewed_by: null,
      review_note: "",
    },
  );
  redirect("/admin/content?guide_review_requested=1");
}

export async function approveGuideReviewAction(formData: FormData) {
  const { user, token } = await requireAdmin();
  const id = rowId(formData);
  const note = reviewNote(formData);
  if (!id) redirect("/admin/content");
  if (note.length < 10) {
    redirect(
      "/admin/content?error=" +
        msg("가이드 승인에는 10자 이상의 검토 메모가 필요합니다."),
    );
  }
  await userPatch(
    "game_guides",
    token,
    { id: `eq.${id}` },
    {
      review_status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      review_note: note,
    },
  );
  redirect("/admin/content?guide_review_approved=1");
}

export async function rejectGuideReviewAction(formData: FormData) {
  const { user, token } = await requireAdmin();
  const id = rowId(formData);
  if (!id) redirect("/admin/content");
  await userPatch(
    "game_guides",
    token,
    { id: `eq.${id}` },
    {
      review_status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      review_note: reviewNote(formData) || "검토 반려",
      content_status: "draft",
      index_state: "noindex",
    },
  );
  redirect("/admin/content?guide_review_rejected=1");
}

export async function publishGuideAction(formData: FormData) {
  const { token } = await requireAdmin();
  const id = rowId(formData);
  const indexable = formData.get("indexable") === "on";
  if (!id) redirect("/admin/content");
  await userPatch(
    "game_guides",
    token,
    { id: `eq.${id}` },
    {
      content_status: "published",
      index_state: indexable ? "indexable" : "noindex",
    },
  );
  redirect("/admin/content?guide_published=1");
}

export async function submitCodeReviewAction(formData: FormData) {
  const { token } = await requireAdmin();
  const id = rowId(formData);
  if (!id) redirect("/admin/content");
  await userPatch(
    "game_codes",
    token,
    { id: `eq.${id}` },
    {
      review_status: "pending",
      reviewed_at: null,
      reviewed_by: null,
      review_note: "",
    },
  );
  redirect("/admin/content?code_review_requested=1");
}

export async function approveCodeReviewAction(formData: FormData) {
  const { user, token } = await requireAdmin();
  const id = rowId(formData);
  const note = reviewNote(formData);
  if (!id) redirect("/admin/content");
  if (note.length < 10) {
    redirect(
      "/admin/content?error=" +
        msg("코드 승인에는 10자 이상의 검토 메모가 필요합니다."),
    );
  }
  await userPatch(
    "game_codes",
    token,
    { id: `eq.${id}` },
    {
      review_status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      review_note: note,
    },
  );
  redirect("/admin/content?code_review_approved=1");
}

export async function rejectCodeReviewAction(formData: FormData) {
  const { user, token } = await requireAdmin();
  const id = rowId(formData);
  if (!id) redirect("/admin/content");
  await userPatch(
    "game_codes",
    token,
    { id: `eq.${id}` },
    {
      review_status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      review_note: reviewNote(formData) || "검토 반려",
      visibility: "draft",
    },
  );
  redirect("/admin/content?code_review_rejected=1");
}

export async function publishCodeAction(formData: FormData) {
  const { token } = await requireAdmin();
  const id = rowId(formData);
  if (!id) redirect("/admin/content");
  await userPatch(
    "game_codes",
    token,
    { id: `eq.${id}` },
    { visibility: "published" },
  );
  redirect("/admin/content?code_published=1");
}

export async function archiveGuideAction(formData: FormData) {
  const { token } = await requireAdmin();
  const id = rowId(formData);
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
  const id = rowId(formData);
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
  const id = rowId(formData);
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
