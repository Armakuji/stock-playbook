# Journal API — Deployment Guide

> Companion to `journal-api.md` (design/spec). This is the step-by-step ops runbook:
> follow top-to-bottom for first deploy, then only §6 for day-to-day changes.

## 0. Prerequisites (one-time, human tasks)

- [ ] Railway account (Hobby plan, $5/mo)
- [ ] Google Cloud Console project → OAuth 2.0 Client ID (see §2)
- [ ] `SESSION_SECRET` generated: `openssl rand -base64 32` — stored in **Railway Variables** (prod) + `service/.env` gitignored (local, use a different value). No GitHub Secrets needed (no CI deploy — Railway injects its own vars). If lost: regenerate → all sessions invalid → users just re-login, nothing breaks.
- [ ] Repo pushed to GitHub (Railway deploys from GitHub)

## 1. Local dev setup

```bash
cd service
docker compose up -d          # Postgres 16 on localhost:5432 (see docker-compose.yml)
cp .env.example .env          # DATABASE_URL=postgresql://radar:radar@localhost:5432/journal
npx prisma migrate dev        # apply migrations to local DB + generate client
npm run start:dev             # NestJS with hot-reload on :4000
```

Frontend dev: `web/` already proxies `/api/journal/*` — point the rewrite destination at
`http://localhost:4000` via env (`JOURNAL_API_ORIGIN`) so local web talks to local API.

**Local login:** works with real Google — the OAuth client registers
`http://localhost:3000/api/journal/auth/callback` (§2, routed through the `web/` rewrite proxy,
**not** `:4000` directly — see the cookie-domain note below), Google always allows localhost
without HTTPS.

`service/.env` (gitignored — commit `service/.env.example` with these keys as the template):

```bash
DATABASE_URL=postgresql://radar:radar@localhost:5432/journal
SESSION_SECRET=            # openssl rand -base64 32 — dev value, different from prod
GOOGLE_CLIENT_ID=          # same OAuth client as prod is fine
GOOGLE_CLIENT_SECRET=
WEB_ORIGIN=http://localhost:3000
PORT=4000
```

**Why the redirect_uri must go through the proxy, not straight to `:4000`:** the OAuth
`redirect_uri` NestJS registers with Google is built from `WEB_ORIGIN` (`${WEB_ORIGIN}/api/journal/auth/callback`),
so Google always redirects the browser back to the **web app's own origin** first — the
`web/` rewrite then forwards that request server-side to the API. This means the API's
`Set-Cookie: session=...` response is relayed back to the browser as if it came from the web
app's own host, so the cookie is first-party there. If `redirect_uri` pointed straight at the
API's own origin instead (`:4000` locally, the raw Railway URL in prod), Google would redirect
the browser directly to the API — the session cookie would then be scoped to the **API's**
host, and the browser would never send it back on requests to the web app. This bit us for
real in prod (Railway ≠ Vercel, two different hosts — no cookie-sharing quirk to save it);
locally it's less visible because `localhost` cookies happen to be host-scoped but
**not port-scoped**, so a cookie set by `:4000` directly would still (confusingly) show up on
`:3000` — do not rely on that quirk, always route the callback through the proxy so local
dev matches prod topology. `Secure` cookies are fine over local `http://` because browsers
treat `localhost` as a secure context. Dev uses **real Google login** (no dev-login bypass —
decided against it so local always tests the true OIDC flow).

## 2. Google OAuth client (one-time)

Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID (Web)**:

- Authorized redirect URIs (always the **web app's** origin + `/api/journal/auth/callback` —
  routed through the rewrite proxy — never the Railway/`:4000` origin directly, see §1):
  - `https://<your-vercel-domain>/api/journal/auth/callback` (prod)
  - `http://localhost:3000/api/journal/auth/callback` (dev)
- Copy **Client ID** + **Client Secret** → used in §3 and local `.env`.
- OAuth consent screen: External, scopes = `openid email profile` only.

## 3. Railway project setup (one-time)

1. **New Project** → **Deploy from GitHub repo** → pick this repo.
2. Service settings:
   - **Root Directory** = `service`
   - **Pre-Deploy Command** = `npx prisma migrate deploy`  ← migrations run here, every deploy
   - Start command: auto (`npm start` → `node dist/main`)
3. **+ New → Database → PostgreSQL** (same project — Railway generates all credentials).
4. Service **Variables**:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference variable) |
   | `SESSION_SECRET` | from §0 |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from §2 |
   | `WEB_ORIGIN` | `https://stockplaybook.app` (used to build the OAuth `redirect_uri` so it routes through the proxy, and for the post-login redirect-back) |

5. **Networking** → Generate public domain → note `https://<service>.up.railway.app`.

⚠️ `package.json` requirements (or pre-deploy fails):
- `prisma` + `@prisma/client` in **`dependencies`** (NOT devDependencies — Railway prunes devDeps)
- `"start": "node dist/main"` script present

## 4. Vercel side (one-time)

`web/next.config.js` rewrites proxy (Option B — no CORS, first-party cookies):

```js
async rewrites() {
  return [{ source: "/api/journal/:path*",
            destination: `${process.env.JOURNAL_API_ORIGIN}/:path*` }];
}
```

Vercel project → Environment Variables → `JOURNAL_API_ORIGIN=https://<service>.up.railway.app`
(local `.env.local`: `JOURNAL_API_ORIGIN=http://localhost:4000`).

## 5. First deploy checklist

- [ ] `git push origin main` → Railway builds (Railpack) → pre-deploy runs migrations → starts
- [ ] `curl https://<service>.up.railway.app/health` → 200
- [ ] Login flow works end-to-end from the Vercel site (Google → callback → cookie → `/auth/me`)
- [ ] Import `private/journal.json` as user #1 (one-off seed script: `npm run seed:import`)
- [ ] Issue first PAT (`POST /tokens`) → save as `JOURNAL_API_TOKEN` in local env for Claude scripts

## 6. Day-to-day: schema changes & deploys

```bash
# 1. edit service/prisma/schema.prisma
npx prisma migrate dev --name add_something   # gen SQL + apply locally + regen client
# 2. commit prisma/migrations/** together with code that uses it
git add -A && git commit && git push
# 3. Railway: build → pre-deploy applies the new migration → start. No manual steps.
```

Rules:
- **Never edit an already-pushed migration file** — always create a new one.
- Migration fails on Railway → deploy halts, old version keeps running (safe). Fix forward
  with a new migration; `prisma migrate resolve` only for repairing history.
- Plain code change (no schema) → just push; pre-deploy is a fast no-op.

## 7. Rollback / recovery

- **App rollback:** Railway dashboard → Deployments → Redeploy previous build.
- **DB:** Railway Postgres has backups (verify retention on current plan); before risky
  migrations run a manual `pg_dump` first.
- **Migration half-applied:** `npx prisma migrate resolve --rolled-back <name>` then fix forward.

---
*Not financial advice · StockPlaybook Research*
