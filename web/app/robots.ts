import type { MetadataRoute } from "next";

const SITE_URL = "https://stockplaybook.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Login-gated, per-user data — nothing here should be indexed.
      disallow: "/journal",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
