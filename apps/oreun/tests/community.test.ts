import test from "node:test";
import assert from "node:assert/strict";
import { communityConfig } from "../lib/community/rest";
import { getQuestionFeed } from "../lib/community/queries";

test("community config is null without a public Supabase key", () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
  };
  assert.equal(communityConfig(env), null);
});

test("community config prefers the public URL and strips trailing slash", () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SUPABASE_URL: "https://server-only.supabase.co/",
    NEXT_PUBLIC_SUPABASE_URL: "https://public.supabase.co/",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  };
  assert.deepEqual(communityConfig(env), {
    url: "https://public.supabase.co",
    publishableKey: "sb_publishable_test",
  });
});

test("public question feed degrades to empty when community DB is unconfigured", async () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldServerUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  try {
    assert.deepEqual(await getQuestionFeed(), []);
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldServerUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldServerUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});
