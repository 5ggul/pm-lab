import test from "node:test";
import assert from "node:assert/strict";
import { runPersistentCollector } from "../lib/collector/persistent-run";
import type {
  ClaimedCollectorTarget,
  CollectorObservation,
  IngestionRunFinish,
  PersistentCollectorStore,
} from "../lib/collector/persistent-types";
import {
  ProviderRateLimitError,
  type GameProvider,
} from "../lib/providers/roblox-public";
import type { ProviderGame } from "../lib/types";

const providerGame = (id: number, playing: number): ProviderGame => ({
  universeId: id,
  rootPlaceId: id + 1000,
  name: `Game ${id}`,
  description: "",
  creatorName: "creator",
  playing,
  visits: 1000,
  favorites: 10,
  sourceUpdatedAt: "2026-09-19T00:00:00Z",
  fetchedAt: "2026-09-19T01:00:00Z",
  sourceProvider: "roblox_public_games",
  sourceEndpoint: "https://games.roblox.com/v1/games",
  sourceClass: "ROBLOX_PUBLIC_API",
  sourceStatus: "live",
});

class FakeStore implements PersistentCollectorStore {
  configured = true;
  targets: ClaimedCollectorTarget[] = [];
  observations: CollectorObservation[] = [];
  failures: Array<{ ids: number[]; retryAfterSeconds: number | null }> = [];
  finished: IngestionRunFinish | null = null;
  rollups = 0;

  isConfigured() { return this.configured; }
  async claimDueGames() { return this.targets; }
  async startIngestionRun() { return "run-1"; }
  async persistObservations(_run: string, _lease: string, rows: CollectorObservation[]) {
    this.observations.push(...rows);
  }
  async markTargetsFailed(_lease: string, ids: number[], _error: string, retryAfterSeconds: number | null) {
    this.failures.push({ ids, retryAfterSeconds });
  }
  async finishIngestionRun(_id: string, result: IngestionRunFinish) {
    this.finished = result;
  }
  async refreshRollups() { this.rollups += 1; }
}

test("persistent collector adapts cadence from fresh CCU and refreshes rollups", async () => {
  const store = new FakeStore();
  store.targets = [
    { universeId: 1, failureCount: 0, cadenceMinutes: 120 },
    { universeId: 2, failureCount: 0, cadenceMinutes: 120 },
  ];
  const provider: GameProvider = {
    async getGames() {
      return [providerGame(1, 150000), providerGame(2, 500)];
    },
  };

  const result = await runPersistentCollector({
    provider,
    store,
    leaseToken: "00000000-0000-0000-0000-000000000001",
  });

  assert.equal(result.status, "success");
  assert.equal(store.observations.length, 2);
  assert.equal(store.observations.find((x) => x.game.universeId === 1)?.cadenceMinutes, 5);
  assert.equal(store.observations.find((x) => x.game.universeId === 2)?.cadenceMinutes, 120);
  assert.equal(store.rollups, 1);
  assert.equal(store.finished?.success, 2);
});

test("persistent collector preserves partial success when provider omits an id", async () => {
  const store = new FakeStore();
  store.targets = [
    { universeId: 1, failureCount: 0, cadenceMinutes: 30 },
    { universeId: 2, failureCount: 0, cadenceMinutes: 30 },
  ];
  const provider: GameProvider = {
    async getGames() {
      return [providerGame(1, 10000)];
    },
  };

  const result = await runPersistentCollector({
    provider,
    store,
    leaseToken: "00000000-0000-0000-0000-000000000002",
  });

  assert.equal(result.status, "partial");
  assert.equal(result.success, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(store.failures[0]?.ids, [2]);
  assert.equal(store.rollups, 1);
});

test("persistent collector honors provider retry-after on 429", async () => {
  const store = new FakeStore();
  store.targets = [{ universeId: 1, failureCount: 2, cadenceMinutes: 30 }];
  const provider: GameProvider = {
    async getGames() {
      throw new ProviderRateLimitError(95);
    },
  };

  const result = await runPersistentCollector({
    provider,
    store,
    leaseToken: "00000000-0000-0000-0000-000000000003",
  });

  assert.equal(result.status, "rate_limited");
  assert.equal(result.rateLimited, 1);
  assert.equal(result.retryAfterSeconds, 95);
  assert.equal(store.failures[0]?.retryAfterSeconds, 95);
  assert.equal(store.rollups, 0);
});

test("persistent collector returns idle without creating fake work", async () => {
  const store = new FakeStore();
  const provider: GameProvider = { async getGames() { return []; } };
  const result = await runPersistentCollector({
    provider,
    store,
    leaseToken: "00000000-0000-0000-0000-000000000004",
  });
  assert.equal(result.status, "idle");
  assert.equal(result.ingestionRunId, null);
});
