import assert from "node:assert/strict";
import test from "node:test";
import { rankGameSearch } from "../lib/search";

const games = [
  { universeId: 1, rootPlaceId: 11, descriptionKo: "", indexState: "candidate" as const, slug: "blox-fruits", nameKo: "Blox Fruits", name: "Blox Fruits", aliases: ["블프", "블록스 프루츠"], playing: 1000 },
  { universeId: 2, rootPlaceId: 22, descriptionKo: "", indexState: "candidate" as const, slug: "blade-ball", nameKo: "Blade Ball", name: "Blade Ball", aliases: ["블볼"], playing: 2000 },
  { universeId: 3, rootPlaceId: 33, descriptionKo: "", indexState: "candidate" as const, slug: "rivals", nameKo: "라이벌즈", name: "RIVALS", aliases: ["라이벌"], playing: 3000 },
  { universeId: 4, rootPlaceId: 44, descriptionKo: "", indexState: "candidate" as const, slug: "natural-disaster", nameKo: "Natural Disaster Survival", name: "Natural Disaster Survival", aliases: ["자연재해 생존"], playing: 4000 },
];

test("exact Korean aliases outrank and exclude unrelated short fuzzy matches", () => {
  assert.deepEqual(rankGameSearch(games, "블프").map((game) => game.slug), ["blox-fruits"]);
  assert.equal(rankGameSearch(games, "라이벌")[0]?.slug, "rivals");
  assert.equal(rankGameSearch(games, "라이벌").some((game) => game.slug === "natural-disaster"), false);
});
