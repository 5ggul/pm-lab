import type { ProviderGame } from "../types";

export interface ClaimedCollectorTarget {
  universeId: number;
  failureCount: number;
  cadenceMinutes: number;
}

export interface CollectorObservation {
  game: ProviderGame;
  cadenceMinutes: number;
}

export interface IngestionRunFinish {
  status: "success" | "partial" | "failed" | "rate_limited";
  requested: number;
  success: number;
  failed: number;
  rateLimited: number;
  retryAfterSeconds: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  errors: string[];
}

export interface PersistentCollectorStore {
  isConfigured(): boolean;
  claimDueGames(limit: number, leaseToken: string, leaseSeconds: number): Promise<ClaimedCollectorTarget[]>;
  startIngestionRun(requested: number): Promise<string>;
  persistObservations(
    ingestionRunId: string,
    leaseToken: string,
    observations: CollectorObservation[],
  ): Promise<number>;
  markTargetsFailed(
    leaseToken: string,
    universeIds: number[],
    error: string,
    retryAfterSeconds: number | null,
  ): Promise<void>;
  finishIngestionRun(id: string, result: IngestionRunFinish): Promise<void>;
  refreshRollups(fromIso: string, toIso: string): Promise<void>;
}
