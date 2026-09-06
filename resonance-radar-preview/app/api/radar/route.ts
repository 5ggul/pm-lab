import { NextResponse } from "next/server";
import { getRadarSnapshot } from "../../../lib/radar";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getRadarSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
