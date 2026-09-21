import { getFreshnessState } from "../freshness";
import { getRegionalAvailability } from "../regional-availability";
import type {
  GameIdentity,
  GameMediaImage,
  GameMediaVideo,
  GameView,
  HistoryPoint,
} from "../types";

type QueryValue = string | number | boolean | null | undefined;

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

export function getSupabasePublicConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabasePublicConfig | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url: url.replace(/\/$/, ""), publishableKey };
}

class PublicRest {
  constructor(private config: SupabasePublicConfig) {}

  async select<T>(
    table: string,
    query: Record<string, QueryValue>,
  ): Promise<T[]> {
    const url = new URL(`/rest/v1/${table}`, this.config.url);
    for (const [key, value] of Object.entries(query)) {
      if (value != null) url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      headers: {
        apikey: this.config.publishableKey,
        accept: "application/json",
      },
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      throw new Error(`Supabase public read ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    return await response.json() as T[];
  }
}

type DbGame = {
  universe_id: number | string;
  root_place_id: number | string;
  canonical_slug: string;
  name_ko: string;
  description_ko: string;
  index_state: GameIdentity["indexState"];
};
type DbAlias = { universe_id: number | string; alias: string };
type DbState = {
  universe_id: number | string;
  name: string;
  description: string;
  creator_name: string | null;
  playing: number | string | null;
  visits: number | string | null;
  favorites: number | string | null;
  source_updated_at: string | null;
  fetched_at: string;
  freshness_state: GameView["freshnessState"];
};
type DbRollup = {
  universe_id: number | string;
  bucket_at: string;
  playing_last: number | string | null;
  coverage_ratio: number | string;
};
type DbEnrichment = {
  universe_id: number | string;
  creator_id: number | string | null;
  creator_name: string | null;
  creator_type: "User" | "Group" | null;
  creator_verified: boolean;
  max_players: number | string | null;
  genre: string | null;
  genre_l1: string | null;
  genre_l2: string | null;
  experience_created_at: string | null;
  experience_updated_at: string | null;
  hero_image_url: string | null;
  media_images: GameMediaImage[];
  media_videos: GameMediaVideo[];
  fallback_name: string | null;
  fallback_description: string | null;
  fallback_visits: number | string | null;
  fallback_favorites: number | string | null;
  fallback_source_updated_at: string | null;
  fallback_fetched_at: string | null;
  fallback_source_provider: string | null;
};

export async function getPersistentGameCatalog(): Promise<GameView[] | null> {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  const db = new PublicRest(config);

  const [games, aliases, states] = await Promise.all([
    db.select<DbGame>("games", {
      select: "universe_id,root_place_id,canonical_slug,name_ko,description_ko,index_state",
      index_state: "neq.retired",
      order: "universe_id.asc",
    }),
    db.select<DbAlias>("game_aliases", {
      select: "universe_id,alias",
      order: "id.asc",
    }),
    db.select<DbState>("game_provider_state", {
      select: "universe_id,name,description,creator_name,playing,visits,favorites,source_updated_at,fetched_at,freshness_state",
    }),
  ]);

  const aliasMap = new Map<number, string[]>();
  for (const alias of aliases) {
    const id = Number(alias.universe_id);
    aliasMap.set(id, [...(aliasMap.get(id) ?? []), alias.alias]);
  }
  const stateMap = new Map(states.map((state) => [Number(state.universe_id), state]));

  let enrichmentRows: DbEnrichment[] = [];
  try {
    enrichmentRows = await db.select<DbEnrichment>("game_enrichment", {
      select:
        "universe_id,creator_id,creator_name,creator_type,creator_verified,max_players,genre,genre_l1,genre_l2,experience_created_at,experience_updated_at,hero_image_url,media_images,media_videos,fallback_name,fallback_description,fallback_visits,fallback_favorites,fallback_source_updated_at,fallback_fetched_at,fallback_source_provider",
    });
  } catch {
    enrichmentRows = [];
  }
  const enrichmentMap = new Map(
    enrichmentRows.map((row) => [Number(row.universe_id), row]),
  );

  return games.map((game) => {
    const id = Number(game.universe_id);
    const regionalAvailability = getRegionalAvailability(id);
    const state = stateMap.get(id);
    const enrichment = enrichmentMap.get(id);
    const timeFreshness = state?.fetched_at
      ? getFreshnessState(state.fetched_at)
      : "unavailable";
    const freshnessState = !state
      ? "unavailable"
      : state.freshness_state === "unavailable" ||
          state.freshness_state === "insufficient_data"
        ? state.freshness_state
        : timeFreshness;
    const currentPlaying =
      freshnessState === "stale" || freshnessState === "unavailable"
        ? null
        : state?.playing == null
          ? null
          : Number(state.playing);
    return {
      universeId: id,
      rootPlaceId: Number(game.root_place_id),
      slug: game.canonical_slug,
      nameKo: game.name_ko,
      aliases: aliasMap.get(id) ?? [game.name_ko],
      descriptionKo: game.description_ko,
      indexState: game.index_state,
      name: state?.name ?? enrichment?.fallback_name ?? game.name_ko,
      description:
        state?.description ?? enrichment?.fallback_description ?? "",
      creatorName:
        state?.creator_name ?? enrichment?.creator_name ?? "알 수 없음",
      playing: currentPlaying,
      visits:
        state?.visits != null
          ? Number(state.visits)
          : enrichment?.fallback_visits != null
            ? Number(enrichment.fallback_visits)
            : null,
      favorites:
        state?.favorites != null
          ? Number(state.favorites)
          : enrichment?.fallback_favorites != null
            ? Number(enrichment.fallback_favorites)
            : null,
      sourceUpdatedAt:
        state?.source_updated_at ??
        enrichment?.fallback_source_updated_at ??
        null,
      fetchedAt:
        state?.fetched_at ?? enrichment?.fallback_fetched_at ?? "",
      sourceProvider:
        state
          ? "roblox_public_games"
          : enrichment?.fallback_source_provider ?? "roblox_public_games",
      sourceEndpoint:
        state
          ? "https://games.roblox.com/v1/games"
          : enrichment?.fallback_source_provider
            ? "verified_official_fallback"
            : "https://games.roblox.com/v1/games",
      sourceClass: "ROBLOX_PUBLIC_API",
      sourceStatus: state ? "stored" : "fallback",
      freshnessState,
      regionalAvailability: regionalAvailability?.state,
      availabilityNote: regionalAvailability?.note,
      thumbnailUrl: null,
      heroImageUrl: enrichment?.hero_image_url ?? null,
      creatorId:
        enrichment?.creator_id == null ? null : Number(enrichment.creator_id),
      creatorType: enrichment?.creator_type ?? null,
      creatorVerified: enrichment?.creator_verified ?? false,
      maxPlayers:
        enrichment?.max_players == null ? null : Number(enrichment.max_players),
      genre: enrichment?.genre ?? null,
      genreL1: enrichment?.genre_l1 ?? null,
      genreL2: enrichment?.genre_l2 ?? null,
      experienceCreatedAt: enrichment?.experience_created_at ?? null,
      experienceUpdatedAt:
        state?.source_updated_at ?? enrichment?.experience_updated_at ?? null,
      mediaImages: enrichment?.media_images ?? [],
      mediaVideos: enrichment?.media_videos ?? [],
      fallbackReason: regionalAvailability
        ? regionalAvailability.note
        : state
          ? freshnessState === "stale"
            ? "Roblox 공개 API에서 최근 현재값을 확인하지 못해 오래된 플레이 인원은 현재값으로 표시하지 않습니다."
            : freshnessState === "unavailable"
              ? "Roblox 공개 API가 현재 정보를 제한해 플레이 인원은 표시하지 않습니다. 마지막 정상 관측값은 히스토리에만 남깁니다."
              : undefined
        : enrichment?.fallback_source_provider
          ? "현재 플레이 인원은 Roblox primary provider에서 확인할 수 없어 비워 두었습니다. 게임 정보와 미디어는 검증된 공식 보조 API를 사용합니다."
          : "아직 정상 Snapshot이 없습니다.",
    };
  });
}

export async function getPersistentHistories(
  universeIds: number[],
  hours = 168,
): Promise<Map<number, HistoryPoint[]> | null> {
  const config = getSupabasePublicConfig();
  if (!config || !universeIds.length) return null;
  const db = new PublicRest(config);
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();

  const rows = await db.select<DbRollup>("game_rollups_hourly", {
    select: "universe_id,bucket_at,playing_last,coverage_ratio",
    universe_id: `in.(${universeIds.join(",")})`,
    bucket_at: `gte.${cutoff}`,
    order: "bucket_at.asc",
  });

  const result = new Map<number, HistoryPoint[]>();
  for (const row of rows) {
    const id = Number(row.universe_id);
    const points = result.get(id) ?? [];
    points.push({
      at: row.bucket_at,
      playing: row.playing_last == null ? null : Number(row.playing_last),
      coverageRatio: Number(row.coverage_ratio),
    });
    result.set(id, points);
  }
  return result;
}
