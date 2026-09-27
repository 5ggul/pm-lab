export function verifiedOperatorName(
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (env.R1_OPERATOR_IDENTITY_VERIFIED !== "1") return null;
  const name = env.R1_OPERATOR_NAME?.trim();
  if (!name || name.length < 2 || name.length > 120) return null;
  return name;
}
