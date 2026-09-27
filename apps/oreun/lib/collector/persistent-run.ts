import { randomUUID } from "node:crypto";
import { cadenceMinutes, collectorTier, failureRetrySeconds } from "./adaptive";
import type { GameProvider } from "../providers/roblox-public";
import { ProviderRateLimitError } from "../providers/roblox-public";
import type {
  CollectorObservation,
  IngestionRunFinish,
  PersistentCollectorStore,
} from "./persistent-types";

export interface PersistentCollectorResult extends Omit<IngestionRunFinish, "status"> {
  status: IngestionRunFinish["status"] | "idle";
  ingestionRunId: string | null;
  rollupError: string | null;
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return Math.round(sorted[index]);
}

export async function runPersistentCollector({
  provider,
  store,
  limit = 100,
  leaseSeconds = 180,
  now = new Date(),
  leaseToken = randomUUID(),
}: {
  provider: GameProvider;
  store: PersistentCollectorStore;
  limit?: number;
  leaseSeconds?: number;
  now?: Date;
  leaseToken?: string;
}): Promise<PersistentCollectorResult> {
  if (!store.isConfigured()) throw new Error("R1 persistent collector is not configured");

  const targets = await store.claimDueGames(limit, leaseToken, leaseSeconds);
  if (!targets.length) {
    return {
      status: "idle",
      ingestionRunId: null,
      requested: 0,
      success: 0,
      failed: 0,
      rateLimited: 0,
      retryAfterSeconds: null,
      latencyP50Ms: null,
      latencyP95Ms: null,
      errors: [],
      rollupError: null,
    };
  }

  const ingestionRunId = await store.startIngestionRun(targets.length);
  const targetById = new Map(targets.map((target) => [target.universeId, target]));
  const latencies: number[] = [];
  const errors: string[] = [];
  let success = 0;
  let failed = 0;
  let rateLimited = 0;
  let retryAfterSeconds: number | null = null;

  for (let offset = 0; offset < targets.length; offset += 20) {
    const batch = targets.slice(offset, offset + 20);
    const ids = batch.map((target) => target.universeId);
    const started = Date.now();

    try {
      const games = await provider.getGames(ids);
      latencies.push(Date.now() - started);
      const requestedSet = new Set(ids);
      const requestedGames = games.filter((game) => requestedSet.has(game.universeId));
      const unexpected = games.filter((game) => !requestedSet.has(game.universeId));
      if (unexpected.length) {
        errors.push(`provider returned unrequested ids: ${unexpected.map((game) => game.universeId).join(",")}`);
      }
      const found = new Set(requestedGames.map((game) => game.universeId));
      const observations: CollectorObservation[] = requestedGames.map((game) => {
        const target = targetById.get(game.universeId);
        const tier = collectorTier(game.playing, 0);
        return {
          game,
          cadenceMinutes: cadenceMinutes(tier),
          ...(target ? {} : {}),
        };
      });

      const saved = await store.persistObservations(
        ingestionRunId,
        leaseToken,
        observations,
      );
      success += saved;
      const rejected = Math.max(0, observations.length - saved);
      if (rejected) {
        failed += rejected;
        errors.push(`persistence rejected ${rejected} observation(s)`);
      }

      const missing = ids.filter((id) => !found.has(id));
      for (const id of missing) {
        const retryStarted = Date.now();
        const target = targetById.get(id);
        try {
          const retryGames = await provider.getGames([id]);
          latencies.push(Date.now() - retryStarted);
          const retryGame = retryGames.find((game) => game.universeId === id);

          if (!retryGame) {
            failed += 1;
            errors.push(`missing id after single retry: ${id}`);
            await store.markTargetsFailed(
              leaseToken,
              [id],
              "provider response omitted requested universe after single retry",
              failureRetrySeconds((target?.failureCount ?? 0) + 1, null),
            );
            continue;
          }

          const tier = collectorTier(retryGame.playing, 0);
          const retrySaved = await store.persistObservations(
            ingestionRunId,
            leaseToken,
            [
              {
                game: retryGame,
                cadenceMinutes: cadenceMinutes(tier),
              },
            ],
          );

          if (retrySaved === 1) {
            success += 1;
          } else {
            failed += 1;
            errors.push(`persistence rejected single retry observation: ${id}`);
            await store.markTargetsFailed(
              leaseToken,
              [id],
              "persistence rejected single retry observation",
              failureRetrySeconds((target?.failureCount ?? 0) + 1, null),
            );
          }
        } catch (retryError) {
          latencies.push(Date.now() - retryStarted);
          failed += 1;

          if (retryError instanceof ProviderRateLimitError) {
            rateLimited += 1;
            retryAfterSeconds =
              retryAfterSeconds == null
                ? retryError.retryAfterSeconds
                : Math.max(
                    retryAfterSeconds,
                    retryError.retryAfterSeconds ?? 0,
                  );
            errors.push(
              `single retry 429 id=${id} retry-after=${retryError.retryAfterSeconds ?? "unknown"}`,
            );
            await store.markTargetsFailed(
              leaseToken,
              [id],
              "Roblox provider rate limited during single retry",
              retryError.retryAfterSeconds,
            );
          } else {
            const message =
              retryError instanceof Error
                ? retryError.message
                : "unknown provider error";
            errors.push(`single retry id=${id}: ${message}`);
            await store.markTargetsFailed(
              leaseToken,
              [id],
              message,
              failureRetrySeconds((target?.failureCount ?? 0) + 1, null),
            );
          }
        }
      }
    } catch (error) {
      latencies.push(Date.now() - started);
      failed += ids.length;

      if (error instanceof ProviderRateLimitError) {
        rateLimited += ids.length;
        retryAfterSeconds =
          retryAfterSeconds == null
            ? error.retryAfterSeconds
            : Math.max(retryAfterSeconds, error.retryAfterSeconds ?? 0);
        errors.push(`429 retry-after=${error.retryAfterSeconds ?? "unknown"}`);
        await store.markTargetsFailed(
          leaseToken,
          ids,
          "Roblox provider rate limited",
          error.retryAfterSeconds,
        );
      } else {
        const message = error instanceof Error ? error.message : "unknown provider error";
        errors.push(message);
        const worstFailureCount = Math.max(
          0,
          ...batch.map((target) => target.failureCount),
        );
        await store.markTargetsFailed(
          leaseToken,
          ids,
          message,
          failureRetrySeconds(worstFailureCount + 1, null),
        );
      }
    }
  }

  const status: IngestionRunFinish["status"] =
    failed === 0 && success === targets.length
      ? "success"
      : success > 0
        ? "partial"
        : rateLimited > 0
          ? "rate_limited"
          : "failed";

  const finish: IngestionRunFinish = {
    status,
    requested: targets.length,
    success,
    failed,
    rateLimited,
    retryAfterSeconds,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    errors,
  };
  await store.finishIngestionRun(ingestionRunId, finish);

  let rollupError: string | null = null;
  if (success > 0) {
    try {
      const from = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      await store.refreshRollups(from.toISOString(), now.toISOString());
    } catch (error) {
      rollupError = error instanceof Error ? error.message : "rollup refresh failed";
    }
  }

  return { ...finish, ingestionRunId, rollupError };
}
