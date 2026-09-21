import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { refreshSessionIfNeeded } from "../lib/auth/proxy-session";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
} as NodeJS.ProcessEnv;

function fakeJwt(exp: number) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return encode({ alg: "none", typ: "JWT" }) + "." + encode({ exp }) + ".sig";
}

function requestWith(access: string | null, refresh = "refresh-old") {
  const cookies = [
    access ? "oreun_access=" + access : "",
    refresh ? "oreun_refresh=" + refresh : "",
  ].filter(Boolean);
  return new NextRequest("https://preview.example.com/me", {
    headers: { cookie: cookies.join("; ") },
  });
}

test("SSR auth proxy rotates expiring sessions and handles failures safely", async () => {
  const now = Math.floor(Date.now() / 1000);

  let calls = 0;
  const freshRequest = requestWith(fakeJwt(now + 600));
  const freshResponse = await refreshSessionIfNeeded(freshRequest, {
    env,
    fetchImpl: (async () => {
      calls += 1;
      return new Response(null, { status: 500 });
    }) as typeof fetch,
  });
  assert.equal(calls, 0);
  assert.equal(freshResponse.cookies.get("oreun_access"), undefined);

  const expiredRequest = requestWith(fakeJwt(now - 10));
  const rotated = await refreshSessionIfNeeded(expiredRequest, {
    env,
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          access_token: fakeJwt(now + 3600),
          refresh_token: "refresh-new",
          expires_in: 3600,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch,
  });
  assert.ok(rotated.cookies.get("oreun_access")?.value);
  assert.equal(rotated.cookies.get("oreun_refresh")?.value, "refresh-new");
  assert.equal(expiredRequest.cookies.get("oreun_refresh")?.value, "refresh-new");
  assert.equal(rotated.headers.get("cache-control"), "private, no-store");

  const invalidRequest = requestWith(fakeJwt(now - 10));
  const invalid = await refreshSessionIfNeeded(invalidRequest, {
    env,
    fetchImpl: (async () =>
      new Response(JSON.stringify({ error: "invalid refresh" }), {
        status: 401,
      })) as typeof fetch,
  });
  assert.equal(invalid.cookies.get("oreun_access")?.value, "");
  assert.equal(invalid.cookies.get("oreun_refresh")?.value, "");

  const outageRequest = requestWith(fakeJwt(now - 10));
  const outage = await refreshSessionIfNeeded(outageRequest, {
    env,
    fetchImpl: (async () =>
      new Response("temporary outage", { status: 503 })) as typeof fetch,
  });
  assert.equal(outage.cookies.get("oreun_access"), undefined);
  assert.equal(outage.cookies.get("oreun_refresh"), undefined);
  assert.equal(outage.headers.get("cache-control"), "private, no-store");
});
