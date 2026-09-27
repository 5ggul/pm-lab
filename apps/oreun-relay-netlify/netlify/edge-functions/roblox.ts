import type { Config, Context } from "@netlify/edge-functions";

const BROOKHAVEN_UNIVERSE_ID = 1686885941;
const ROBLOX_GAMES_ENDPOINT = "https://games.roblox.com/v1/games";

type RobloxGame = {
  id: number;
  rootPlaceId: number;
  name: string;
  description?: string;
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
  canonicalUrlPath?: string;
  isContentRestricted?: boolean;
};

export default async (request: Request, _context: Context) => {
  if (request.method !== "GET") {
    return Response.json({ error: "GET required" }, { status: 405 });
  }

  const url = new URL(request.url);
  const universeId = Number(url.searchParams.get("universeId"));

  if (universeId !== BROOKHAVEN_UNIVERSE_ID) {
    return Response.json({ error: "unknown universe" }, { status: 404 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const upstream = await fetch(
      ROBLOX_GAMES_ENDPOINT +
        "?universeIds=" +
        encodeURIComponent(String(universeId)),
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Oreun-R1-Netlify-Relay/0.1",
        },
        signal: controller.signal,
      },
    );

    if (upstream.status === 429) {
      return Response.json(
        {
          error: "provider rate limited",
          retryAfter: upstream.headers.get("retry-after"),
        },
        { status: 429, headers: { "cache-control": "no-store" } },
      );
    }

    if (!upstream.ok) {
      return Response.json(
        { error: "provider unavailable", status: upstream.status },
        { status: 502, headers: { "cache-control": "no-store" } },
      );
    }

    const payload = (await upstream.json()) as { data?: RobloxGame[] };
    const game = (payload.data ?? []).find(
      (item) => Number(item.id) === universeId,
    );

    if (
      !game ||
      Number(game.rootPlaceId) <= 0 ||
      game.isContentRestricted === true ||
      !Number.isFinite(game.playing) ||
      Number(game.playing) < 0
    ) {
      return Response.json(
        { error: "provider did not return valid current state" },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }

    return Response.json(
      {
        game: {
          id: game.id,
          rootPlaceId: game.rootPlaceId,
          name: game.name,
          description: game.description ?? "",
          creator: game.creator ?? null,
          playing: game.playing,
          visits: Number.isFinite(game.visits) ? game.visits : null,
          favoritedCount: Number.isFinite(game.favoritedCount)
            ? game.favoritedCount
            : null,
          maxPlayers: Number.isFinite(game.maxPlayers)
            ? game.maxPlayers
            : null,
          genre: game.genre ?? null,
          genre_l1: game.genre_l1 ?? null,
          genre_l2: game.genre_l2 ?? null,
          created: game.created ?? null,
          updated: game.updated ?? null,
          canonicalUrlPath: game.canonicalUrlPath ?? null,
          isContentRestricted: false,
        },
        fetchedAt: new Date().toISOString(),
        source: "roblox_public_games_via_netlify",
      },
      {
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "provider relay failed",
      },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  } finally {
    clearTimeout(timer);
  }
};

export const config: Config = {
  path: "/api/roblox",
  method: "GET",
};
