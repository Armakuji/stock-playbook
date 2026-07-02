import fs from "fs";
import path from "path";

export function loadMarketTiming(): unknown {
  try {
    const p = path.join(process.cwd(), "data", "market-timing.json");
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}
