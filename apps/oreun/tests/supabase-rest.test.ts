import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSupabaseServerAuthHeaders,
  SupabaseRestClient,
} from "../lib/db/supabase-rest";

test("modern Supabase secret key uses apikey only", () => {
  const headers = buildSupabaseServerAuthHeaders("sb_secret_example");
  assert.equal(headers.apikey, "sb_secret_example");
  assert.equal(headers.authorization, undefined);
});

test("legacy service-role JWT keeps Bearer authorization", () => {
  const key = "eyJlegacy.service.role";
  const headers = buildSupabaseServerAuthHeaders(key);
  assert.equal(headers.apikey, key);
  assert.equal(headers.authorization, `Bearer ${key}`);
});

test("REST client does not leak modern secret into Authorization", async (t) => {
  const originalFetch = globalThis.fetch;
  let seen: Headers | null = null;
  globalThis.fetch = (async (_input, init) => {
    seen = new Headers(init?.headers);
    return new Response("[]", { status: 200 });
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const client = new SupabaseRestClient({
    url: "https://example.supabase.co",
    secretKey: "sb_secret_example",
  });
  await client.select("games", { select: "universe_id" });

  assert.equal(seen?.get("apikey"), "sb_secret_example");
  assert.equal(seen?.get("authorization"), null);
});
