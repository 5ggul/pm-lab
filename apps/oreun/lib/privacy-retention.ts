export function privacyRetentionStatement(
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (env.R1_PRIVACY_RETENTION_VERIFIED !== "1") return null;
  const statement = env.R1_PRIVACY_RETENTION_STATEMENT?.trim();
  if (!statement || statement.length < 20 || statement.length > 800) return null;
  return statement;
}
