import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("footer keeps policy destinations as real links without speculative requests", () => {
  const source = readFileSync(new URL("../components/Footer.tsx", import.meta.url), "utf8");
  for (const path of ["/about", "/methodology", "/community", "/guides", "/guidelines", "/privacy", "/youth", "/terms", "/contact", "/disclaimer"]) {
    assert.ok(source.includes(`<a href="${path}">`), path);
  }
  assert.doesNotMatch(source, /from ["']next\/link["']|<Link\b|router\.prefetch/);
  assert.match(source, /제휴 또는 공식 관계가 없는 독립/);
});
