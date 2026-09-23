import revisions from "./editorial-revisions.json";
import type { GameGuide } from "./queries";

// Explicit reviewed copy edits for a known original, NOT a text filter. An
// independently edited DB article never gets silently rewritten. DB moderation
// and publication always take precedence. No review/publish timestamps changed.
export function applyKnownEditorialRevision(guide: GameGuide): GameGuide {
  if (guide.content_status !== "published" || guide.review_status !== "approved") return guide;
  const change = revisions.find(r => r.universeId === Number(guide.universe_id) && r.slug === guide.slug
    && r.expectedTitle === guide.title && r.expectedSummary === guide.summary && r.expectedBody === guide.body);
  if (!change) return guide;
  return { ...guide, body: change.body, summary: change.summary,
    ...(change.withdraw ? { content_status: "archived" as const, index_state: "noindex" as const } : {}) };
}
