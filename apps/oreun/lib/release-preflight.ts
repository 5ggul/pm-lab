export type ReleasePreflightInput = {
  publicSiteUrl: string | null;
  previewNoIndex: string | undefined;
  releaseConfirm: string | undefined;
  googleProviderEnabled: boolean;
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

export function evaluateReleasePreflight(
  input: ReleasePreflightInput,
): ReleasePreflightCheck[] {
  const checks: ReleasePreflightCheck[] = [
    {
      key: "public-site-url",
      ok: Boolean(input.publicSiteUrl),
      detail: input.publicSiteUrl
        ? `public HTTPS site: ${input.publicSiteUrl}`
        : "NEXT_PUBLIC_SITE_URL is not a valid public HTTPS origin",
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
      key: "google-provider",
      ok: input.googleProviderEnabled,
      detail: input.googleProviderEnabled
        ? "Supabase Google provider enabled"
        : "Supabase Google provider is not enabled",
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
