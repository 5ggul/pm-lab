import type { MetadataRoute } from "next";
import { GAME_IDENTITIES } from "@/lib/seed";
import { getPersistentGameCatalog } from "@/lib/repository/supabase-public";
import { getPublicSiteUrl } from "@/lib/indexing";
import { getPublishedCodes, getPublishedGuides, getUpdateEvents, isFreshCodeCheck } from "@/lib/content/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    getPublicSiteUrl() ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  const staticPaths = [
    "",
    "/games",
    "/rising",
    "/about",
    "/methodology",
    "/guidelines",
    "/privacy",
    "/youth",
    "/terms",
    "/disclaimer",
  ];
  const staticRows = staticPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: path === "" ? 1 : path === "/games" || path === "/rising" ? 0.8 : 0.5,
  }));
  let source = GAME_IDENTITIES;
  try {
    source = (await getPersistentGameCatalog()) ?? GAME_IDENTITIES;
  } catch {
    source = GAME_IDENTITIES;
  }
  const indexableGames = source.filter(
    (game) => game.indexState === "indexable",
  );
  const games = indexableGames.map((game) => ({
    url: `${base}/game/${game.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const contentRows = (
    await Promise.all(
      indexableGames.map(async (game) => {
        const [guides, codes, events] = await Promise.all([
          getPublishedGuides(game.universeId).catch(() => []),
          getPublishedCodes(game.universeId).catch(() => []),
          getUpdateEvents(game.universeId, 20).catch(() => []),
        ]);
        const rows: MetadataRoute.Sitemap = [];

        const indexableGuides = guides.filter(
          (guide) => guide.index_state === "indexable",
        );
        if (indexableGuides.length) {
          rows.push({
            url: `${base}/game/${game.slug}/guides`,
            changeFrequency: "weekly",
            priority: 0.7,
          });
          for (const guide of indexableGuides) {
            rows.push({
              url: `${base}/game/${game.slug}/guides/${guide.slug}`,
              lastModified: new Date(guide.updated_at),
              changeFrequency: "monthly",
              priority: 0.7,
            });
          }
        }

        if (
          codes.some(
            (code) =>
              code.code_status === "active" && isFreshCodeCheck(code),
          )
        ) {
          rows.push({
            url: `${base}/game/${game.slug}/codes`,
            changeFrequency: "daily",
            priority: 0.7,
          });
        }

        if (
          events.some(
            (event) => event.event_kind === "provider_update_detected",
          )
        ) {
          rows.push({
            url: `${base}/game/${game.slug}/updates`,
            changeFrequency: "daily",
            priority: 0.6,
          });
        }
        return rows;
      }),
    )
  ).flat();

  return [...staticRows, ...games, ...contentRows];
}
