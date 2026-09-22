import { communityConfig, publicSelect, userSelect } from "./rest";
import type { QuestionFeedRow } from "./queries";
import { questionFeedQuery, type FeedFilters } from "./experience-model";
export async function getFollowingIds(token: string, userId: string) {
  const rows = await userSelect<{ universe_id: number | string }>("game_follows", token, { select: "universe_id", user_id: `eq.${userId}`, limit: 100 });
  return rows.map(row => Number(row.universe_id)).filter(id => Number.isSafeInteger(id) && id > 0);
}
export async function getFilteredQuestions(filters: FeedFilters, followedIds?: number[]) {
  const query = questionFeedQuery(filters, followedIds);
  if (!query || !communityConfig()) return { rows: [] as QuestionFeedRow[], hasNext: false };
  const rows = await publicSelect<QuestionFeedRow>("r1_question_feed", query);
  return { rows: rows.slice(0, 20), hasNext: rows.length > 20 };
}
