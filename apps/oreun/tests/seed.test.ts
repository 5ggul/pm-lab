import test from "node:test";
import assert from "node:assert/strict";
import { GAME_IDENTITIES } from "../lib/seed";

test("verified launch catalog has at least 24 unique games", () => {
  assert.ok(GAME_IDENTITIES.length >= 24);
  assert.equal(
    new Set(GAME_IDENTITIES.map((game) => game.universeId)).size,
    GAME_IDENTITIES.length,
    "duplicate universe_id",
  );
  assert.equal(
    new Set(GAME_IDENTITIES.map((game) => game.rootPlaceId)).size,
    GAME_IDENTITIES.length,
    "duplicate root_place_id",
  );
  assert.equal(
    new Set(GAME_IDENTITIES.map((game) => game.slug)).size,
    GAME_IDENTITIES.length,
    "duplicate slug",
  );
});

test("each launch game has searchable aliases and English-safe canonical slug", () => {
  for (const game of GAME_IDENTITIES) {
    assert.ok(game.aliases.length >= 3, game.slug);
    assert.match(game.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(game.descriptionKo.trim().length >= 20, game.slug);
  }
});
