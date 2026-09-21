import { NextRequest, NextResponse } from "next/server";
import {
  clearGoogleOAuthAttempt,
  exchangeGoogleOAuthCode,
} from "@/lib/auth/session";
import { getCommunityPermissions } from "@/lib/community/queries";

function privateRedirect(url: URL | string) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function loginError(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return privateRedirect(url);
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const providerError =
    request.nextUrl.searchParams.get("error_description") ||
    request.nextUrl.searchParams.get("error");

  if (providerError) {
    await clearGoogleOAuthAttempt(origin);
    return loginError(request, "Google 로그인이 취소되었거나 완료되지 않았습니다.");
  }

  const code = request.nextUrl.searchParams.get("code") ?? "";
  const result = await exchangeGoogleOAuthCode(origin, code);

  if (!result.data?.access_token || result.error) {
    return loginError(
      request,
      result.error ?? "Google 로그인 세션을 만들지 못했습니다.",
    );
  }

  const permissions = await getCommunityPermissions(
    result.data.access_token,
  ).catch(() => null);

  if (permissions?.age_confirmed_14_plus) {
    return privateRedirect(new URL(result.next, origin));
  }

  const onboarding = new URL("/me", origin);
  onboarding.searchParams.set("welcome", "google");
  onboarding.searchParams.set("next", result.next);
  return privateRedirect(onboarding);
}
