import type { GameGuide } from "./queries";
export type GuideState = { universe_id: number | string; slug: string; state: "missing" | "published" | "withheld" };
export const guideKey = (g: { universe_id: number | string; slug: string }) => `${g.universe_id}|${g.slug}`;
export const publishable = (g: Pick<GameGuide, "content_status" | "review_status">) => g.content_status === "published" && g.review_status === "approved";
export function mergePublicGuides(db: GameGuide[], fallback: GameGuide[], states: GuideState[]): GameGuide[] {
  const map = new Map(states.map(s => [guideKey(s),s.state]));
  if (map.size !== states.length || states.some(s => !["missing","published","withheld"].includes(s.state)) || fallback.some(g => !map.has(guideKey(g)))) throw new Error("Guide publication state unavailable");
  const rows = new Map<string,GameGuide>();
  for (const g of db) {
    if (publishable(g) && map.get(guideKey(g)) !== "withheld") rows.set(guideKey(g),g);
  }
  for (const g of fallback) {
    // Missing DB row is different from a known row absent from the public view.
    if (!rows.has(guideKey(g)) && map.get(guideKey(g)) === "missing" && publishable(g)) rows.set(guideKey(g),g);
  }
  return [...rows.values()].sort((a,b) => new Date(b.published_at ?? 0).getTime()-new Date(a.published_at ?? 0).getTime() || guideKey(a).localeCompare(guideKey(b)));
}
