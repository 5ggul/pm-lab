import { NextResponse, type NextRequest } from "next/server";
import { authCookieNames } from "./session";

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function secureCookie(request: NextRequest) {
  return request.nextUrl.protocol === "https:";
}

export async function refreshSessionIfNeeded(request: NextRequest) {
  const response = NextResponse.next({ request });
  const currentAccess = request.cookies.get(authCookieNames.access)?.value;
  const refresh = request.cookies.get(authCookieNames.refresh)?.value;
  if (currentAccess || !refresh) return response;

  const auth = config();
  if (!auth) return response;

  try {
    const refreshed = await fetch(
      `${auth.url}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: auth.key,
          "content-type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refresh }),
        cache: "no-store",
      },
    );
    if (!refreshed.ok) {
      response.cookies.delete(authCookieNames.access);
      response.cookies.delete(authCookieNames.refresh);
      return response;
    }

    const session = (await refreshed.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (session.access_token && session.refresh_token) {
      const common = {
        httpOnly: true,
        secure: secureCookie(request),
        sameSite: "lax" as const,
        path: "/",
      };
      response.cookies.set(authCookieNames.access, session.access_token, {
        ...common,
        maxAge: Math.max(60, session.expires_in ?? 3600),
      });
      response.cookies.set(authCookieNames.refresh, session.refresh_token, {
        ...common,
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  } catch {
    return response;
  }

  return response;
}
