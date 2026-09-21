export function accessTokenExpiresAt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    const payload = JSON.parse(
      Buffer.from(padded, "base64").toString("utf8"),
    ) as { exp?: unknown };
    const exp = Number(payload.exp);
    return Number.isFinite(exp) && exp > 0 ? exp : null;
  } catch {
    return null;
  }
}

export function shouldRefreshAccessToken(
  token: string | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
  skewSeconds = 60,
) {
  if (!token) return true;
  const exp = accessTokenExpiresAt(token);
  if (exp == null) return true;
  return exp <= nowSeconds + Math.max(0, skewSeconds);
}
