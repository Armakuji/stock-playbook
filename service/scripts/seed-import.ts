import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface LegacyExit {
  date: string;
  price: number;
  shares: number;
  note?: string;
}

interface LegacyTrade {
  id: string;
  ticker: string;
  catalystType: string;
  linkedReportDate?: string;
  entryPrice: number;
  shares: number;
  entryDate: string;
  plannedTP: number[];
  plannedSL: number;
  status: "open" | "closed";
  exits: LegacyExit[];
  realizedPnL?: number;
  notes?: string;
}

interface LegacyJournalFile {
  trades: LegacyTrade[];
}

async function main() {
  const email = process.argv[2];
  const journalPathArg = process.argv[3];

  if (!email) {
    console.error(
      "Usage: npm run seed:import -- <owner-email> [path-to-journal.json]",
    );
    process.exit(1);
  }

  const journalPath = journalPathArg
    ? resolve(journalPathArg)
    : resolve(__dirname, "../../private/journal.json");

  const journal = JSON.parse(
    readFileSync(journalPath, "utf-8"),
  ) as LegacyJournalFile;

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });
    console.log(`User #1: ${user.id} (${user.email})`);

    for (const t of journal.trades) {
      await prisma.trade.upsert({
        where: { id: t.id },
        update: {},
        create: {
          id: t.id,
          userId: user.id,
          ticker: t.ticker,
          catalystType: t.catalystType,
          linkedReportDate: t.linkedReportDate,
          entryPrice: t.entryPrice,
          shares: t.shares,
          entryDate: new Date(t.entryDate),
          plannedTP: t.plannedTP,
          plannedSL: t.plannedSL,
          status: t.status,
          realizedPnL: t.realizedPnL,
          notes: t.notes,
          exits: {
            create: t.exits.map((e) => ({
              date: new Date(e.date),
              price: e.price,
              shares: e.shares,
              note: e.note,
            })),
          },
        },
      });
      console.log(`  imported trade ${t.id} (${t.ticker})`);
    }

    console.log(`Done — imported ${journal.trades.length} trades.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
