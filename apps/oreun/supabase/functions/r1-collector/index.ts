import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Target = {
  universe_id: number | string;
  failure_count: number;
  cadence_minutes: number;
};

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
  created?: string;
  updated?: string;
  genre?: string;
  genre_l1?: string;
  genre_l2?: string;
  canonicalUrlPath?: string;
  isContentRestricted?: boolean;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ROBLOX_ENDPOINT = "https://games.roblox.com/v1/games";

function adminKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed?.default) return String(parsed.default);
    } catch {
      // Fall through to legacy key.
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Supabase admin key unavailable");
  return legacy;
}

const KEY = adminKey();
const restHeaders = () => {
  const headers: Record<string, string> = {
    apikey: KEY,
    "content-type": "application/json",
    accept: "application/json",
  };
  if (!KEY.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${KEY}`;
  }
  return headers;
};

async function rest<T>(
  path: string,
  init: RequestInit = {},
  query?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(path, SUPABASE_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    ...init,
    headers: { ...restHeaders(), ...(init.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${response.status} ${path}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) as T : undefined as T;
}

function cadence(playing: number | null) {
  if ((playing ?? 0) >= 100000) return 5;
  if ((playing ?? 0) >= 20000) return 15;
  if ((playing ?? 0) >= 2000) return 15;
  return 120;
}

function isContentRestrictedPlaceholder(game: RobloxGame) {
  return (
    game.id === 0 &&
    game.isContentRestricted === true &&
    game.name === "[TITLE UNAVAILABLE]"
  );
}

async function fetchRoblox(ids: number[]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `${ROBLOX_ENDPOINT}?universeIds=${ids.join(",")}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Oreun-R1-Supabase-Preview/0.1" },
      signal: controller.signal,
    });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") || 0) || null;
      return { kind: "rate_limited" as const, retryAfter, games: [] as RobloxGame[] };
    }
    if (!response.ok) {
      throw new Error(`Roblox API ${response.status}`);
    }
    const body = await response.json() as { data?: RobloxGame[] };
    return { kind: "ok" as const, retryAfter: null, games: body.data ?? [] };
  } finally {
    clearTimeout(timer);
  }
}

type RobloxMedia = {
  assetType?: string;
  imageId?: number;
  videoId?: string;
  videoHash?: string | null;
  videoTitle?: string | null;
  approved?: boolean;
  altText?: string | null;
};

async function recordEnrichmentFailure(
  universeId: number,
  failureCount: number,
  error: string,
) {
  const nextCount = failureCount + 1;
  const retryHours = Math.min(24, 2 ** Math.min(nextCount - 1, 4));
  const nextRetryAt = new Date(Date.now() + retryHours * 60 * 60 * 1000).toISOString();

  await rest(
    "/rest/v1/game_enrichment",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        universe_id: universeId,
        media_failure_count: nextCount,
        media_next_retry_at: nextRetryAt,
        media_last_error: error.slice(0, 500),
        updated_at: new Date().toISOString(),
      }),
    },
    { on_conflict: "universe_id" },
  );
}

type ProviderFallback = {
  universe_id: number | string;
  provider: "roblox_group_games";
  group_id: number | string | null;
  group_name: string | null;
};

type GroupGame = {
  id: number;
  name: string;
  description?: string;
  creator?: { id?: number; type?: string };
  rootPlace?: { id?: number; type?: string };
  created?: string;
  updated?: string;
  placeVisits?: number;
};

async function fetchVerifiedFallback(universeId: number) {
  const bindings = await rest<ProviderFallback[]>(
    "/rest/v1/game_provider_fallbacks",
    {},
    {
      select: "universe_id,provider,group_id,group_name",
      universe_id: `eq.${universeId}`,
      limit: 1,
    },
  );
  const binding = bindings[0];
  if (!binding || binding.provider !== "roblox_group_games" || !binding.group_id) {
    return null;
  }

  const groupId = Number(binding.group_id);
  const groupUrl =
    `https://games.roblox.com/v2/groups/${groupId}/gamesV2?accessFilter=Public&limit=50&sortOrder=Asc`;
  const [gamesResponse, favoritesResponse, thumbsResponse, groupResponse] =
    await Promise.all([
      fetch(groupUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Oreun-R1-Supabase-Preview/0.4",
        },
      }),
      fetch(
        `https://games.roblox.com/v1/games/${universeId}/favorites/count`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Oreun-R1-Supabase-Preview/0.4",
          },
        },
      ),
      fetch(
        "https://thumbnails.roblox.com/v1/games/multiget/thumbnails?" +
          `universeIds=${universeId}&countPerUniverse=10&defaults=true&size=768x432&format=Png&isCircular=false`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Oreun-R1-Supabase-Preview/0.4",
          },
        },
      ),
      fetch(`https://groups.roblox.com/v1/groups/${groupId}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Oreun-R1-Supabase-Preview/0.4",
        },
      }),
    ]);

  if (!gamesResponse.ok) {
    throw new Error(`Roblox group games API ${gamesResponse.status}`);
  }
  if (!favoritesResponse.ok) {
    throw new Error(`Roblox favorites API ${favoritesResponse.status}`);
  }
  if (!thumbsResponse.ok) {
    throw new Error(`Roblox multiget thumbnails API ${thumbsResponse.status}`);
  }

  const gamesPayload = await gamesResponse.json() as { data?: GroupGame[] };
  const game = (gamesPayload.data ?? []).find((item) => item.id === universeId);
  if (!game || Number(game.rootPlace?.id) <= 0) {
    throw new Error("verified fallback did not return requested universe");
  }

  const favoritesPayload = await favoritesResponse.json() as {
    favoritesCount?: number;
  };
  const thumbsPayload = await thumbsResponse.json() as {
    data?: Array<{
      universeId: number;
      thumbnails?: Array<{
        targetId: number;
        state: string;
        imageUrl: string | null;
      }>;
    }>;
  };
  const groupPayload = groupResponse.ok
    ? await groupResponse.json() as { name?: string; hasVerifiedBadge?: boolean }
    : null;

  const thumbnailSet = thumbsPayload.data?.find(
    (item) => Number(item.universeId) === universeId,
  );
  const images = (thumbnailSet?.thumbnails ?? [])
    .filter((item) => item.state === "Completed" && Boolean(item.imageUrl))
    .map((item, position) => ({
      position,
      assetId: Number(item.targetId),
      url: item.imageUrl!,
      altText: null,
    }));

  const now = new Date().toISOString();
  return {
    universeId,
    creatorId: groupId,
    creatorName: groupPayload?.name ?? binding.group_name ?? null,
    creatorVerified: Boolean(groupPayload?.hasVerifiedBadge),
    name: game.name,
    description: game.description ?? "",
    visits: Number.isFinite(game.placeVisits) ? game.placeVisits! : null,
    favorites: Number.isFinite(favoritesPayload.favoritesCount)
      ? favoritesPayload.favoritesCount!
      : null,
    createdAt: game.created ?? null,
    updatedAt: game.updated ?? null,
    heroImageUrl: images[0]?.url ?? null,
    images,
    fetchedAt: now,
    sourceProvider: "roblox_group_games+favorites+multiget_thumbnails",
  };
}

async function refreshOneEnrichment() {
  type EnrichmentState = {
    universe_id: number | string;
    media_fetched_at: string | null;
    media_failure_count: number | string;
    media_next_retry_at: string | null;
  };

  const [existing, catalog] = await Promise.all([
    rest<EnrichmentState[]>(
      "/rest/v1/game_enrichment",
      {},
      {
        select:
          "universe_id,media_fetched_at,media_failure_count,media_next_retry_at",
        order: "media_fetched_at.asc.nullsfirst",
        limit: 100,
      },
    ),
    rest<Array<{ universe_id: number | string }>>(
      "/rest/v1/games",
      {},
      {
        select: "universe_id",
        index_state: "neq.retired",
        order: "universe_id.asc",
        limit: 500,
      },
    ),
  ]);

  const nowMs = Date.now();
  const refreshAfterMs = 6 * 60 * 60 * 1000;
  const stateById = new Map(
    existing.map((row) => [Number(row.universe_id), row]),
  );

  let universeId: number | null = null;
  let failureCount = 0;

  for (const row of existing) {
    const retryAt = row.media_next_retry_at
      ? new Date(row.media_next_retry_at).getTime()
      : 0;
    if (retryAt && retryAt > nowMs) continue;

    const fetchedAt = row.media_fetched_at
      ? new Date(row.media_fetched_at).getTime()
      : 0;
    if (fetchedAt && nowMs - fetchedAt < refreshAfterMs) continue;

    universeId = Number(row.universe_id);
    failureCount = Number(row.media_failure_count) || 0;
    break;
  }

  if (!universeId) {
    const missing = catalog
      .map((row) => Number(row.universe_id))
      .find((id) => !stateById.has(id));
    if (missing) universeId = missing;
  }

  if (!universeId) return null;

  try {
    const detailResult = await fetchRoblox([universeId]);
    if (detailResult.kind !== "ok") {
      throw new Error("enrichment detail provider rate limited");
    }

    const game = detailResult.games.find((item) => item.id === universeId);
    if (!game) {
      const fallback = await fetchVerifiedFallback(universeId);
      if (!fallback) {
        throw new Error("provider response omitted requested universe");
      }

      await rest(
        "/rest/v1/game_enrichment",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            universe_id: universeId,
            creator_id: fallback.creatorId,
            creator_name: fallback.creatorName,
            creator_type: "Group",
            creator_verified: fallback.creatorVerified,
            max_players: null,
            genre: null,
            genre_l1: null,
            genre_l2: null,
            experience_created_at: fallback.createdAt,
            experience_updated_at: fallback.updatedAt,
            canonical_url_path: null,
            is_content_restricted: false,
            hero_image_url: fallback.heroImageUrl,
            media_images: fallback.images,
            media_videos: [],
            details_fetched_at: fallback.fetchedAt,
            media_fetched_at: fallback.fetchedAt,
            media_failure_count: 0,
            media_next_retry_at: null,
            media_last_error: null,
            fallback_name: fallback.name,
            fallback_description: fallback.description,
            fallback_visits: fallback.visits,
            fallback_favorites: fallback.favorites,
            fallback_source_updated_at: fallback.updatedAt,
            fallback_fetched_at: fallback.fetchedAt,
            fallback_source_provider: fallback.sourceProvider,
            updated_at: fallback.fetchedAt,
          }),
        },
        { on_conflict: "universe_id" },
      );

      return {
        universeId,
        source: "verified_fallback",
        images: fallback.images.length,
        videos: 0,
      };
    }

    const mediaResponse = await fetch(
      `https://games.roblox.com/v2/games/${universeId}/media`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Oreun-R1-Supabase-Preview/0.4",
        },
      },
    );
    if (!mediaResponse.ok) {
      throw new Error(`Roblox media API ${mediaResponse.status}`);
    }

    const mediaPayload = await mediaResponse.json() as { data?: RobloxMedia[] };
    const media = (mediaPayload.data ?? []).filter(
      (item) => item.approved !== false,
    );
    const imageIds = [
      ...new Set(
        media
          .map((item) => Number(item.imageId))
          .filter((id) => Number.isSafeInteger(id) && id > 0),
      ),
    ];

    const thumbMap = new Map<number, string>();
    if (imageIds.length) {
      const thumbUrl =
        "https://thumbnails.roblox.com/v1/assets?assetIds=" +
        imageIds.join(",") +
        "&returnPolicy=PlaceHolder&size=768x432&format=Png&isCircular=false";
      const thumbResponse = await fetch(thumbUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Oreun-R1-Supabase-Preview/0.4",
        },
      });
      if (!thumbResponse.ok) {
        throw new Error(`Roblox thumbnail API ${thumbResponse.status}`);
      }
      const thumbPayload = await thumbResponse.json() as {
        data?: Array<{
          targetId: number;
          state: string;
          imageUrl: string | null;
        }>;
      };
      for (const item of thumbPayload.data ?? []) {
        if (item.state === "Completed" && item.imageUrl) {
          thumbMap.set(Number(item.targetId), item.imageUrl);
        }
      }
    }

    const images: Array<Record<string, unknown>> = [];
    const videos: Array<Record<string, unknown>> = [];
    media.forEach((item, position) => {
      const imageId = Number(item.imageId) || null;
      const posterUrl = imageId ? thumbMap.get(imageId) ?? null : null;
      if (item.assetType === "GamePreviewVideo" && item.videoId) {
        videos.push({
          position,
          provider: "roblox",
          assetId: Number(item.videoId),
          youtubeId: null,
          posterAssetId: imageId,
          posterUrl,
          title: item.videoTitle ?? null,
          altText: item.altText ?? null,
        });
      } else if (
        item.assetType === "YouTubeVideo" &&
        item.videoHash &&
        /^[A-Za-z0-9_-]{6,20}$/.test(item.videoHash)
      ) {
        videos.push({
          position,
          provider: "youtube",
          assetId: null,
          youtubeId: item.videoHash,
          posterAssetId: null,
          posterUrl: `https://i.ytimg.com/vi/${item.videoHash}/hqdefault.jpg`,
          title: item.videoTitle ?? null,
          altText: item.altText ?? null,
        });
      } else if (item.assetType === "Image" && imageId && posterUrl) {
        images.push({
          position,
          assetId: imageId,
          url: posterUrl,
          altText: item.altText ?? null,
        });
      }
    });

    const now = new Date().toISOString();
    await rest(
      "/rest/v1/game_enrichment",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          universe_id: universeId,
          creator_id: Number(game.creator?.id) || null,
          creator_name: game.creator?.name ?? null,
          creator_type: game.creator?.type ?? null,
          creator_verified: Boolean(game.creator?.hasVerifiedBadge),
          max_players: Number.isFinite(game.maxPlayers) ? game.maxPlayers : null,
          genre: game.genre ?? null,
          genre_l1: game.genre_l1 ?? null,
          genre_l2: game.genre_l2 ?? null,
          experience_created_at: game.created ?? null,
          experience_updated_at: game.updated ?? null,
          canonical_url_path: game.canonicalUrlPath ?? null,
          is_content_restricted: Boolean(game.isContentRestricted),
          hero_image_url: images[0]?.url ?? videos[0]?.posterUrl ?? null,
          media_images: images,
          media_videos: videos,
          details_fetched_at: now,
          media_fetched_at: now,
          media_failure_count: 0,
          media_next_retry_at: null,
          media_last_error: null,
          fallback_name: null,
          fallback_description: null,
          fallback_visits: null,
          fallback_favorites: null,
          fallback_source_updated_at: null,
          fallback_fetched_at: null,
          fallback_source_provider: null,
          updated_at: now,
        }),
      },
      { on_conflict: "universe_id" },
    );

    return {
      universeId,
      source: "primary",
      images: images.length,
      videos: videos.length,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "enrichment refresh failed";
    await recordEnrichmentFailure(universeId, failureCount, message);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST required" }, { status: 405 });
  }

  const collectorToken = req.headers.get("x-r1-collector-token") ?? "";
  if (!collectorToken) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const tokenValid = await rest<boolean>(
    "/rest/v1/rpc/r1_validate_collector_token",
    {
      method: "POST",
      body: JSON.stringify({ p_token: collectorToken }),
    },
  );
  if (!tokenValid) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const leaseToken = crypto.randomUUID();
  let runId: string | null = null;

  try {
    const targets = await rest<Target[]>("/rest/v1/rpc/r1_claim_due_games", {
      method: "POST",
      body: JSON.stringify({
        p_limit: 100,
        p_lease_token: leaseToken,
        p_lease_seconds: 180,
      }),
    });

    if (!targets.length) {
      let enrichment = null;
      let enrichmentError: string | null = null;
      try {
        enrichment = await refreshOneEnrichment();
      } catch (error) {
        enrichmentError =
          error instanceof Error ? error.message : "enrichment refresh failed";
      }
      return Response.json({
        status: "idle",
        requested: 0,
        success: 0,
        failed: 0,
        enrichment,
        enrichmentError,
      });
    }

    const sources = await rest<Array<{ id: number }>>("/rest/v1/data_sources", {}, {
      select: "id",
      provider: "eq.roblox_public_games",
      endpoint: "eq.https://games.roblox.com/v1/games",
      limit: 1,
    });
    const sourceId = Number(sources[0]?.id);
    if (!sourceId) throw new Error("roblox_public_games source missing");

    const runs = await rest<Array<{ id: string }>>("/rest/v1/ingestion_runs", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        data_source_id: sourceId,
        started_at: new Date().toISOString(),
        status: "running",
        requested_count: targets.length,
      }),
    });
    runId = runs[0]?.id ?? null;
    if (!runId) throw new Error("failed to create ingestion run");

    let success = 0;
    let failed = 0;
    let rateLimited = 0;
    let retryAfterSeconds: number | null = null;
    const errors: string[] = [];
    const latencies: number[] = [];

    for (let offset = 0; offset < targets.length; offset += 20) {
      const batch = targets.slice(offset, offset + 20);
      const ids = batch.map((target) => Number(target.universe_id));
      const batchStarted = Date.now();

      try {
        const result = await fetchRoblox(ids);
        latencies.push(Date.now() - batchStarted);

        if (result.kind === "rate_limited") {
          failed += ids.length;
          rateLimited += ids.length;
          retryAfterSeconds = Math.max(retryAfterSeconds ?? 0, result.retryAfter ?? 0) || null;
          errors.push(`429 retry-after=${result.retryAfter ?? "unknown"}`);
          await rest("/rest/v1/rpc/r1_mark_targets_failed", {
            method: "POST",
            body: JSON.stringify({
              p_universe_ids: ids,
              p_lease_token: leaseToken,
              p_error: "Roblox provider rate limited",
              p_retry_after_seconds: result.retryAfter,
            }),
          });
          continue;
        }

        const fetchedAt = new Date().toISOString();
        const requestedSet = new Set(ids);
        const providerGames = result.games.filter((game) => game.id > 0);
        const requestedGames = providerGames.filter((game) => requestedSet.has(game.id));
        const unexpected = providerGames.filter((game) => !requestedSet.has(game.id));
        if (unexpected.length) {
          errors.push(
            `provider returned unrequested ids: ${unexpected.map((game) => game.id).join(",")}`,
          );
        }
        const found = new Set(requestedGames.map((game) => game.id));
        const observations = requestedGames.map((game) => ({
          universe_id: game.id,
          root_place_id: game.rootPlaceId,
          name: game.name,
          description: game.description ?? "",
          creator_name: game.creator?.name ?? "알 수 없음",
          playing: Number.isFinite(game.playing) ? game.playing : null,
          visits: Number.isFinite(game.visits) ? game.visits : null,
          favorites: Number.isFinite(game.favoritedCount) ? game.favoritedCount : null,
          source_updated_at: game.updated ?? null,
          fetched_at: fetchedAt,
          freshness_state: "fresh",
          cadence_minutes: cadence(Number.isFinite(game.playing) ? game.playing! : null),
        }));

        const saved = Number(
          await rest<number>("/rest/v1/rpc/r1_persist_game_observations", {
            method: "POST",
            body: JSON.stringify({
              p_ingestion_run_id: runId,
              p_data_source_id: sourceId,
              p_lease_token: leaseToken,
              p_observations: observations,
            }),
          }),
        ) || 0;
        success += saved;
        const rejected = Math.max(0, observations.length - saved);
        if (rejected) {
          failed += rejected;
          errors.push(`persistence rejected ${rejected} observation(s)`);
        }

        const missing = ids.filter((id) => !found.has(id));
        for (const id of missing) {
          const retryStarted = Date.now();
          try {
            const retryResult = await fetchRoblox([id]);
            latencies.push(Date.now() - retryStarted);

            if (retryResult.kind === "rate_limited") {
              failed += 1;
              rateLimited += 1;
              retryAfterSeconds =
                Math.max(retryAfterSeconds ?? 0, retryResult.retryAfter ?? 0) || null;
              errors.push(
                `single retry 429 id=${id} retry-after=${retryResult.retryAfter ?? "unknown"}`,
              );
              await rest("/rest/v1/rpc/r1_mark_targets_failed", {
                method: "POST",
                body: JSON.stringify({
                  p_universe_ids: [id],
                  p_lease_token: leaseToken,
                  p_error: "Roblox provider rate limited during single retry",
                  p_retry_after_seconds: retryResult.retryAfter,
                }),
              });
              continue;
            }

            const retryGame = retryResult.games.find((game) => game.id === id);
            if (!retryGame) {
              const contentRestricted = retryResult.games.some(
                isContentRestrictedPlaceholder,
              );
              if (contentRestricted) {
                failed += 1;
                errors.push(`provider content restricted id=${id}`);
                const markedUnavailable = await rest<boolean>(
                  "/rest/v1/rpc/r1_mark_target_unavailable",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      p_universe_id: id,
                      p_lease_token: leaseToken,
                      p_data_source_id: sourceId,
                      p_ingestion_run_id: runId,
                      p_reason:
                        "Roblox public API returned content-restricted placeholder",
                      p_retry_minutes: 360,
                    }),
                  },
                );
                if (!markedUnavailable) {
                  errors.push(
                    `content restricted state update rejected id=${id}`,
                  );
                }
                continue;
              }

              failed += 1;
              errors.push(`missing id after single retry: ${id}`);
              await rest("/rest/v1/rpc/r1_mark_targets_failed", {
                method: "POST",
                body: JSON.stringify({
                  p_universe_ids: [id],
                  p_lease_token: leaseToken,
                  p_error:
                    "provider response omitted requested universe after single retry",
                  p_retry_after_seconds: null,
                }),
              });
              continue;
            }

            const retryFetchedAt = new Date().toISOString();
            const retryObservation = {
              universe_id: retryGame.id,
              root_place_id: retryGame.rootPlaceId,
              name: retryGame.name,
              description: retryGame.description ?? "",
              creator_name: retryGame.creator?.name ?? "알 수 없음",
              playing: Number.isFinite(retryGame.playing)
                ? retryGame.playing
                : null,
              visits: Number.isFinite(retryGame.visits)
                ? retryGame.visits
                : null,
              favorites: Number.isFinite(retryGame.favoritedCount)
                ? retryGame.favoritedCount
                : null,
              source_updated_at: retryGame.updated ?? null,
              fetched_at: retryFetchedAt,
              freshness_state: "fresh",
              cadence_minutes: cadence(
                Number.isFinite(retryGame.playing) ? retryGame.playing! : null,
              ),
            };

            const retrySaved =
              Number(
                await rest<number>(
                  "/rest/v1/rpc/r1_persist_game_observations",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      p_ingestion_run_id: runId,
                      p_data_source_id: sourceId,
                      p_lease_token: leaseToken,
                      p_observations: [retryObservation],
                    }),
                  },
                ),
              ) || 0;

            if (retrySaved === 1) {
              success += 1;
            } else {
              failed += 1;
              errors.push(
                `persistence rejected single retry observation: ${id}`,
              );
              await rest("/rest/v1/rpc/r1_mark_targets_failed", {
                method: "POST",
                body: JSON.stringify({
                  p_universe_ids: [id],
                  p_lease_token: leaseToken,
                  p_error: "persistence rejected single retry observation",
                  p_retry_after_seconds: null,
                }),
              });
            }
          } catch (retryError) {
            latencies.push(Date.now() - retryStarted);
            failed += 1;
            const retryMessage =
              retryError instanceof Error
                ? retryError.message
                : "unknown provider error";
            errors.push(`single retry id=${id}: ${retryMessage}`);
            await rest("/rest/v1/rpc/r1_mark_targets_failed", {
              method: "POST",
              body: JSON.stringify({
                p_universe_ids: [id],
                p_lease_token: leaseToken,
                p_error: retryMessage,
                p_retry_after_seconds: null,
              }),
            });
          }
        }
      } catch (error) {
        latencies.push(Date.now() - batchStarted);
        failed += ids.length;
        const message = error instanceof Error ? error.message : "unknown provider error";
        errors.push(message);
        await rest("/rest/v1/rpc/r1_mark_targets_failed", {
          method: "POST",
          body: JSON.stringify({
            p_universe_ids: ids,
            p_lease_token: leaseToken,
            p_error: message,
            p_retry_after_seconds: null,
          }),
        });
      }
    }

    const sorted = latencies.slice().sort((a, b) => a - b);
    const percentile = (p: number) => sorted.length
      ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))]
      : null;
    const status = failed === 0 && success === targets.length
      ? "success"
      : success > 0
        ? "partial"
        : rateLimited > 0
          ? "rate_limited"
          : "failed";

    await rest("/rest/v1/ingestion_runs", {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        finished_at: new Date().toISOString(),
        status,
        requested_count: targets.length,
        success_count: success,
        failure_count: failed,
        rate_limit_count: rateLimited,
        retry_after_seconds: retryAfterSeconds,
        latency_p50_ms: percentile(0.5),
        latency_p95_ms: percentile(0.95),
        error_summary: errors.slice(0, 100),
      }),
    }, { id: `eq.${runId}` });

    let rollup = null;
    if (success > 0) {
      rollup = await rest("/rest/v1/rpc/r1_refresh_rollups", {
        method: "POST",
        body: JSON.stringify({
          p_from: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          p_to: new Date().toISOString(),
        }),
      });
    }

    let enrichment = null;
    let enrichmentError: string | null = null;
    try {
      enrichment = await refreshOneEnrichment();
    } catch (error) {
      enrichmentError =
        error instanceof Error ? error.message : "enrichment refresh failed";
    }

    return Response.json({
      status,
      runId,
      requested: targets.length,
      success,
      failed,
      rateLimited,
      retryAfterSeconds,
      durationMs: Date.now() - startedAt,
      rollup,
      enrichment,
      enrichmentError,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    if (runId) {
      try {
        await rest("/rest/v1/ingestion_runs", {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            finished_at: new Date().toISOString(),
            status: "failed",
            error_summary: [error instanceof Error ? error.message : "fatal collector error"],
          }),
        }, { id: `eq.${runId}` });
      } catch {
        // Preserve the original error.
      }
    }
    return Response.json(
      {
        status: "failed",
        error: error instanceof Error ? error.message : "collector failed",
      },
      { status: 500 },
    );
  }
});
