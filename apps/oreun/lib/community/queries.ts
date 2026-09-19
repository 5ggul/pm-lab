import {
  communityConfig,
  publicSelect,
  userRpc,
  userSelect,
} from "./rest";

export type QuestionFeedRow = {
  id: string;
  game_universe_id: number | string;
  game_slug: string;
  game_name_ko: string;
  author_id: string;
  author_handle: string;
  author_name: string;
  title: string;
  body: string;
  status: string;
  accepted_answer_id: string | null;
  created_at: string;
  updated_at: string;
  answer_count: number;
  comment_count: number;
};

export type AnswerFeedRow = {
  id: string;
  question_id: string;
  author_id: string;
  author_handle: string;
  author_name: string;
  body: string;
  created_at: string;
  updated_at: string;
  is_accepted: boolean;
  comment_count: number;
};

export type CommentFeedRow = {
  id: string;
  question_id: string | null;
  answer_id: string | null;
  author_id: string;
  author_handle: string;
  author_name: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type PublicProfile = {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string;
  created_at: string;
  updated_at: string;
};

export async function getQuestionFeed({
  gameUniverseId,
  limit = 30,
}: {
  gameUniverseId?: number;
  limit?: number;
} = {}) {
  if (!communityConfig()) return [];
  return publicSelect<QuestionFeedRow>("r1_question_feed", {
    select: "*",
    ...(gameUniverseId ? { game_universe_id: `eq.${gameUniverseId}` } : {}),
    order: "created_at.desc",
    limit,
  });
}

export async function getQuestion(id: string) {
  if (!communityConfig()) return null;
  const rows = await publicSelect<QuestionFeedRow>("r1_question_feed", {
    select: "*",
    id: `eq.${id}`,
    limit: 1,
  });
  return rows[0] ?? null;
}

export function getAnswers(questionId: string) {
  if (!communityConfig()) return Promise.resolve([] as AnswerFeedRow[]);
  return publicSelect<AnswerFeedRow>("r1_answer_feed", {
    select: "*",
    question_id: `eq.${questionId}`,
    order: "is_accepted.desc,created_at.asc",
    limit: 100,
  });
}

export function getQuestionComments(questionId: string) {
  if (!communityConfig()) return Promise.resolve([] as CommentFeedRow[]);
  return publicSelect<CommentFeedRow>("r1_comment_feed", {
    select: "*",
    question_id: `eq.${questionId}`,
    order: "created_at.asc",
    limit: 100,
  });
}

export async function getProfile(id: string) {
  if (!communityConfig()) return null;
  const rows = await publicSelect<PublicProfile>("profiles", {
    select: "id,handle,display_name,bio,created_at,updated_at",
    id: `eq.${id}`,
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function getOwnFollow(
  token: string,
  userId: string,
  universeId: number,
) {
  const rows = await userSelect<{ user_id: string; universe_id: number | string }>(
    "game_follows",
    token,
    {
      select: "user_id,universe_id",
      user_id: `eq.${userId}`,
      universe_id: `eq.${universeId}`,
      limit: 1,
    },
  );
  return rows.length > 0;
}

export type CommunityPermissions = {
  authenticated: boolean;
  active: boolean;
  age_confirmed_14_plus: boolean;
  role: "user" | "moderator" | "admin" | null;
};

export async function getCommunityPermissions(token: string) {
  return userRpc<CommunityPermissions>(
    "r1_my_community_permissions",
    token,
  );
}

export type NotificationRow = {
  id: string;
  kind: string;
  actor_id: string | null;
  game_universe_id: number | string | null;
  question_id: string | null;
  answer_id: string | null;
  comment_id: string | null;
  update_event_id: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export function getNotifications(token: string, userId: string) {
  return userSelect<NotificationRow>("notifications", token, {
    select: "*",
    user_id: `eq.${userId}`,
    order: "created_at.desc",
    limit: 100,
  });
}

export type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export function getModerationReports(token: string) {
  return userSelect<ReportRow>("reports", token, {
    select: "*",
    order: "status.asc,created_at.asc",
    limit: 100,
  });
}

export function getAnswerComments(answerIds: string[]) {
  if (!answerIds.length || !communityConfig()) {
    return Promise.resolve([] as CommentFeedRow[]);
  }
  return publicSelect<CommentFeedRow>("r1_comment_feed", {
    select: "*",
    answer_id: `in.(${answerIds.join(",")})`,
    order: "created_at.asc",
    limit: 300,
  });
}
