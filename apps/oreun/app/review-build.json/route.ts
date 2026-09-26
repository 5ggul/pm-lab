import { getPublicSiteUrl, isIndexingReleased } from "@/lib/indexing";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isIndexingReleased()) {
    return new Response(null, {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }

  const commit =
    process.env.NEXT_PUBLIC_REVIEW_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "local";

  return Response.json(
    {
      project: "R1",
      brand: "로블잼",
      commit_sha: commit,
      preview_noindex: !isIndexingReleased(),
      indexing_release_requested: process.env.R1_PREVIEW_NO_INDEX === "0",
      indexing_release_confirmed:
        process.env.R1_INDEX_RELEASE_CONFIRM === "1",
      validated_site_url: getPublicSiteUrl(),
      community_version: "sprint02",
      content_version: "sprint03",
      party_trust_version: "sprint04",
      community_analytics_version: "sprint05",
      release_candidate: true,
      community_analytics_enabled:
        process.env.R1_ROBLOX_COMMUNITY_ANALYTICS === "1",
      community_analytics_key_configured: Boolean(
        process.env.ROBLOX_OPEN_CLOUD_API_KEY,
      ),
      community_db_configured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      ),
      data_mode:
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          ? "persistent-preview-db"
          : process.env.R1_PREVIEW_FIXTURES === "1"
            ? "fixture-ui-qa"
            : "provider-fallback",
      generated_at: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
