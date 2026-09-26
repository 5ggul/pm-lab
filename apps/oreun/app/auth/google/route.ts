import { NextRequest, NextResponse } from "next/server";
import {
  beginGoogleOAuth,
  getGoogleAuthProviderStatus,
} from "@/lib/auth/session";
import { normalizeAuthNext } from "@/lib/auth/oauth";

function privateRedirect(url: URL | string) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function loginError(request: NextRequest, message: string, next: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  url.searchParams.set("next", next);
  return privateRedirect(url);
}

export async function GET(request: NextRequest) {
  const next = normalizeAuthNext(request.nextUrl.searchParams.get("next"));
  const provider = await getGoogleAuthProviderStatus();

  if (!provider.enabled) {
    return loginError(
      request,
      "Google 로그인 연결 설정이 아직 완료되지 않았습니다.",
      next,
    );
  }

  const started = await beginGoogleOAuth(request.nextUrl.origin, next);
  if (!started.url) {
    return loginError(
      request,
      started.error ?? "Google 로그인을 시작하지 못했습니다.",
      next,
    );
  }

  return privateRedirect(started.url);
}
