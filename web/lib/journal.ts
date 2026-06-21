// ─── Journal read/write helpers ──────────────────────────────────────────────
// SERVER-SIDE ONLY. Never import this from any client component or public page.
// Reads/writes ../private/journal.json (gitignored).

import fs from "fs";
import path from "path";
import { JournalFile, Trade } from "./journal-types";

// Re-export everything from journal-math so server code can use one import
export { totalCost, realizedPnL, unrealizedPnL, holdDays, computeStats } from "./journal-math";
export type { JournalStats } from "./journal-math";

const JOURNAL_PATH = path.resolve(
  path.join(process.cwd(), "..", "private", "journal.json")
);

const FALLBACK: JournalFile = {
  _note: "PRIVATE — local Mac Mini only. Never committed to git. Never deployed to Vercel.",
  trades: [],
};

export function readJournal(): JournalFile {
  if (!fs.existsSync(JOURNAL_PATH)) return { ...FALLBACK };
  try {
    return JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf-8")) as JournalFile;
  } catch {
    return { ...FALLBACK };
  }
}

export function writeJournal(data: JournalFile): void {
  const dir = path.dirname(JOURNAL_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(JOURNAL_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function saveTrade(trade: Trade): void {
  const journal = readJournal();
  const idx = journal.trades.findIndex((t) => t.id === trade.id);
  if (idx >= 0) {
    journal.trades[idx] = trade;
  } else {
    journal.trades.push(trade);
  }
  writeJournal(journal);
}

export function deleteTrade(id: string): void {
  const journal = readJournal();
  journal.trades = journal.trades.filter((t) => t.id !== id);
  writeJournal(journal);
}
