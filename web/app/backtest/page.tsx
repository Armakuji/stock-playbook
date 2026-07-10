import { buildBacktestEntries, computeBacktestStats, readCache } from "@/lib/backtest";
import { computeNearMissOutcomes } from "@/lib/near-miss";
import { computeNorthStar } from "@/lib/north-star";
import { computeTurboNorthStar } from "@/lib/turbo-north-star";
import { BacktestContent } from "./BacktestContent";

export default function BacktestPage() {
  const cache = readCache();
  const entries = buildBacktestEntries(cache);
  const stats   = computeBacktestStats(entries);
  const nearMisses = computeNearMissOutcomes();
  const northStar = computeNorthStar();
  const turboNorthStar = computeTurboNorthStar();

  return <BacktestContent entries={entries} stats={stats} nearMisses={nearMisses} northStar={northStar} turboNorthStar={turboNorthStar} />;
}
