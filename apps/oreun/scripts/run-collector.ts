import { RobloxPublicGamesProvider } from "../lib/providers/roblox-public";
import { SupabaseCollectorStore } from "../lib/collector/supabase-store";
import { runPersistentCollector } from "../lib/collector/persistent-run";

const store = new SupabaseCollectorStore();
if (!store.isConfigured()) {
  console.error(
    "R1 persistence is not configured. Set SUPABASE_URL + SUPABASE_SECRET_KEY.",
  );
  process.exit(1);
}

const result = await runPersistentCollector({
  provider: new RobloxPublicGamesProvider(),
  store,
  limit: Number(process.env.R1_COLLECTOR_BATCH_LIMIT || 100),
});

console.log(JSON.stringify(result, null, 2));

if (result.status === "failed") process.exitCode = 1;
