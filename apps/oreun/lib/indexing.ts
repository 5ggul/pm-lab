function isPrivateOrReservedHostname(hostname: string) {
  const host = hostname.toLowerCase();

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".example") ||
    host.endsWith(".invalid") ||
    host.endsWith(".test")
  ) {
    return true;
  }

  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }

  const match = host.match(/^172\.(\d{1,3})\./);
  if (match) {
    const second = Number(match[1]);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
}

export function getPublicSiteUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || isPrivateOrReservedHostname(hostname)) {
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
  return (
    env.R1_PREVIEW_NO_INDEX === "0" &&
    env.R1_INDEX_RELEASE_CONFIRM === "1" &&
    getPublicSiteUrl(env) !== null
  );
}
