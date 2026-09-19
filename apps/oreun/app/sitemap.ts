import type { MetadataRoute } from "next";
import { GAME_IDENTITIES } from "@/lib/seed";
import { getPersistentGameCatalog } from "@/lib/repository/supabase-public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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
  const games = source
    .filter((game) => game.indexState === "indexable")
    .map((game) => ({
      url: `${base}/game/${game.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  return [...staticRows, ...games];
}
