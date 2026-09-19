import type { ProviderGame } from "../types";
import { getFreshnessState } from "../freshness";
import { SupabaseRestClient, getSupabaseRestConfig } from "../db/supabase-rest";
import type {
  ClaimedCollectorTarget,
  CollectorObservation,
  IngestionRunFinish,
  PersistentCollectorStore,
} from "./persistent-types";

type SourceRow = { id: number };
type RunRow = { id: string };
type ClaimRow = {
  universe_id: number | string;
  failure_count: number;
  cadence_minutes: number;
};

export class SupabaseCollectorStore implements PersistentCollectorStore {
  private readonly client: SupabaseRestClient | null;
  private sourceId: number | null = null;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const config = getSupabaseRestConfig(env);
    this.client = config ? new SupabaseRestClient(config) : null;
  }

  isConfigured() {
    return this.client !== null;
  }

  private db() {
    if (!this.client) throw new Error("R1 Supabase collector is not configured");
    return this.client;
  }

  private async getSourceId() {
    if (this.sourceId != null) return this.sourceId;
    const rows = await this.db().select<SourceRow>("data_sources", {
      select: "id",
      provider: "eq.roblox_public_games",
      endpoint: "eq.https://games.roblox.com/v1/games",
      limit: 1,
    });
    if (!rows[0]) throw new Error("roblox_public_games data source is not seeded");
    this.sourceId = Number(rows[0].id);
    return this.sourceId;
  }

  async claimDueGames(limit: number, leaseToken: string, leaseSeconds: number) {
    const rows = await this.db().rpc<ClaimRow[]>("r1_claim_due_games", {
      p_limit: limit,
      p_lease_token: leaseToken,
      p_lease_seconds: leaseSeconds,
    });
    return rows.map((row) => ({
      universeId: Number(row.universe_id),
      failureCount: Number(row.failure_count),
      cadenceMinutes: Number(row.cadence_minutes),
    }));
  }

  async startIngestionRun(requested: number) {
    const dataSourceId = await this.getSourceId();
    const rows = await this.db().insert<RunRow>("ingestion_runs", {
      data_source_id: dataSourceId,
      started_at: new Date().toISOString(),
      status: "running",
      requested_count: requested,
    });
    if (!rows[0]?.id) throw new Error("failed to create ingestion_run");
    return rows[0].id;
  }

  async persistObservations(
    ingestionRunId: string,
    leaseToken: string,
    observations: CollectorObservation[],
  ) {
    if (!observations.length) return 0;
    const dataSourceId = await this.getSourceId();
    const saved = await this.db().rpc<number>("r1_persist_game_observations", {
      p_ingestion_run_id: ingestionRunId,
      p_data_source_id: dataSourceId,
      p_lease_token: leaseToken,
      p_observations: observations.map(({ game, cadenceMinutes }) => ({
        universe_id: game.universeId,
        root_place_id: game.rootPlaceId,
        name: game.name,
        description: game.description,
        creator_name: game.creatorName,
        playing: game.playing,
        visits: game.visits,
        favorites: game.favorites,
        source_updated_at: game.sourceUpdatedAt,
        fetched_at: game.fetchedAt,
        freshness_state: getFreshnessState(game.fetchedAt),
        cadence_minutes: cadenceMinutes,
      })),
    });
    return Number(saved) || 0;
  }

  async markTargetsFailed(
    leaseToken: string,
    universeIds: number[],
    error: string,
    retryAfterSeconds: number | null,
  ) {
    if (!universeIds.length) return;
    await this.db().rpc("r1_mark_targets_failed", {
      p_universe_ids: universeIds,
      p_lease_token: leaseToken,
      p_error: error.slice(0, 500),
      p_retry_after_seconds: retryAfterSeconds,
    });
  }

  async finishIngestionRun(id: string, result: IngestionRunFinish) {
    await this.db().patch(
      "ingestion_runs",
      {
        finished_at: new Date().toISOString(),
        status: result.status,
        requested_count: result.requested,
        success_count: result.success,
        failure_count: result.failed,
        rate_limit_count: result.rateLimited,
        retry_after_seconds: result.retryAfterSeconds,
        latency_p50_ms: result.latencyP50Ms,
        latency_p95_ms: result.latencyP95Ms,
        error_summary: result.errors.slice(0, 100),
      },
      { id: `eq.${id}` },
    );
  }

  async refreshRollups(fromIso: string, toIso: string) {
    await this.db().rpc("r1_refresh_rollups", {
      p_from: fromIso,
      p_to: toIso,
    });
  }
}
