import test from "node:test";
import assert from "node:assert/strict";
import {
  getPublicSiteUrl,
  getRenderingSiteUrl,
  isIndexingReleased,
} from "../lib/indexing";

test("indexing stays locked when noindex is on", () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    R1_PREVIEW_NO_INDEX: "1",
    R1_INDEX_RELEASE_CONFIRM: "1",
    NEXT_PUBLIC_SITE_URL: "https://oreun.example.com",
  };
  assert.equal(isIndexingReleased(env), false);
});

test("indexing stays locked without the final release confirmation", () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    R1_PREVIEW_NO_INDEX: "0",
    R1_INDEX_RELEASE_CONFIRM: "0",
    NEXT_PUBLIC_SITE_URL: "https://oreun.example.com",
  };
  assert.equal(isIndexingReleased(env), false);
});

test("indexing stays locked without a public https site URL", () => {
  for (const site of [
    undefined,
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "https://preview.localhost",
    "https://oreun.example",
    "https://oreun.invalid",
    "https://oreun.test",
    "https://10.0.0.1",
    "https://172.16.0.1",
    "https://192.168.0.10",
    "https://8.8.8.8",
    "https://[2001:4860:4860::8888]",
    "not-a-url",
  ]) {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      R1_PREVIEW_NO_INDEX: "0",
      R1_INDEX_RELEASE_CONFIRM: "1",
      NEXT_PUBLIC_SITE_URL: site,
    };
    assert.equal(isIndexingReleased(env), false, String(site));
    assert.equal(getPublicSiteUrl(env), null, String(site));
  }
});

test("indexing releases only with all three explicit conditions", () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    R1_PREVIEW_NO_INDEX: "0",
    R1_INDEX_RELEASE_CONFIRM: "1",
    NEXT_PUBLIC_SITE_URL: "https://oreun-review.example.com/path",
  };
  assert.equal(isIndexingReleased(env), true);
  assert.equal(
    getPublicSiteUrl(env),
    "https://oreun-review.example.com",
  );
});


test("Vercel preview origin is used for rendering but never opens indexing", () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    R1_PREVIEW_NO_INDEX: "1",
    R1_INDEX_RELEASE_CONFIRM: "0",
    NEXT_PUBLIC_SITE_URL: "",
    VERCEL_URL: "oreun-r1-preview-abc123.vercel.app",
  };
  assert.equal(
    getRenderingSiteUrl(env),
    "https://oreun-r1-preview-abc123.vercel.app",
  );
  assert.equal(getPublicSiteUrl(env), null);
  assert.equal(isIndexingReleased(env), false);
});

test("explicit public site wins over Vercel preview rendering origin", () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NEXT_PUBLIC_SITE_URL: "https://oreun.example.com/path",
    VERCEL_URL: "oreun-r1-preview-abc123.vercel.app",
  };
  assert.equal(getRenderingSiteUrl(env), "https://oreun.example.com");
});
