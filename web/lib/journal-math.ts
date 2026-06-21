// ─── Journal P&L math — CLIENT SAFE ──────────────────────────────────────────
// Pure functions only. No fs, no path, no Node.js APIs.
// Imported by both JournalContent.tsx (client) and journal.ts (server).

import { Trade } from "./journal-types";

export interface JournalStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalRealizedPnL: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldDays: number;
  expectancy: number;
  planAdherence: number;
  byType: Record<string, { trades: number; wins: number; totalPnL: number }>;
}

export function totalCost(trade: Trade): number {
  return trade.entryPrice * trade.shares;
}

export function realizedPnL(trade: Trade): number {
  return trade.exits.reduce(
    (sum, exit) => sum + exit.shares * (exit.price - trade.entryPrice),
    0
  );
}

export function unrealizedPnL(trade: Trade, currentPrice: number): number {
  const exitedShares = trade.exits.reduce((s, e) => s + e.shares, 0);
  return (trade.shares - exitedShares) * (currentPrice - trade.entryPrice);
}

export function holdDays(trade: Trade): number {
  const entry = new Date(trade.entryDate).getTime();
  const end =
    trade.status === "closed" && trade.exits.length > 0
      ? new Date(trade.exits[trade.exits.length - 1].date).getTime()
      : Date.now();
  return Math.round((end - entry) / 86_400_000);
}

export function computeStats(trades: Trade[]): JournalStats {
  const closed = trades.filter((t) => t.status === "closed");
  const wins   = closed.filter((t) => (t.realizedPnL ?? realizedPnL(t)) > 0);
  const losses = closed.filter((t) => (t.realizedPnL ?? realizedPnL(t)) <= 0);

  const pnls     = closed.map((t) => t.realizedPnL ?? realizedPnL(t));
  const winPnls  = wins.map((t) => t.realizedPnL ?? realizedPnL(t));
  const lossPnls = losses.map((t) => t.realizedPnL ?? realizedPnL(t));

  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;

  const winRate = closed.length === 0 ? 0 : wins.length / closed.length;

  const adherent = closed.filter((t) => {
    if (!t.plannedTP[0] || t.exits.length === 0) return false;
    const avgExit =
      t.exits.reduce((s, e) => s + e.price * e.shares, 0) /
      t.exits.reduce((s, e) => s + e.shares, 0);
    return avgExit >= t.plannedTP[0];
  });

  const byType: JournalStats["byType"] = {};
  for (const t of closed) {
    const ct = t.catalystType ?? "other";
    if (!byType[ct]) byType[ct] = { trades: 0, wins: 0, totalPnL: 0 };
    const pnl = t.realizedPnL ?? realizedPnL(t);
    byType[ct].trades++;
    if (pnl > 0) byType[ct].wins++;
    byType[ct].totalPnL += pnl;
  }

  return {
    totalTrades: trades.length,
    openTrades: trades.filter((t) => t.status === "open").length,
    closedTrades: closed.length,
    totalRealizedPnL: pnls.reduce((s, v) => s + v, 0),
    winRate,
    avgWin:  avg(winPnls),
    avgLoss: avg(lossPnls),
    bestTrade:  pnls.length ? Math.max(...pnls) : 0,
    worstTrade: pnls.length ? Math.min(...pnls) : 0,
    avgHoldDays: avg(closed.map(holdDays)),
    expectancy: winRate * avg(winPnls) + (1 - winRate) * avg(lossPnls),
    planAdherence: closed.length === 0 ? 0 : adherent.length / closed.length,
    byType,
  };
}
