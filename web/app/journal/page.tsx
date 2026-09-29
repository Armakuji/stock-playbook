// ─── Trade Journal Page ───────────────────────────────────────────────────────
// Trades now live in the Journal API (Postgres via Railway) — this page fetches
// them server-side, forwarding the session cookie. See docs/architecture/journal-api.md.

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Trade, AiValidateQuota } from "@/lib/journal-types";
import { computeStats } from "@/lib/journal-math";
import { getAllReports, getAllReportsGrouped } from "@/lib/reports";
import { JournalContent } from "./JournalContent";
import { LoginGate } from "./LoginGate";

// Login-gated, per-user trade data — belt-and-suspenders with the /journal
// disallow in robots.ts (this metadata-level noindex also covers crawlers
// that ignore robots.txt but do respect the meta tag).
export const metadata: Metadata = {
  title: "Journal",
  robots: { index: false, follow: false },
};

const API_ORIGIN = process.env.JOURNAL_API_ORIGIN ?? "http://localhost:4000";

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, fontFamily: "var(--font-display, sans-serif)" }}>
        {title}
      </h1>
      <p style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{message}</p>
    </div>
  );
}

export default async function JournalPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return <LoginGate />;
  }

  const headers = { Cookie: `session=${sessionCookie}` };

  let tradesRes: Response;
  try {
    tradesRes = await fetch(`${API_ORIGIN}/trades`, { headers, cache: "no-store" });
  } catch {
    return (
      <ErrorState
        title="Can't reach the Journal API"
        message="The API may be starting up or temporarily unavailable. Try refreshing in a moment."
      />
    );
  }

  // Only an actually-unauthenticated response should send a logged-in user back to
  // the login screen — a 5xx from the API is a backend problem, not an expired session.
  if (tradesRes.status === 401) {
    return <LoginGate />;
  }

  if (!tradesRes.ok) {
    return (
      <ErrorState
        title="Something went wrong"
        message={`The Journal API returned an error (${tradesRes.status}). Try refreshing in a moment.`}
      />
    );
  }

  const trades: Trade[] = await tradesRes.json();

  const quotaRes = await fetch(`${API_ORIGIN}/journal/validate/quota`, {
    headers,
    cache: "no-store",
  }).catch(() => null);
  const quota: AiValidateQuota | null =
    quotaRes && quotaRes.ok ? await quotaRes.json() : null;

  const stats = computeStats(trades);
  const reports = getAllReports();

  const reportOptions = reports.map((r) => ({
    ticker: r.ticker,
    companyName: r.companyName,
    price: r.price,
    tp1: r.entryStrategy.tp1.price,
    tp2: r.entryStrategy.tp2.price,
    tp3: r.entryStrategy.tp3.price,
    tightStop: r.entryStrategy.stopLoss.tight ?? null,
    hardStop: r.entryStrategy.stopLoss.hard ?? null,
    reportDate: r.generatedAt.slice(0, 10).replace(/-/g, ""),
    catalystType: r.catalystSpot?.catalystType ?? null,
  }));

  const priceMap: Record<string, { price: number; generatedAt: string; companyName: string }> = {};
  for (const r of reports) {
    priceMap[r.ticker] = { price: r.price, generatedAt: r.generatedAt, companyName: r.companyName };
  }

  const grouped = getAllReportsGrouped();
  const reportsByTicker: Record<
    string,
    { reportDate: string; price: number; tp1: number; tp2: number; tp3: number; tightStop: number | null; hardStop: number | null; catalystType: string | null }[]
  > = {};
  for (const [ticker, reps] of Object.entries(grouped)) {
    reportsByTicker[ticker] = reps.map((r) => ({
      reportDate: r.generatedAt.slice(0, 10).replace(/-/g, ""),
      price: r.price,
      tp1: r.entryStrategy.tp1.price,
      tp2: r.entryStrategy.tp2.price,
      tp3: r.entryStrategy.tp3.price,
      tightStop: r.entryStrategy.stopLoss.tight ?? null,
      hardStop: r.entryStrategy.stopLoss.hard ?? null,
      catalystType: r.catalystSpot?.catalystType ?? null,
    }));
  }

  return (
    <JournalContent
      initialTrades={trades}
      stats={stats}
      reportOptions={reportOptions}
      priceMap={priceMap}
      reportsByTicker={reportsByTicker}
      quota={quota}
    />
  );
}
