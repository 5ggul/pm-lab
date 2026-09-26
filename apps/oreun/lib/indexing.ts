import { privateContact } from "./private-contact";
import { privacyRetentionStatement } from "./privacy-retention";
import { verifiedOperatorName } from "./operator-info";

function isPrivateOrReservedHostname(hostname: string) {
  const host = hostname.toLowerCase();

  const isIpv4Literal = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
  const isIpv6Literal = host.includes(":");

  if (isIpv4Literal || isIpv6Literal) return true;

  return (
    host === "localhost" ||
    host === "example" ||
    host === "invalid" ||
    host === "test" ||
    host.endsWith(".localhost") ||
    host.endsWith(".example") ||
    host.endsWith(".invalid") ||
    host.endsWith(".test")
  );
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

function isHostedPreviewOrigin(value: string | null) {
  if (!value) return false;
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname.endsWith(".vercel.app") || hostname.endsWith(".workers.dev");
}

export function isIndexingReleased(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const publicSiteUrl = getPublicSiteUrl(env);
  return (
    env.R1_PREVIEW_NO_INDEX === "0" &&
    env.R1_INDEX_RELEASE_CONFIRM === "1" &&
    publicSiteUrl !== null &&
    !isHostedPreviewOrigin(publicSiteUrl) &&
    privateContact(env) !== null &&
    privacyRetentionStatement(env) !== null &&
    verifiedOperatorName(env) !== null
  );
}


export function getRenderingSiteUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = getPublicSiteUrl(env);
  if (explicit) return explicit;

  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) {
    try {
      const url = new URL("https://" + vercelUrl.replace(/^https?:\/\//, ""));
      if (url.protocol === "https:" && url.hostname.endsWith(".vercel.app")) {
        return url.origin;
      }
    } catch {
      // Preview metadata falls back locally; this never opens indexing.
    }
  }

  return "http://localhost:3000";
}
