import type { MetadataRoute } from "next";
import { getPublicSiteUrl, isIndexingReleased } from "@/lib/indexing";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicSiteUrl();
  if (!isIndexingReleased() || !base) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/search", "/admin/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
