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

export type CommunityAnalyticsRunResult = {
  status: "disabled" | "not_configured" | "idle" | "success" | "partial" | "failed";
  requested: number;
  success: number;
  failure: number;
  errors: Array<{ universeId: number; message: string }>;
};

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
          forum_category_count: aggregate.forumCategoryCount,
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
    return { configured: false, rows: [] as Array<Record<string, unknown>> };
  }
  const db = new SupabaseRestClient(database);
  const rows = await db.select<Record<string, unknown>>(
    "r1_community_analytics_readiness",
    {
      select: "*",
      order: "enabled.desc,authorization_state.asc,canonical_slug.asc",
    },
  );
  return { configured: true, rows };
}
