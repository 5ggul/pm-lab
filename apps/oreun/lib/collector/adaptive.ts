export type CollectorTier = "hot" | "active" | "normal" | "longtail";

export function collectorTier(
  playing: number | null,
  failures = 0,
): CollectorTier {
  if (failures >= 3) return "longtail";
  if ((playing ?? 0) >= 100000) return "hot";
  if ((playing ?? 0) >= 20000) return "active";
  if ((playing ?? 0) >= 2000) return "normal";
  return "longtail";
}

export function cadenceMinutes(tier: CollectorTier) {
  return tier === "hot"
    ? 5
    : tier === "active"
      ? 15
      : tier === "normal"
        ? 30
        : 120;
}

export function backoffMs(
  attempt: number,
  retryAfterSeconds: number | null = 0,
) {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  return Math.min(120000, 1000 * Math.pow(2, Math.max(0, attempt)));
}

export function failureRetrySeconds(
  failureCount: number,
  retryAfterSeconds: number | null,
) {
  if (retryAfterSeconds != null && retryAfterSeconds > 0) {
    return Math.min(6 * 60 * 60, Math.max(30, Math.ceil(retryAfterSeconds)));
  }
  return Math.min(
    60 * 60,
    Math.max(60, 60 * Math.pow(2, Math.max(0, failureCount - 1))),
  );
}
