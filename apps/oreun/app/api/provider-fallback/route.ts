import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_UNIVERSE_IDS = new Set([1686885941]);
const ROBLOX_GAMES_ENDPOINT = "https://games.roblox.com/v1/games";

type RobloxGame = {
  id?: number;
  rootPlaceId?: number;
  name?: string;
  description?: string;
  creator?: {
    id?: number;
    name?: string;
    type?: string;
    hasVerifiedBadge?: boolean;
  };
  playing?: number;
  visits?: number;
  favoritedCount?: number;
  maxPlayers?: number;
  created?: string;
  updated?: string;
  genre?: string;
  genre_l1?: string;
  genre_l2?: string;
  canonicalUrlPath?: string;
  isContentRestricted?: boolean;
};

export async function GET(request: NextRequest) {
  const universeId = Number(request.nextUrl.searchParams.get("universeId"));
  if (!Number.isSafeInteger(universeId) || universeId <= 0) {
    return NextResponse.json(
      { error: "invalid universe id" },
      {
        status: 400,
        headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
      },
    );
  }

  if (!ALLOWED_UNIVERSE_IDS.has(universeId)) {
    return NextResponse.json(
      { error: "universe not allowlisted" },
      {
        status: 404,
        headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
      },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      ROBLOX_GAMES_ENDPOINT +
        "?universeIds=" +
        encodeURIComponent(String(universeId)),
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": "Oreun-R1-Provider-Bridge/0.1",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Roblox provider request failed" },
      {
        status: 502,
        headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
      },
    );
  }

  if (upstream.status === 429) {
    const retryAfter = upstream.headers.get("retry-after");
    return NextResponse.json(
      { error: "Roblox provider rate limited", retryAfter },
      {
        status: 429,
        headers: {
          "cache-control": "no-store",
          "x-robots-tag": "noindex",
          ...(retryAfter ? { "retry-after": retryAfter } : {}),
        },
      },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Roblox provider unavailable", status: upstream.status },
      {
        status: 502,
        headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
      },
    );
  }

  let payload: { data?: RobloxGame[] };
  try {
    payload = (await upstream.json()) as { data?: RobloxGame[] };
  } catch {
    return NextResponse.json(
      { error: "invalid Roblox provider response" },
      {
        status: 502,
        headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
      },
    );
  }

  const game = (payload.data ?? []).find(
    (item) =>
      Number(item.id) === universeId &&
      Number.isSafeInteger(Number(item.rootPlaceId)) &&
      Number(item.rootPlaceId) > 0 &&
      typeof item.name === "string" &&
      item.name.length > 0,
  );

  if (!game) {
    return NextResponse.json(
      { error: "requested universe omitted by provider" },
      {
        status: 502,
        headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
      },
    );
  }

  return NextResponse.json(
    {
      source: "roblox_public_games",
      fetchedAt: new Date().toISOString(),
      data: [game],
    },
    {
      headers: {
        "cache-control": "public, max-age=15, stale-while-revalidate=30",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex",
      },
    },
  );
}
