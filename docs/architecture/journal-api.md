# Journal API — Architecture Design

> Status: **agreed, not started** · Designed 2026-07-04 · Backlog item #14
> Ops runbook: **`journal-api-deployment.md`** (step-by-step Railway/Vercel/OAuth setup + migration workflow)
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
| Auth (humans) | **OIDC** code flow handled by NestJS → NestJS issues its own **httpOnly session cookie**. The cookie holds a self-signed JWT (`SESSION_SECRET`, payload = `userId` + `exp` ~7–30d) — the browser/JS never receives or stores any token; frontend just calls `GET /auth/me` for the user JSON. Google's `id_token` is verified server-side only and discarded. (Revocation trade-off accepted; add a `sessions` table later if needed.) Multi-provider ready: `auth_identities` table keyed by `(provider, subject)` — Google now, Facebook/Twitter later = add a strategy, zero schema migration. Auto-link identities to an existing user by email **only when the provider asserts `email_verified: true`** (otherwise create a separate account — prevents email-spoof hijack) |
| Auth (scripts) | **Personal access tokens** (PAT, hashed in DB) as `Authorization: Bearer` — Claude's backtest/validator scripts read the journal **from the API**, not local files |
| Authorization | One rule: `trade.user_id === session.user.id`. Role `admin` (owner) gates token issuance + future report sync |
| Access control | **Whitelist mode** (env flag `WHITELIST_MODE`): first OIDC login checks `whitelist` by email → in list = `users.status: active`, not in list = `pending` (waiting-for-invite page). **Subscription-ready:** `plans` + `features` + `plan_features` + `subscriptions` — seed only `free` plan at launch, every user auto-subscribed; guards resolve `user → subscription → plan → plan_features` (`hasFeature(user, 'validator')`, `limitOf(user, 'max_trades')`). Stripe later = fill `external_ref` + webhook, no schema change |
| Database | PostgreSQL. `journal-validation.json` also moves to DB (`trade_validations`) so validator verdicts live beside trades |
| API framework | **NestJS** (owner's strongest stack), lives in `service/` in this repo (monorepo) |
| ORM / migrations | **Prisma** — `schema.prisma` = source of truth · dev: `prisma migrate dev --name <x>` (commit migration files) · prod: Railway **Pre-Deploy Command** = `npx prisma migrate deploy` (deploy halts if migration fails). ⚠️ `prisma` must be in `dependencies`, not devDependencies |
| Hosting | **Railway**: NestJS + Postgres in one project, private network, ~$5–10/mo (Root Directory = `service`). Next.js stays on Vercel (Root Directory = `web`) |
| Domains | **Start with Option B (no custom domain):** Next.js rewrites proxy `/api/journal/*` → Railway URL — browser sees one origin (vercel.app), no CORS, first-party cookies. **Option A (later, with custom domain):** `www.` + `api.` under one apex, `enableCors({origin, credentials: true})`, `SameSite=Lax`. Avoid `SameSite=None` cross-site cookies — Safari/iOS blocks them |
| Reports | Unchanged (git → Vercel). Scripts keep reading `web/data/` locally; only journal I/O switches to HTTP |

Alternatives considered: Supabase (Postgres + built-in auth + RLS — less NestJS work but
less API ownership; can still be swapped in as the Postgres host), Neon (best free
serverless Postgres, but cold starts → needs pooling), Render (free tier with cold starts,
$7/mo warm).

## 3. Architecture

Monorepo layout (both platforms deploy from a subdirectory of this repo):

```
stock-playbook/
├── web/        Next.js  → Vercel  (Root Directory = web)
├── service/    NestJS   → Railway (Root Directory = service)  ← NEW
└── skills/ scripts/ docs/ ...
```

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

## 3.1 Auth flows (mermaid)

**Login (OIDC → stateless JWT session cookie):**

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant V as Next.js (Vercel)<br/>rewrites proxy /api/journal/*
    participant N as NestJS (Railway)
    participant G as Google OIDC
    participant DB as Postgres

    B->>V: GET /api/journal/auth/google
    V->>N: proxy
    N-->>B: 302 redirect ไป Google (client_id, redirect_uri, scope)
    B->>G: login + consent
    G-->>B: 302 กลับ /auth/callback?code=...
    B->>V: GET /api/journal/auth/callback?code
    V->>N: proxy
    N->>G: แลก code → id_token (JWT ของ Google)
    N->>N: verify id_token → อ่าน sub, email, email_verified
    N->>DB: หา auth_identities (provider='google', subject=sub)
    alt ไม่เจอ identity
        N->>DB: เช็ค whitelist(email) → สร้าง users (active/pending) + auth_identities<br/>+ subscription plan 'free'
    end
    N->>N: เซ็น session JWT ของเราเอง (userId, exp) ด้วย SESSION_SECRET<br/>(id_token ของ Google ทิ้ง ไม่ส่งต่อ)
    N-->>B: Set-Cookie: session=<JWT> HttpOnly Secure + 302 กลับหน้าเว็บ
    B->>V: GET /api/journal/auth/me (cookie แนบอัตโนมัติ)
    V->>N: proxy
    N-->>B: { id, email, name, role, plan }
```

**Authenticated requests (browser vs Claude scripts):**

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant S as Claude scripts (Mac)
    participant N as NestJS (Railway)
    participant DB as Postgres

    Note over B,N: ผู้ใช้ปกติ — cookie
    B->>N: CRUD /trades (Cookie: session=<JWT>, ผ่าน Vercel proxy)
    N->>N: verify JWT signature + exp → userId
    N->>DB: query WHERE user_id = userId (ownership guard)
    N-->>B: trades ของตัวเองเท่านั้น

    Note over S,N: scripts — PAT
    S->>N: PUT /trades/:id/validation (Authorization: Bearer <PAT>)
    N->>DB: hash(PAT) → หา api_tokens → userId
    N->>DB: upsert trade_validations
    N-->>S: 200
```

## 4. Schema

```sql
users             (id uuid PK, email text, name text, avatar_url text,
                   role text DEFAULT 'user',
                   status text DEFAULT 'active',  -- active | pending (not whitelisted) | blocked
                   created_at timestamptz)
whitelist         (id uuid PK, email text UNIQUE, note text,
                   invited_by uuid FK→users NULL, created_at timestamptz)
plans             (id text PK,  -- 'free' | 'pro' | ... (seed 'free' only at launch)
                   name text, price_cents int, interval text)
features          (id text PK,  -- 'max_trades' | 'validator' | 'price_alerts' | ...
                   name text, description text)
plan_features     (plan_id text FK→plans, feature_id text FK→features,
                   enabled bool DEFAULT true,
                   limit_value int NULL,  -- numeric features e.g. max_trades = 50
                   PK(plan_id, feature_id))  -- new feature = insert rows, no migration
subscriptions     (id uuid PK, user_id uuid FK→users, plan_id text FK→plans,
                   status text,  -- active | trialing | past_due | canceled
                   current_period_start timestamptz, current_period_end timestamptz,
                   external_ref text,  -- Stripe subscription id (future)
                   created_at timestamptz, updated_at timestamptz)
auth_identities   (id uuid PK, user_id uuid FK→users,
                   provider text,   -- 'google' now; 'facebook' | 'twitter' | ... later, no migration needed
                   subject text,    -- OIDC `sub` claim from that provider
                   email text, created_at timestamptz,
                   UNIQUE(provider, subject))
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

## 4.1 API surface

| Group | Endpoint | Auth | Notes |
|---|---|---|---|
| Auth | `GET /auth/google` → `GET /auth/callback` | — | OIDC code flow, sets session cookie |
| | `GET /auth/me` | cookie | user JSON: `{id, email, name, role, status, plan}` |
| | `POST /auth/logout` | cookie | clear cookie |
| Journal | `GET/POST /trades` · `GET/PATCH/DELETE /trades/:id` | cookie/PAT | ownership guard — own trades only |
| | `POST/DELETE /trades/:id/exits` | cookie/PAT | close/partial-close |
| Validator | `PUT /trades/:id/validation` | PAT | validator skill writes `trade_validations` |
| AI Validate | `POST /journal/validate` · `GET /journal/validate/quota` | cookie | user-triggered Claude API validation (backlog #20) — Sonnet, quota 3/lifetime via `plan_features.ai_validation`, results → `trade_validations` |
| Tokens | `POST /tokens` · `GET /tokens` · `DELETE /tokens/:id` | cookie (admin) | issue/list/revoke PATs |
| Admin | `GET/POST/DELETE /admin/whitelist` | cookie (admin) | manage invite list |
| | `GET /admin/users` · `PATCH /admin/users/:id` | cookie (admin) | list users, set status/role |
| | `GET/POST/PATCH /admin/plans` · `/admin/features` · `/admin/plans/:id/features` | cookie (admin) | manage plans/features/plan_features (Phase 3+, admin UI optional — seed via migration first) |

Feature gating is **not** an endpoint — it's a guard (`hasFeature` / `limitOf` per §2
Access control) applied to Journal routes.

## 5. Phases

**Phase 1 — API + my journal in prod**
NestJS skeleton in `service/` (deployed on Railway) · Postgres + migrations · Google OIDC + sessions · trades/exits
CRUD + ownership guard · import `private/journal.json` as user #1 · point
`web/app/journal/*` at the API (login gate; remove `fs` writes + `isLocal` gate).

**Phase 2 — open to everyone + scripts on API**
Signup with **whitelist mode** (`WHITELIST_MODE` env + `/admin/whitelist` endpoints) ·
seed `free` plan + auto-subscribe on signup · PAT issuance + Bearer guard ·
migrate `scripts/fetch-backtest-prices.mjs` + analyze-journal/validator skill to
`JOURNAL_API_URL`/`JOURNAL_API_TOKEN` · validator PUTs results to `trade_validations` ·
retire `private/journal.json` + `journal-validation.json` (keep as backup export).

**Phase 3 (optional, when needed) — reports queryable**
`reports (ticker, report_date, kind, payload jsonb, UNIQUE(ticker, report_date, kind))` +
admin sync endpoint called from `push-report.sh` after validation. Git stays source of
truth. Do this only when journal↔report joins or data volume demand it.

## 6. Dev & deploy mechanics

**Local dev:** Postgres runs in Docker, NestJS runs on host (hot-reload). `service/docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16
    ports: ["5432:5432"]
    environment: { POSTGRES_USER: radar, POSTGRES_PASSWORD: radar, POSTGRES_DB: journal }
    volumes: [pgdata:/var/lib/postgresql/data]
volumes:
  pgdata:
```

Loop: `docker compose up -d` once → `npm run start:dev` · `.env`:
`DATABASE_URL=postgresql://radar:radar@localhost:5432/journal`

**Railway deploy:** no Dockerfile needed — Railway's **Railpack** builder auto-detects Node
from `package.json` (Root Directory = `service`), runs build + start scripts. Ensure a
`start` script exists (`node dist/main`). Postgres is added as a managed service in the
same Railway project ("+ New → Database → PostgreSQL"); Railway injects `DATABASE_URL`
via reference variable over the private network — same env var name as local, code
unchanged. A custom `Dockerfile` in `service/` overrides Railpack if image control is
ever needed.

**Secrets / env vars** (set as Railway service variables in prod; `.env` git-ignored locally):

| Var | Source |
|---|---|
| `DATABASE_URL` | Railway auto-generates with the Postgres service — reference it as `${{Postgres.DATABASE_URL}}`. Local: the docker-compose creds |
| `SESSION_SECRET` | Self-generated once: `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → OAuth credentials (redirect URI = `https://api.<domain>/auth/callback` + localhost variant) |
| PATs | Generated by our API (`POST /tokens`), only the hash stored; scripts keep the token in local env (`JOURNAL_API_TOKEN`) |

## 7. Risks / gotchas

- **Cookies:** never `SameSite=None` cross-site (Safari/iOS blocks) — use the rewrites proxy (Option B) or same apex domain (Option A); always `Secure` + `HttpOnly`. With Option B the proxy config is:

  ```js
  // web/next.config.js
  async rewrites() {
    return [{ source: "/api/journal/:path*",
              destination: "https://<service>.up.railway.app/:path*" }];
  }
  ```
- **CORS is not security** — it only limits which origins browsers will read responses from; anyone can curl the API. Real protection = auth guards on every route.
- **PAT hygiene:** store only hashes; scripts read token from env, never committed.
- **PII:** storing Google emails → add a minimal privacy note + delete-account endpoint (GDPR/PDPA-lite).
- **Journal page i18n:** `JournalContent.tsx` is also on the i18n backlog (#13) — coordinate to avoid double rework.
- **Earth element (#12 option ก):** if `/journal` becomes the 🌍 Earth feature, this API is its prerequisite — sequence #14 before #12(ก).

---
*Not financial advice · StockPlaybook Research*
