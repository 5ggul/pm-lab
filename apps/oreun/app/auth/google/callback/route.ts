import { NextRequest, NextResponse } from "next/server";
import { authCookieNames, clearGoogleOAuthAttempt, exchangeGoogleOAuthCode } from "@/lib/auth/session";
import { getCommunityPermissions } from "@/lib/community/queries";
import { loginErrorPath } from "@/lib/auth/navigation";

function privateRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function retryLogin(message: string, next?: string | null) {
  // This destination is always the local /login route. A relative Location
  // retains the browser's actual host, including 127.0.0.1 in local QA.
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: loginErrorPath(message, next),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const providerError = request.nextUrl.searchParams.get("error_description") || request.nextUrl.searchParams.get("error");

  if (providerError) {
    const next = request.cookies.get(authCookieNames.oauthNext)?.value;
    await clearGoogleOAuthAttempt(origin);
    return retryLogin("Google 로그인이 취소되었거나 완료되지 않았습니다.", next);
  }

  const code = request.nextUrl.searchParams.get("code") ?? "";
  const result = await exchangeGoogleOAuthCode(origin, code);
  if (!result.data?.access_token || result.error) {
    return retryLogin(result.error ?? "Google 로그인 세션을 만들지 못했습니다.", result.next);
  }

  const permissions = await getCommunityPermissions(result.data.access_token).catch(() => null);
  if (permissions?.age_confirmed_14_plus) {
    return privateRedirect(new URL(result.next, origin));
  }

  const onboarding = new URL("/me", origin);
  onboarding.searchParams.set("welcome", "google");
  onboarding.searchParams.set("next", result.next);
  return privateRedirect(onboarding);
}
