import type { NotificationRow } from "./queries";
import { notificationHref } from "./notifications";
import { uuidPattern } from "./experience-model";
type Row = { id: string; question_id?: string | null; answer_id?: string | null; author_id?: string | null };
export type TargetReader = (table: string, id: string) => Promise<Row | null>;
const unavailable = (kind: "question" | "answer" | "comment", questionId?: string) => {
  if (questionId) return `/questions/${questionId}?notice=${kind}_unavailable#${kind === "answer" ? "answers" : "comments"}`;
  return "/notifications?message=" + encodeURIComponent(kind === "question" ? "이 질문은 더 이상 볼 수 없습니다." : kind === "answer" ? "이 답변은 더 이상 볼 수 없습니다." : "이 댓글은 더 이상 볼 수 없습니다.");
};
// Caller verifies notification ownership before entering this resolver. A lookup
// failure throws; only a confirmed missing/hidden/deleted target is "unavailable".
export async function resolveNotificationTarget(item: NotificationRow, gameSlug: string | null, read: TargetReader): Promise<string> {
  if (![item.question_id,item.answer_id,item.comment_id].some(Boolean)) return notificationHref(item,gameSlug);
  const get = async (table: string, id: string | null | undefined) => id && uuidPattern.test(id) ? read(table,id) : null;
  const comment = item.comment_id ? await get("comments",item.comment_id) : null;
  const answerId = item.answer_id ?? comment?.answer_id ?? null;
  const answer = answerId ? await get("answers",answerId) : null;
  const questionId = item.question_id ?? answer?.question_id ?? comment?.question_id ?? null;
  const question = await get("questions",questionId);
  if (!question || !questionId) return unavailable("question");
  if (answerId && (!answer || !answer.author_id || answer.question_id !== questionId)) return unavailable("answer",questionId);
  if (item.comment_id) {
    if (!comment || !comment.author_id || (comment.answer_id ? comment.answer_id !== answerId || !answer : comment.question_id !== questionId)) return unavailable("comment",questionId);
    return `/questions/${questionId}#comment-${comment.id}`;
  }
  if (answer) return `/questions/${questionId}#answer-${answer.id}`;
  return `/questions/${questionId}`;
}
