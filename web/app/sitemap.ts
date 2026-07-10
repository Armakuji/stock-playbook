import type { MetadataRoute } from "next";
import { getAllReports } from "@/lib/reports";
import { getAllDcaReports } from "@/lib/dca";
import { getAllSpeculativeReports } from "@/lib/speculative";
import { SITE_URL } from "@/lib/site-meta";

// /journal is login-gated (nothing to index) and intentionally excluded —
// see robots.ts, which also disallows it.
const STATIC_PAGES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/catalyst", priority: 0.9 },
  { path: "/dca", priority: 0.8 },
  { path: "/turbo", priority: 0.8 },
  { path: "/backtest", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority,
  }));

  // /report/[ticker] resolves across all three pools (catalyst reports, DCA,
  // speculative) keyed only by ticker — so one entry per unique ticker across
  // all three, not one per JSON file.
  const allReports = [
    ...getAllReports(),
    ...getAllDcaReports(),
    ...getAllSpeculativeReports(),
  ];
  const seen = new Set<string>();
  const reportEntries: MetadataRoute.Sitemap = [];
  for (const r of allReports) {
    const ticker = r.ticker.toLowerCase();
    if (seen.has(ticker)) continue;
    seen.add(ticker);
    reportEntries.push({
      url: `${SITE_URL}/report/${ticker}`,
      lastModified: new Date(r.generatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    });
  }

  return [...staticEntries, ...reportEntries];
}
