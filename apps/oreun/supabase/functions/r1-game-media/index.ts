import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PREVIEW_ORIGIN = "https://5ggul.github.io";
const configuredOrigins = (Deno.env.get("R1_MEDIA_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set([PREVIEW_ORIGIN, ...configuredOrigins]);

function adminKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed?.default) return String(parsed.default);
    } catch {}
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Supabase admin key unavailable");
  return legacy;
}

const KEY = adminKey();

function cors(origin: string | null) {
  const headers: Record<string, string> = {
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
    "vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["access-control-allow-origin"] = origin;
  }
  return headers;
}

async function getKnownVideos(universeId: number) {
  const url = new URL("/rest/v1/game_enrichment", SUPABASE_URL);
  url.searchParams.set("select", "media_videos");
  url.searchParams.set("universe_id", `eq.${universeId}`);
  url.searchParams.set("limit", "1");
  const headers: Record<string,string> = { apikey: KEY, accept: "application/json" };
  if (!KEY.startsWith("sb_secret_")) headers.Authorization = `Bearer ${KEY}`;
  const response = await fetch(url, { headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`DB ${response.status}: ${text.slice(0,300)}`);
  const rows = text ? JSON.parse(text) as Array<{media_videos?:Array<{assetId?:number}>}> : [];
  return rows[0]?.media_videos ?? [];
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return Response.json(
        { error: "origin not allowed" },
        { status: 403, headers: cors(origin) },
      );
    }
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (req.method !== "GET") return Response.json({ error: "GET required" }, { status: 405, headers: cors(origin) });

  const url = new URL(req.url);
  const universeId = Number(url.searchParams.get("universeId"));
  const videoId = Number(url.searchParams.get("videoId"));
  if (!Number.isSafeInteger(universeId) || universeId <= 0 || !Number.isSafeInteger(videoId) || videoId <= 0) {
    return Response.json({ error: "invalid ids" }, { status: 400, headers: cors(origin) });
  }

  try {
    const known = await getKnownVideos(universeId);
    if (!known.some((item) => Number(item.assetId) === videoId)) {
      return Response.json({ error: "unknown video asset" }, { status: 404, headers: cors(origin) });
    }

    const response = await fetch(`https://assetdelivery.roblox.com/v2/assetId/${videoId}`, {
      headers: { Accept: "application/json", "User-Agent": "Oreun-R1-Media/0.2" },
    });
    const text = await response.text();
    if (!response.ok) {
      return Response.json({ error: "Roblox asset unavailable" }, { status: 502, headers: cors(origin) });
    }
    const payload = JSON.parse(text) as { locations?: Array<{ assetFormat?: string; location?: string }> };
    const location = payload.locations?.find((item) => item.assetFormat === "source")?.location ?? payload.locations?.[0]?.location ?? null;
    if (!location) return Response.json({ error: "video location missing" }, { status: 502, headers: cors(origin) });
    const parsed = new URL(location);
    if (!parsed.hostname.endsWith(".rbxcdn.com")) {
      return Response.json({ error: "unexpected video host" }, { status: 502, headers: cors(origin) });
    }
    return Response.json({ url: location }, { headers: cors(origin) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "media resolver failed" }, { status: 500, headers: cors(origin) });
  }
});
