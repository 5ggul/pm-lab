import test from "node:test";
import assert from "node:assert/strict";
import { getPublicSiteUrl, isIndexingReleased } from "../lib/indexing";

test("indexing stays locked when noindex is on", () => {
  const env = {
    R1_PREVIEW_NO_INDEX: "1",
    NEXT_PUBLIC_SITE_URL: "https://oreun.example",
  } as NodeJS.ProcessEnv;
  assert.equal(isIndexingReleased(env), false);
});

test("indexing stays locked without a public https site URL", () => {
  for (const site of [
    undefined,
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "not-a-url",
  ]) {
    const env = {
      R1_PREVIEW_NO_INDEX: "0",
      NEXT_PUBLIC_SITE_URL: site,
    } as NodeJS.ProcessEnv;
    assert.equal(isIndexingReleased(env), false);
    assert.equal(getPublicSiteUrl(env), null);
  }
});

test("indexing can release only with explicit switch and public https URL", () => {
  const env = {
    R1_PREVIEW_NO_INDEX: "0",
    NEXT_PUBLIC_SITE_URL: "https://oreun.example/path",
  } as NodeJS.ProcessEnv;
  assert.equal(isIndexingReleased(env), true);
  assert.equal(getPublicSiteUrl(env), "https://oreun.example");
});
