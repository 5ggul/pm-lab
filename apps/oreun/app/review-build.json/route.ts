import { getPublicSiteUrl, isIndexingReleased } from "@/lib/indexing";

export const dynamic = "force-dynamic";

export async function GET() {
  const commit =
    process.env.NEXT_PUBLIC_REVIEW_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "local";

  return Response.json(
    {
      project: "R1",
      brand: "오름",
      commit_sha: commit,
      preview_noindex: !isIndexingReleased(),
      indexing_release_requested: process.env.R1_PREVIEW_NO_INDEX === "0",
      validated_site_url: getPublicSiteUrl(),
      community_version: "sprint02",
      content_version: "sprint03",
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
