export type WriteAccess = "guest" | "ready" | "age" | "restricted" | "unavailable";
export function writeAccess(signedIn: boolean, permissions: { active: boolean; age_confirmed_14_plus: boolean } | null): WriteAccess {
  if (!signedIn) return "guest";
  if (!permissions) return "unavailable";
  if (!permissions.active) return "restricted";
  return permissions.age_confirmed_14_plus ? "ready" : "age";
}
export const questionStates = ["latest", "unanswered", "resolved"] as const;
export type QuestionState = typeof questionStates[number];
export type FeedFilters = { state: QuestionState; game: string; scope: "all" | "following"; page: number };
export function normalizeFeedFilters(input: { state?: string; game?: string; scope?: string; page?: string }): FeedFilters {
  return {
    state: questionStates.includes(input.state as QuestionState) ? input.state as QuestionState : "latest",
    game: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.game ?? "") ? input.game! : "",
    scope: input.scope === "following" ? "following" : "all",
    page: /^\d+$/.test(input.page ?? "") ? Math.min(100, Math.max(1, Number(input.page))) : 1,
  };
}
export function feedHref(path: string, filters: FeedFilters) {
  const query = new URLSearchParams();
  if (filters.state !== "latest") query.set("state", filters.state);
  if (filters.game) query.set("game", filters.game);
  if (filters.scope === "following") query.set("scope", "following");
  if (filters.page > 1) query.set("page", String(filters.page));
  return path + (query.size ? "?" + query.toString() : "");
}
export function questionFeedQuery(filters: FeedFilters, followedIds?: number[]) {
  if (filters.scope === "following" && !followedIds?.length) return null;
  return {
    select: "*", order: "created_at.desc,id.desc", limit: 21, offset: (filters.page - 1) * 20,
    ...(filters.game ? { game_slug: `eq.${filters.game}` } : {}),
    ...(filters.state === "unanswered" ? { answer_count: "eq.0", status: "eq.open" } : {}),
    ...(filters.state === "resolved" ? { accepted_answer_id: "not.is.null" } : {}),
    ...(filters.scope === "following" ? { game_universe_id: `in.(${followedIds!.filter(Number.isSafeInteger).filter(id => id > 0).join(",")})` } : {}),
  };
}
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type WriteResult = { status: "success" | "conflict" | "error" | "login" | "age" | "restricted" | "unavailable"; message: string; href?: string; hrefLabel?: string; canStartNew?: boolean };
export type QuestionResult = WriteResult;
export type AnswerResult = WriteResult;
export function questionInputError(title: string, body: string, requestId: string) {
  if (!uuidPattern.test(requestId)) return "등록 요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.";
  if (title.trim().length < 5 || title.trim().length > 120) return "제목은 5~120자로 작성해 주세요.";
  if (body.trim().length < 10 || body.trim().length > 5000) return "내용은 10~5,000자로 작성해 주세요.";
  return null;
}
export function questionSaveError(message: string) {
  if (/restricted contact|credential pattern/i.test(message)) return "연락처나 계정 인증정보가 포함되어 있지 않은지 확인해 주세요. 입력한 글은 그대로 남아 있습니다.";
  if (/rate.limit|too many/i.test(message)) return "짧은 시간에 등록한 글이 많습니다. 잠시 뒤 다시 등록해 주세요.";
  if (/question_request_conflict/i.test(message)) return "같은 요청으로 이미 다른 내용이 등록되었습니다. 내 질문을 확인한 뒤 새 글을 작성해 주세요.";
  return "질문을 등록하지 못했습니다. 입력한 글은 유지됩니다. 잠시 뒤 다시 시도해 주세요.";
}
export function answerInputError(body: string, requestId: string) {
  if (!uuidPattern.test(requestId)) return "등록 요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.";
  if (body.trim().length < 2 || body.trim().length > 5000) return "답변은 2~5,000자로 작성해 주세요.";
  return null;
}
export function answerSaveError(message: string) {
  if (/restricted contact|credential pattern/i.test(message)) return "연락처나 계정 인증정보가 포함되어 있지 않은지 확인해 주세요. 작성한 답변은 그대로 남아 있습니다.";
  if (/rate.limit|too many/i.test(message)) return "짧은 시간에 등록한 글이 많습니다. 잠시 뒤 다시 등록해 주세요.";
  if (/answer_request_conflict/i.test(message)) return "같은 등록 요청으로 다른 답변이 이미 처리됐습니다. 질문을 새로고침해 확인해 주세요.";
  if (/question_unavailable/i.test(message)) return "이 질문에는 더 이상 답변을 등록할 수 없습니다.";
  return "답변을 등록하지 못했습니다. 작성한 내용은 유지됩니다. 잠시 뒤 다시 시도해 주세요.";
}
export type NotificationFilter = "all" | "unread" | "replies" | "games";
export function notificationFilter(value?: string): NotificationFilter {
  return ["unread", "replies", "games"].includes(value ?? "") ? value as NotificationFilter : "all";
}
export function notificationQuery(filter: NotificationFilter, userId: string) {
  return {
    select: "*", user_id: `eq.${userId}`, order: "created_at.desc,id.desc", limit: 100,
    ...(filter === "unread" ? { read_at: "is.null" } : {}),
    ...(filter === "replies" ? { kind: "in.(question_answer,question_comment,answer_comment,answer_accepted)" } : {}),
    ...(filter === "games" ? { kind: "in.(followed_game_question,followed_game_update,followed_game_code,followed_game_guide)" } : {}),
  };
}
