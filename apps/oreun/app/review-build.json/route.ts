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
      preview_noindex: process.env.R1_PREVIEW_NO_INDEX !== "0",
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
