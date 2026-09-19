import { GAME_IDENTITIES } from "../lib/seed";
import { normalizeQuery } from "../lib/search";
import {
  SupabaseRestClient,
  getSupabaseRestConfig,
} from "../lib/db/supabase-rest";

const config = getSupabaseRestConfig();
if (!config) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY).",
  );
  process.exit(1);
}

const db = new SupabaseRestClient(config);

const gameRows = GAME_IDENTITIES.map((game) => ({
  universe_id: game.universeId,
  root_place_id: game.rootPlaceId,
  canonical_slug: game.slug,
  name_ko: game.nameKo,
  description_ko: game.descriptionKo,
  index_state: game.indexState,
}));

const slugRows = GAME_IDENTITIES.map((game) => ({
  universe_id: game.universeId,
  slug: game.slug,
  is_canonical: true,
}));

const aliasRows = GAME_IDENTITIES.flatMap((game) => {
  const seen = new Set<string>();
  return [game.nameKo, ...game.aliases].flatMap((alias) => {
    const normalized = normalizeQuery(alias);
    if (!normalized || seen.has(normalized)) return [];
    seen.add(normalized);
    const korean = /[가-힣]/.test(alias);
    return [
      {
        universe_id: game.universeId,
        alias,
        normalized_alias: normalized,
        lang: korean ? "ko" : "en",
        alias_type: korean ? "korean" : "english",
      },
    ];
  });
});

const targetRows = GAME_IDENTITIES.map((game) => ({
  universe_id: game.universeId,
  tier: "longtail",
  cadence_minutes: 120,
  next_due_at: new Date().toISOString(),
  enabled: true,
}));

await db.upsert("games", gameRows, "universe_id");
await db.upsert("game_slug_history", slugRows, "universe_id,slug");
await db.upsert("game_aliases", aliasRows, "universe_id,normalized_alias");
await db.upsert("collector_targets", targetRows, "universe_id");

console.log(
  JSON.stringify(
    {
      status: "ok",
      games: gameRows.length,
      aliases: aliasRows.length,
      targets: targetRows.length,
    },
    null,
    2,
  ),
);
