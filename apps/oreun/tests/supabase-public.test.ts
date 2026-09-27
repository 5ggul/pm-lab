import test from "node:test";
import assert from "node:assert/strict";
import {
  getPersistentGameCatalog,
  getPersistentHistories,
} from "../lib/repository/supabase-public";

test("persistent catalog maps stored state and recalculates freshness from fetched_at", async (t) => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    if (url.pathname.endsWith("/games")) {
      return new Response(JSON.stringify([{
        universe_id: 1,
        root_place_id: 101,
        canonical_slug: "game-one",
        name_ko: "게임 원",
        description_ko: "설명",
        index_state: "candidate",
      }]));
    }
    if (url.pathname.endsWith("/game_aliases")) {
      return new Response(JSON.stringify([
        { universe_id: 1, alias: "게임원" },
        { universe_id: 1, alias: "game one" },
      ]));
    }
    if (url.pathname.endsWith("/game_provider_state")) {
      return new Response(JSON.stringify([{
        universe_id: 1,
        name: "Game One",
        description: "",
        creator_name: "Creator",
        playing: 1234,
        visits: 9999,
        favorites: 321,
        source_updated_at: null,
        fetched_at: new Date().toISOString(),
        freshness_state: "stale",
      }]));
    }
    throw new Error(`unexpected URL ${url}`);
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = oldFetch;
    if (oldUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  });

  const games = await getPersistentGameCatalog();
  assert.equal(games?.[0]?.sourceStatus, "stored");
  assert.equal(games?.[0]?.freshnessState, "fresh");
  assert.equal(games?.[0]?.playing, 1234);
  assert.deepEqual(games?.[0]?.aliases, ["게임원", "game one"]);
});

test("persistent catalog honors explicit unavailable state without exposing stored CCU", async (t) => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    if (url.pathname.endsWith("/games")) {
      return new Response(JSON.stringify([{
        universe_id: 1,
        root_place_id: 101,
        canonical_slug: "game-one",
        name_ko: "게임 원",
        description_ko: "설명",
        index_state: "candidate",
      }]));
    }
    if (url.pathname.endsWith("/game_aliases")) {
      return new Response(JSON.stringify([]));
    }
    if (url.pathname.endsWith("/game_provider_state")) {
      return new Response(JSON.stringify([{
        universe_id: 1,
        name: "Game One",
        description: "",
        creator_name: "Creator",
        playing: 999999,
        visits: 9999,
        favorites: 321,
        source_updated_at: null,
        fetched_at: new Date().toISOString(),
        freshness_state: "unavailable",
      }]));
    }
    if (url.pathname.endsWith("/game_enrichment")) {
      return new Response(JSON.stringify([]));
    }
    throw new Error(`unexpected URL ${url}`);
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = oldFetch;
    if (oldUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  });

  const games = await getPersistentGameCatalog();
  assert.equal(games?.[0]?.freshnessState, "unavailable");
  assert.equal(games?.[0]?.playing, null);
  assert.equal(games?.[0]?.visits, 9999);
  assert.match(games?.[0]?.fallbackReason ?? "", /현재 정보를 제한/);
});

test("persistent catalog never exposes stale CCU as current", async (t) => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    if (url.pathname.endsWith("/games")) {
      return new Response(JSON.stringify([{
        universe_id: 1,
        root_place_id: 101,
        canonical_slug: "game-one",
        name_ko: "게임 원",
        description_ko: "설명",
        index_state: "candidate",
      }]));
    }
    if (url.pathname.endsWith("/game_aliases")) {
      return new Response(JSON.stringify([]));
    }
    if (url.pathname.endsWith("/game_provider_state")) {
      return new Response(JSON.stringify([{
        universe_id: 1,
        name: "Game One",
        description: "",
        creator_name: "Creator",
        playing: 999999,
        visits: 9999,
        favorites: 321,
        source_updated_at: null,
        fetched_at: "2026-09-19T00:00:00.000Z",
        freshness_state: "fresh",
      }]));
    }
    if (url.pathname.endsWith("/game_enrichment")) {
      return new Response(JSON.stringify([]));
    }
    throw new Error(`unexpected URL ${url}`);
  }) as typeof fetch;

  const RealDate = Date;
  class MockDate extends RealDate {
    constructor(value?: string | number | Date) {
      super(value ?? "2026-09-20T12:00:00.000Z");
    }
    static now() {
      return new RealDate("2026-09-20T12:00:00.000Z").getTime();
    }
  }
  globalThis.Date = MockDate as DateConstructor;

  t.after(() => {
    globalThis.fetch = oldFetch;
    globalThis.Date = RealDate;
    if (oldUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  });

  const games = await getPersistentGameCatalog();
  assert.equal(games?.[0]?.freshnessState, "stale");
  assert.equal(games?.[0]?.playing, null);
  assert.equal(games?.[0]?.visits, 9999);
});

test("persistent history preserves hourly raw coverage", async (t) => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

  globalThis.fetch = (async () =>
    new Response(JSON.stringify([{
      universe_id: 1,
      bucket_at: "2026-09-19T00:00:00Z",
      playing_last: 5000,
      coverage_ratio: "0.25",
    }]), {headers: {"content-range": "0-0/1"}})) as typeof fetch;

  t.after(() => {
    globalThis.fetch = oldFetch;
    if (oldUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  });

  const histories = await getPersistentHistories([1], 24);
  assert.equal(histories?.get(1)?.[0]?.playing, 5000);
  assert.equal(histories?.get(1)?.[0]?.coverageRatio, 0.25);
});
