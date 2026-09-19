import test from "node:test";
import assert from "node:assert/strict";
import {
  getCommunityAnalyticsConfig,
  OpenCloudCommunityClient,
  CommunityAnalyticsAuthorizationError,
  CommunityAnalyticsDisabledError,
  CommunityAnalyticsNotConfiguredError,
} from "../lib/community-analytics/open-cloud";
import { runCommunityAnalyticsOnce } from "../lib/community-analytics/run";

test("community analytics config is off by default and clamps scan bounds", () => {
  const defaults = getCommunityAnalyticsConfig({} as unknown as NodeJS.ProcessEnv);
  assert.equal(defaults.enabled, false);
  assert.equal(defaults.apiKey, null);
  assert.equal(defaults.maxCategories, 5);
  assert.equal(defaults.maxPosts, 20);

  const bounded = getCommunityAnalyticsConfig({
    R1_ROBLOX_COMMUNITY_ANALYTICS: "1",
    ROBLOX_OPEN_CLOUD_API_KEY: " test-key ",
    R1_COMMUNITY_MAX_CATEGORIES: "999",
    R1_COMMUNITY_MAX_POSTS: "999",
  } as unknown as NodeJS.ProcessEnv);
  assert.equal(bounded.enabled, true);
  assert.equal(bounded.apiKey, "test-key");
  assert.equal(bounded.maxCategories, 20);
  assert.equal(bounded.maxPosts, 100);
});

test("community analytics defaults to disabled and makes no request", async () => {
  let requests = 0;
  const fakeFetch = async () => {
    requests += 1;
    return new Response("{}");
  };
  const client = new OpenCloudCommunityClient(
    getCommunityAnalyticsConfig({} as unknown as NodeJS.ProcessEnv),
    fakeFetch as typeof fetch,
  );
  await assert.rejects(
    () => client.scanGroupForumAggregate(123),
    CommunityAnalyticsDisabledError,
  );
  assert.equal(requests, 0);
});

test("enabled analytics without API key still makes no request", async () => {
  let requests = 0;
  const fakeFetch = async () => {
    requests += 1;
    return new Response("{}");
  };
  const config = getCommunityAnalyticsConfig({
    R1_ROBLOX_COMMUNITY_ANALYTICS: "1",
  } as unknown as NodeJS.ProcessEnv);
  const client = new OpenCloudCommunityClient(
    config,
    fakeFetch as typeof fetch,
  );
  await assert.rejects(
    () => client.scanGroupForumAggregate(123),
    CommunityAnalyticsNotConfiguredError,
  );
  assert.equal(requests, 0);
});

test("Open Cloud 401/403 is treated as authorization failure", async () => {
  const client = new OpenCloudCommunityClient(
    getCommunityAnalyticsConfig({
      R1_ROBLOX_COMMUNITY_ANALYTICS: "1",
      ROBLOX_OPEN_CLOUD_API_KEY: "test-key",
    } as unknown as NodeJS.ProcessEnv),
    (async () => new Response("forbidden", { status: 403 })) as typeof fetch,
  );

  await assert.rejects(
    () => client.verifyGroupForumRead(77),
    CommunityAnalyticsAuthorizationError,
  );
});

test("aggregate scanner stores bounded observed counts only", async () => {
  const seen: string[] = [];
  const fakeFetch = async (input: string | URL | Request) => {
    const url = String(input);
    seen.push(url);
    if (url.endsWith("/forum-categories")) {
      return Response.json({
        forumCategories: [{ id: "cat-a" }],
      });
    }
    if (url.endsWith("/forum-categories/cat-a/posts")) {
      return Response.json({
        posts: [{ id: "post-a", title: "must-not-be-stored" }],
      });
    }
    if (url.endsWith("/posts/post-a/comments")) {
      return Response.json({
        comments: [
          { id: "c1", body: "must-not-be-stored" },
          { id: "c2", body: "must-not-be-stored" },
        ],
        nextPageToken: "more",
      });
    }
    return new Response("not found", { status: 404 });
  };

  const client = new OpenCloudCommunityClient(
    getCommunityAnalyticsConfig({
      R1_ROBLOX_COMMUNITY_ANALYTICS: "1",
      ROBLOX_OPEN_CLOUD_API_KEY: "test-key",
    } as unknown as NodeJS.ProcessEnv),
    fakeFetch as typeof fetch,
  );
  const aggregate = await client.scanGroupForumAggregate(77);

  assert.equal(aggregate.observedForumCategoryCount, 1);
  assert.equal(aggregate.observedPostCount, 1);
  assert.equal(aggregate.observedCommentCount, 2);
  assert.equal(aggregate.postsScanned, 1);
  assert.equal(aggregate.truncated, true);
  assert.equal(JSON.stringify(aggregate).includes("must-not-be-stored"), false);
  assert.equal(seen.length, 3);
});

test("invalid group id is rejected before a network request", async () => {
  let requests = 0;
  const client = new OpenCloudCommunityClient(
    getCommunityAnalyticsConfig({
      R1_ROBLOX_COMMUNITY_ANALYTICS: "1",
      ROBLOX_OPEN_CLOUD_API_KEY: "test-key",
    } as unknown as NodeJS.ProcessEnv),
    (async () => {
      requests += 1;
      return Response.json({});
    }) as typeof fetch,
  );

  await assert.rejects(() => client.scanGroupForumAggregate(0), /positive/);
  assert.equal(requests, 0);
});

test("runner returns disabled before database or network access", async () => {
  let requests = 0;
  const result = await runCommunityAnalyticsOnce(
    {
      R1_ROBLOX_COMMUNITY_ANALYTICS: "0",
    } as unknown as NodeJS.ProcessEnv,
    (async () => {
      requests += 1;
      return new Response("{}");
    }) as typeof fetch,
  );
  assert.equal(result.status, "disabled");
  assert.equal(requests, 0);
});
