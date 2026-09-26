import { NextRequest, NextResponse } from "next/server";
import { GAME_IDENTITIES } from "@/lib/seed";

export const dynamic = "force-dynamic";

const ALLOWED_UNIVERSE_IDS = new Set(
  GAME_IDENTITIES.map((game) => Number(game.universeId)),
);
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

export async function GET(request: NextRequest) {
  const universeId = Number(request.nextUrl.searchParams.get("universeId"));
  if (
    !Number.isSafeInteger(universeId) ||
    universeId <= 0 ||
    !ALLOWED_UNIVERSE_IDS.has(universeId)
  ) {
    return NextResponse.json({ error: "unknown universe" }, { status: 404 });
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
          "User-Agent": "Oreun-R1-Cloudflare-Relay/0.1",
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (upstream.status === 429) {
      return NextResponse.json(
        {
          error: "provider rate limited",
          retryAfter: upstream.headers.get("retry-after"),
        },
        {
          status: 429,
          headers: { "cache-control": "no-store" },
        },
      );
    }
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "provider unavailable", status: upstream.status },
        {
          status: 502,
          headers: { "cache-control": "no-store" },
        },
      );
    }

    const payload = (await upstream.json()) as { data?: RobloxGame[] };
    const game = (payload.data ?? []).find(
      (item) => Number(item.id) === universeId,
    );

    if (!game || game.isContentRestricted === true) {
      return NextResponse.json(
        { error: "provider did not return requested universe" },
        {
          status: 503,
          headers: { "cache-control": "no-store" },
        },
      );
    }

    const fetchedAt = new Date().toISOString();
    return NextResponse.json(
      {
        game: {
          id: game.id,
          rootPlaceId: game.rootPlaceId,
          name: game.name,
          description: game.description ?? "",
          creator: game.creator ?? null,
          playing: Number.isFinite(game.playing) ? game.playing : null,
          visits: Number.isFinite(game.visits) ? game.visits : null,
          favoritedCount: Number.isFinite(game.favoritedCount)
            ? game.favoritedCount
            : null,
          maxPlayers: Number.isFinite(game.maxPlayers) ? game.maxPlayers : null,
          genre: game.genre ?? null,
          genre_l1: game.genre_l1 ?? null,
          genre_l2: game.genre_l2 ?? null,
          created: game.created ?? null,
          updated: game.updated ?? null,
          canonicalUrlPath: game.canonicalUrlPath ?? null,
          isContentRestricted: false,
        },
        fetchedAt,
        source: "roblox_public_games_via_cloudflare",
      },
      {
        headers: {
          "cache-control": "public, max-age=10, s-maxage=10, stale-while-revalidate=20",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "provider relay failed",
      },
      {
        status: 502,
        headers: { "cache-control": "no-store" },
      },
    );
  } finally {
    clearTimeout(timer);
  }
}
