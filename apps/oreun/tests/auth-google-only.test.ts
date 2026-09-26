import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loginErrorPath, profileErrorPath } from "../lib/auth/navigation";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Google-only login removes both legacy UI and password grant code", () => {
  const page = source("../app/login/page.tsx");
  const action = source("../app/actions/auth.ts");
  const session = source("../lib/auth/session.ts");
  assert.doesNotMatch(page, /email-login-panel|loginAction|type="password"|name="email"|기존 이메일 계정/);
  assert.doesNotMatch(action, /loginAction|signInWithPassword|cleanPassword|cleanEmail/);
  assert.doesNotMatch(session, /signInWithPassword|grant_type=password/);
  assert.match(session, /grant_type=pkce/);
  assert.match(session, /grant_type=refresh_token/);
});

test("Google CTA uses ordinary navigation and the official logo", () => {
  const page = source("../app/login/page.tsx");
  assert.doesNotMatch(page, /next\/link|<Link/);
  assert.match(page, /https:\/\/developers\.google\.com\/static\/identity\/images\/g-logo\.png/);
  assert.match(page, /referrerPolicy="no-referrer"/);
  assert.match(page, /Google로 계속하기/);
  assert.match(page, /로그인 없이 게임 둘러보기/);
});

for (const [name, build, pathname] of [
  ["OAuth", loginErrorPath, "/login"],
  ["profile", profileErrorPath, "/me"],
] as const) {
  test(`${name} retry retains a safe query and fragment`, () => {
    const next = "/game/rivals/questions?sort=new#ask";
    const result = new URL(build("다시 확인해 주세요.", next), "https://oreun.example");
    assert.equal(result.pathname, pathname);
    assert.equal(result.searchParams.get("next"), next);
    assert.equal(result.searchParams.get("error"), "다시 확인해 주세요.");
  });
  test(`${name} retry rejects external destinations and bounds feedback`, () => {
    for (const next of ["https://evil.example", "//evil.example", "/%2f%2fevil.example", "/%5cevil.example", "/%ZZ", undefined]) {
      const result = new URL(build("x".repeat(300), next), "https://oreun.example");
      assert.equal(result.origin, "https://oreun.example");
      assert.equal(result.searchParams.get("next"), "/me");
      assert.equal(result.searchParams.get("error")?.length, 180);
    }
  });
}
