import test from "node:test";
import assert from "node:assert/strict";
import {
  getCommunityAnalyticsConfig,
  OpenCloudCommunityClient,
  CommunityAnalyticsDisabledError,
  CommunityAnalyticsNotConfiguredError,
} from "../lib/community-analytics/open-cloud";
import { runCommunityAnalyticsOnce } from "../lib/community-analytics/run";

test("community analytics defaults to disabled and makes no request", async () => {
  let requests = 0;
  const fakeFetch = async () => {
    requests += 1;
    return new Response("{}");
  };
  const client = new OpenCloudCommunityClient(
    getCommunityAnalyticsConfig({} as NodeJS.ProcessEnv),
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
  } as NodeJS.ProcessEnv);
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

test("aggregate scanner stores counts only and marks pagination truncation", async () => {
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
    {
      enabled: true,
      apiKey: "test-key",
      baseUrl: "https://apis.roblox.com",
    },
    fakeFetch as typeof fetch,
  );
  const aggregate = await client.scanGroupForumAggregate(77);

  assert.equal(aggregate.forumCategoryCount, 1);
  assert.equal(aggregate.observedPostCount, 1);
  assert.equal(aggregate.observedCommentCount, 2);
  assert.equal(aggregate.postsScanned, 1);
  assert.equal(aggregate.truncated, true);
  assert.equal(JSON.stringify(aggregate).includes("must-not-be-stored"), false);
  assert.equal(seen.length, 3);
});

test("runner returns disabled before database or network access", async () => {
  let requests = 0;
  const result = await runCommunityAnalyticsOnce(
    {
      R1_ROBLOX_COMMUNITY_ANALYTICS: "0",
    } as NodeJS.ProcessEnv,
    (async () => {
      requests += 1;
      return new Response("{}");
    }) as typeof fetch,
  );
  assert.equal(result.status, "disabled");
  assert.equal(requests, 0);
});
