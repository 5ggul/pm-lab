import {
  getSupabaseRestConfig,
  SupabaseRestClient,
} from "../db/supabase-rest";

type RunRow = {
  id: string;
  status: "running" | "success" | "partial" | "failed" | "rate_limited";
  requested_count: number;
  success_count: number;
  failure_count: number;
  rate_limit_count: number;
  started_at: string;
  finished_at: string | null;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  error_summary: unknown;
};

type TargetRow = {
  universe_id: number | string;
  tier: string;
  cadence_minutes: number;
  next_due_at: string;
  failure_count: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
};

export interface CollectorOpsSummary {
  configured: boolean;
  latestRun: RunRow | null;
  recentRuns: RunRow[];
  failingTargets: Array<{
    universeId: number;
    tier: string;
    cadenceMinutes: number;
    failureCount: number;
    nextDueAt: string;
    lastError: string | null;
  }>;
}

export async function getCollectorOpsSummary(): Promise<CollectorOpsSummary> {
  const config = getSupabaseRestConfig();
  if (!config) {
    return {
      configured: false,
      latestRun: null,
      recentRuns: [],
      failingTargets: [],
    };
  }

  const db = new SupabaseRestClient(config);
  const [runs, targets] = await Promise.all([
    db.select<RunRow>("ingestion_runs", {
      select:
        "id,status,requested_count,success_count,failure_count,rate_limit_count,started_at,finished_at,latency_p50_ms,latency_p95_ms,error_summary",
      order: "started_at.desc",
      limit: 5,
    }),
    db.select<TargetRow>("collector_targets", {
      select:
        "universe_id,tier,cadence_minutes,next_due_at,failure_count,last_success_at,last_failure_at,last_error",
      failure_count: "gt.0",
      order: "failure_count.desc,next_due_at.asc",
      limit: 10,
    }),
  ]);

  return {
    configured: true,
    latestRun: runs[0] ?? null,
    recentRuns: runs,
    failingTargets: targets.map((target) => ({
      universeId: Number(target.universe_id),
      tier: target.tier,
      cadenceMinutes: Number(target.cadence_minutes),
      failureCount: Number(target.failure_count),
      nextDueAt: target.next_due_at,
      lastError: target.last_error,
    })),
  };
}
