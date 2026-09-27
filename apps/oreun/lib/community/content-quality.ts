const GENERATED_HANDLE = /^u_[0-9a-f]{10,32}$/i;
const JAMO_ONLY = /^[\u1100-\u11ff\u3131-\u318e\ua960-\ua97f\ud7b0-\ud7ff]+$/u;

function compactMeaningful(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function isLikelyJunkCommunityText(value: string) {
  const compact = compactMeaningful(value);
  if (!compact) return true;
  if (JAMO_ONLY.test(compact)) return true;
  const meaningful = compact.match(/[\p{L}\p{N}]/gu) ?? [];
  if (meaningful.length < 2) return true;
  const unique = new Set(meaningful.map((char) => char.toLocaleLowerCase())).size;
  return meaningful.length >= 4 && unique <= 2;
}

export function isPublishableCommunityPost(title: string, body: string) {
  return (
    title.trim().length >= 2 &&
    body.trim().length >= 10 &&
    !isLikelyJunkCommunityText(title) &&
    !isLikelyJunkCommunityText(body)
  );
}

export function publicCommunityAuthorName(value: string | null | undefined) {
  const name = value?.trim();
  if (!name || GENERATED_HANDLE.test(name)) return "로블잼 이용자";
  return name;
}
