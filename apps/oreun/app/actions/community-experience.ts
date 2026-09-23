'use server';

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth/session";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import { getCommunityPermissions, type NotificationRow } from "@/lib/community/queries";
import { userPatch, userRpc, userSelect } from "@/lib/community/rest";
import { resolveNotificationTarget } from "@/lib/community/notification-target";
import { submitWithRecovery } from "@/lib/community/write-recovery";
import {
  answerInputError,
  answerSaveError,
  questionInputError,
  questionSaveError,
  uuidPattern,
  writeAccess,
  type AnswerResult,
  type QuestionResult,
} from "@/lib/community/experience-model";

export async function submitQuestion(form: FormData): Promise<QuestionResult> {
  const slug = String(form.get("game_slug") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const requestId = String(form.get("request_id") ?? "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { status: "error", message: "게임을 다시 선택해 주세요." };
  const next = `/game/${slug}/questions`;
  try {
    const [user, token] = await Promise.all([getCurrentUser(), getCurrentAccessToken()]);
    if (!user || !token) return { status: "login", message: "로그인이 만료됐습니다. 같은 Google 계정으로 로그인하면 이 탭의 초안을 이어서 쓸 수 있습니다.", href: `/login?next=${encodeURIComponent(next)}` };
    if (String(form.get("draft_user_id") ?? "") !== user.id) return { status: "login", message: "작성 중인 계정과 현재 계정이 다릅니다. 원래 계정으로 다시 로그인해 주세요.", href: `/me?next=${encodeURIComponent(next)}` };
    const permissions = await getCommunityPermissions(token);
    const access = writeAccess(true, permissions);
    if (access === "restricted") return { status: "restricted", message: "이 계정은 현재 글을 작성할 수 없습니다.", href: "/contact" };
    if (access === "age") return { status: "age", message: "프로필에서 만 14세 이상 여부를 확인해 주세요.", href: `/me?next=${encodeURIComponent(next)}` };
    if (access !== "ready") return { status: "unavailable", message: "계정 상태를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
    const validation = questionInputError(title, body, requestId);
    if (validation) return { status: "error", message: validation };
    const game = await getGameBySlug(slug);
    if (!game || game.universeId !== Number(form.get("game_universe_id"))) return { status: "error", message: "선택한 게임을 확인하지 못했습니다. 페이지를 새로고침해 주세요." };
    return await submitWithRecovery({ kind: "question", token, userId: user.id, requestId, values: { game_universe_id: game.universeId, title, body } }, async () => {
    const id = await userRpc<string>("r1_submit_question", token, { p_game_universe_id: game.universeId, p_title: title, p_body: body, p_request_id: requestId });
    if (!uuidPattern.test(id)) throw new Error("invalid question response");
    revalidatePath("/community");
    revalidatePath(next);
    return { status: "success", message: "질문을 등록했습니다.", href: `/questions/${id}` };
    });
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", message: questionSaveError(error instanceof Error ? error.message : "") };
  }
}

export async function submitAnswer(form: FormData): Promise<AnswerResult> {
  const questionId = String(form.get("question_id") ?? "");
  const body = String(form.get("body") ?? "").trim();
  const requestId = String(form.get("request_id") ?? "");
  const next = `/questions/${questionId}#answers`;

  if (!uuidPattern.test(questionId)) return { status: "error", message: "질문을 확인할 수 없습니다." };

  try {
    const [user, token] = await Promise.all([getCurrentUser(), getCurrentAccessToken()]);
    if (!user || !token) {
      return { status: "login", message: "로그인이 만료됐습니다. 같은 Google 계정으로 로그인하면 작성 중인 답변을 이어서 쓸 수 있습니다.", href: `/login?next=${encodeURIComponent(next)}` };
    }
    if (String(form.get("draft_user_id") ?? "") !== user.id) {
      return { status: "login", message: "작성 중인 계정과 현재 계정이 다릅니다.", href: `/me?next=${encodeURIComponent(next)}` };
    }
    const permissions = await getCommunityPermissions(token);
    const access = writeAccess(true, permissions);
    if (access === "restricted") return { status: "restricted", message: "이 계정은 현재 글을 작성할 수 없습니다.", href: "/contact" };
    if (access === "age") return { status: "age", message: "프로필에서 만 14세 이상 여부를 확인해 주세요.", href: `/me?next=${encodeURIComponent(next)}` };
    if (access !== "ready") return { status: "unavailable", message: "계정 상태를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };

    const validation = answerInputError(body, requestId);
    if (validation) return { status: "error", message: validation };

    return await submitWithRecovery({ kind: "answer", token, userId: user.id, requestId, values: { question_id: questionId, body } }, async () => {
    const id = await userRpc<string>("r1_submit_answer", token, {
      p_question_id: questionId,
      p_body: body,
      p_request_id: requestId,
    });
    if (!uuidPattern.test(id)) throw new Error("invalid answer response");
    revalidatePath(`/questions/${questionId}`);
    revalidatePath("/community");
    return { status: "success", message: "답변을 등록했습니다.", href: `/questions/${questionId}#answer-${id}` };
    });
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", message: answerSaveError(error instanceof Error ? error.message : "") };
  }
}

export async function openNotification(form: FormData) {
  const id = String(form.get("notification_id") ?? "");
  if (!uuidPattern.test(id)) redirect("/notifications?message=알림을+확인할+수+없습니다.");
  const [user, token] = await Promise.all([getCurrentUser(), getCurrentAccessToken()]);
  if (!user || !token) redirect("/login?next=%2Fnotifications");
  let destination = "/notifications";
  let failed = false;
  try {
    const rows = await userSelect<NotificationRow>("notifications", token, {
      select: "*", id: `eq.${id}`, user_id: `eq.${user.id}`, limit: 1,
    });
    const item = rows[0];
    if (!item) throw new Error("Notification unavailable");
    const games = await getGameCatalog();
    const game = games.find(g => g.universeId === Number(item.game_universe_id));
    destination = await resolveNotificationTarget(item, game?.slug ?? null, async (table, targetId) => {
      const select = table === "comments" ? "id,author_id,question_id,answer_id" : table === "answers" ? "id,author_id,question_id" : "id";
      const targets = await userSelect<{id:string;author_id?:string|null;question_id?:string|null;answer_id?:string|null}>(table,token, {
        select, id: `eq.${targetId}`, moderation_status: "eq.visible", limit: 1,
      });
      return targets[0] ?? null;
    });
    // Missing content is a handled notification, so read only this owner's item.
    // DB/network errors above never reach this write.
    if (!(await userRpc<boolean>("r1_mark_notification_read",token,{p_notification_id:id}))) throw new Error("Notification read failed");
  } catch (error) { unstable_rethrow(error); failed = true; }
  if (failed) redirect("/notifications?message=알림을+열지+못했습니다.+잠시+뒤+다시+시도해+주세요.");
  revalidatePath("/notifications"); revalidatePath("/me"); redirect(destination);
}

export async function readAllNotifications() {
  const [user, token] = await Promise.all([getCurrentUser(), getCurrentAccessToken()]);
  if (!user || !token) redirect("/login?next=%2Fnotifications");
  let failed = false;
  try {
    await userPatch("notifications", token, { user_id: `eq.${user.id}`, read_at: "is.null" }, { read_at: new Date().toISOString() });
  } catch (error) {
    unstable_rethrow(error);
    failed = true;
  }
  if (failed) redirect("/notifications?message=읽음+처리를+완료하지+못했습니다.");
  revalidatePath("/notifications");
  revalidatePath("/me");
  redirect("/notifications");
}
