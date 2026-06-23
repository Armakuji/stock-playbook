import { buildBacktestEntries, computeBacktestStats, readCache } from "@/lib/backtest";
import { computeNearMissOutcomes } from "@/lib/near-miss";
import { BacktestContent } from "./BacktestContent";

export default function BacktestPage() {
  const cache = readCache();
  const entries = buildBacktestEntries(cache);
  const stats   = computeBacktestStats(entries);
  const nearMisses = computeNearMissOutcomes();

  return <BacktestContent entries={entries} stats={stats} nearMisses={nearMisses} />;
}
