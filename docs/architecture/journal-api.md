# Journal API — Architecture Design

> Status: **agreed, not started** · Designed 2026-07-04 · Backlog item #14
> Goal: take the private local journal public (multi-user, Google login) and move journal
> data to PostgreSQL behind a NestJS API — while leaving the report publish pipeline untouched.

## 1. Context & problem

Today the journal is local-only: `web/lib/journal.ts` reads/writes `private/journal.json`
via `fs` and a Next.js API route. Vercel's production filesystem is **read-only**, so the
journal cannot work on the deployed site at all — multi-user support requires an external
API + database regardless.

Reports (`web/data/reports|dca|speculative/*.json`) are the opposite profile: written only
by Claude via git push (~5–10/day, write-once, 1.4MB total), validated by
`scripts/validate-reports.mjs`, with git history as the audit trail. The git pipeline IS
the CMS. **Decision: journal moves to DB now; reports stay in git** (optional jsonb sync
later — see Phase 3).

## 2. Decisions (summary)

| Topic | Decision |
|---|---|
| Journal visibility | **Private per-user** — each user CRUDs only their own trades. No social features, no likes, no public feed. |
| Auth (humans) | Google **OIDC** code flow handled by NestJS → NestJS issues its own **httpOnly session cookie** |
| Auth (scripts) | **Personal access tokens** (PAT, hashed in DB) as `Authorization: Bearer` — Claude's backtest/validator scripts read the journal **from the API**, not local files |
| Authorization | One rule: `trade.user_id === session.user.id`. Role `admin` (owner) gates token issuance + future report sync |
| Database | PostgreSQL. `journal-validation.json` also moves to DB (`trade_validations`) so validator verdicts live beside trades |
| API framework | **NestJS** (owner's strongest stack) |
| Hosting | **Railway**: NestJS + Postgres in one project, private network, ~$5–10/mo. Next.js stays on Vercel |
| Domains | Same apex for web + API (`www.` / `api.`) so session cookies work without cross-domain pain |
| Reports | Unchanged (git → Vercel). Scripts keep reading `web/data/` locally; only journal I/O switches to HTTP |

Alternatives considered: Supabase (Postgres + built-in auth + RLS — less NestJS work but
less API ownership; can still be swapped in as the Postgres host), Neon (best free
serverless Postgres, but cold starts → needs pooling), Render (free tier with cold starts,
$7/mo warm).

## 3. Architecture

```
Browser ──────────── Next.js on Vercel (public: reports, dashboards — unchanged, build-time JSON)
   │                        │
   │  session cookie        │ /journal page (login-gated)
   ▼                        ▼
NestJS API (api.<domain>, Railway)
   ├─ GET  /auth/google  → Google OIDC → callback → set httpOnly cookie
   ├─ GET  /auth/me
   ├─ CRUD /trades · /trades/:id/exits          (cookie OR PAT)
   ├─ PUT  /trades/:id/validation               (PAT — validator skill)
   ├─ POST /tokens                              (admin — issue PAT)
   └─ PostgreSQL (Railway, private network)

Claude scripts (Mac) ── Bearer PAT ──► same API   (env: JOURNAL_API_URL, JOURNAL_API_TOKEN)
```

## 4. Schema

```sql
users             (id uuid PK, google_sub text UNIQUE, email text, name text,
                   avatar_url text, role text DEFAULT 'user', created_at timestamptz)
trades            (id uuid PK, user_id uuid FK→users, ticker text, catalyst_type text,
                   linked_report_date text,          -- "YYYYMMDD" → web/data/reports/<TICKER>_<DATE>.json
                   entry_price numeric, shares numeric, entry_date date,
                   planned_tp jsonb,                 -- [tp1, tp2, tp3]
                   planned_sl numeric, status text,  -- open | closed
                   realized_pnl numeric, notes text,
                   created_at timestamptz, updated_at timestamptz)
trade_exits       (id uuid PK, trade_id uuid FK→trades, date date, price numeric,
                   shares numeric, note text)
trade_validations (trade_id uuid PK FK→trades, verdict text,  -- HOLD | CUT | WATCH
                   thesis_intact bool, stop_breached bool, at_risk bool,
                   summary text, action text, color text, validated_at timestamptz)
api_tokens        (id uuid PK, user_id uuid FK→users, token_hash text, label text,
                   last_used_at timestamptz, created_at timestamptz)
```

Maps 1:1 from `web/lib/journal-types.ts` (`Trade`, `TradeExit`, `ValidatorResult`).

## 5. Phases

**Phase 1 — API + my journal in prod**
NestJS skeleton (Railway) · Postgres + migrations · Google OIDC + sessions · trades/exits
CRUD + ownership guard · import `private/journal.json` as user #1 · point
`web/app/journal/*` at the API (login gate; remove `fs` writes + `isLocal` gate).

**Phase 2 — open to everyone + scripts on API**
Public signup (any Google account) · PAT issuance + Bearer guard ·
migrate `scripts/fetch-backtest-prices.mjs` + analyze-journal/validator skill to
`JOURNAL_API_URL`/`JOURNAL_API_TOKEN` · validator PUTs results to `trade_validations` ·
retire `private/journal.json` + `journal-validation.json` (keep as backup export).

**Phase 3 (optional, when needed) — reports queryable**
`reports (ticker, report_date, kind, payload jsonb, UNIQUE(ticker, report_date, kind))` +
admin sync endpoint called from `push-report.sh` after validation. Git stays source of
truth. Do this only when journal↔report joins or data volume demand it.

## 6. Risks / gotchas

- **Cookies:** must be same apex domain; set `SameSite=Lax`, `Secure`, `HttpOnly`.
- **PAT hygiene:** store only hashes; scripts read token from env, never committed.
- **PII:** storing Google emails → add a minimal privacy note + delete-account endpoint (GDPR/PDPA-lite).
- **Journal page i18n:** `JournalContent.tsx` is also on the i18n backlog (#13) — coordinate to avoid double rework.
- **Earth element (#12 option ก):** if `/journal` becomes the 🌍 Earth feature, this API is its prerequisite — sequence #14 before #12(ก).

---
*Not financial advice · Stock Radar Research*
