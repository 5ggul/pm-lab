import { NextResponse } from "next/server";
import { getRadarSnapshot } from "../../../lib/radar";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getRadarSnapshot();
  return NextResponse.json({
    ok: snapshot.health.status !== "DELAYED",
    mode: snapshot.mode,
    generatedAt: snapshot.generatedAt,
    collector: snapshot.health
  }, { headers: { "Cache-Control": "no-store" } });
}
