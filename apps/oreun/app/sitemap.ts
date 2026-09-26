import type { MetadataRoute } from "next";
import { getPersistentGameCatalog } from "@/lib/repository/supabase-public";
import { getGameIndexEligibility } from "@/lib/index-eligibility";
import { getPublicSiteUrl, isIndexingReleased } from "@/lib/indexing";
import {
  getPublicGuideCatalog,
  getPublishedCodes,
  getPublishedGuides,
  isFreshCodeCheck,
} from "@/lib/content/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexingReleased()) return [];

  const base = getPublicSiteUrl();
  if (!base) return [];

  const staticPaths = [
    "",
    "/games",
    "/about",
    "/methodology",
    "/guidelines",
    "/privacy",
    "/youth",
    "/terms",
    "/disclaimer",
  ];
  const staticRows: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: path === "" ? 1 : path === "/games" ? 0.8 : 0.5,
  }));

  const guideCatalog = await getPublicGuideCatalog().catch(() => []);
  const indexableGuideCount = guideCatalog.filter(
    (guide) => guide.index_state === "indexable",
  ).length;
  if (indexableGuideCount >= 3) {
    staticRows.push({
      url: `${base}/guides`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.75,
    });
  }

  let source: NonNullable<Awaited<ReturnType<typeof getPersistentGameCatalog>>> = [];
  try {
    source = (await getPersistentGameCatalog()) ?? [];
  } catch {
    source = [];
  }

  const indexableCandidates = source.filter(
    (game) => game.indexState === "indexable",
  );
  const eligibility = await Promise.all(
    indexableCandidates.map(async (game) => ({
      game,
      result: await getGameIndexEligibility(game),
    })),
  );
  const indexableGames = eligibility
    .filter(({ result }) => result.eligible)
    .map(({ game }) => game);
  const games = indexableGames.map((game) => ({
    url: `${base}/game/${game.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const contentRows = (
    await Promise.all(
      indexableGames.map(async (game) => {
        const [guides, codes] = await Promise.all([
          getPublishedGuides(game.universeId).catch(() => []),
          getPublishedCodes(game.universeId).catch(() => []),
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

        return rows;
      }),
    )
  ).flat();

  return [...staticRows, ...games, ...contentRows];
}
