import { GAME_IDENTITIES, VERIFIED_FALLBACKS } from "./seed";
import { RobloxPublicGamesProvider } from "./providers/roblox-public";
import { getFreshnessState } from "./freshness";
import { getPersistentGameCatalog } from "./repository/supabase-public";
import type { GameView, ProviderGame } from "./types";

export async function getGameCatalog(): Promise<GameView[]> {
  try {
    const stored = await getPersistentGameCatalog();
    if (stored?.length) return stored;
  } catch {
    // Persistent Preview DB is an optimization/source of history, not a reason
    // to make the public page fail. Fall back to the direct provider path.
  }

  const provider = new RobloxPublicGamesProvider();
  let live: ProviderGame[] = [];
  let error = "";
  try {
    live = await provider.getGames(GAME_IDENTITIES.map((game) => game.universeId));
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "provider error";
  }

  const map = new Map(live.map((game) => [game.universeId, game]));
  return GAME_IDENTITIES.map((identity) => {
    const source = map.get(identity.universeId) ?? VERIFIED_FALLBACKS[identity.universeId];
    if (!source) {
      return {
        ...identity,
        universeId: identity.universeId,
        rootPlaceId: identity.rootPlaceId,
        name: identity.nameKo,
        description: "",
        creatorName: "알 수 없음",
        playing: null,
        visits: null,
        favorites: null,
        sourceUpdatedAt: null,
        fetchedAt: "",
        sourceProvider: "roblox_public_games",
        sourceEndpoint: "https://games.roblox.com/v1/games",
        sourceClass: "ROBLOX_PUBLIC_API",
        sourceStatus: "fallback",
        freshnessState: "unavailable",
        fallbackReason: error || "no snapshot",
      } satisfies GameView;
    }

    return {
      ...identity,
      ...source,
      rootPlaceId: identity.rootPlaceId,
      freshnessState: getFreshnessState(source.fetchedAt),
      fallbackReason:
        source.sourceStatus === "fallback"
          ? error || "실시간 제공자 응답 없음; 마지막 검증 스냅샷 사용"
          : undefined,
    };
  });
}

export async function getGameBySlug(slug: string) {
  return (await getGameCatalog()).find((game) => game.slug === slug) ?? null;
}
