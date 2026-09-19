import { gunzipSync } from "node:zlib";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const universeId = Number(request.nextUrl.searchParams.get("universeId"));
  const videoId = Number(request.nextUrl.searchParams.get("videoId"));
  const stream = request.nextUrl.searchParams.get("stream") === "1";

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

  if (!stream) {
    return NextResponse.json(
      { url: payload.url },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const asset = await fetch(payload.url, {
    cache: "no-store",
    headers: {
      "accept-encoding": "identity",
    },
  });
  if (!asset.ok) {
    return NextResponse.json(
      { error: "video asset unavailable" },
      { status: 502 },
    );
  }

  const compressedLength = Number(asset.headers.get("content-length") ?? 0);
  if (compressedLength > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "video asset too large" }, { status: 413 });
  }

  const raw = Buffer.from(await asset.arrayBuffer());
  if (raw.byteLength > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "video asset too large" }, { status: 413 });
  }

  let body: Uint8Array = new Uint8Array(raw);
  if (raw[0] === 0x1f && raw[1] === 0x8b) {
    try {
      body = new Uint8Array(gunzipSync(raw));
    } catch {
      return NextResponse.json(
        { error: "video decompression failed" },
        { status: 502 },
      );
    }
  }

  if (
    body.byteLength < 4 ||
    body[0] !== 0x1a ||
    body[1] !== 0x45 ||
    body[2] !== 0xdf ||
    body[3] !== 0xa3
  ) {
    return NextResponse.json(
      { error: "unexpected video format" },
      { status: 502 },
    );
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "video/webm",
      "cache-control": "private, max-age=300",
      "content-length": String(body.byteLength),
      "x-content-type-options": "nosniff",
    },
  });
}
