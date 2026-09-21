import {
  communityConfig,
  publicSelect,
  userSelect,
} from "@/lib/community/rest";
import {
  getVerifiedEditorialGuide,
  getVerifiedEditorialGuides,
  getVerifiedEditorialSources,
} from "@/lib/content/verified-guides";

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
  review_status: "draft" | "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string;
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
  review_status: "draft" | "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string;
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
  const verified = getVerifiedEditorialGuides(universeId) as GameGuide[];
  if (!communityConfig()) return verified;
  const rows = await publicSelect<GameGuide>("game_guides", {
    select: "*",
    universe_id: `eq.${universeId}`,
    content_status: "eq.published",
    order: "published_at.desc",
    limit: 100,
  });
  const dbSlugs = new Set(rows.map((row) => row.slug));
  return [
    ...rows,
    ...verified.filter((guide) => !dbSlugs.has(guide.slug)),
  ].sort(
    (a, b) =>
      new Date(b.published_at ?? 0).getTime() -
      new Date(a.published_at ?? 0).getTime(),
  );
}

export async function getPublishedGuide(universeId: number, slug: string) {
  const verified = getVerifiedEditorialGuide(universeId, slug) as GameGuide | null;
  if (!communityConfig()) return verified;
  const rows = await publicSelect<GameGuide>("game_guides", {
    select: "*",
    universe_id: `eq.${universeId}`,
    slug: `eq.${slug}`,
    content_status: "eq.published",
    limit: 1,
  });
  return rows[0] ?? verified;
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

export async function getRecentUpdateEvents(limit = 100) {
  if (!communityConfig()) return [] as GameUpdateEvent[];
  return publicSelect<GameUpdateEvent>("game_update_events", {
    select: "*",
    event_kind: "eq.provider_update_detected",
    order: "first_observed_at.desc",
    limit,
  });
}

export async function getContentSources(universeId?: number) {
  const verified = getVerifiedEditorialSources(universeId) as ContentSource[];
  if (!communityConfig()) return verified;
  const rows = await publicSelect<ContentSource>("content_sources", {
    select: "*",
    ...(universeId ? { universe_id: `eq.${universeId}` } : {}),
    order: "last_checked_at.desc",
    limit: 500,
  });
  const dbSourceKeys = new Set(
    rows.map(
      (row) => String(row.universe_id ?? "common") + "|" + row.source_url,
    ),
  );
  return [
    ...rows,
    ...verified.filter(
      (source) =>
        !dbSourceKeys.has(
          String(source.universe_id ?? "common") + "|" + source.source_url,
        ),
    ),
  ].sort(
    (a, b) =>
      new Date(b.last_checked_at).getTime() -
      new Date(a.last_checked_at).getTime(),
  );
}

export function resolveGuideSource(
  guide: Pick<GameGuide, "universe_id" | "source_id">,
  sources: ContentSource[],
) {
  if (!guide.source_id) return null;

  const direct = sources.find((source) => source.id === guide.source_id);
  if (direct) return direct;

  const verified = getVerifiedEditorialSources(Number(guide.universe_id)).find(
    (source) => source.id === guide.source_id,
  ) as ContentSource | undefined;
  if (!verified) return null;

  return (
    sources.find(
      (source) =>
        Number(source.universe_id) === Number(guide.universe_id) &&
        source.source_url === verified.source_url,
    ) ?? verified
  );
}

export async function getAdminSources(token: string) {
  return userSelect<ContentSource>("content_sources", token, {
    select: "*",
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
