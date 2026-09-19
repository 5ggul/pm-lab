import {
  communityConfig,
  publicSelect,
  userSelect,
} from "@/lib/community/rest";

export type ContentSource = {
  id: string;
  universe_id: number | string | null;
  source_type: string;
  label: string;
  source_url: string;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
};

export type GameGuide = {
  id: string;
  universe_id: number | string;
  slug: string;
  guide_type: string;
  title: string;
  summary: string;
  body: string;
  source_id: string | null;
  content_status: "draft" | "published" | "archived";
  index_state: "noindex" | "indexable";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GameCode = {
  id: string;
  universe_id: number | string;
  code: string;
  reward_text: string;
  code_status: "active" | "expired" | "unknown";
  visibility: "draft" | "published" | "archived";
  source_id: string | null;
  verified_at: string | null;
  last_checked_at: string | null;
  expires_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type GameUpdateEvent = {
  id: string;
  universe_id: number | string;
  source_updated_at: string;
  first_observed_at: string;
  event_kind: "baseline" | "provider_update_detected";
  source_url: string;
  created_at: string;
};

export async function getPublishedGuides(universeId: number) {
  if (!communityConfig()) return [] as GameGuide[];
  return publicSelect<GameGuide>("game_guides", {
    select: "*",
    universe_id: `eq.${universeId}`,
    content_status: "eq.published",
    order: "published_at.desc",
    limit: 100,
  });
}

export async function getPublishedGuide(universeId: number, slug: string) {
  if (!communityConfig()) return null;
  const rows = await publicSelect<GameGuide>("game_guides", {
    select: "*",
    universe_id: `eq.${universeId}`,
    slug: `eq.${slug}`,
    content_status: "eq.published",
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function getPublishedCodes(universeId: number) {
  if (!communityConfig()) return [] as GameCode[];
  return publicSelect<GameCode>("game_codes", {
    select: "*",
    universe_id: `eq.${universeId}`,
    visibility: "eq.published",
    order: "code_status.asc,last_checked_at.desc",
    limit: 200,
  });
}

export async function getUpdateEvents(universeId: number, limit = 100) {
  if (!communityConfig()) return [] as GameUpdateEvent[];
  return publicSelect<GameUpdateEvent>("game_update_events", {
    select: "*",
    universe_id: `eq.${universeId}`,
    order: "source_updated_at.desc",
    limit,
  });
}

export async function getContentSources(universeId?: number) {
  if (!communityConfig()) return [] as ContentSource[];
  return publicSelect<ContentSource>("content_sources", {
    select: "*",
    ...(universeId ? { universe_id: `eq.${universeId}` } : {}),
    order: "last_checked_at.desc",
    limit: 500,
  });
}

export async function getAdminGuides(token: string) {
  return userSelect<GameGuide>("game_guides", token, {
    select: "*",
    order: "updated_at.desc",
    limit: 200,
  });
}

export async function getAdminCodes(token: string) {
  return userSelect<GameCode>("game_codes", token, {
    select: "*",
    order: "updated_at.desc",
    limit: 300,
  });
}

export function isFreshCodeCheck(code: GameCode, now = new Date()) {
  if (!code.last_checked_at) return false;
  const age =
    now.getTime() - new Date(code.last_checked_at).getTime();
  return age <= 7 * 24 * 60 * 60 * 1000;
}
