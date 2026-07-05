// Prisma's @db.Date columns still come back as JS Date objects (midnight UTC), which
// JSON.stringify renders as a full ISO timestamp ("2026-07-01T00:00:00.000Z"). The client
// expects a plain "YYYY-MM-DD" string (it feeds this straight into <input type="date">).
// Normalize at the HTTP response boundary, not inside TradesService, so its existing unit
// tests (which mock Prisma responses without a Date instance or an `exits` array) stay valid.

function toDateStr(value: unknown): unknown {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function serializeExit(exit: unknown): unknown {
  if (typeof exit !== "object" || exit === null) return exit;
  return { ...exit, date: toDateStr((exit as { date?: unknown }).date) };
}

export function serializeTrade<
  T extends { entryDate?: unknown; exits?: unknown },
>(trade: T): T {
  return {
    ...trade,
    entryDate: toDateStr(trade.entryDate),
    exits: Array.isArray(trade.exits)
      ? (trade.exits as unknown[]).map(serializeExit)
      : trade.exits,
  };
}
