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


type IndexReadinessRow = {
  universe_id: number | string;
  canonical_slug: string;
  index_state: string;
  fetched_at: string | null;
  hourly_buckets_24h: number | string;
  avg_coverage_24h: number | string;
  current_data_recent: boolean;
  has_editorial_description: boolean;
  data_ready_for_index_review: boolean;
};

export async function getIndexReadiness() {
  const config = getSupabaseRestConfig();
  if (!config) return [];
  const db = new SupabaseRestClient(config);
  const rows = await db.select<IndexReadinessRow>("r1_game_index_readiness", {
    select:
      "universe_id,canonical_slug,index_state,fetched_at,hourly_buckets_24h,avg_coverage_24h,current_data_recent,has_editorial_description,data_ready_for_index_review",
    order: "data_ready_for_index_review.desc,avg_coverage_24h.desc,canonical_slug.asc",
  });
  return rows.map((row) => ({
    universeId: Number(row.universe_id),
    slug: row.canonical_slug,
    indexState: row.index_state,
    fetchedAt: row.fetched_at,
    hourlyBuckets24h: Number(row.hourly_buckets_24h),
    avgCoverage24h: Number(row.avg_coverage_24h),
    currentDataRecent: row.current_data_recent,
    hasEditorialDescription: row.has_editorial_description,
    dataReadyForIndexReview: row.data_ready_for_index_review,
  }));
}
