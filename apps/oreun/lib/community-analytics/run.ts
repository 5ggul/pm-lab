import {
  getSupabaseRestConfig,
  SupabaseRestClient,
} from "@/lib/db/supabase-rest";
import {
  getCommunityAnalyticsConfig,
  OpenCloudCommunityClient,
  CommunityAnalyticsAuthorizationError,
} from "./open-cloud";

type TargetRow = {
  universe_id: number | string;
  group_id: number | string;
  authorization_state: string;
  enabled: boolean;
  last_verified_at: string | null;
};

type RunRow = { id: string };
type GameIdentityRow = { universe_id: number | string };
type ExistingTargetRow = { enabled: boolean };

type ReadinessRow = {
  universe_id: number | string;
  canonical_slug: string;
  name_ko: string;
  group_id: number | string | null;
  authorization_state: string | null;
  enabled: boolean | null;
  last_verified_at: string | null;
  last_collected_at: string | null;
  last_error: string | null;
  ready_for_server_collection: boolean | null;
  latest_snapshot_at: string | null;
};

export type CommunityAnalyticsReadinessRow = {
  universeId: number;
  slug: string;
  nameKo: string;
  groupId: number | null;
  authorizationState: string | null;
  enabled: boolean;
  lastVerifiedAt: string | null;
  lastCollectedAt: string | null;
  lastError: string | null;
  readyForServerCollection: boolean;
  latestSnapshotAt: string | null;
};

export type CommunityAnalyticsRunResult = {
  status:
    | "disabled"
    | "not_configured"
    | "idle"
    | "success"
    | "partial"
    | "failed";
  requested: number;
  success: number;
  failure: number;
  errors: Array<{ universeId: number; message: string }>;
};

function positiveId(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
}

export async function verifyCommunityAnalyticsTarget(
  input: { universeId: number; groupId: number; enable?: boolean },
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  positiveId(input.universeId, "universeId");
  positiveId(input.groupId, "groupId");

  const database = getSupabaseRestConfig(env);
  if (!database) {
    throw new Error("R1 Supabase persistence is not configured.");
  }

  const db = new SupabaseRestClient(database);
  const games = await db.select<GameIdentityRow>("games", {
    select: "universe_id",
    universe_id: `eq.${input.universeId}`,
    limit: 1,
  });
  if (!games.length) {
    throw new Error("universeId is not present in the verified R1 Game catalog.");
  }

  const existing = await db.select<ExistingTargetRow>("roblox_community_targets", {
    select: "enabled",
    universe_id: `eq.${input.universeId}`,
    limit: 1,
  });

  const client = new OpenCloudCommunityClient(
    getCommunityAnalyticsConfig(env),
    fetchImpl,
  );
  const verification = await client.verifyGroupForumRead(input.groupId);
  const enabled = input.enable ?? existing[0]?.enabled ?? false;

  await db.upsert(
    "roblox_community_targets",
    {
      universe_id: input.universeId,
      group_id: input.groupId,
      authorization_state: "authorized",
      enabled,
      last_verified_at: verification.checkedAt,
      last_error: null,
      updated_at: verification.checkedAt,
    },
    "universe_id",
    false,
  );

  return {
    universeId: input.universeId,
    groupId: input.groupId,
    enabled,
    observedCategories: verification.observedCategories,
    truncated: verification.truncated,
    verifiedAt: verification.checkedAt,
  };
}

export async function runCommunityAnalyticsOnce(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<CommunityAnalyticsRunResult> {
  const feature = getCommunityAnalyticsConfig(env);
  if (!feature.enabled) {
    return {
      status: "disabled",
      requested: 0,
      success: 0,
      failure: 0,
      errors: [],
    };
  }
  if (!feature.apiKey) {
    return {
      status: "not_configured",
      requested: 0,
      success: 0,
      failure: 0,
      errors: [],
    };
  }

  const database = getSupabaseRestConfig(env);
  if (!database) {
    return {
      status: "not_configured",
      requested: 0,
      success: 0,
      failure: 0,
      errors: [],
    };
  }

  const db = new SupabaseRestClient(database);
  const targets = await db.select<TargetRow>("roblox_community_targets", {
    select:
      "universe_id,group_id,authorization_state,enabled,last_verified_at",
    enabled: "eq.true",
    authorization_state: "eq.authorized",
    order: "universe_id.asc",
  });
  if (!targets.length) {
    return {
      status: "idle",
      requested: 0,
      success: 0,
      failure: 0,
      errors: [],
    };
  }

  const [run] = await db.insert<RunRow>(
    "roblox_community_runs",
    {
      status: "running",
      target_count: targets.length,
      success_count: 0,
      failure_count: 0,
      error_summary: [],
    },
    true,
  );
  if (!run?.id) throw new Error("community analytics run row was not created");

  const client = new OpenCloudCommunityClient(feature, fetchImpl);
  let success = 0;
  let failure = 0;
  const errors: Array<{ universeId: number; message: string }> = [];

  for (const target of targets) {
    const universeId = Number(target.universe_id);
    const groupId = Number(target.group_id);
    try {
      if (!target.last_verified_at) {
        throw new Error("target authorization has not been verified");
      }

      const aggregate = await client.scanGroupForumAggregate(groupId);
      await db.insert(
        "roblox_community_snapshots",
        {
          run_id: run.id,
          universe_id: universeId,
          group_id: groupId,
          captured_at: aggregate.capturedAt,
          observed_forum_category_count:
            aggregate.observedForumCategoryCount,
          observed_post_count: aggregate.observedPostCount,
          observed_comment_count: aggregate.observedCommentCount,
          categories_scanned: aggregate.categoriesScanned,
          posts_scanned: aggregate.postsScanned,
          truncated: aggregate.truncated,
          source_class: "OFFICIAL_OPEN_CLOUD",
          source_scope: "group-forum:read",
          calculation_version: "community_aggregate_v1",
        },
        false,
      );
      await db.patch(
        "roblox_community_targets",
        {
          last_collected_at: aggregate.capturedAt,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { universe_id: `eq.${universeId}` },
      );
      success += 1;
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "community analytics failed";
      errors.push({ universeId, message: message.slice(0, 500) });
      await db.patch(
        "roblox_community_targets",
        {
          ...(caught instanceof CommunityAnalyticsAuthorizationError
            ? {
                authorization_state: "revoked",
                enabled: false,
              }
            : {}),
          last_error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        },
        { universe_id: `eq.${universeId}` },
      );
      failure += 1;
    }
  }

  const status =
    failure === 0 ? "success" : success === 0 ? "failed" : "partial";

  await db.patch(
    "roblox_community_runs",
    {
      status,
      success_count: success,
      failure_count: failure,
      error_summary: errors,
      finished_at: new Date().toISOString(),
    },
    { id: `eq.${run.id}` },
  );

  return {
    status,
    requested: targets.length,
    success,
    failure,
    errors,
  };
}

export async function getCommunityAnalyticsReadiness(
  env: NodeJS.ProcessEnv = process.env,
) {
  const database = getSupabaseRestConfig(env);
  if (!database) {
    return { configured: false, rows: [] as CommunityAnalyticsReadinessRow[] };
  }
  const db = new SupabaseRestClient(database);
  const rows = await db.select<ReadinessRow>(
    "r1_community_analytics_readiness",
    {
      select: "*",
      order: "enabled.desc,authorization_state.asc,canonical_slug.asc",
    },
  );

  return {
    configured: true,
    rows: rows.map((row) => ({
      universeId: Number(row.universe_id),
      slug: row.canonical_slug,
      nameKo: row.name_ko,
      groupId: row.group_id == null ? null : Number(row.group_id),
      authorizationState: row.authorization_state,
      enabled: Boolean(row.enabled),
      lastVerifiedAt: row.last_verified_at,
      lastCollectedAt: row.last_collected_at,
      lastError: row.last_error,
      readyForServerCollection: Boolean(row.ready_for_server_collection),
      latestSnapshotAt: row.latest_snapshot_at,
    })),
  };
}
