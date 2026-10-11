import type { FreshnessState } from "./types";
export function getFreshnessState(fetchedAt: string | null, now = new Date(), targetMinutes = 5): FreshnessState {
  if (!fetchedAt) return "unavailable";
  const age=(now.getTime()-new Date(fetchedAt).getTime())/60000;
  if (age <= Math.max(10,targetMinutes*2)) return "fresh";
  if (age <= Math.max(20,targetMinutes*4)) return "delayed";
  return "stale";
}
