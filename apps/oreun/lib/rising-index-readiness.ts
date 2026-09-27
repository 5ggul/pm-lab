import { cache } from "react";
import { getGameCatalog } from "./catalog";
import { getPersistentHistories } from "./repository/supabase-public";
import { computeTrend } from "./trend";
import { recentRiseSignal } from "./recent-rise";
import { isPublicRisingCandidate } from "./rising-quality";

export const getRisingIndexReadiness = cache(async () => {
  const games = await getGameCatalog();
  const histories = await getPersistentHistories(
    games.map((game) => game.universeId),
    168,
  ).catch(() => null);

  if (!histories) {
    return { ready: false, qualified: 0, observed: 0 };
  }

  const now = new Date();
  let observed = 0;
  let qualified = 0;

  for (const game of games) {
    const history = histories.get(game.universeId) ?? [];
    if (!history.length) continue;
    observed += 1;
    const trend = computeTrend(
      game.universeId,
      history,
      game.sourceUpdatedAt,
      now,
      60,
    );
    const rise = recentRiseSignal(history, 60);
    if (isPublicRisingCandidate(game, trend, rise)) qualified += 1;
  }

  return {
    ready: observed >= 20 && qualified >= 5,
    qualified,
    observed,
  };
});
