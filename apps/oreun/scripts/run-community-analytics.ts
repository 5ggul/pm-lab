import { runCommunityAnalyticsOnce } from "../lib/community-analytics/run";

const result = await runCommunityAnalyticsOnce();
console.log(JSON.stringify(result, null, 2));

if (result.status === "failed") process.exit(1);
