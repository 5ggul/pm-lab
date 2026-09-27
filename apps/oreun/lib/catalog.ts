import { cache } from "react";
import { GAME_IDENTITIES, VERIFIED_FALLBACKS } from "./seed";
import { RobloxPublicGamesProvider } from "./providers/roblox-public";
import { RobloxThumbnailProvider } from "./providers/roblox-thumbnails";
import { getFreshnessState } from "./freshness";
import { getPersistentGameCatalog } from "./repository/supabase-public";
import { getRegionalAvailability } from "./regional-availability";
import type { GameView, ProviderGame } from "./types";

async function attachThumbnails(games: GameView[]): Promise<GameView[]> {
  try {
    const thumbnails = await new RobloxThumbnailProvider().getGameIcons(
      games.map((game) => game.universeId),
    );
    const thumbnailMap = new Map(
      thumbnails.map((item) => [item.universeId, item.imageUrl]),
    );
    return games.map((game) => ({
      ...game,
      thumbnailUrl: thumbnailMap.get(game.universeId) ?? null,
    }));
  } catch {
    return games.map((game) => ({ ...game, thumbnailUrl: null }));
  }
}

export const getGameCatalog = cache(async (): Promise<GameView[]> => {
  try {
    const stored = await getPersistentGameCatalog();
    if (stored?.length) return attachThumbnails(stored);
  } catch {
    // Persistent Preview DB is the preferred source, but its failure must not
    // turn a Roblox game page into a 500. Fall through to direct provider.
  }

  const provider = new RobloxPublicGamesProvider();
  let live: ProviderGame[] = [];
  let error = "";

  try {
    live = await provider.getGames(
      GAME_IDENTITIES.map((game) => game.universeId),
    );
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "provider error";
  }

  const map = new Map(live.map((game) => [game.universeId, game]));
  const games = GAME_IDENTITIES.map((identity): GameView => {
    const regionalAvailability = getRegionalAvailability(identity.universeId);
    const source =
      map.get(identity.universeId) ?? VERIFIED_FALLBACKS[identity.universeId];

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
        regionalAvailability: regionalAvailability?.state,
        availabilityNote: regionalAvailability?.note,
        thumbnailUrl: null,
        fallbackReason: regionalAvailability?.note ?? (error || "no snapshot"),
      };
    }

    const freshnessState = regionalAvailability
      ? "unavailable"
      : getFreshnessState(source.fetchedAt);
    const suppressCurrent =
      regionalAvailability ||
      freshnessState === "stale" ||
      freshnessState === "unavailable";

    return {
      ...identity,
      ...source,
      rootPlaceId: identity.rootPlaceId,
      playing: suppressCurrent ? null : source.playing,
      freshnessState,
      regionalAvailability: regionalAvailability?.state,
      availabilityNote: regionalAvailability?.note,
      thumbnailUrl: null,
      fallbackReason: regionalAvailability?.note ??
        (source.sourceStatus === "fallback"
          ? error || "실시간 제공자 응답 없음; 마지막 검증 스냅샷 사용"
          : freshnessState === "stale"
            ? "오래된 플레이 인원은 현재값으로 표시하지 않습니다."
            : undefined),
    };
  });

  return attachThumbnails(games);
});

export async function getGameBySlug(slug: string) {
  return (await getGameCatalog()).find((game) => game.slug === slug) ?? null;
}
