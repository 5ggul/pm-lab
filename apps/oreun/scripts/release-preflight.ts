import { getPublicSiteUrl } from "../lib/indexing";
import { privateContact } from "../lib/private-contact";
import { privacyRetentionStatement } from "../lib/privacy-retention";
import { verifiedOperatorName } from "../lib/operator-info";
import { GAME_IDENTITIES } from "../lib/seed";
import {
  evaluateReleasePreflight,
  releasePreflightPassed,
} from "../lib/release-preflight";
import {
  getSupabaseRestConfig,
  SupabaseRestClient,
} from "../lib/db/supabase-rest";

type ReadinessRow = {
  universe_id: number | string;
  canonical_slug: string;
  data_ready_for_index_review: boolean;
  freshness_state: string | null;
};

type GuideRow = {
  id: string;
  review_status: string;
  content_status: string;
  index_state: string;
};

type CodeRow = {
  id: string;
  source_id: string | null;
  visibility: string;
  code_status: string;
  review_status: string;
  reviewed_at: string | null;
  verified_at: string | null;
  last_checked_at: string | null;
};

async function authSettings() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase public Auth configuration is missing.");
  }

  const response = await fetch(
    url.replace(/\/$/, "") + "/auth/v1/settings",
    {
      headers: { apikey: key },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error("Supabase Auth settings HTTP " + response.status);
  }

  return (await response.json()) as {
    external?: { google?: boolean };
  };
}

async function main() {
  const config = getSupabaseRestConfig();
  if (!config) {
    throw new Error(
      "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for release preflight.",
    );
  }

  const db = new SupabaseRestClient(config);
  const [settings, authReadiness, readiness, sources, guides, codes] = await Promise.all([
    authSettings(),
    db.rpc<{
      google_identity_count?: number;
      active_admin_count?: number;
      active_google_admin_count?: number;
    }>("r1_release_auth_readiness"),
    db.select<ReadinessRow>("r1_game_index_readiness", {
      select:
        "universe_id,canonical_slug,data_ready_for_index_review,freshness_state",
      order: "canonical_slug.asc",
    }),
    db.select<{ id: string }>("content_sources", {
      select: "id",
      limit: 1000,
    }),
    db.select<GuideRow>("game_guides", {
      select: "id,review_status,content_status,index_state",
      limit: 1000,
    }),
    db.select<CodeRow>("game_codes", {
      select:
        "id,source_id,visibility,code_status,review_status,reviewed_at,verified_at,last_checked_at",
      limit: 1000,
    }),
  ]);

  const launchUniverseIds = new Set(
    GAME_IDENTITIES.map((game) => Number(game.universeId)),
  );
  const launchReadiness = readiness.filter((row) =>
    launchUniverseIds.has(Number(row.universe_id)),
  );

  const publishedCodes = codes.filter(
    (code) => code.visibility === "published",
  );
  const invalidPublishedCodes = publishedCodes.filter(
    (code) =>
      !code.source_id ||
      !code.last_checked_at ||
      code.review_status !== "approved" ||
      !code.reviewed_at ||
      (code.code_status === "active" && !code.verified_at),
  ).length;

  const input = {
    publicSiteUrl: getPublicSiteUrl(),
    previewNoIndex: process.env.R1_PREVIEW_NO_INDEX,
    releaseConfirm: process.env.R1_INDEX_RELEASE_CONFIRM,
    privateContactConfigured: Boolean(privateContact()),
    privacyRetentionConfigured: Boolean(privacyRetentionStatement()),
    operatorIdentityConfigured: Boolean(verifiedOperatorName()),
    googleProviderEnabled: settings.external?.google === true,
    googleOnlySignupHookConfirmed:
      process.env.R1_GOOGLE_ONLY_SIGNUP_HOOK_CONFIRM === "1",
    googleIdentityCount: Number(authReadiness?.google_identity_count ?? 0),
    activeGoogleAdminCount: Number(
      authReadiness?.active_google_admin_count ?? 0,
    ),
    googleE2EConfirmed: process.env.R1_GOOGLE_E2E_CONFIRM === "1",
    communityE2EConfirmed:
      process.env.R1_COMMUNITY_E2E_CONFIRM === "1",
    catalogGames: launchReadiness.length,
    dataReadyGames: launchReadiness.filter(
      (row) => row.data_ready_for_index_review,
    ).length,
    unavailableGames: launchReadiness
      .filter((row) => row.freshness_state === "unavailable")
      .map((row) => ({
        slug: row.canonical_slug,
        freshnessState: row.freshness_state,
      })),
    contentSources: sources.length,
    approvedPublishedGuides: guides.filter(
      (guide) =>
        guide.review_status === "approved" &&
        guide.content_status === "published",
    ).length,
    noindexGuides: guides.filter(
      (guide) => guide.index_state === "noindex",
    ).length,
    publishedCodes: publishedCodes.length,
    invalidPublishedCodes,
  };

  const checks = evaluateReleasePreflight(input);

  console.log("R1 Oreun release preflight");
  console.log("==========================");
  for (const check of checks) {
    console.log(
      `${check.ok ? "PASS" : "BLOCK"}  ${check.key}  ${check.detail}`,
    );
  }

  if (!releasePreflightPassed(checks)) {
    console.error("\nRelease preflight BLOCKED.");
    process.exitCode = 1;
    return;
  }

  console.log("\nRelease preflight PASSED.");
}

main().catch((error) => {
  console.error(
    "Release preflight failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
