# Code Quality Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce duplication and file size across the codebase by extracting shared constants, merging duplicate components, and splitting the 1061-line JournalContent.tsx into focused sub-components.

**Architecture:** Three layers of cleanup — (1) shared token/util files that eliminate copy-paste constants, (2) a unified Pagination component replacing two near-identical copies, (3) JournalContent split into TradeRow + TradeForm + ExitForm + shared utils so no single file exceeds ~250 lines.

**Tech Stack:** Next.js 14 App Router, TypeScript, inline React styles (no CSS-in-JS library), no test framework.

## Global Constraints

- No new features — only restructure existing code
- Keep all existing exports and props interfaces identical (no consumer changes outside the files being split)
- After every task: `cd web && npx tsc --noEmit` must pass with zero errors
- Do not add any npm dependencies
- File paths are relative to `/Users/nitiponchingthongchai/Documents/cowork/stock-radar-weekly/`

---

### Task 1: Shared color tokens

**Files:**
- Create: `web/lib/ui-tokens.ts`
- Modify: `web/app/StockCard.tsx`
- Modify: `web/app/RankingChangeTable.tsx`
- Modify: `web/app/CatalystCalendar.tsx`
- Modify: `web/app/backtest/BacktestContent.tsx`
- Modify: `web/app/journal/JournalContent.tsx`

**Interfaces:**
- Produces: `VERDICT_COLORS: Record<string, string>` — exported from `web/lib/ui-tokens.ts`

- [ ] **Step 1: Create `web/lib/ui-tokens.ts`**

```typescript
// Shared design tokens — colour maps used across multiple components.
// Import from here instead of redefining per-file.

export const VERDICT_COLORS: Record<string, string> = {
  BUY: "#10b981",
  HOLD: "#f59e0b",
  SELL: "#ef4444",
  SPECULATIVE: "#8b5cf6",
};
```

- [ ] **Step 2: Update StockCard.tsx — replace local definition**

In `web/app/StockCard.tsx`, find and remove:
```typescript
const VERDICT_COLORS: Record<StockReport["verdict"], string> = {
  BUY: "#10b981", HOLD: "#f59e0b", SELL: "#ef4444", SPECULATIVE: "#8b5cf6",
};
```
Replace with import at top of file:
```typescript
import { VERDICT_COLORS } from "@/lib/ui-tokens";
```

- [ ] **Step 3: Update RankingChangeTable.tsx — replace local definition**

In `web/app/RankingChangeTable.tsx`, find and remove:
```typescript
const VERDICT_COLORS: Record<StockReport["verdict"], string> = {
  BUY: "#10b981", HOLD: "#f59e0b", SELL: "#ef4444", SPECULATIVE: "#8b5cf6",
};
```
Replace with import:
```typescript
import { VERDICT_COLORS } from "@/lib/ui-tokens";
```
Also remove the unused `StockReport` import if it was only used for the type annotation on `VERDICT_COLORS`.

- [ ] **Step 4: Update CatalystCalendar.tsx — replace local definition**

In `web/app/CatalystCalendar.tsx`, find and remove:
```typescript
const VERDICT_COLORS: Record<string, string> = {
  BUY: "#10b981", HOLD: "#f59e0b", SELL: "#ef4444", SPECULATIVE: "#8b5cf6",
};
```
Replace with import:
```typescript
import { VERDICT_COLORS } from "@/lib/ui-tokens";
```

- [ ] **Step 5: Update BacktestContent.tsx — replace local definition**

In `web/app/backtest/BacktestContent.tsx`, find and remove:
```typescript
const VERDICT_COLORS: Record<string, string> = {
  BUY: "#10b981", HOLD: "#f59e0b", SELL: "#ef4444", SPECULATIVE: "#8b5cf6",
};
```
Replace with import:
```typescript
import { VERDICT_COLORS } from "@/lib/ui-tokens";
```

- [ ] **Step 6: Update JournalContent.tsx — replace local definition**

In `web/app/journal/JournalContent.tsx`, find and remove:
```typescript
const VERDICT_COLORS: Record<string, string> = {
  BUY: "#10b981", HOLD: "#f59e0b", SELL: "#ef4444", SPECULATIVE: "#8b5cf6",
};
```
Replace with import:
```typescript
import { VERDICT_COLORS } from "@/lib/ui-tokens";
```

- [ ] **Step 7: TypeScript check**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add web/lib/ui-tokens.ts web/app/StockCard.tsx web/app/RankingChangeTable.tsx web/app/CatalystCalendar.tsx web/app/backtest/BacktestContent.tsx web/app/journal/JournalContent.tsx
git commit -m "refactor: extract VERDICT_COLORS to shared ui-tokens"
```

---

### Task 2: Unified Pagination component

**Files:**
- Create: `web/app/ui/Pagination.tsx`
- Modify: `web/app/RankingChangeTable.tsx` — remove local `Pagination`, import shared one
- Modify: `web/app/CatalystCalendar.tsx` — remove local `CalPagination`, import shared one

**Interfaces:**
- Produces: `Pagination` component with props `{ page, totalPages, onPrev, onNext, variant? }`

- [ ] **Step 1: Create `web/app/ui/Pagination.tsx`**

```tsx
interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  /** "table" adds card background + bottom border-radius. Default: "card" */
  variant?: "table" | "card";
}

export function Pagination({ page, totalPages, onPrev, onNext, variant = "card" }: PaginationProps) {
  if (totalPages <= 1) return null;
  const isTable = variant === "table";

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px",
      borderTop: "1px solid var(--border)",
      ...(isTable
        ? { background: "var(--card)", borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }
        : { marginTop: 4 }),
    }}>
      <button
        onClick={onPrev}
        disabled={page === 0}
        style={{
          fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 6,
          border: "1px solid var(--border)",
          background: page === 0 ? "transparent" : "var(--card)",
          color: page === 0 ? "var(--muted)" : "var(--text)",
          cursor: page === 0 ? "default" : "pointer",
          fontFamily: "var(--font-mono, monospace)",
          opacity: page === 0 ? 0.4 : 1,
          transition: "opacity 0.15s",
        }}
      >
        ← Prev
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {Array.from({ length: totalPages }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === page ? 16 : 6, height: 6, borderRadius: 3,
              background: i === page ? "#10b981" : "var(--border)",
              transition: "all 0.2s ease",
            }}
          />
        ))}
      </div>

      <span style={{
        fontSize: 10, color: "var(--muted)",
        fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
      }}>
        {page + 1} / {totalPages}
      </span>

      <button
        onClick={onNext}
        disabled={page >= totalPages - 1}
        style={{
          fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 6,
          border: "1px solid var(--border)",
          background: page >= totalPages - 1 ? "transparent" : "var(--card)",
          color: page >= totalPages - 1 ? "var(--muted)" : "var(--text)",
          cursor: page >= totalPages - 1 ? "default" : "pointer",
          fontFamily: "var(--font-mono, monospace)",
          opacity: page >= totalPages - 1 ? 0.4 : 1,
          transition: "opacity 0.15s",
        }}
      >
        Next →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update RankingChangeTable.tsx**

Remove the entire local `Pagination` function (lines 10–79 in the original).

Add import at top:
```typescript
import { Pagination } from "@/app/ui/Pagination";
```

Change the usage at the bottom of the component from:
```tsx
<Pagination
  page={page}
  totalPages={totalPages}
  onPrev={() => setPage((p) => Math.max(0, p - 1))}
  onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
/>
```
to:
```tsx
<Pagination
  variant="table"
  page={page}
  totalPages={totalPages}
  onPrev={() => setPage((p) => Math.max(0, p - 1))}
  onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
/>
```

- [ ] **Step 3: Update CatalystCalendar.tsx**

Remove the entire local `CalPagination` function (lines 9–75 in the original).

Add import at top:
```typescript
import { Pagination } from "@/app/ui/Pagination";
```

Change `<CalPagination ...>` usages to `<Pagination ...>` (no `variant` needed — default "card" matches the original CalPagination style).

- [ ] **Step 4: TypeScript check**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/app/ui/Pagination.tsx web/app/RankingChangeTable.tsx web/app/CatalystCalendar.tsx
git commit -m "refactor: unify duplicate Pagination components"
```

---

### Task 3: Journal shared utilities

**Files:**
- Create: `web/app/journal/journal-utils.ts`
- Modify: `web/app/journal/JournalContent.tsx` — move utilities out, import from journal-utils

**Interfaces:**
- Produces: `pnlColor`, `fmt$`, `fmtPct`, `newId`, `todayYYYYMMDD`, `emptyTrade`, `CATALYST_TYPES`, `inputStyle` — all exported from `journal-utils.ts`
- Produces: `ReportOption`, `PriceInfo`, `ReportDateOption` interfaces — exported from `journal-utils.ts`

- [ ] **Step 1: Create `web/app/journal/journal-utils.ts`**

```typescript
import type { Trade, CatalystType } from "@/lib/journal-types";

// ── Exported interfaces ───────────────────────────────────────────────────────

export interface ReportOption {
  ticker:       string;
  companyName:  string;
  price:        number;
  tp1:          number;
  tp2:          number;
  tp3:          number;
  tightStop:    number | null;
  reportDate:   string;
  catalystType: string | null;
}

export interface PriceInfo {
  price:        number;
  generatedAt:  string;
  companyName:  string;
  isLive?:      boolean;
  changePct?:   number;
  marketState?: string;
}

export interface ReportDateOption {
  reportDate:   string;
  price:        number;
  tp1:          number;
  tp2:          number;
  tp3:          number;
  tightStop:    number | null;
  catalystType: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const CATALYST_TYPES: CatalystType[] = [
  "earnings_beat", "satellite_launch", "fda_decision", "foundry_validation",
  "delivery_beat", "partnership_win", "product_launch", "regulatory_approval",
  "phase3_readout", "design_win", "macro", "other",
];

export const inputStyle: React.CSSProperties = {
  background: "var(--bg, #0f172a)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "7px 10px", color: "var(--text)",
  fontFamily: "var(--font-mono, monospace)", fontSize: 13,
  outline: "none", width: "100%",
};

// ── Pure utility functions ────────────────────────────────────────────────────

export function todayYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function pnlColor(v: number): string {
  return v > 0 ? "#10b981" : v < 0 ? "#ef4444" : "#64748b";
}

export function fmt$(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? "-" : "+") + "$" + abs;
}

export function fmtPct(v: number): string {
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

export function emptyTrade(): Omit<Trade, "id"> {
  return {
    ticker: "", catalystType: "earnings_beat",
    entryPrice: 0, shares: 0, entryDate: new Date().toISOString().slice(0, 10),
    plannedTP: [0, 0, 0], plannedSL: 0,
    status: "open", exits: [], notes: "",
    linkedReportDate: todayYYYYMMDD(),
  };
}
```

Note: `inputStyle` uses `React.CSSProperties` — add `import React from "react";` or type it as `import type { CSSProperties } from "react"; export const inputStyle: CSSProperties = ...` if the project doesn't have global React in scope.

- [ ] **Step 2: Update JournalContent.tsx — replace local definitions with imports**

Add at the top of `JournalContent.tsx`:
```typescript
import {
  ReportOption, PriceInfo, ReportDateOption,
  CATALYST_TYPES, inputStyle, todayYYYYMMDD, newId,
  pnlColor, fmt$, fmtPct, emptyTrade,
} from "./journal-utils";
```

Remove from `JournalContent.tsx` the now-duplicate declarations:
- `export interface ReportOption { ... }` (lines 10–21)
- `export interface PriceInfo { ... }` (lines 22–29)
- `export interface ReportDateOption { ... }` (lines 831–839)
- `const CATALYST_TYPES = [...]` (lines 87–92)
- `const inputStyle = ...` (lines 174–179)
- `function todayYYYYMMDD() { ... }` (line 81)
- `function newId() { ... }` (lines 110–112)
- `function pnlColor() { ... }` (lines 97–99)
- `function fmt$() { ... }` (lines 101–104)
- `function fmtPct() { ... }` (lines 106–108)
- `function emptyTrade() { ... }` (lines 155–163)

- [ ] **Step 3: TypeScript check**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/journal/journal-utils.ts web/app/journal/JournalContent.tsx
git commit -m "refactor: extract journal shared utilities to journal-utils.ts"
```

---

### Task 4: Extract ExitForm

**Files:**
- Create: `web/app/journal/ExitForm.tsx`
- Modify: `web/app/journal/JournalContent.tsx` — remove ExitForm, import from new file

**Interfaces:**
- Consumes: `Trade`, `TradeExit` from `@/lib/journal-types`; `inputStyle` from `./journal-utils`
- Produces: `ExitForm` component with props `{ trade: Trade; onClose: (updated: Trade) => void }`

- [ ] **Step 1: Create `web/app/journal/ExitForm.tsx`**

Copy lines 396–454 from `JournalContent.tsx` (the ExitForm function) into a new file:

```tsx
"use client";

import { useState } from "react";
import type { Trade, TradeExit } from "@/lib/journal-types";
import { inputStyle } from "./journal-utils";

export function ExitForm({ trade, onClose }: {
  trade: Trade;
  onClose: (updated: Trade) => void;
}) {
  const [price, setPrice] = useState("");
  const [shares, setShares] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const exitedSoFar = trade.exits.reduce((s, e) => s + e.shares, 0);
  const remaining = trade.shares - exitedSoFar;

  function submit() {
    const exit: TradeExit = {
      date, price: parseFloat(price), shares: parseInt(shares), note: note || undefined,
    };
    const newExits = [...trade.exits, exit];
    const totalExited = newExits.reduce((s, e) => s + e.shares, 0);
    const updated: Trade = {
      ...trade,
      exits: newExits,
      status: totalExited >= trade.shares ? "closed" : "open",
      realizedPnL: newExits.reduce((s, e) => s + e.shares * (e.price - trade.entryPrice), 0),
    };
    onClose(updated);
  }
  // … paste the complete JSX return from the original ExitForm exactly as-is …
}
```

Paste the full JSX return block (from `return (` through the closing `);`) verbatim from `JournalContent.tsx` lines 422–454.

- [ ] **Step 2: Update JournalContent.tsx**

Add import:
```typescript
import { ExitForm } from "./ExitForm";
```

Delete the entire `ExitForm` function body from `JournalContent.tsx` (lines 396–454).

- [ ] **Step 3: TypeScript check**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/journal/ExitForm.tsx web/app/journal/JournalContent.tsx
git commit -m "refactor: extract ExitForm to its own file"
```

---

### Task 5: Extract TradeForm

**Files:**
- Create: `web/app/journal/TradeForm.tsx`
- Modify: `web/app/journal/JournalContent.tsx` — remove TradeForm, import from new file

**Interfaces:**
- Consumes: `Trade`, `CatalystType` from `@/lib/journal-types`; `ReportOption`, `ReportDateOption`, `CATALYST_TYPES`, `inputStyle`, `emptyTrade`, `newId` from `./journal-utils`
- Produces: `TradeForm` component with props `{ initial?: Trade; reportOptions: ReportOption[]; reportsByTicker: Record<string, ReportDateOption[]>; onSave: (t: Trade) => void; onCancel: () => void }`

- [ ] **Step 1: Create `web/app/journal/TradeForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Trade, CatalystType } from "@/lib/journal-types";
import {
  ReportOption, ReportDateOption,
  CATALYST_TYPES, inputStyle, emptyTrade, newId,
} from "./journal-utils";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)" }}>{label}</span>
      {children}
    </label>
  );
}

export function TradeForm({ initial, reportOptions, reportsByTicker, onSave, onCancel }: {
  initial?: Trade;
  reportOptions: ReportOption[];
  reportsByTicker: Record<string, ReportDateOption[]>;
  onSave: (t: Trade) => void;
  onCancel: () => void;
}) {
  // … paste the complete TradeForm function body verbatim from JournalContent.tsx lines 181–395 …
}
```

Paste the complete body of `TradeForm` from `JournalContent.tsx` lines 188–395 (everything from `const [t, setT]` through the closing `}` of the function) verbatim.

Also copy `Field` (lines 165–172) and `inputStyle` usage is imported from `journal-utils`.

- [ ] **Step 2: Update JournalContent.tsx**

Add import:
```typescript
import { TradeForm } from "./TradeForm";
```

Delete from `JournalContent.tsx`:
- The `Field` function (lines 165–172)
- The `TradeForm` function (lines 181–395)

- [ ] **Step 3: TypeScript check**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/journal/TradeForm.tsx web/app/journal/JournalContent.tsx
git commit -m "refactor: extract TradeForm to its own file"
```

---

### Task 6: Extract TradeRow

**Files:**
- Create: `web/app/journal/TradeRow.tsx`
- Modify: `web/app/journal/JournalContent.tsx` — remove TradeRow, import from new file

**Interfaces:**
- Consumes: `Trade` from `@/lib/journal-types`; `PriceInfo` from `./journal-utils`; `VERDICT_COLORS` from `@/lib/ui-tokens`; `CATALYST_TYPES`, `pnlColor`, `fmt$`, `fmtPct` from `./journal-utils`; `ExitForm` from `./ExitForm`; `calcPnL`, `holdDays` from `@/lib/journal-math`
- Produces: `TradeRow` component with props `{ trade: Trade; priceInfo: PriceInfo | null; onEdit: () => void; onDelete: () => void; onSaveExit: (updated: Trade) => void }`

- [ ] **Step 1: Create `web/app/journal/TradeRow.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { Trade } from "@/lib/journal-types";
import { realizedPnL as calcPnL, holdDays } from "@/lib/journal-math";
import { VERDICT_COLORS } from "@/lib/ui-tokens";
import { PriceInfo, CATALYST_TYPES, pnlColor, fmt$, fmtPct } from "./journal-utils";
import { ExitForm } from "./ExitForm";

// ── Position state ────────────────────────────────────────────────────────────

type PositionState =
  | "STOP_LOSS" | "AT_RISK" | "IN_PROGRESS"
  | "TP1_HIT" | "TP2_HIT" | "TP3_HIT" | "UNKNOWN";

function getPositionState(trade: Trade, currentPrice: number | null): PositionState {
  if (currentPrice === null || trade.status === "closed") return "UNKNOWN";
  const { plannedSL, plannedTP, entryPrice } = trade;
  const [tp1, tp2, tp3] = plannedTP;
  if (tp3 > 0 && currentPrice >= tp3) return "TP3_HIT";
  if (tp2 > 0 && currentPrice >= tp2) return "TP2_HIT";
  if (tp1 > 0 && currentPrice >= tp1) return "TP1_HIT";
  if (plannedSL > 0 && currentPrice <= plannedSL) return "STOP_LOSS";
  if (plannedSL > 0 && entryPrice > 0 && currentPrice <= plannedSL * 1.03) return "AT_RISK";
  return "IN_PROGRESS";
}

const STATE_META: Record<PositionState, { label: string; color: string; bg: string; icon: string }> = {
  STOP_LOSS:   { label: "STOP LOSS", color: "#ef4444", bg: "#ef444418", icon: "🚨" },
  AT_RISK:     { label: "AT RISK",   color: "#f59e0b", bg: "#f59e0b15", icon: "⚠️" },
  IN_PROGRESS: { label: "OPEN",      color: "#3b82f6", bg: "#3b82f615", icon: "🔵" },
  TP1_HIT:     { label: "TP1 HIT",  color: "#10b981", bg: "#10b98115", icon: "🟢" },
  TP2_HIT:     { label: "TP2 HIT",  color: "#10b981", bg: "#10b98120", icon: "🟢" },
  TP3_HIT:     { label: "TP3 🌙",   color: "#8b5cf6", bg: "#8b5cf618", icon: "🌙" },
  UNKNOWN:     { label: "",          color: "var(--muted)", bg: "transparent", icon: "" },
};

function priceStaleness(info: PriceInfo): { label: string; color: string } {
  if (info.isLive) {
    const state = info.marketState ?? "REGULAR";
    const stateLabel = state === "REGULAR" ? "market open" : state === "PRE" ? "pre-market" : state === "POST" ? "after hours" : "delayed";
    return { label: `LIVE · ${stateLabel}`, color: "#10b981" };
  }
  const diffMs   = Date.now() - new Date(info.generatedAt).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const d        = new Date(info.generatedAt);
  const dateStr  = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diffDays < 1)  return { label: `from report · today · ${dateStr}`,        color: "#10b981" };
  if (diffDays < 2)  return { label: `from report · 1 day ago · ${dateStr}`,    color: "#10b981" };
  if (diffDays < 4)  return { label: `from report · ${Math.floor(diffDays)}d ago · ${dateStr}`, color: "#f59e0b" };
  return              { label: `from report · ${Math.floor(diffDays)}d ago · ${dateStr} ⚠️`,     color: "#ef4444" };
}

export function TradeRow({ trade, priceInfo, onEdit, onDelete, onSaveExit }: {
  trade: Trade;
  priceInfo: PriceInfo | null;
  onEdit: () => void;
  onDelete: () => void;
  onSaveExit: (updated: Trade) => void;
}) {
  // … paste the complete TradeRow function body verbatim from JournalContent.tsx lines 462–829 …
}
```

Paste lines 462–829 of `JournalContent.tsx` (everything from `const [expanded, setExpanded]` through the closing `}`) verbatim into the function body.

- [ ] **Step 2: Update JournalContent.tsx**

Add import:
```typescript
import { TradeRow } from "./TradeRow";
```

Delete from `JournalContent.tsx`:
- `type PositionState` (lines 33–41)
- `getPositionState()` function (lines 42–53)
- `STATE_META` constant (lines 55–63)
- `priceStaleness()` function (lines 65–79)
- The `TradeRow` function (lines 455–829)

At this point `JournalContent.tsx` should be under 300 lines.

- [ ] **Step 3: TypeScript check**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/journal/TradeRow.tsx web/app/journal/JournalContent.tsx
git commit -m "refactor: extract TradeRow to its own file"
```

---

### Task 7: CSS utility class for mono-label pattern

The pattern `fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono)"` appears 20+ times. Add a CSS class so new code can use it, and apply it to the Pagination component.

**Files:**
- Modify: `web/app/globals.css`
- Modify: `web/app/ui/Pagination.tsx` — use className for the page counter span

- [ ] **Step 1: Add utility class to globals.css**

Append to `web/app/globals.css`:
```css
/* ─── Utility classes for repeated inline-style patterns ──────────────────── */

/* Mono label: the 9px uppercase tracking label used for stats/section headers */
.srw-mono-label {
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Mono button: used for pagination / small action buttons */
.srw-mono-btn {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 800;
  border-radius: 6px;
  border: 1px solid var(--border);
  padding: 4px 12px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.srw-mono-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
```

- [ ] **Step 2: Apply to Pagination.tsx**

Update `web/app/ui/Pagination.tsx` page counter `<span>` to use `className`:
```tsx
<span className="srw-mono-label" style={{ color: "var(--muted)" }}>
  {page + 1} / {totalPages}
</span>
```

- [ ] **Step 3: TypeScript check**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css web/app/ui/Pagination.tsx
git commit -m "refactor: add srw-mono-label CSS utility class"
```

---

## Final verification

After all tasks are complete:

- [ ] Run `cd web && npx tsc --noEmit` — zero errors
- [ ] Start dev server: `npm run dev` in `web/`
- [ ] Open `http://localhost:3000` — landing page renders
- [ ] Open `http://localhost:3000/catalyst` — Catalyst Calendar renders with pagination
- [ ] Open `http://localhost:3000/dca` — Ranking Change table renders with pagination
- [ ] Open `http://localhost:3000/journal` — Journal renders, trade form opens, trade row expands
- [ ] Check file sizes: `wc -l web/app/journal/JournalContent.tsx` should be under 300 lines

## Result: file size improvement

| File | Before | After |
|------|--------|-------|
| `JournalContent.tsx` | 1061 lines | ~250 lines |
| `RankingChangeTable.tsx` | 268 lines | ~190 lines |
| `CatalystCalendar.tsx` | 315 lines | ~245 lines |
| New: `TradeRow.tsx` | — | ~380 lines |
| New: `TradeForm.tsx` | — | ~220 lines |
| New: `ExitForm.tsx` | — | ~60 lines |
| New: `journal-utils.ts` | — | ~70 lines |
| New: `ui-tokens.ts` | — | ~10 lines |
| New: `ui/Pagination.tsx` | — | ~65 lines |
