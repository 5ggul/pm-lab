import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateReleasePreflight,
  releasePreflightPassed,
  type ReleasePreflightInput,
} from "../lib/release-preflight";

const good: ReleasePreflightInput = {
  publicSiteUrl: "https://oreun.example.kr",
  previewNoIndex: "0",
  releaseConfirm: "1",
  googleProviderEnabled: true,
  googleOnlySignupHookConfirmed: true,
  googleIdentityCount: 1,
  activeGoogleAdminCount: 1,
  googleE2EConfirmed: true,
  communityE2EConfirmed: true,
  catalogGames: 26,
  dataReadyGames: 25,
  unavailableGames: [
    { slug: "brookhaven", freshnessState: "unavailable" },
  ],
  contentSources: 26,
  approvedPublishedGuides: 26,
  noindexGuides: 26,
  publishedCodes: 0,
  invalidPublishedCodes: 0,
};

test("release preflight passes the intended 25/26 Brookhaven state", () => {
  const checks = evaluateReleasePreflight(good);
  assert.equal(releasePreflightPassed(checks), true);
  assert.equal(checks.filter((check) => !check.ok).length, 0);
});

test("release preflight blocks missing Google OAuth", () => {
  const checks = evaluateReleasePreflight({
    ...good,
    googleProviderEnabled: false,
  });
  assert.equal(releasePreflightPassed(checks), false);
  assert.equal(
    checks.find((check) => check.key === "google-provider")?.ok,
    false,
  );
});

test("release preflight blocks unverified Google-only signup hook", () => {
  const checks = evaluateReleasePreflight({
    ...good,
    googleOnlySignupHookConfirmed: false,
  });
  assert.equal(releasePreflightPassed(checks), false);
  assert.equal(
    checks.find((check) => check.key === "google-only-signup-hook")?.ok,
    false,
  );
});

test("release preflight blocks provider-only setups without real Google E2E", () => {
  const checks = evaluateReleasePreflight({
    ...good,
    googleIdentityCount: 0,
    activeGoogleAdminCount: 0,
    googleE2EConfirmed: false,
    communityE2EConfirmed: false,
  });
  assert.equal(releasePreflightPassed(checks), false);
  for (const key of [
    "google-identity",
    "google-admin",
    "google-browser-e2e",
    "community-browser-e2e",
  ]) {
    assert.equal(checks.find((check) => check.key === key)?.ok, false);
  }
});

test("release preflight blocks invalid release origin or flags", () => {
  const checks = evaluateReleasePreflight({
    ...good,
    publicSiteUrl: null,
    previewNoIndex: "1",
    releaseConfirm: "0",
  });
  assert.equal(releasePreflightPassed(checks), false);
  assert.equal(checks.find((check) => check.key === "public-site-url")?.ok, false);
  assert.equal(checks.find((check) => check.key === "release-flags")?.ok, false);
});

test("release preflight blocks data/content regressions", () => {
  const checks = evaluateReleasePreflight({
    ...good,
    dataReadyGames: 24,
    contentSources: 25,
    approvedPublishedGuides: 25,
    noindexGuides: 25,
    invalidPublishedCodes: 1,
  });
  assert.equal(releasePreflightPassed(checks), false);
  for (const key of [
    "data-readiness",
    "content-sources",
    "reviewed-guides",
    "code-integrity",
  ]) {
    assert.equal(checks.find((check) => check.key === key)?.ok, false);
  }
});

test("release preflight only tolerates Brookhaven as unavailable", () => {
  const checks = evaluateReleasePreflight({
    ...good,
    unavailableGames: [
      { slug: "brookhaven", freshnessState: "unavailable" },
      { slug: "arsenal", freshnessState: "unavailable" },
    ],
  });
  assert.equal(releasePreflightPassed(checks), false);
  assert.equal(
    checks.find((check) => check.key === "regional-unavailable")?.ok,
    false,
  );
});
