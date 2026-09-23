import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicFiles = [
  "../components/Header.tsx",
  "../components/MobileNav.tsx",
  "../components/Footer.tsx",
  "../app/page.tsx",
  "../app/community/page.tsx",
  "../app/game/[slug]/questions/page.tsx",
  "../app/guides/page.tsx",
  "../app/game/[slug]/guides/page.tsx",
  "../app/game/[slug]/guides/[guideSlug]/page.tsx",
  "../app/about/page.tsx",
  "../app/layout.tsx",
];

const banned = [
  "검증 가이드",
  "VERIFIED EDITORIAL",
  "EDITORIAL GUIDES",
  "공식 정보로 보는 핵심 포인트",
  "핵심 답",
  "POINT ",
  "뜨는 게임의 기록",
  "GAME-CONTEXT",
  "Game Entity",
];

test("public navigation and guide surfaces do not reintroduce templated editorial labels", () => {
  for (const path of publicFiles) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    for (const phrase of banned) {
      assert.equal(source.includes(phrase), false, `${path} contains banned public copy: ${phrase}`);
    }
  }
});
