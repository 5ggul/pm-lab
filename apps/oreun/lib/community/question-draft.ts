import { uuidPattern } from "./experience-model";
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export const DRAFT_PREFIX = "oreun:question-draft:v1:";
export type QuestionDraft = { version: 1; userId: string; gameSlug: string; requestId: string; title: string; body: string; savedAt: number };
export function draftKey(userId: string, gameSlug: string) { return DRAFT_PREFIX + userId + ":" + gameSlug; }
export function parseDraft(raw: string | null, userId: string, gameSlug: string, now = Date.now()): QuestionDraft | null {
  if (!raw || raw.length > 24000) return null;
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || data.userId !== userId || data.gameSlug !== gameSlug || !uuidPattern.test(data.requestId ?? "")) return null;
    if (typeof data.title !== "string" || data.title.length > 120 || typeof data.body !== "string" || data.body.length > 5000) return null;
    if (typeof data.savedAt !== "number" || !Number.isFinite(data.savedAt) || data.savedAt > now + 60_000 || now - data.savedAt >= DRAFT_TTL_MS) return null;
    return { version: 1, userId, gameSlug, requestId: data.requestId, title: data.title, body: data.body, savedAt: data.savedAt };
  } catch { return null; }
}
// Storage may be disabled or full. Editing and submission must still work.
export function loadDraft(storage: Pick<Storage, "getItem" | "removeItem">, userId: string, slug: string, now = Date.now()) {
  const key = draftKey(userId, slug);
  const raw = storage.getItem(key);
  const draft = parseDraft(raw, userId, slug, now);
  if (raw && !draft) storage.removeItem(key);
  return draft;
}
export function persistDraft(storage: Pick<Storage, "setItem" | "removeItem">, draft: QuestionDraft) {
  const key = draftKey(draft.userId, draft.gameSlug);
  if (!draft.title && !draft.body) storage.removeItem(key);
  else storage.setItem(key, JSON.stringify(draft));
}
