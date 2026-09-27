import test from "node:test";
import assert from "node:assert/strict";
import sitemap from "../app/sitemap";

test("preview sitemap is empty before the final release latch opens", async () => {
  const before = {
    noindex: process.env.R1_PREVIEW_NO_INDEX,
    confirm: process.env.R1_INDEX_RELEASE_CONFIRM,
    site: process.env.NEXT_PUBLIC_SITE_URL,
  };

  process.env.R1_PREVIEW_NO_INDEX = "1";
  process.env.R1_INDEX_RELEASE_CONFIRM = "0";
  process.env.NEXT_PUBLIC_SITE_URL = "https://oreun-review.example.com";

  try {
    assert.deepEqual(await sitemap(), []);
  } finally {
    if (before.noindex === undefined) delete process.env.R1_PREVIEW_NO_INDEX;
    else process.env.R1_PREVIEW_NO_INDEX = before.noindex;
    if (before.confirm === undefined) delete process.env.R1_INDEX_RELEASE_CONFIRM;
    else process.env.R1_INDEX_RELEASE_CONFIRM = before.confirm;
    if (before.site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = before.site;
  }
});
