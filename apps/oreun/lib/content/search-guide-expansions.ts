import revisions from "./editorial-revisions.json";
import type { GameGuide } from "./queries";
import { getCoreGuideExpansion } from "./core-guide-expansions";
import { isActionablePublicGuide } from "./public-guide";

// This layer may expand only the exact reviewed original encoded in
// editorial-revisions.json. An independently edited DB row never matches and
// therefore remains authoritative.
export function applyReviewedSearchExpansion(guide: GameGuide): GameGuide | null {
  if (guide.content_status !== "published" || guide.review_status !== "approved") return null;
  const change = revisions.find(
    (revision) =>
      revision.universeId === Number(guide.universe_id) &&
      revision.slug === guide.slug &&
      revision.expectedTitle === guide.title &&
      revision.expectedSummary === guide.summary &&
      revision.expectedBody === guide.body,
  );
  if (!change || change.withdraw) return null;

  const expansion = getCoreGuideExpansion(Number(guide.universe_id), guide.slug);
  if (!expansion) return null;

  const revised: GameGuide = {
    ...guide,
    ...expansion,
    content_status: "published",
    index_state: "noindex",
  };
  return isActionablePublicGuide(revised) ? revised : null;
}
