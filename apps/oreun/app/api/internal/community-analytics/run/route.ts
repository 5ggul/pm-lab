import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { runCommunityAnalyticsOnce } from "@/lib/community-analytics/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function expectedTriggerSecret() {
  return (
    process.env.R1_COMMUNITY_ANALYTICS_TRIGGER_SECRET ||
    process.env.CRON_SECRET ||
    ""
  );
}

function hasValidSecret(request: NextRequest, expected: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const presented = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : request.headers.get("x-r1-community-analytics-secret") ?? "";
  if (!presented || presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  const expected = expectedTriggerSecret();
  if (!expected) {
    return Response.json(
      { error: "community analytics trigger secret is not configured" },
      { status: 503 },
    );
  }
  if (!hasValidSecret(request, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCommunityAnalyticsOnce();
    const status =
      result.status === "failed"
        ? 502
        : result.status === "not_configured"
          ? 503
          : 200;

    return Response.json(result, {
      status,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "community analytics execution failed",
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
