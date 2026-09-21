import assert from "node:assert/strict";
import test from "node:test";
import {
  createGoogleOAuthRequest,
  normalizeAuthNext,
  normalizeOAuthOrigin,
} from "../lib/auth/oauth";

test("Google OAuth request uses Supabase authorize endpoint and PKCE", () => {
  const request = createGoogleOAuthRequest({
    supabaseUrl: "https://project.supabase.co/",
    origin: "https://preview.example.com",
    next: "/game/rivals/questions",
  });

  const url = new URL(request.authorizeUrl);
  assert.equal(url.origin, "https://project.supabase.co");
  assert.equal(url.pathname, "/auth/v1/authorize");
  assert.equal(url.searchParams.get("provider"), "google");
  assert.equal(
    url.searchParams.get("redirect_to"),
    "https://preview.example.com/auth/google/callback",
  );
  assert.equal(url.searchParams.get("code_challenge_method"), "s256");
  assert.equal(url.searchParams.get("code_challenge"), request.challenge);
  assert.ok(request.verifier.length >= 43);
  assert.equal(request.challenge.length, 43);
  assert.equal(request.next, "/game/rivals/questions");
});

test("auth next only accepts local absolute paths", () => {
  assert.equal(normalizeAuthNext("/me"), "/me");
  assert.equal(normalizeAuthNext("/game/rivals?tab=1"), "/game/rivals?tab=1");
  assert.equal(normalizeAuthNext("//evil.example"), "/me");
  assert.equal(normalizeAuthNext("/\\\\evil.example"), "/me");
  assert.equal(normalizeAuthNext("/%5Cevil.example"), "/me");
  assert.equal(normalizeAuthNext("https://evil.example"), "/me");
  assert.equal(normalizeAuthNext(""), "/me");
});

test("OAuth callback origin requires HTTPS except localhost", () => {
  assert.equal(
    normalizeOAuthOrigin("https://preview.example.com/path"),
    "https://preview.example.com",
  );
  assert.equal(
    normalizeOAuthOrigin("http://localhost:3000/path"),
    "http://localhost:3000",
  );
  assert.throws(
    () => normalizeOAuthOrigin("http://preview.example.com"),
    /HTTPS/,
  );
});
