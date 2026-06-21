// ─── Journal API — LOCAL ONLY ────────────────────────────────────────────────
// This route reads/writes private/journal.json.
// It is NEVER reachable on Vercel (static export has no runtime routes).
// Access it only at http://localhost:3000/journal/api on the Mac Mini.

import { NextRequest, NextResponse } from "next/server";
import { readJournal, writeJournal, saveTrade, deleteTrade } from "@/lib/journal";
import { Trade } from "@/lib/journal-types";

export async function GET() {
  const journal = readJournal();
  return NextResponse.json(journal);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { action: string; trade?: Trade; id?: string };

  if (body.action === "save" && body.trade) {
    saveTrade(body.trade);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete" && body.id) {
    deleteTrade(body.id);
    return NextResponse.json({ ok: true });
  }

  const bodyWithTrades = body as unknown as { action: string; trades?: Trade[] };
  if (bodyWithTrades.action === "replace_all" && Array.isArray(bodyWithTrades.trades)) {
    const journal = readJournal();
    journal.trades = bodyWithTrades.trades!;
    writeJournal(journal);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
