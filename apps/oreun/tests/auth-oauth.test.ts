import assert from "node:assert/strict";
import test from "node:test";
import {
  createGoogleOAuthRequest,
  normalizeAuthNext,
  normalizeOAuthOrigin,
} from "../lib/auth/oauth";
import {
  accessTokenExpiresAt,
  shouldRefreshAccessToken,
} from "../lib/auth/token";

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


function fakeJwt(exp: number) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return encode({ alg: "none", typ: "JWT" }) + "." + encode({ exp }) + ".sig";
}

test("access token refresh timing handles expiry and skew", () => {
  const now = 1_800_000_000;
  const fresh = fakeJwt(now + 600);
  const nearExpiry = fakeJwt(now + 30);
  const expired = fakeJwt(now - 1);

  assert.equal(accessTokenExpiresAt(fresh), now + 600);
  assert.equal(shouldRefreshAccessToken(fresh, now, 60), false);
  assert.equal(shouldRefreshAccessToken(nearExpiry, now, 60), true);
  assert.equal(shouldRefreshAccessToken(expired, now, 60), true);
  assert.equal(shouldRefreshAccessToken("not-a-jwt", now, 60), true);
  assert.equal(shouldRefreshAccessToken(null, now, 60), true);
});
