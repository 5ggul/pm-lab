import { createHash, randomBytes } from "node:crypto";

export function normalizeAuthNext(value: string | null | undefined) {
  const next = String(value ?? "").trim();
  return next.startsWith("/") && !next.startsWith("//") ? next : "/me";
}

export function normalizeOAuthOrigin(value: string) {
  const url = new URL(value);
  const local =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";

  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("OAuth callback origin must use HTTPS.");
  }

  return url.origin;
}

function base64UrlSha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function createGoogleOAuthRequest({
  supabaseUrl,
  origin,
  next,
}: {
  supabaseUrl: string;
  origin: string;
  next?: string | null;
}) {
  const normalizedOrigin = normalizeOAuthOrigin(origin);
  const normalizedNext = normalizeAuthNext(next);
  const verifier = randomBytes(48).toString("base64url");
  const challenge = base64UrlSha256(verifier);
  const callbackUrl = normalizedOrigin + "/auth/google/callback";
  const authorize = new URL(
    supabaseUrl.replace(/\/$/, "") + "/auth/v1/authorize",
  );

  authorize.searchParams.set("provider", "google");
  authorize.searchParams.set("redirect_to", callbackUrl);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "s256");

  return {
    authorizeUrl: authorize.toString(),
    callbackUrl,
    verifier,
    challenge,
    next: normalizedNext,
  };
}
