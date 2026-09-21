import { cookies } from "next/headers";
import { getPublicSiteUrl } from "@/lib/indexing";
import { createGoogleOAuthRequest, normalizeAuthNext } from "@/lib/auth/oauth";

const ACCESS_COOKIE = "oreun_access";
const REFRESH_COOKIE = "oreun_refresh";
const OAUTH_VERIFIER_COOKIE = "oreun_oauth_verifier";
const OAUTH_NEXT_COOKIE = "oreun_oauth_next";

export type AuthUser = {
  id: string;
  email?: string | null;
  created_at?: string;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: AuthUser | null;
};

function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function secureCookies() {
  return getPublicSiteUrl() !== null;
}

function cookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax" as const,
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  };
}

function oauthCookieOptions(origin: string, maxAge = 10 * 60) {
  return {
    ...cookieOptions(maxAge),
    secure: origin.startsWith("https://"),
  };
}

function clearOAuthCookieOptions(origin: string) {
  return {
    ...oauthCookieOptions(origin, 1),
    maxAge: 1,
  };
}

async function requestAuth<T>(
  path: string,
  init: RequestInit,
): Promise<{ data: T | null; error: string | null; status: number }> {
  const config = authConfig();
  if (!config) {
    return { data: null, error: "Supabase Auth is not configured.", status: 503 };
  }

  const headers = new Headers(init.headers);
  headers.set("apikey", config.key);
  headers.set("content-type", "application/json");

  const response = await fetch(`${config.url}/auth/v1${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    return {
      data: null,
      error:
        parsed?.msg ||
        parsed?.message ||
        parsed?.error_description ||
        `Auth HTTP ${response.status}`,
      status: response.status,
    };
  }

  return { data: parsed as T, error: null, status: response.status };
}

export async function setAuthSession(session: AuthSession) {
  const store = await cookies();
  store.set(
    ACCESS_COOKIE,
    session.access_token,
    cookieOptions(Math.max(60, session.expires_in ?? 3600)),
  );
  store.set(
    REFRESH_COOKIE,
    session.refresh_token,
    cookieOptions(60 * 60 * 24 * 30),
  );
}

export async function clearAuthSession() {
  const store = await cookies();
  store.set(ACCESS_COOKIE, "", cookieOptions(1));
  store.set(REFRESH_COOKIE, "", cookieOptions(1));
}

export async function getGoogleAuthProviderStatus() {
  const result = await requestAuth<{
    external?: Record<string, boolean | undefined>;
  }>("/settings", { method: "GET" });

  return {
    enabled: result.data?.external?.google === true,
    error: result.error,
    status: result.status,
  };
}

export async function beginGoogleOAuth(origin: string, next?: string | null) {
  const config = authConfig();
  if (!config) {
    return {
      url: null,
      error: "Supabase Auth is not configured.",
      status: 503,
    };
  }

  let request: ReturnType<typeof createGoogleOAuthRequest>;
  try {
    request = createGoogleOAuthRequest({
      supabaseUrl: config.url,
      origin,
      next,
    });
  } catch (caught) {
    return {
      url: null,
      error:
        caught instanceof Error ? caught.message : "OAuth callback URL is invalid.",
      status: 400,
    };
  }

  const store = await cookies();
  store.set(
    OAUTH_VERIFIER_COOKIE,
    request.verifier,
    oauthCookieOptions(new URL(request.callbackUrl).origin),
  );
  store.set(
    OAUTH_NEXT_COOKIE,
    request.next,
    oauthCookieOptions(new URL(request.callbackUrl).origin),
  );

  return {
    url: request.authorizeUrl,
    error: null,
    status: 200,
  };
}

export async function clearGoogleOAuthAttempt(origin: string) {
  const store = await cookies();
  store.set(
    OAUTH_VERIFIER_COOKIE,
    "",
    clearOAuthCookieOptions(origin),
  );
  store.set(
    OAUTH_NEXT_COOKIE,
    "",
    clearOAuthCookieOptions(origin),
  );
}

export async function exchangeGoogleOAuthCode(
  origin: string,
  code: string,
): Promise<{
  data: AuthSession | null;
  error: string | null;
  status: number;
  next: string;
}> {
  const store = await cookies();
  const verifier = store.get(OAUTH_VERIFIER_COOKIE)?.value ?? "";
  const next = normalizeAuthNext(store.get(OAUTH_NEXT_COOKIE)?.value);

  await clearGoogleOAuthAttempt(origin);

  if (!code || !verifier) {
    return {
      data: null,
      error: "Google 로그인 요청이 만료됐습니다. 다시 시도해 주세요.",
      status: 400,
      next,
    };
  }

  const result = await requestAuth<AuthSession>("/token?grant_type=pkce", {
    method: "POST",
    body: JSON.stringify({
      auth_code: code,
      code_verifier: verifier,
    }),
  });

  if (result.data?.access_token && result.data.refresh_token) {
    await setAuthSession(result.data);
  }

  return { ...result, next };
}

export async function signInWithPassword(email: string, password: string) {
  const result = await requestAuth<AuthSession>("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (result.data?.access_token && result.data.refresh_token) {
    await setAuthSession(result.data);
  }
  return result;
}

export async function getCurrentAccessToken() {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshToken() {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const config = authConfig();
  const access = await getCurrentAccessToken();
  if (!config || !access) return null;

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.key,
      authorization: `Bearer ${access}`,
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as AuthUser;
}

export async function refreshAuthSession(refreshToken: string) {
  return requestAuth<AuthSession>("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function signOutCurrentSession() {
  const config = authConfig();
  const access = await getCurrentAccessToken();
  if (config && access) {
    await fetch(`${config.url}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: config.key,
        authorization: `Bearer ${access}`,
      },
      cache: "no-store",
    }).catch(() => undefined);
  }
  await clearAuthSession();
}

export const authCookieNames = {
  access: ACCESS_COOKIE,
  refresh: REFRESH_COOKIE,
  oauthVerifier: OAUTH_VERIFIER_COOKIE,
  oauthNext: OAUTH_NEXT_COOKIE,
};
