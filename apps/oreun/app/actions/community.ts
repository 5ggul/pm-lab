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
} from "@/lib/community/rest";

function msg(value: string) {
  return encodeURIComponent(value.slice(0, 180));
}

async function requireCommunityUser(next: string) {
  const [user, token] = await Promise.all([
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);
  if (!user || !token) redirect(`/login?next=${encodeURIComponent(next)}`);

  const permissions = await getCommunityPermissions(token);
  if (!permissions.active || !permissions.age_confirmed_14_plus) {
    redirect(
      `/me?error=${msg("커뮤니티 글 작성은 만 14세 이상 확인과 활성 계정이 필요합니다.")}`,
    );
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
  const targetType = String(formData.get("target_type") ?? "");
  const targetId = String(formData.get("target_id") ?? "");
  const reason = String(formData.get("reason") ?? "other");
  const details = String(formData.get("details") ?? "").trim();
  const allowedTargets = new Set(["question", "answer", "comment", "profile"]);
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
    if (questionId) redirect(`/questions/${questionId}?error=${msg("신고 정보를 확인해 주세요.")}`);
    redirect("/community");
  }

  const { user, token } = await requireCommunityUser(
    questionId ? `/questions/${questionId}` : "/community",
  );

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

  if (questionId) {
    redirect(
      `/questions/${questionId}?${error ? `error=${msg(error)}` : "reported=1"}`,
    );
  }
  redirect(error ? `/community?error=${msg(error)}` : "/community?reported=1");
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
