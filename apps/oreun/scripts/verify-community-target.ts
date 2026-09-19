import { verifyCommunityAnalyticsTarget } from "../lib/community-analytics/run";

const args = process.argv.slice(2);
const universeId = Number(args[0]);
const groupId = Number(args[1]);
const enable = args.includes("--enable");

if (!Number.isSafeInteger(universeId) || universeId <= 0) {
  throw new Error(
    "Usage: npm run community:verify -- <universeId> <groupId> [--enable]",
  );
}
if (!Number.isSafeInteger(groupId) || groupId <= 0) {
  throw new Error(
    "Usage: npm run community:verify -- <universeId> <groupId> [--enable]",
  );
}

const result = await verifyCommunityAnalyticsTarget(
  { universeId, groupId, enable },
);
console.log(JSON.stringify(result, null, 2));
