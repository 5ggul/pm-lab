import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const universeId = Number(request.nextUrl.searchParams.get("universeId"));
  const videoId = Number(request.nextUrl.searchParams.get("videoId"));

  if (
    !Number.isSafeInteger(universeId) ||
    universeId <= 0 ||
    !Number.isSafeInteger(videoId) ||
    videoId <= 0
  ) {
    return NextResponse.json({ error: "invalid ids" }, { status: 400 });
  }

  const supabaseUrl = (
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).replace(/\/$/, "");

  if (!supabaseUrl) {
    return NextResponse.json(
      { error: "media resolver unavailable" },
      { status: 503 },
    );
  }

  const upstream = await fetch(
    supabaseUrl +
      "/functions/v1/r1-game-media?universeId=" +
      encodeURIComponent(String(universeId)) +
      "&videoId=" +
      encodeURIComponent(String(videoId)),
    { cache: "no-store" },
  );

  const text = await upstream.text();
  if (!upstream.ok) {
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  }

  let payload: { url?: string };
  try {
    payload = JSON.parse(text) as { url?: string };
  } catch {
    return NextResponse.json({ error: "invalid media response" }, { status: 502 });
  }

  if (!payload.url) {
    return NextResponse.json({ error: "video location missing" }, { status: 502 });
  }

  let host = "";
  try {
    host = new URL(payload.url).hostname;
  } catch {
    return NextResponse.json({ error: "invalid video location" }, { status: 502 });
  }
  if (!host.endsWith(".rbxcdn.com")) {
    return NextResponse.json({ error: "unexpected video host" }, { status: 502 });
  }

  return NextResponse.json(
    { url: payload.url },
    { headers: { "cache-control": "no-store" } },
  );
}
