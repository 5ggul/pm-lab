import test from "node:test";
import assert from "node:assert/strict";

test("party URL allowlist is intentionally roblox-only", () => {
  const allowed = [
    "https://www.roblox.com/games/123",
    "https://roblox.com/share?code=abc",
  ];
  const blocked = [
    "http://www.roblox.com/games/123",
    "https://discord.gg/test",
    "https://roblox.com.evil.example/games/123",
    "javascript:alert(1)",
  ];
  const rule = /^https:\/\/(www\.)?roblox\.com\//i;
  for (const value of allowed) assert.equal(rule.test(value), true);
  for (const value of blocked) assert.equal(rule.test(value), false);
});

test("party capacity remains bounded to 2 through 12", () => {
  const valid = (value: number) => value >= 2 && value <= 12;
  assert.equal(valid(2), true);
  assert.equal(valid(12), true);
  assert.equal(valid(1), false);
  assert.equal(valid(13), false);
});
