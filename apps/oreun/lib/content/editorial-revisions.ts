import revisions from "./editorial-revisions.json";
import type { GameGuide } from "./queries";
import { isActionablePublicGuide } from "./public-guide";
import { getCoreGuideExpansion } from "./core-guide-expansions";

// Explicit reviewed copy edits for a known original, NOT a text filter. An
// independently edited DB article never gets silently rewritten. DB moderation
// and publication always take precedence. No review/publish timestamps changed.
export function applyKnownEditorialRevision(guide: GameGuide): GameGuide {
  if (guide.content_status !== "published" || guide.review_status !== "approved") return guide;
  const change = revisions.find(r => r.universeId === Number(guide.universe_id) && r.slug === guide.slug
    && r.expectedTitle === guide.title && r.expectedSummary === guide.summary && r.expectedBody === guide.body);
  let revised = change ? { ...guide, body: change.body, summary: change.summary,
    ...(change.withdraw ? { content_status: "archived" as const, index_state: "noindex" as const } : {}) } : guide;
  if (change && Number(guide.universe_id) === 1176784616 && guide.slug === "defense-basics") {
    const tds = getCoreGuideExpansion(1176784616, "defense-basics");
    if (tds) revised = { ...revised, body: tds.body, summary: tds.summary, content_status: "published", index_state: "noindex" };
  }
  if (revised.content_status === "published" && !isActionablePublicGuide(revised)) {
    return { ...revised, content_status: "archived" as const, index_state: "noindex" as const };
  }
  return revised;
}
