import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-meta";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/journal",  // login-gated, per-user data — nothing here should be indexed
        "/api/",     // JSON endpoints, not content
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
