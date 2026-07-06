import fs from "fs";
import path from "path";
import { getAllReports } from "./reports";
import { getAllSpeculativeReports } from "./speculative";
import { getAllDcaReports } from "./dca";

/** Latest generatedAt across catalyst, turbo, DCA reports + market-timing.json */
export function getSiteLastUpdatedIso(): string | null {
  const timestamps = [
    ...getAllReports(),
    ...getAllSpeculativeReports(),
    ...getAllDcaReports(),
  ].map((r) => r.generatedAt);

  try {
    const mtPath = path.join(process.cwd(), "data", "market-timing.json");
    const mt = JSON.parse(fs.readFileSync(mtPath, "utf-8")) as { generatedAt?: string };
    if (mt.generatedAt) timestamps.push(mt.generatedAt);
  } catch {
    // market-timing optional
  }

  if (timestamps.length === 0) return null;
  return timestamps.sort().reverse()[0] ?? null;
}

/** DD/MM/YYYY for header / landing "Updated" label */
export function formatSiteLastUpdated(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function getSiteLastUpdatedLabel(): string {
  return formatSiteLastUpdated(getSiteLastUpdatedIso());
}
