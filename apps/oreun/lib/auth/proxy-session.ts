import { NextResponse, type NextRequest } from "next/server";
import { authCookieNames } from "./session";
import { shouldRefreshAccessToken } from "./token";

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function secureCookie(request: NextRequest) {
  return request.nextUrl.protocol === "https:";
}

function commonCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    secure: secureCookie(request),
    sameSite: "lax" as const,
    path: "/",
  };
}

function nextResponse(request: NextRequest) {
  return NextResponse.next({ request });
}

export async function refreshSessionIfNeeded(request: NextRequest) {
  const currentAccess = request.cookies.get(authCookieNames.access)?.value;
  const refresh = request.cookies.get(authCookieNames.refresh)?.value;

  if (!refresh || !shouldRefreshAccessToken(currentAccess)) {
    return nextResponse(request);
  }

  const auth = config();
  if (!auth) return nextResponse(request);

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
      const response = nextResponse(request);
      response.headers.set("Cache-Control", "private, no-store");

      // Invalid/expired refresh tokens should fail closed. Transient provider
      // failures keep the existing cookies so a temporary outage does not
      // force an otherwise recoverable user session to sign out.
      if ([400, 401, 403].includes(refreshed.status)) {
        const common = commonCookieOptions(request);
        response.cookies.set(authCookieNames.access, "", {
          ...common,
          maxAge: 1,
        });
        response.cookies.set(authCookieNames.refresh, "", {
          ...common,
          maxAge: 1,
        });
      }
      return response;
    }

    const session = (await refreshed.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!session.access_token || !session.refresh_token) {
      const response = nextResponse(request);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    // Make the rotated tokens visible to the Server Components handling this
    // same request, not only to the browser's next request.
    request.cookies.set(authCookieNames.access, session.access_token);
    request.cookies.set(authCookieNames.refresh, session.refresh_token);

    const response = nextResponse(request);
    response.headers.set("Cache-Control", "private, no-store");
    const common = commonCookieOptions(request);

    response.cookies.set(authCookieNames.access, session.access_token, {
      ...common,
      maxAge: Math.max(60, session.expires_in ?? 3600),
    });
    response.cookies.set(authCookieNames.refresh, session.refresh_token, {
      ...common,
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch {
    const response = nextResponse(request);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
