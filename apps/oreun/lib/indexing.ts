export function getPublicSiteUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return null;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost")
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function isIndexingReleased(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.R1_PREVIEW_NO_INDEX === "0" && getPublicSiteUrl(env) !== null;
}
