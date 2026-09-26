import type { ProviderGame } from "../types";

export class ProviderRateLimitError extends Error {
  constructor(public retryAfterSeconds: number | null) {
    super("Roblox provider rate limited");
  }
}

export interface GameProvider {
  getGames(universeIds: number[]): Promise<ProviderGame[]>;
}

type ApiGame = {
  id: number;
  rootPlaceId: number;
  name: string;
  description: string;
  creator?: {
    id?: number;
    name?: string;
    type?: "User" | "Group";
    hasVerifiedBadge?: boolean;
  };
  playing?: number;
  visits?: number;
  favoritedCount?: number;
  maxPlayers?: number;
  genre?: string;
  genre_l1?: string;
  genre_l2?: string;
  created?: string;
  updated?: string;
};

export class RobloxPublicGamesProvider implements GameProvider {
  readonly endpoint = "https://games.roblox.com/v1/games";

  async getGames(universeIds: number[]): Promise<ProviderGame[]> {
    if (!universeIds.length) return [];

    const url = `${this.endpoint}?universeIds=${universeIds.join(",")}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Oreun-R1-Preview/0.3",
        },
        signal: controller.signal,
        next: { revalidate: 120 },
      });

      if (res.status === 429) {
        const raw = res.headers.get("retry-after");
        throw new ProviderRateLimitError(raw ? Number(raw) : null);
      }
      if (!res.ok) throw new Error(`Roblox API ${res.status}`);

      const json = (await res.json()) as { data: ApiGame[] };
      const fetchedAt = new Date().toISOString();

      return (json.data ?? [])
        .filter((game) => game.id > 0)
        .map((game) => ({
          universeId: game.id,
          rootPlaceId: game.rootPlaceId,
          name: game.name,
          description: game.description ?? "",
          creatorName: game.creator?.name ?? "알 수 없음",
          creatorId: Number.isFinite(game.creator?.id) ? game.creator!.id! : null,
          creatorType: game.creator?.type ?? null,
          creatorVerified: Boolean(game.creator?.hasVerifiedBadge),
          maxPlayers: Number.isFinite(game.maxPlayers) ? game.maxPlayers! : null,
          genre: game.genre ?? null,
          genreL1: game.genre_l1 ?? null,
          genreL2: game.genre_l2 ?? null,
          experienceCreatedAt: game.created ?? null,
          experienceUpdatedAt: game.updated ?? null,
          playing: Number.isFinite(game.playing) ? game.playing! : null,
          visits: Number.isFinite(game.visits) ? game.visits! : null,
          favorites: Number.isFinite(game.favoritedCount)
            ? game.favoritedCount!
            : null,
          sourceUpdatedAt: game.updated ?? null,
          fetchedAt,
          sourceProvider: "roblox_public_games",
          sourceEndpoint: this.endpoint,
          sourceClass: "ROBLOX_PUBLIC_API",
          sourceStatus: "live",
        }));
    } finally {
      clearTimeout(timer);
    }
  }
}
