import type { GameIdentity, GameView } from "./types";

export function normalizeQuery(input: string) {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-_·:!.'’()[\]{}]/g, "")
    .trim();
}

function trigramSet(value: string) {
  const padded = `  ${value}  `;
  const out = new Set<string>();
  for (let index = 0; index < padded.length - 2; index++) {
    out.add(padded.slice(index, index + 3));
  }
  return out;
}

export function trigramSimilarity(a: string, b: string) {
  if (!a || !b) return 0;
  const left = trigramSet(a);
  const right = trigramSet(b);
  let hit = 0;
  for (const token of left) if (right.has(token)) hit++;
  return (2 * hit) / (left.size + right.size);
}

export function rankGameSearch<
  T extends GameIdentity & Partial<Pick<GameView, "playing" | "name">>,
>(games: T[], raw: string) {
  const q = normalizeQuery(raw);
  if (!q) return [];

  const shortHangul = /^[가-힣]{1,3}$/.test(q);
  const fuzzyThreshold = shortHangul ? 0.55 : q.length <= 4 ? 0.4 : 0.25;

  return games
    .map((game) => {
      const names = [game.nameKo, (game as any).name ?? "", ...game.aliases];
      const norms = names.map(normalizeQuery).filter(Boolean);
      let tier = 9;
      let sim = 0;

      if (
        norms[0] === q ||
        normalizeQuery((game as any).name ?? "") === q
      ) {
        tier = 0;
      } else if (norms.some((value) => value === q)) {
        tier = 1;
      } else if (norms.some((value) => value.startsWith(q))) {
        tier = 2;
      } else {
        sim = Math.max(...norms.map((value) => trigramSimilarity(q, value)));
        tier = sim >= fuzzyThreshold ? 3 : 9;
      }

      return { game, tier, sim };
    })
    .filter((item) => item.tier < 9)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        b.sim - a.sim ||
        (b.game.playing ?? 0) - (a.game.playing ?? 0),
    )
    .map((item) => item.game);
}
