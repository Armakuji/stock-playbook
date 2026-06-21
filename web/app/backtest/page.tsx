import { buildBacktestEntries, computeBacktestStats, readCache } from "@/lib/backtest";
import { BacktestContent } from "./BacktestContent";

export default function BacktestPage() {
  const cache = readCache();
  const entries = buildBacktestEntries(cache);
  const stats   = computeBacktestStats(entries);

  return <BacktestContent entries={entries} stats={stats} />;
}
