import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const interactiveFiles = [
  "../app/me/page.tsx",
  "../app/login/page.tsx",
  "../app/actions/auth.ts",
  "../app/actions/community.ts",
  "../app/actions/community-experience.ts",
  "../app/actions/extra-composers.ts",
  "../app/auth/google/callback/route.ts",
  "../app/game/[slug]/party/page.tsx",
  "../components/CommunityAccess.tsx",
  "../lib/community/experience-model.ts",
  "../lib/community/queries.ts",
];

test("current app does not reintroduce age self-attestation fields or gates", () => {
  for (const path of interactiveFiles) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /age_confirmed_14_plus|birth_?date|date_?of_?birth|status:\s*"age"|access\s*===\s*"age"|name=["']age["']|name=["']birth/i,
      path,
    );
  }
});

test("policy pages may state the community age boundary without collecting birthdate", () => {
  const terms = readFileSync(new URL("../app/terms/page.tsx", import.meta.url), "utf8");
  const youth = readFileSync(new URL("../app/youth/page.tsx", import.meta.url), "utf8");
  for (const source of [terms, youth]) {
    assert.match(source, /만 14세 이상/);
    assert.match(source, /생년월일/);
  }
  assert.match(youth, /보호자/);
  assert.match(youth, /\/contact#private/);
});

test("current access model still depends on sign-in, availability and active status only", () => {
  const source = readFileSync(new URL("../lib/community/experience-model.ts", import.meta.url), "utf8");
  assert.match(source, /permissions\.active \? "ready" : "restricted"/);
  assert.doesNotMatch(source, /age_confirmed|birth_?date/i);
});
