import {
  communityConfig,
  publicSelect,
  userSelect,
} from "@/lib/community/rest";

export type PartyFeedRow = {
  id: string;
  game_universe_id: number | string;
  game_slug: string;
  game_name_ko: string;
  host_id: string;
  host_handle: string;
  host_name: string;
  title: string;
  note: string;
  playstyle: "casual" | "competitive" | "learning" | "quest" | "grind";
  max_members: number;
  member_count: number;
  roblox_join_url: string | null;
  status: "open" | "full";
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type ContributionSummary = {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  created_at: string;
  question_count: number;
  answer_count: number;
  accepted_answer_count: number;
  comment_count: number;
};

export async function getPartyFeed(universeId: number, limit = 50) {
  if (!communityConfig()) return [] as PartyFeedRow[];
  return publicSelect<PartyFeedRow>("r1_party_feed", {
    select: "*",
    game_universe_id: `eq.${universeId}`,
    order: "status.asc,expires_at.asc,created_at.desc",
    limit,
  });
}

export async function getOwnPartyIds(token: string, userId: string) {
  const rows = await userSelect<{ party_id: string }>(
    "party_members",
    token,
    {
      select: "party_id",
      user_id: `eq.${userId}`,
      limit: 200,
    },
  );
  return new Set(rows.map((row) => row.party_id));
}

export async function getContributionByHandle(handle: string) {
  if (!communityConfig()) return null;
  const rows = await publicSelect<ContributionSummary>(
    "r1_profile_contribution_summary",
    {
      select: "*",
      handle: `eq.${handle.toLowerCase()}`,
      limit: 1,
    },
  );
  return rows[0] ?? null;
}

export async function getQuestionsByAuthor(authorId: string, limit = 20) {
  if (!communityConfig()) return [];
  return publicSelect<{
    id: string;
    game_slug: string;
    game_name_ko: string;
    title: string;
    status: string;
    created_at: string;
    answer_count: number;
  }>("r1_question_feed", {
    select:
      "id,game_slug,game_name_ko,title,status,created_at,answer_count",
    author_id: `eq.${authorId}`,
    order: "created_at.desc",
    limit,
  });
}

export async function getAnswersByAuthor(authorId: string, limit = 20) {
  if (!communityConfig()) return [];
  return publicSelect<{
    id: string;
    question_id: string;
    body: string;
    created_at: string;
    is_accepted: boolean;
  }>("r1_answer_feed", {
    select: "id,question_id,body,created_at,is_accepted",
    author_id: `eq.${authorId}`,
    order: "created_at.desc",
    limit,
  });
}
