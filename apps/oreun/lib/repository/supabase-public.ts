import type { GameIdentity, GameView, HistoryPoint } from "../types";

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

  return games.map((game) => {
    const id = Number(game.universe_id);
    const state = stateMap.get(id);
    return {
      universeId: id,
      rootPlaceId: Number(game.root_place_id),
      slug: game.canonical_slug,
      nameKo: game.name_ko,
      aliases: aliasMap.get(id) ?? [game.name_ko],
      descriptionKo: game.description_ko,
      indexState: game.index_state,
      name: state?.name ?? game.name_ko,
      description: state?.description ?? "",
      creatorName: state?.creator_name ?? "알 수 없음",
      playing: state?.playing == null ? null : Number(state.playing),
      visits: state?.visits == null ? null : Number(state.visits),
      favorites: state?.favorites == null ? null : Number(state.favorites),
      sourceUpdatedAt: state?.source_updated_at ?? null,
      fetchedAt: state?.fetched_at ?? "",
      sourceProvider: "roblox_public_games",
      sourceEndpoint: "https://games.roblox.com/v1/games",
      sourceClass: "ROBLOX_PUBLIC_API",
      sourceStatus: state ? "stored" : "fallback",
      freshnessState: state?.freshness_state ?? "unavailable",
      fallbackReason: state ? undefined : "아직 정상 Snapshot이 없습니다.",
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
