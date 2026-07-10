# Dashboard Tab Switcher + Card Restyles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the missing cross-route DCA↔Catalyst↔Turbo switcher (currently absent
from all 3 dashboard routes) as one new shared component, wire it into all 3 routes with
real cross-category counts, value-tune stats/tier/grid numbers to match the mockup, and
retune `StockCard`'s surface tokens for visual consistency with its theme.

**Architecture:** One new client component (`DashboardSwitcher.tsx`) consuming the
already-staged `.radar-pills`/`.radar-pill` CSS in `globals.css`. Each dashboard route's
server `page.tsx` gains 3 cheap extra data-loader calls (already used elsewhere in the
app) to compute cross-category counts, passed through its `*Content.tsx` into the new
switcher. No shared layout, no new data layer, no npm dependencies.

**Tech Stack:** Next.js 15 App Router, React server + client components, inline styles +
existing global CSS classes, `useLang()`/`LanguageContext`.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-09-dashboard-restyle-design.md`.
- Do NOT touch `Header.tsx`, `MarketTicker.tsx`, `layout.tsx`, `Landing.tsx` (Phases 1-2).
- Do NOT rename any existing component or file (`DcaCard`, `TurboCard`, `StockCard`,
  `ThemeGroups`, etc.) — per project convention, radar-era naming stays; only styling/
  markup changes.
- Do NOT modify `DcaCard.tsx`/`TurboCard.tsx` internals beyond what's in this plan — their
  fine-grained chip/gauge/bar pixel-tuning is explicitly out of scope this phase (logged
  as backlog item #23).
- Do NOT rebuild `StockCard.tsx`'s ring/price-bar/hover mechanism or `ThemeGroups`'
  grouping logic — only the container surface/border tokens change (see Task 5).
- No new npm dependencies.
- No automated test suite for these files. Verification per task = `npm run build` + curl
  against a live dev server (inline styles render literally into HTML, proven reliable
  in Phases 1-2) + a check that each route's switcher correctly marks itself active and
  links to the other two.

---

## Task 1: Create the shared `DashboardSwitcher` component

**Files:**
- Create: `web/app/DashboardSwitcher.tsx`

**Interfaces:**
- Consumes: `globals.css`'s existing `.radar-pills`/`.radar-pill` (+ `.on-water`/
  `.on-air`/`.on-fire`) classes, and the existing `livePulse` keyframe (both already
  defined, no changes needed to `globals.css`).
- Produces: `DashboardSwitcher({ active: "dca"|"catalyst"|"turbo", counts: { dca: number;
  catalyst: number; turbo: number }, lastUpdated: string })` — a default-less named
  export, imported by Tasks 2-4 into each `*Content.tsx`.

- [ ] **Step 1: Write the component**

Create `web/app/DashboardSwitcher.tsx` with this exact content:

```tsx
"use client";

import Link from "next/link";
import { useLang } from "@/lib/LanguageContext";

type ActiveTab = "dca" | "catalyst" | "turbo";

const TABS: {
  key: ActiveTab;
  href: string;
  icon: string;
  labelEn: string;
  labelTh: string;
  onClass: string;
}[] = [
  { key: "dca",      href: "/dca",      icon: "💧",  labelEn: "DCA",      labelTh: "DCA",      onClass: "on-water" },
  { key: "catalyst", href: "/catalyst", icon: "🌬️", labelEn: "Catalyst", labelTh: "Catalyst", onClass: "on-air"   },
  { key: "turbo",    href: "/turbo",    icon: "🔥",  labelEn: "Turbo",    labelTh: "Turbo",    onClass: "on-fire"  },
];

export function DashboardSwitcher({
  active,
  counts,
  lastUpdated,
}: {
  active: ActiveTab;
  counts: { dca: number; catalyst: number; turbo: number };
  lastUpdated: string;
}) {
  const { lang } = useLang();
  const th = lang === "th";

  return (
    <div style={{ textAlign: "center", padding: "30px 0 6px" }}>
      {/* ── Mini-hero: LIVE badge + tagline ─────────────────────────── */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 14,
        padding: "5px 14px", borderRadius: 999,
        background: "var(--card)", border: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}>
        <span style={{
          display: "inline-block", width: 7, height: 7, borderRadius: "50%",
          background: "#10b981", animation: "livePulse 2s ease-in-out infinite",
        }} />
        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.5px" }}>
          LIVE · {th ? "อัปเดต" : "Updated"} {lastUpdated}
        </span>
      </div>
      <p style={{
        fontSize: 13, color: "var(--muted)", maxWidth: 520, margin: "0 auto 18px",
        fontFamily: "var(--font-mono, monospace)", lineHeight: 1.6,
      }}>
        {th
          ? "เลือกธาตุการลงทุนของคุณด้านล่าง — จัดอันดับใหม่ทุกสัปดาห์"
          : "Pick your investment element below — re-ranked automatically every week."}
      </p>

      {/* ── Cross-route switcher ─────────────────────────────────────── */}
      <div className="radar-pills">
        {TABS.map((t) => {
          const isActive = t.key === active;
          const count = counts[t.key];
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`radar-pill${isActive ? ` ${t.onClass}` : ""}`}
            >
              <span>{t.icon} {th ? t.labelTh : t.labelEn}</span>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 5,
                background: isActive ? "rgba(0,0,0,0.2)" : "#141422",
                color: isActive ? "inherit" : "var(--muted)",
              }}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds. `DashboardSwitcher` isn't imported anywhere yet at this point
in the plan, so Next.js may report it as an unused file — that's fine, it's not an error;
just confirm no type errors within the file itself.

- [ ] **Step 3: Commit**

```bash
git add web/app/DashboardSwitcher.tsx
git commit -m "feat: add shared DashboardSwitcher component for cross-route dashboard nav"
```

---

## Task 2: Wire the switcher into DCA + value-tune DCA's stats/grid

**Files:**
- Modify: `web/app/dca/page.tsx`
- Modify: `web/app/dca/DcaContent.tsx`

**Interfaces:**
- Consumes: `DashboardSwitcher` from Task 1 (exact props: `active`, `counts`, `lastUpdated`).
- Produces: `DcaContent` now requires two new props (`dashboardCounts`, `lastUpdated`) —
  Tasks 3-4 follow the identical pattern for their own routes, not consumed by this task.

- [ ] **Step 1: Update `web/app/dca/page.tsx` to compute cross-category counts**

Find (the entire file):

```tsx
import { getDcaStocks, getDcaFunds, rankDcaReports } from "@/lib/dca";
import { getDcaRankingChanges } from "@/lib/ranking-history";
import { DcaContent } from "./DcaContent";

export const dynamic = "force-dynamic";

export default function DcaPage() {
  const funds = rankDcaReports(getDcaFunds());
  const stocks = rankDcaReports(getDcaStocks());
  const fundChanges = getDcaRankingChanges("fund");
  const stockChanges = getDcaRankingChanges("stock");
  return (
    <DcaContent
      funds={funds}
      stocks={stocks}
      fundChanges={fundChanges}
      stockChanges={stockChanges}
    />
  );
}
```

Replace with:

```tsx
import { getDcaStocks, getDcaFunds, rankDcaReports, getAllDcaReports } from "@/lib/dca";
import { getDcaRankingChanges } from "@/lib/ranking-history";
import { getAllReports } from "@/lib/reports";
import { getAllSpeculativeReports } from "@/lib/speculative";
import { formatSiteLastUpdated, getSiteLastUpdatedIso } from "@/lib/site-meta";
import { DcaContent } from "./DcaContent";

export const dynamic = "force-dynamic";

export default function DcaPage() {
  const funds = rankDcaReports(getDcaFunds());
  const stocks = rankDcaReports(getDcaStocks());
  const fundChanges = getDcaRankingChanges("fund");
  const stockChanges = getDcaRankingChanges("stock");
  const dashboardCounts = {
    dca: getAllDcaReports().length,
    catalyst: getAllReports().length,
    turbo: getAllSpeculativeReports().length,
  };
  return (
    <DcaContent
      funds={funds}
      stocks={stocks}
      fundChanges={fundChanges}
      stockChanges={stockChanges}
      dashboardCounts={dashboardCounts}
      lastUpdated={formatSiteLastUpdated(getSiteLastUpdatedIso())}
    />
  );
}
```

- [ ] **Step 2: Import `DashboardSwitcher` in `DcaContent.tsx`**

Find:

```tsx
import { useState } from "react";
import { DcaCard } from "./DcaCard";
import { RankingChangeTable } from "../RankingChangeTable";
import { useLang } from "@/lib/LanguageContext";
import type { RankedDca } from "@/lib/dca";
import type { RankChange } from "@/lib/ranking-history";
```

Replace with:

```tsx
import { useState } from "react";
import { DcaCard } from "./DcaCard";
import { DashboardSwitcher } from "../DashboardSwitcher";
import { RankingChangeTable } from "../RankingChangeTable";
import { useLang } from "@/lib/LanguageContext";
import type { RankedDca } from "@/lib/dca";
import type { RankChange } from "@/lib/ranking-history";
```

- [ ] **Step 3: Accept the two new props**

Find:

```tsx
export function DcaContent({
  funds,
  stocks,
  fundChanges = [],
  stockChanges = [],
}: {
  funds: RankedDca[];
  stocks: RankedDca[];
  fundChanges?: RankChange[];
  stockChanges?: RankChange[];
}) {
```

Replace with:

```tsx
export function DcaContent({
  funds,
  stocks,
  fundChanges = [],
  stockChanges = [],
  dashboardCounts,
  lastUpdated,
}: {
  funds: RankedDca[];
  stocks: RankedDca[];
  fundChanges?: RankChange[];
  stockChanges?: RankChange[];
  dashboardCounts: { dca: number; catalyst: number; turbo: number };
  lastUpdated: string;
}) {
```

- [ ] **Step 4: Render the switcher above the existing hero header**

Find:

```tsx
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ── Hero header ───────────────────────────────────────────────── */}
```

Replace with:

```tsx
      <div style={{ position: "relative", zIndex: 1 }}>

        <DashboardSwitcher active="dca" counts={dashboardCounts} lastUpdated={lastUpdated} />

        {/* ── Hero header ───────────────────────────────────────────────── */}
```

- [ ] **Step 5: Retune the stats grid (minmax 110→120, value font-size 17→18)**

Find:

```tsx
        {ranked.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 8, marginBottom: 20,
          }}>
            {statsItems.map(({ label, value, color }) => (
              <div key={label} style={{ background: "#07111a", border: "1px solid #102530", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "#3a5560", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4, fontFamily: "var(--font-mono, monospace)" }}>
                  {label}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}
```

Replace with:

```tsx
        {ranked.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 8, marginBottom: 20,
          }}>
            {statsItems.map(({ label, value, color }) => (
              <div key={label} style={{ background: "#07111a", border: "1px solid #102530", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "#3a5560", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4, fontFamily: "var(--font-mono, monospace)" }}>
                  {label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}
```

- [ ] **Step 6: Retune the card grid (minmax 280→300)**

Find:

```tsx
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {ranked.map((r) => (
              <DcaCard key={r.ticker} report={r} rank={r.rank} />
            ))}
          </div>
```

Replace with:

```tsx
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {ranked.map((r) => (
              <DcaCard key={r.ticker} report={r} rank={r.rank} />
            ))}
          </div>
```

- [ ] **Step 7: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds — this also confirms `DcaContent`'s new required props are
correctly threaded through from `page.tsx` (a missing/mistyped prop would be a
TypeScript error).

- [ ] **Step 8: Manual check**

Start `npm run dev`, load `/dca`, confirm: a small LIVE badge + tagline + 3-pill
switcher appears above the existing "💧 DCA List" header, the DCA pill is highlighted
(gradient `on-water` fill), and clicking the Catalyst/Turbo pills navigates to those
routes (they won't be highlighted yet — that lands in Tasks 3-4).

- [ ] **Step 9: Commit**

```bash
git add web/app/dca/page.tsx web/app/dca/DcaContent.tsx
git commit -m "feat: wire dashboard switcher into DCA, retune stats/grid values"
```

---

## Task 3: Wire the switcher into Catalyst + value-tune stats/tier/grid

**Files:**
- Modify: `web/app/catalyst/page.tsx`
- Modify: `web/app/catalyst/CatalystContent.tsx`
- Modify: `web/app/ThemeGroups.tsx`

**Interfaces:**
- Consumes: `DashboardSwitcher` from Task 1.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Update `web/app/catalyst/page.tsx`**

Find (the entire file):

```tsx
import { getAllReports } from "@/lib/reports";
import { rankReports } from "@/lib/ranking";
import { getRankingChanges } from "@/lib/ranking-history";
import { getCatalystCalendar } from "@/lib/catalyst-calendar";
import { CatalystContent } from "./CatalystContent";

export const dynamic = "force-dynamic";

export default function CatalystPage() {
  const ranked = rankReports(getAllReports());
  const rankChanges = getRankingChanges();
  const calendarEvents = getCatalystCalendar();

  return (
    <CatalystContent
      ranked={ranked}
      rankChanges={rankChanges}
      calendarEvents={calendarEvents}
    />
  );
}
```

Replace with:

```tsx
import { getAllReports } from "@/lib/reports";
import { rankReports } from "@/lib/ranking";
import { getRankingChanges } from "@/lib/ranking-history";
import { getCatalystCalendar } from "@/lib/catalyst-calendar";
import { getAllDcaReports } from "@/lib/dca";
import { getAllSpeculativeReports } from "@/lib/speculative";
import { formatSiteLastUpdated, getSiteLastUpdatedIso } from "@/lib/site-meta";
import { CatalystContent } from "./CatalystContent";

export const dynamic = "force-dynamic";

export default function CatalystPage() {
  const ranked = rankReports(getAllReports());
  const rankChanges = getRankingChanges();
  const calendarEvents = getCatalystCalendar();
  const dashboardCounts = {
    dca: getAllDcaReports().length,
    catalyst: getAllReports().length,
    turbo: getAllSpeculativeReports().length,
  };

  return (
    <CatalystContent
      ranked={ranked}
      rankChanges={rankChanges}
      calendarEvents={calendarEvents}
      dashboardCounts={dashboardCounts}
      lastUpdated={formatSiteLastUpdated(getSiteLastUpdatedIso())}
    />
  );
}
```

- [ ] **Step 2: Import `DashboardSwitcher` in `CatalystContent.tsx`**

Find:

```tsx
import { rankReports } from "@/lib/ranking";
import { getRankingChanges } from "@/lib/ranking-history";
import { getCatalystCalendar } from "@/lib/catalyst-calendar";
import { detectCatalystClusters, reportStage } from "@/lib/catalyst-timing";
import { factorConcentration } from "@/lib/factors";
import { useLang } from "@/lib/LanguageContext";
import { RankingChangeTable } from "../RankingChangeTable";
import { CatalystCalendar } from "../CatalystCalendar";
import { ThemeGroups } from "../ThemeGroups";
import { FactorRiskPanel } from "../FactorRiskPanel";
```

Replace with:

```tsx
import { rankReports } from "@/lib/ranking";
import { getRankingChanges } from "@/lib/ranking-history";
import { getCatalystCalendar } from "@/lib/catalyst-calendar";
import { detectCatalystClusters, reportStage } from "@/lib/catalyst-timing";
import { factorConcentration } from "@/lib/factors";
import { useLang } from "@/lib/LanguageContext";
import { RankingChangeTable } from "../RankingChangeTable";
import { CatalystCalendar } from "../CatalystCalendar";
import { ThemeGroups } from "../ThemeGroups";
import { FactorRiskPanel } from "../FactorRiskPanel";
import { DashboardSwitcher } from "../DashboardSwitcher";
```

- [ ] **Step 3: Accept the two new props**

Find:

```tsx
export function CatalystContent({
  ranked,
  rankChanges,
  calendarEvents,
}: {
  ranked: Ranked;
  rankChanges: RankChanges;
  calendarEvents: CalendarEvents;
}) {
```

Replace with:

```tsx
export function CatalystContent({
  ranked,
  rankChanges,
  calendarEvents,
  dashboardCounts,
  lastUpdated,
}: {
  ranked: Ranked;
  rankChanges: RankChanges;
  calendarEvents: CalendarEvents;
  dashboardCounts: { dca: number; catalyst: number; turbo: number };
  lastUpdated: string;
}) {
```

- [ ] **Step 4: Render the switcher above the existing hero header**

Find:

```tsx
  return (
    <div className="theme-air">
      {/* ── Hero header ───────────────────────────────────────── */}
```

Replace with:

```tsx
  return (
    <div className="theme-air">
      <DashboardSwitcher active="catalyst" counts={dashboardCounts} lastUpdated={lastUpdated} />

      {/* ── Hero header ───────────────────────────────────────── */}
```

- [ ] **Step 5: Retune the stats grid (minmax 110→120, value font-size 17→18)**

Find:

```tsx
        {ranked.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 8, marginBottom: 20,
          }}>
            {statsItems.map(({ label, value, color }) => (
              <div key={label} style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4, fontFamily: "var(--font-mono, monospace)" }}>
                  {label}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}
```

Replace with:

```tsx
        {ranked.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 8, marginBottom: 20,
          }}>
            {statsItems.map(({ label, value, color }) => (
              <div key={label} style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4, fontFamily: "var(--font-mono, monospace)" }}>
                  {label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}
```

- [ ] **Step 6: Trim the sort-tag copy to match the mockup**

Find:

```tsx
          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
            {th ? "เรียงตาม: ความใกล้ catalyst · conviction" : "sorted: catalyst proximity · conviction"}
          </span>
```

Replace with:

```tsx
          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
            {th ? "เรียงตาม: ความใกล้ catalyst" : "sorted: catalyst proximity"}
          </span>
```

- [ ] **Step 7: Retune the card grid in `ThemeGroups.tsx` (minmax 280→300)**

In `web/app/ThemeGroups.tsx`, find:

```tsx
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
```

Replace with:

```tsx
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
```

- [ ] **Step 8: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 9: Manual check**

In the dev server, load `/catalyst`, confirm the switcher appears above the existing
hero, the Catalyst pill is highlighted (`on-air` gradient), the DCA/Turbo pills
navigate correctly, and the sort tag now reads "sorted: catalyst proximity" (no
"· conviction" suffix).

- [ ] **Step 10: Commit**

```bash
git add web/app/catalyst/page.tsx web/app/catalyst/CatalystContent.tsx web/app/ThemeGroups.tsx
git commit -m "feat: wire dashboard switcher into Catalyst, retune stats/grid/copy"
```

---

## Task 4: Wire the switcher into Turbo + value-tune stats/grid

**Files:**
- Modify: `web/app/turbo/page.tsx`
- Modify: `web/app/turbo/TurboContent.tsx`

**Interfaces:**
- Consumes: `DashboardSwitcher` from Task 1.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Update `web/app/turbo/page.tsx`**

Find (the entire file):

```tsx
import { getAllSpeculativeReports, rankTurboReports } from "@/lib/speculative";
import { getTurboRankingChanges } from "@/lib/ranking-history";
import { TurboContent } from "./TurboContent";

export const dynamic = "force-dynamic";

export default function TurboPage() {
  const ranked = rankTurboReports(getAllSpeculativeReports());
  const rankChanges = getTurboRankingChanges();
  return <TurboContent ranked={ranked} rankChanges={rankChanges} />;
}
```

Replace with:

```tsx
import { getAllSpeculativeReports, rankTurboReports } from "@/lib/speculative";
import { getTurboRankingChanges } from "@/lib/ranking-history";
import { getAllDcaReports } from "@/lib/dca";
import { getAllReports } from "@/lib/reports";
import { formatSiteLastUpdated, getSiteLastUpdatedIso } from "@/lib/site-meta";
import { TurboContent } from "./TurboContent";

export const dynamic = "force-dynamic";

export default function TurboPage() {
  const ranked = rankTurboReports(getAllSpeculativeReports());
  const rankChanges = getTurboRankingChanges();
  const dashboardCounts = {
    dca: getAllDcaReports().length,
    catalyst: getAllReports().length,
    turbo: getAllSpeculativeReports().length,
  };
  return (
    <TurboContent
      ranked={ranked}
      rankChanges={rankChanges}
      dashboardCounts={dashboardCounts}
      lastUpdated={formatSiteLastUpdated(getSiteLastUpdatedIso())}
    />
  );
}
```

- [ ] **Step 2: Import `DashboardSwitcher` in `TurboContent.tsx`**

Find:

```tsx
import { TurboCard } from "./TurboCard";
import { RankingChangeTable } from "../RankingChangeTable";
import { useLang } from "@/lib/LanguageContext";
import type { rankTurboReports } from "@/lib/speculative";
import type { RankChange } from "@/lib/ranking-history";
```

Replace with:

```tsx
import { TurboCard } from "./TurboCard";
import { DashboardSwitcher } from "../DashboardSwitcher";
import { RankingChangeTable } from "../RankingChangeTable";
import { useLang } from "@/lib/LanguageContext";
import type { rankTurboReports } from "@/lib/speculative";
import type { RankChange } from "@/lib/ranking-history";
```

- [ ] **Step 3: Accept the two new props**

Find:

```tsx
export function TurboContent({ ranked, rankChanges = [] }: { ranked: Ranked; rankChanges?: RankChange[] }) {
```

Replace with:

```tsx
export function TurboContent({
  ranked,
  rankChanges = [],
  dashboardCounts,
  lastUpdated,
}: {
  ranked: Ranked;
  rankChanges?: RankChange[];
  dashboardCounts: { dca: number; catalyst: number; turbo: number };
  lastUpdated: string;
}) {
```

- [ ] **Step 4: Render the switcher above the existing hero header**

Find:

```tsx
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ── Hero header ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
```

Replace with:

```tsx
      <div style={{ position: "relative", zIndex: 1 }}>

        <DashboardSwitcher active="turbo" counts={dashboardCounts} lastUpdated={lastUpdated} />

        {/* ── Hero header ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
```

- [ ] **Step 5: Retune the stats grid (minmax 110→120, value font-size 17→18)**

Find:

```tsx
          {displayed.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: 8, marginBottom: 20,
            }}>
              {statsItems.map(({ label, value, color }) => (
                <div key={label} style={{
                  background: "#0e0508",
                  border: "1px solid #2d1010",
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{
                    fontSize: 9, color: "#4d2020", textTransform: "uppercase",
                    letterSpacing: "1px", marginBottom: 4,
                    fontFamily: "var(--font-mono, monospace)",
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: 17, fontWeight: 800, color,
                    fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px",
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          )}
```

Replace with:

```tsx
          {displayed.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 8, marginBottom: 20,
            }}>
              {statsItems.map(({ label, value, color }) => (
                <div key={label} style={{
                  background: "#0e0508",
                  border: "1px solid #2d1010",
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{
                    fontSize: 9, color: "#4d2020", textTransform: "uppercase",
                    letterSpacing: "1px", marginBottom: 4,
                    fontFamily: "var(--font-mono, monospace)",
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: 18, fontWeight: 800, color,
                    fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px",
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          )}
```

- [ ] **Step 6: Retune the card grid (minmax 280→300)**

Find:

```tsx
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {displayed.map((r) => (
```

Replace with:

```tsx
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}>
            {displayed.map((r) => (
```

- [ ] **Step 7: Trim the sort-tag copy to match the mockup (parity with Task 3's Catalyst trim)**

Find:

```tsx
              <span style={{
                fontSize: 11, padding: "4px 12px", borderRadius: 8,
                background: "#13050a", color: "#4d2020",
                border: "1px solid #2d1010", fontWeight: 800,
                fontFamily: "var(--font-mono, monospace)",
              }}>
                {th ? "เรียงตาม: 🔥 upside มากสุด (bull %)" : "sorted: 🔥 most potential up (bull %)"}
              </span>
```

Replace with:

```tsx
              <span style={{
                fontSize: 11, padding: "4px 12px", borderRadius: 8,
                background: "#13050a", color: "#4d2020",
                border: "1px solid #2d1010", fontWeight: 800,
                fontFamily: "var(--font-mono, monospace)",
              }}>
                {th ? "เรียงตาม: 🔥 upside มากสุด" : "sorted: 🔥 most upside"}
              </span>
```

- [ ] **Step 8: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 9: Manual check**

In the dev server, load `/turbo`, confirm the switcher appears above the existing hero,
the Turbo pill is highlighted (`on-fire` gradient), DCA/Catalyst pills navigate
correctly, and the sort tag now reads "sorted: 🔥 most upside" (no "(bull %)" suffix).

- [ ] **Step 10: Commit**

```bash
git add web/app/turbo/page.tsx web/app/turbo/TurboContent.tsx
git commit -m "feat: wire dashboard switcher into Turbo, retune stats/grid/copy"
```

---

## Task 5: Retune `StockCard` surface tokens for theme consistency

**Files:**
- Modify: `web/app/StockCard.tsx`

**Interfaces:**
- Consumes: the `--surface`/`--brd` CSS custom properties already defined by the
  `.theme-air` wrapper class in `globals.css` (`CatalystContent.tsx` already wraps its
  content in `<div className="theme-air">`, so these variables are already in scope
  wherever `StockCard` renders).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Retune the card container's background/border**

Find:

```tsx
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderTop: `2px solid ${verdictColor}`,
          borderRadius: 14,
          padding: "18px 20px",
          cursor: "pointer",
          transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
          position: "relative",
          overflow: "hidden",
          height: "100%",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = verdictColor;
          el.style.transform = "translateY(-3px)";
          el.style.boxShadow = `0 8px 32px ${verdictColor}20, 0 2px 8px rgba(0,0,0,0.5)`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "var(--border)";
          el.style.borderTopColor = verdictColor;
          el.style.transform = "translateY(0)";
          el.style.boxShadow = "none";
        }}
      >
```

Replace with:

```tsx
      <div
        style={{
          background: "var(--surface, var(--card))",
          border: "1px solid var(--brd, var(--border))",
          borderTop: `2px solid ${verdictColor}`,
          borderRadius: 14,
          padding: "18px 20px",
          cursor: "pointer",
          transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
          position: "relative",
          overflow: "hidden",
          height: "100%",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = verdictColor;
          el.style.transform = "translateY(-3px)";
          el.style.boxShadow = `0 8px 32px ${verdictColor}20, 0 2px 8px rgba(0,0,0,0.5)`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "var(--brd, var(--border))";
          el.style.borderTopColor = verdictColor;
          el.style.transform = "translateY(0)";
          el.style.boxShadow = "none";
        }}
      >
```

Note the `var(--surface, var(--card))` / `var(--brd, var(--border))` fallback form —
`StockCard` is only ever rendered inside `CatalystContent`'s `theme-air` wrapper today,
but this fallback means the component degrades safely to the original global tokens if
it's ever rendered somewhere without a `.theme-*` ancestor, rather than resolving to an
invalid empty value.

- [ ] **Step 2: Retune the price-bar's current-price dot to match the new surface**

Find:

```tsx
        {/* Current price dot */}
        <div style={{
          position: "absolute", left: `${curPct}%`, top: "50%",
          width: 10, height: 10, borderRadius: "50%",
          background: verdictColor, border: "2px solid var(--card)",
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 8px ${verdictColor}`,
        }} />
```

Replace with:

```tsx
        {/* Current price dot */}
        <div style={{
          position: "absolute", left: `${curPct}%`, top: "50%",
          width: 10, height: 10, borderRadius: "50%",
          background: verdictColor, border: "2px solid var(--surface, var(--card))",
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 8px ${verdictColor}`,
        }} />
```

- [ ] **Step 3: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check**

In the dev server, load `/catalyst` and confirm the cards render with a slightly
different (greener-tinted dark) surface than before, consistent with the DCA/Turbo
cards' theme-tinted surfaces, and that the current-price dot inside each card's price
bar still has a clean cutout ring matching the new card background (no visible seam).

- [ ] **Step 5: Commit**

```bash
git add web/app/StockCard.tsx
git commit -m "style: retune StockCard surface tokens to match theme-air palette"
```

---

## Task 6: Full manual QA pass

**Files:** none modified — verification only.

- [ ] **Step 1: Start the dev server**

Run: `cd web && npm run dev`

- [ ] **Step 2: Walk the design spec's Testing checklist**

For each of `/dca`, `/catalyst`, `/turbo`:
- The mini-hero (LIVE badge + tagline) and 3-pill switcher render above the existing
  per-route hero header.
- The current route's own pill is highlighted with its theme gradient (`on-water`/
  `on-air`/`on-fire`), the other two are plain/muted.
- Each pill's count badge shows a real, non-zero number.
- Clicking each of the other two pills navigates correctly and the switcher re-renders
  with the new active state.
- Stats row values are 18px, tiles are `minmax(120px,...)`.
- Card grids are `minmax(300px,...)`.
- Catalyst's sort tag reads "sorted: catalyst proximity" (no "· conviction").
- Catalyst cards show the retuned surface color; hovering still works (border
  brightens to the verdict color, card lifts).

- [ ] **Step 3: Stop the dev server**

Kill the `npm run dev` process once verification is complete.

- [ ] **Step 4: Mark Phase 3 complete**

No commit needed for this task. Proceed to Phase 4 (Journal login gate restyle).
