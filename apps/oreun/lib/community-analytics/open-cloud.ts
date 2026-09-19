export type CommunityAnalyticsConfig = {
  enabled: boolean;
  apiKey: string | null;
  baseUrl: string;
  maxCategories: number;
  maxPosts: number;
  maxTargets: number;
  minIntervalMinutes: number;
};

export class CommunityAnalyticsDisabledError extends Error {}
export class CommunityAnalyticsNotConfiguredError extends Error {}
export class CommunityAnalyticsAuthorizationError extends Error {}
export class CommunityAnalyticsTargetMismatchError extends Error {}

function boundedInteger(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function getCommunityAnalyticsConfig(
  env: NodeJS.ProcessEnv = process.env,
): CommunityAnalyticsConfig {
  return {
    enabled: env.R1_ROBLOX_COMMUNITY_ANALYTICS === "1",
    apiKey: env.ROBLOX_OPEN_CLOUD_API_KEY?.trim() || null,
    baseUrl: "https://apis.roblox.com",
    maxCategories: boundedInteger(env.R1_COMMUNITY_MAX_CATEGORIES, 5, 20),
    maxPosts: boundedInteger(env.R1_COMMUNITY_MAX_POSTS, 20, 100),
    maxTargets: boundedInteger(env.R1_COMMUNITY_MAX_TARGETS, 5, 25),
    minIntervalMinutes: Math.max(
      15,
      boundedInteger(env.R1_COMMUNITY_MIN_INTERVAL_MINUTES, 60, 1440),
    ),
  };
}

type UnknownRecord = Record<string, unknown>;

export type GroupForumAggregate = {
  groupId: number;
  capturedAt: string;
  observedForumCategoryCount: number;
  observedPostCount: number;
  observedCommentCount: number;
  categoriesScanned: number;
  postsScanned: number;
  truncated: boolean;
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function collection(payload: unknown, candidates: string[]) {
  const record = asRecord(payload);
  for (const key of candidates) {
    const value = record[key];
    if (Array.isArray(value)) return value.map(asRecord);
  }
  return [] as UnknownRecord[];
}

function nextToken(payload: unknown) {
  const record = asRecord(payload);
  const token =
    record.nextPageToken ??
    record.next_page_token ??
    record.nextCursor ??
    record.next_cursor;
  return typeof token === "string" && token.length ? token : null;
}

function resourceId(row: UnknownRecord, candidates: string[]) {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }

  for (const key of ["path", "name"]) {
    const value = row[key];
    if (typeof value === "string" && value.includes("/")) {
      const tail = value.split("/").filter(Boolean).at(-1);
      if (tail) return tail;
    }
  }
  return null;
}

export class OpenCloudCommunityClient {
  constructor(
    private readonly config = getCommunityAnalyticsConfig(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private assertReady() {
    if (!this.config.enabled) {
      throw new CommunityAnalyticsDisabledError(
        "Roblox community analytics feature flag is disabled.",
      );
    }
    if (!this.config.apiKey) {
      throw new CommunityAnalyticsNotConfiguredError(
        "ROBLOX_OPEN_CLOUD_API_KEY is not configured.",
      );
    }
  }

  private async get(path: string) {
    this.assertReady();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetchImpl(new URL(path, this.config.baseUrl), {
        headers: {
          accept: "application/json",
          "x-api-key": this.config.apiKey!,
          "user-agent": "Oreun-R1-CommunityAnalytics/0.2",
        },
        signal: controller.signal,
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403) {
        throw new CommunityAnalyticsAuthorizationError(
          `Roblox Open Cloud authorization failed: ${response.status}`,
        );
      }
      if (!response.ok) {
        throw new Error(
          `Roblox Open Cloud ${response.status}: ${(await response.text()).slice(0, 300)}`,
        );
      }
      return (await response.json()) as unknown;
    } finally {
      clearTimeout(timer);
    }
  }

  async verifyUniverseOwnedByGroup(universeId: number, groupId: number) {
    this.assertReady();
    if (!Number.isSafeInteger(universeId) || universeId <= 0) {
      throw new Error("universeId must be a positive safe integer.");
    }
    if (!Number.isSafeInteger(groupId) || groupId <= 0) {
      throw new Error("groupId must be a positive safe integer.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const url = new URL("/v1/games", "https://games.roblox.com");
      url.searchParams.set("universeIds", String(universeId));
      const response = await this.fetchImpl(url, {
        headers: {
          accept: "application/json",
          "user-agent": "Oreun-R1-CommunityAnalytics/0.2",
        },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new CommunityAnalyticsTargetMismatchError(
          `Roblox Game ownership verification failed: ${response.status}`,
        );
      }

      const payload = asRecord(await response.json());
      const games = Array.isArray(payload.data)
        ? payload.data.map(asRecord)
        : [];
      const game = games.find((row) => Number(row.id) === universeId);
      if (!game) {
        throw new CommunityAnalyticsTargetMismatchError(
          "Universe ownership could not be verified from Roblox Public Games API.",
        );
      }

      const creator = asRecord(game.creator);
      const creatorType =
        typeof creator.type === "string" ? creator.type.toLowerCase() : "";
      const creatorId = Number(creator.id);
      if (creatorType !== "group" || creatorId !== groupId) {
        throw new CommunityAnalyticsTargetMismatchError(
          "Group target does not match the Roblox Game creator group.",
        );
      }

      return {
        verified: true,
        creatorName:
          typeof creator.name === "string" ? creator.name : null,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async verifyGroupForumRead(groupId: number) {
    this.assertReady();
    if (!Number.isSafeInteger(groupId) || groupId <= 0) {
      throw new Error("groupId must be a positive safe integer.");
    }
    const payload = await this.get(
      `/cloud/v2/groups/${groupId}/forum-categories`,
    );
    const categories = collection(payload, [
      "groupForumCategories",
      "forumCategories",
      "forum_categories",
      "categories",
      "data",
    ]);
    return {
      authorized: true,
      observedCategories: categories.length,
      truncated: Boolean(nextToken(payload)),
      checkedAt: new Date().toISOString(),
    };
  }

  async scanGroupForumAggregate(
    groupId: number,
    limits: { maxCategories?: number; maxPosts?: number } = {},
  ): Promise<GroupForumAggregate> {
    this.assertReady();
    if (!Number.isSafeInteger(groupId) || groupId <= 0) {
      throw new Error("groupId must be a positive safe integer.");
    }

    const maxCategories = Math.min(
      Math.max(1, limits.maxCategories ?? this.config.maxCategories),
      20,
    );
    const maxPosts = Math.min(
      Math.max(1, limits.maxPosts ?? this.config.maxPosts),
      100,
    );

    const categoriesPayload = await this.get(
      `/cloud/v2/groups/${groupId}/forum-categories`,
    );
    const categories = collection(categoriesPayload, [
      "groupForumCategories",
      "forumCategories",
      "forum_categories",
      "categories",
      "data",
    ]);

    const selectedCategories = categories.slice(0, maxCategories);
    let observedPostCount = 0;
    let observedCommentCount = 0;
    let postsScanned = 0;
    let truncated =
      Boolean(nextToken(categoriesPayload)) ||
      categories.length > selectedCategories.length;

    for (const category of selectedCategories) {
      const categoryId = resourceId(category, [
        "id",
        "forumCategoryId",
        "forum_category_id",
        "categoryId",
      ]);
      if (!categoryId) {
        truncated = true;
        continue;
      }

      const postsPayload = await this.get(
        `/cloud/v2/groups/${groupId}/forum-categories/${encodeURIComponent(categoryId)}/posts`,
      );
      const posts = collection(postsPayload, [
        "groupForumPosts",
        "forumPosts",
        "forum_posts",
        "posts",
        "data",
      ]);
      observedPostCount += posts.length;
      if (nextToken(postsPayload)) truncated = true;

      const remaining = Math.max(0, maxPosts - postsScanned);
      const selectedPosts = posts.slice(0, remaining);
      if (posts.length > selectedPosts.length) truncated = true;

      for (const post of selectedPosts) {
        const postId = resourceId(post, [
          "id",
          "postId",
          "forumPostId",
          "forum_post_id",
        ]);
        if (!postId) {
          truncated = true;
          continue;
        }

        const commentsPayload = await this.get(
          `/cloud/v2/groups/${groupId}/forum-categories/${encodeURIComponent(categoryId)}/posts/${encodeURIComponent(postId)}/comments`,
        );
        const comments = collection(commentsPayload, [
          "groupForumComments",
          "forumComments",
          "forum_comments",
          "comments",
          "data",
        ]);
        observedCommentCount += comments.length;
        if (nextToken(commentsPayload)) truncated = true;
        postsScanned += 1;
      }

      if (postsScanned >= maxPosts) {
        if (selectedCategories.indexOf(category) < selectedCategories.length - 1) {
          truncated = true;
        }
        break;
      }
    }

    return {
      groupId,
      capturedAt: new Date().toISOString(),
      observedForumCategoryCount: categories.length,
      observedPostCount,
      observedCommentCount,
      categoriesScanned: selectedCategories.length,
      postsScanned,
      truncated,
    };
  }
}
