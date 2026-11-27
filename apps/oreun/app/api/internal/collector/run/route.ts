import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { RobloxPublicGamesProvider } from "@/lib/providers/roblox-public";
import { SupabaseCollectorStore } from "@/lib/collector/supabase-store";
import { runPersistentCollector } from "@/lib/collector/persistent-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function expectedTriggerSecret() {
  return process.env.R1_COLLECTOR_TRIGGER_SECRET || process.env.CRON_SECRET || "";
}

function hasValidSecret(request: NextRequest, expected: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const presented = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : request.headers.get("x-r1-collector-secret") ?? "";
  if (!presented || presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  const expected = expectedTriggerSecret();
  if (!expected) {
    return Response.json(
      { error: "collector trigger secret is not configured" },
      { status: 503 },
    );
  }
  if (!hasValidSecret(request, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const store = new SupabaseCollectorStore();
  if (!store.isConfigured()) {
    return Response.json(
      { error: "R1 Supabase persistence is not configured" },
      { status: 503 },
    );
  }

  try {
    const result = await runPersistentCollector({
      provider: new RobloxPublicGamesProvider(),
      store,
      limit: 100,
    });
    return Response.json(result, {
      status: result.status === "failed" ? 502 : 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "collector execution failed",
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
