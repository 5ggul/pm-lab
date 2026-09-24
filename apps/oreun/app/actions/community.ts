'use server';

import { redirect, unstable_rethrow } from "next/navigation";
import {
  getCurrentAccessToken,
  getCurrentUser,
} from "@/lib/auth/session";
import {
  getCommunityPermissions,
  getOwnFollow,
} from "@/lib/community/queries";
import {
  userDelete,
  userInsert,
  userPatch,
  userRpc,
} from "@/lib/community/rest";

function msg(value: string) {
  return encodeURIComponent(value.slice(0, 180));
}

function safeReturnPath(value: FormDataEntryValue | null, fallback = "/community") {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

async function requireCommunityUser(next: string) {
  const [user, token] = await Promise.all([
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);
  if (!user || !token) redirect(`/login?next=${encodeURIComponent(next)}`);

  const permissions = await getCommunityPermissions(token);
  if (!permissions.active) {
    redirect(`/me?error=${msg("현재 이 계정으로 커뮤니티 기능을 사용할 수 없습니다.")}`);
  }
  return { user, token, permissions };
}

export async function createQuestionAction(formData: FormData) {
  const universeId = Number(formData.get("game_universe_id"));
  const gameSlug = String(formData.get("game_slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!Number.isFinite(universeId) || !gameSlug) redirect("/community");
  const { user, token } = await requireCommunityUser(
    `/game/${gameSlug}/questions`,
  );
  if (title.length < 5 || title.length > 120 || body.length < 10 || body.length > 5000) {
    redirect(
      `/game/${gameSlug}/questions?error=${msg("제목 5~120자, 본문 10~5,000자로 작성해 주세요.")}`,
    );
  }

  let created: Array<{ id: string }> = [];
  let error: string | null = null;
  try {
    created = await userInsert<{ id: string }>("questions", token, {
      game_universe_id: universeId,
      author_id: user.id,
      title,
      body,
    });
  } catch (caught) {
    unstable_rethrow(caught);
    error = caught instanceof Error ? caught.message : "질문 등록 실패";
  }
  if (error || !created[0]?.id) {
    redirect(
      `/game/${gameSlug}/questions?error=${msg(error ?? "질문 등록 실패")}`,
    );
  }
  redirect(`/questions/${created[0].id}`);
}

export async function createAnswerAction(formData: FormData) {
  const questionId = String(formData.get("question_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!questionId) redirect("/community");
  const { user, token } = await requireCommunityUser(`/questions/${questionId}`);

  if (body.length < 2 || body.length > 5000) {
    redirect(
      `/questions/${questionId}?error=${msg("답변은 2~5,000자로 작성해 주세요.")}`,
    );
  }

  let error: string | null = null;
  try {
    await userInsert("answers", token, {
      question_id: questionId,
      author_id: user.id,
      body,
    });
  } catch (caught) {
    unstable_rethrow(caught);
    error = caught instanceof Error ? caught.message : "답변 등록 실패";
  }
  if (error) redirect(`/questions/${questionId}?error=${msg(error)}`);
  redirect(`/questions/${questionId}#answers`);
}

export async function createCommentAction(formData: FormData) {
  const questionId = String(formData.get("question_id") ?? "");
  const answerId = String(formData.get("answer_id") ?? "") || null;
  const body = String(formData.get("body") ?? "").trim();
  if (!questionId) redirect("/community");
  const { user, token } = await requireCommunityUser(`/questions/${questionId}`);

  if (body.length < 2 || body.length > 1500) {
    redirect(
      `/questions/${questionId}?error=${msg("댓글은 2~1,500자로 작성해 주세요.")}`,
    );
  }

  let error: string | null = null;
  try {
    await userInsert("comments", token, {
      question_id: answerId ? null : questionId,
      answer_id: answerId,
      author_id: user.id,
      body,
    });
  } catch (caught) {
    unstable_rethrow(caught);
    error = caught instanceof Error ? caught.message : "댓글 등록 실패";
  }
  if (error) redirect(`/questions/${questionId}?error=${msg(error)}`);
  redirect(`/questions/${questionId}#comments`);
}

export async function toggleFollowAction(formData: FormData) {
  const universeId = Number(formData.get("universe_id"));
  const gameSlug = String(formData.get("game_slug") ?? "");
  if (!Number.isFinite(universeId) || !gameSlug) redirect("/games");

  const { user, token } = await requireCommunityUser(`/game/${gameSlug}`);
  const following = await getOwnFollow(token, user.id, universeId);

  if (following) {
    await userDelete("game_follows", token, {
      user_id: `eq.${user.id}`,
      universe_id: `eq.${universeId}`,
    });
  } else {
    await userInsert("game_follows", token, {
      user_id: user.id,
      universe_id: universeId,
    });
  }
  redirect(`/game/${gameSlug}#community`);
}

export async function acceptAnswerAction(formData: FormData) {
  const questionId = String(formData.get("question_id") ?? "");
  const answerId = String(formData.get("answer_id") ?? "");
  if (!questionId || !answerId) redirect("/community");
  const { user, token } = await requireCommunityUser(`/questions/${questionId}`);

  let error: string | null = null;
  try {
    await userPatch(
      "questions",
      token,
      { id: `eq.${questionId}`, author_id: `eq.${user.id}` },
      { accepted_answer_id: answerId, status: "answered" },
    );
  } catch (caught) {
    unstable_rethrow(caught);
    error = caught instanceof Error ? caught.message : "답변 채택 실패";
  }
  if (error) redirect(`/questions/${questionId}?error=${msg(error)}`);
  redirect(`/questions/${questionId}#answers`);
}

export async function closeQuestionAction(formData: FormData) {
  const questionId = String(formData.get("question_id") ?? "");
  if (!questionId) redirect("/community");
  const { user, token } = await requireCommunityUser(`/questions/${questionId}`);
  await userPatch(
    "questions",
    token,
    { id: `eq.${questionId}`, author_id: `eq.${user.id}` },
    { status: "closed" },
  );
  redirect(`/questions/${questionId}`);
}

export async function reportAction(formData: FormData) {
  const questionId = String(formData.get("return_question_id") ?? "");
  const returnPath = safeReturnPath(
    formData.get("return_path"),
    questionId ? `/questions/${questionId}` : "/community",
  );
  const targetType = String(formData.get("target_type") ?? "");
  const targetId = String(formData.get("target_id") ?? "");
  const reason = String(formData.get("reason") ?? "other");
  const details = String(formData.get("details") ?? "").trim();
  const allowedTargets = new Set([
    "question",
    "answer",
    "comment",
    "profile",
    "party",
  ]);
  const allowedReasons = new Set([
    "spam",
    "harassment",
    "sexual",
    "personal_info",
    "scam",
    "exploit",
    "malicious_link",
    "other",
  ]);
  if (!allowedTargets.has(targetType) || !targetId || !allowedReasons.has(reason)) {
    redirect(`${returnPath}?${new URLSearchParams({
      error: "신고 정보를 확인해 주세요.",
    })}`);
  }

  const { user, token } = await requireCommunityUser(returnPath);

  let error: string | null = null;
  try {
    await userInsert("reports", token, {
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details,
    });
  } catch (caught) {
    unstable_rethrow(caught);
    error = caught instanceof Error ? caught.message : "신고 접수 실패";
  }

  const separator = returnPath.includes("?") ? "&" : "?";
  redirect(
    error
      ? `${returnPath}${separator}error=${msg(error)}`
      : `${returnPath}${separator}reported=1`,
  );
}

export async function createPartyAction(formData: FormData) {
  const universeId = Number(formData.get("game_universe_id"));
  const gameSlug = String(formData.get("game_slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const playstyle = String(formData.get("playstyle") ?? "casual");
  const maxMembers = Number(formData.get("max_members"));
  const durationMinutes = Number(formData.get("duration_minutes"));
  const robloxJoinUrl = String(formData.get("roblox_join_url") ?? "").trim();
  const allowedStyles = new Set([
    "casual",
    "competitive",
    "learning",
    "quest",
    "grind",
  ]);
  const allowedDurations = new Set([30, 60, 120, 180, 360]);

  if (
    !Number.isSafeInteger(universeId) ||
    !gameSlug ||
    title.length < 5 ||
    title.length > 100 ||
    note.length > 1000 ||
    !allowedStyles.has(playstyle) ||
    !Number.isSafeInteger(maxMembers) ||
    maxMembers < 2 ||
    maxMembers > 12 ||
    !allowedDurations.has(durationMinutes)
  ) {
    redirect(
      `/game/${gameSlug || "rivals"}/party?error=${msg("파티 입력값을 확인해 주세요.")}`,
    );
  }

  const { user, token } = await requireCommunityUser(
    `/game/${gameSlug}/party`,
  );

  let error: string | null = null;
  try {
    await userInsert("party_posts", token, {
      game_universe_id: universeId,
      host_id: user.id,
      title,
      note,
      playstyle,
      max_members: maxMembers,
      roblox_join_url: robloxJoinUrl || null,
      expires_at: new Date(Date.now() + durationMinutes * 60_000).toISOString(),
    });
  } catch (caught) {
    unstable_rethrow(caught);
    error = caught instanceof Error ? caught.message : "파티 등록 실패";
  }

  redirect(
    error
      ? `/game/${gameSlug}/party?error=${msg(error)}`
      : `/game/${gameSlug}/party?created=1`,
  );
}

export async function joinPartyAction(formData: FormData) {
  const partyId = String(formData.get("party_id") ?? "");
  const gameSlug = String(formData.get("game_slug") ?? "");
  if (!partyId || !gameSlug) redirect("/games");
  const { token } = await requireCommunityUser(`/game/${gameSlug}/party`);

  let error: string | null = null;
  try {
    await userRpc("r1_join_party", token, { p_party_id: partyId });
  } catch (caught) {
    unstable_rethrow(caught);
    error = caught instanceof Error ? caught.message : "파티 참여 실패";
  }
  redirect(
    error
      ? `/game/${gameSlug}/party?error=${msg(error)}`
      : `/game/${gameSlug}/party?joined=1`,
  );
}

export async function leavePartyAction(formData: FormData) {
  const partyId = String(formData.get("party_id") ?? "");
  const gameSlug = String(formData.get("game_slug") ?? "");
  if (!partyId || !gameSlug) redirect("/games");
  const { token } = await requireCommunityUser(`/game/${gameSlug}/party`);
  let error: string | null = null;
  try {
    await userRpc("r1_leave_party", token, { p_party_id: partyId });
  } catch (caught) {
    unstable_rethrow(caught);
    error = caught instanceof Error ? caught.message : "파티 나가기 실패";
  }
  redirect(
    error
      ? `/game/${gameSlug}/party?error=${msg(error)}`
      : `/game/${gameSlug}/party?left=1`,
  );
}

export async function closePartyAction(formData: FormData) {
  const partyId = String(formData.get("party_id") ?? "");
  const gameSlug = String(formData.get("game_slug") ?? "");
  if (!partyId || !gameSlug) redirect("/games");
  const { token } = await requireCommunityUser(`/game/${gameSlug}/party`);
  let error: string | null = null;
  try {
    await userRpc("r1_close_party", token, { p_party_id: partyId });
  } catch (caught) {
    unstable_rethrow(caught);
    error = caught instanceof Error ? caught.message : "파티 닫기 실패";
  }
  redirect(
    error
      ? `/game/${gameSlug}/party?error=${msg(error)}`
      : `/game/${gameSlug}/party?closed=1`,
  );
}

export async function markNotificationsReadAction() {
  const { user, token } = await requireCommunityUser("/notifications");
  await userPatch(
    "notifications",
    token,
    { user_id: `eq.${user.id}`, read_at: "is.null" },
    { read_at: new Date().toISOString() },
  );
  redirect("/notifications");
}

export async function moderateContentAction(formData: FormData) {
  const reportId = String(formData.get("report_id") ?? "");
  const targetType = String(formData.get("target_type") ?? "");
  const targetId = String(formData.get("target_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const { user, token, permissions } = await requireCommunityUser(
    "/admin/moderation",
  );
  if (!["moderator", "admin"].includes(permissions.role ?? "")) {
    redirect("/");
  }

  const table =
    targetType === "question"
      ? "questions"
      : targetType === "answer"
        ? "answers"
        : targetType === "comment"
          ? "comments"
          : null;

  let error: string | null = null;
  try {
    if (
      targetType === "party" &&
      (action === "hide" || action === "restore")
    ) {
      await userRpc("r1_set_party_moderation", token, {
        p_party_id: targetId,
        p_status: action === "hide" ? "removed" : "visible",
      });
      await userInsert("moderation_actions", token, {
        moderator_id: user.id,
        target_type: "party",
        target_id: targetId,
        action,
        reason: reason || action,
      });
    }

    if (table && (action === "hide" || action === "restore")) {
      await userPatch(
        table,
        token,
        { id: `eq.${targetId}` },
        { moderation_status: action === "hide" ? "removed" : "visible" },
      );
      await userInsert("moderation_actions", token, {
        moderator_id: user.id,
        target_type: targetType,
        target_id: targetId,
        action,
        reason: reason || action,
      });
    }

    if (reportId && (action === "resolve_report" || action === "dismiss_report")) {
      await userPatch(
        "reports",
        token,
        { id: `eq.${reportId}` },
        {
          status: action === "resolve_report" ? "resolved" : "dismissed",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        },
      );
      await userInsert("moderation_actions", token, {
        moderator_id: user.id,
        target_type: "report",
        target_id: reportId,
        action,
        reason: reason || action,
      });
    }
  } catch (caught) {
    unstable_rethrow(caught);
    error = caught instanceof Error ? caught.message : "운영 조치 실패";
  }

  redirect(
    error
      ? `/admin/moderation?error=${msg(error)}`
      : "/admin/moderation?saved=1",
  );
}
