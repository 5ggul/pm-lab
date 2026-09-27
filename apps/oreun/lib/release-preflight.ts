export type ReleasePreflightInput = {
  publicSiteUrl: string | null;
  previewNoIndex: string | undefined;
  releaseConfirm: string | undefined;
  privateContactConfigured: boolean;
  privacyRetentionConfigured: boolean;
  operatorIdentityConfigured: boolean;
  googleProviderEnabled: boolean;
  googleOnlySignupHookConfirmed: boolean;
  googleIdentityCount: number;
  activeGoogleAdminCount: number;
  googleE2EConfirmed: boolean;
  communityE2EConfirmed: boolean;
  catalogGames: number;
  dataReadyGames: number;
  unavailableGames: Array<{ slug: string; freshnessState: string | null }>;
  contentSources: number;
  approvedPublishedGuides: number;
  noindexGuides: number;
  publishedCodes: number;
  invalidPublishedCodes: number;
};

export type ReleasePreflightCheck = {
  key: string;
  ok: boolean;
  detail: string;
};

function isProductionIndexOrigin(value: string | null) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return !hostname.endsWith(".vercel.app") && !hostname.endsWith(".workers.dev");
  } catch {
    return false;
  }
}

export function evaluateReleasePreflight(
  input: ReleasePreflightInput,
): ReleasePreflightCheck[] {
  const checks: ReleasePreflightCheck[] = [
    {
      key: "public-site-url",
      ok: isProductionIndexOrigin(input.publicSiteUrl),
      detail: isProductionIndexOrigin(input.publicSiteUrl)
        ? `public HTTPS site: ${input.publicSiteUrl}`
        : "NEXT_PUBLIC_SITE_URL must be a custom public HTTPS origin, not a hosted preview domain",
    },
    {
      key: "release-flags",
      ok:
        input.previewNoIndex === "0" &&
        input.releaseConfirm === "1",
      detail:
        `R1_PREVIEW_NO_INDEX=${input.previewNoIndex ?? "(unset)"} / ` +
        `R1_INDEX_RELEASE_CONFIRM=${input.releaseConfirm ?? "(unset)"}`,
    },
    {
      key: "private-contact",
      ok: input.privateContactConfigured,
      detail: input.privateContactConfigured
        ? "verified private contact channel configured"
        : "verified private contact channel is missing",
    },
    {
      key: "privacy-retention",
      ok: input.privacyRetentionConfigured,
      detail: input.privacyRetentionConfigured
        ? "verified retention statement configured"
        : "backup/security-log retention statement is not verified",
    },
    {
      key: "operator-identity",
      ok: input.operatorIdentityConfigured,
      detail: input.operatorIdentityConfigured
        ? "verified public operator identity configured"
        : "verified public operator identity is missing",
    },
    {
      key: "google-provider",
      ok: input.googleProviderEnabled,
      detail: input.googleProviderEnabled
        ? "Supabase Google provider enabled"
        : "Supabase Google provider is not enabled",
    },
    {
      key: "google-only-signup-hook",
      ok: input.googleOnlySignupHookConfirmed,
      detail: input.googleOnlySignupHookConfirmed
        ? "Google-only new-account Auth hook manually verified"
        : "R1_GOOGLE_ONLY_SIGNUP_HOOK_CONFIRM is not 1",
    },
    {
      key: "google-identity",
      ok: input.googleIdentityCount >= 1,
      detail: `Google identities ${input.googleIdentityCount}`,
    },
    {
      key: "google-admin",
      ok: input.activeGoogleAdminCount >= 1,
      detail: `active Google-backed admins ${input.activeGoogleAdminCount}`,
    },
    {
      key: "google-browser-e2e",
      ok: input.googleE2EConfirmed,
      detail: input.googleE2EConfirmed
        ? "Google login/onboarding/refresh/logout browser E2E confirmed"
        : "R1_GOOGLE_E2E_CONFIRM is not 1",
    },
    {
      key: "community-browser-e2e",
      ok: input.communityE2EConfirmed,
      detail: input.communityE2EConfirmed
        ? "two-Google-account community browser E2E confirmed"
        : "R1_COMMUNITY_E2E_CONFIRM is not 1",
    },
    {
      key: "catalog",
      ok: input.catalogGames === 26,
      detail: `catalog games ${input.catalogGames}/26`,
    },
    {
      key: "data-readiness",
      ok: input.dataReadyGames >= 25,
      detail: `data-ready games ${input.dataReadyGames}/${input.catalogGames}`,
    },
    {
      key: "regional-unavailable",
      ok:
        input.unavailableGames.length === 1 &&
        input.unavailableGames[0]?.slug === "brookhaven" &&
        input.unavailableGames[0]?.freshnessState === "unavailable",
      detail:
        input.unavailableGames.length === 0
          ? "no regional/provider unavailable game recorded"
          : "unavailable: " +
            input.unavailableGames
              .map((game) => `${game.slug}:${game.freshnessState ?? "null"}`)
              .join(", "),
    },
    {
      key: "content-sources",
      ok: input.contentSources >= 26,
      detail: `official/verified content sources ${input.contentSources}`,
    },
    {
      key: "reviewed-guides",
      ok:
        input.approvedPublishedGuides >= 26 &&
        input.noindexGuides >= 26,
      detail:
        `approved+published guides ${input.approvedPublishedGuides}; ` +
        `guide noindex rows ${input.noindexGuides}`,
    },
    {
      key: "code-integrity",
      ok: input.invalidPublishedCodes === 0,
      detail:
        `published codes ${input.publishedCodes}; invalid published codes ` +
        `${input.invalidPublishedCodes}`,
    },
  ];

  return checks;
}

export function releasePreflightPassed(checks: ReleasePreflightCheck[]) {
  return checks.every((check) => check.ok);
}
