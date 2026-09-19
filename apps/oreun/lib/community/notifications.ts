import type { NotificationRow } from "./queries";

export const notificationLabels: Record<string, string> = {
  followed_game_question: "팔로우한 게임에 새 질문",
  followed_game_update: "팔로우한 게임 업데이트 감지",
  followed_game_code: "팔로우한 게임 새 코드",
  followed_game_guide: "팔로우한 게임 새 공략",
  question_answer: "내 질문에 새 답변",
  question_comment: "내 질문에 새 댓글",
  answer_comment: "내 답변에 새 댓글",
  answer_accepted: "내 답변이 채택됨",
  moderation: "운영 알림",
};

export function notificationHref(
  item: NotificationRow,
  gameSlug: string | null,
) {
  if (item.question_id) return `/questions/${item.question_id}`;

  if (gameSlug && item.kind === "followed_game_update") {
    return (
      `/game/${gameSlug}/updates` +
      (item.update_event_id ? `#event-${item.update_event_id}` : "")
    );
  }

  if (gameSlug && item.kind === "followed_game_code") {
    return `/game/${gameSlug}/codes`;
  }

  if (gameSlug && item.kind === "followed_game_guide") {
    return `/game/${gameSlug}/guides`;
  }

  if (gameSlug) return `/game/${gameSlug}`;
  return "/community";
}
