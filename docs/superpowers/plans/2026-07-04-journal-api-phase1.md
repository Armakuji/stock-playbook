# Journal API — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the NestJS + Postgres Journal API in `service/`, get Google OIDC login + session cookies + trades/exits CRUD working end-to-end, import the existing local `private/journal.json` as user #1, and point `web/app/journal/*` at the API instead of the local filesystem — so the journal actually works on the deployed (read-only-filesystem) Vercel site.

**Architecture:** NestJS app in `service/` (own `package.json`, deploys to Railway per the runbook) talks to Postgres via Prisma. Auth is Google OIDC code flow handled entirely server-side: NestJS exchanges the code, verifies the id_token, and issues its own httpOnly session cookie (a JWT signed with `SESSION_SECRET`) — the browser never sees Google's token. `web/` gets a Next.js rewrite (`/api/journal/*` → the NestJS origin) so the browser only ever talks to one origin (no CORS, first-party cookies), and `web/app/journal/page.tsx` becomes an async Server Component that forwards the session cookie to the API instead of reading `private/journal.json` off disk.

**Tech Stack:** NestJS 11, Prisma 6 + PostgreSQL 16, `google-auth-library` (OIDC code exchange + id_token verification), `jsonwebtoken` (session cookie), `class-validator`/`class-transformer` (DTOs), Jest (unit tests), Next.js 16 (App Router, Server Components).

## Global Constraints

- `prisma` and `@prisma/client` **must** be in `dependencies`, not `devDependencies` (Railway prunes devDeps before the pre-deploy migrate step) — per `docs/architecture/journal-api-deployment.md` §3.
- `service/package.json` must have a `"start": "node dist/main"` script (Railway's default start command).
- NestJS routes live at the API root (`/auth/*`, `/trades/*`, `/health`) — no global prefix — because the Next.js rewrite already scopes them under `/api/journal/*` on the browser side.
- Cookies: `httpOnly`, `Secure`, `SameSite=Lax`, never `SameSite=None` (Safari/iOS blocks it) — per architecture doc §7.
- Never edit an already-applied/pushed Prisma migration file — always add a new one (architecture doc §6 day-to-day rules).
- Phase 1 scope only: `users`, `auth_identities`, `trades`, `trade_exits` tables. **Do not** add `whitelist`, `plans`, `features`, `plan_features`, `subscriptions`, `api_tokens`, or `trade_validations` — those are Phase 2/3 per `docs/architecture/journal-api.md` §5 and have no consumer yet in Phase 1.
- No PAT/Bearer auth, no `/admin/*` routes, no whitelist gating in Phase 1 — first Google login always succeeds (single owner import), matching the Phase 1 bullet in §5 ("Google OIDC + sessions · trades/exits CRUD + ownership guard").
- Ownership rule everywhere: `trade.userId === session.userId`. A mismatch or missing trade returns 404, never 403 (don't leak existence).
- `service/.env` is already filled in (DATABASE_URL, SESSION_SECRET, GOOGLE_CLIENT_ID/SECRET, WEB_ORIGIN, PORT) — this plan adds one new var, `API_ORIGIN` (needed to build the OAuth `redirect_uri` — not in the original doc's env table, flagged here since it must also be added to Railway variables at deploy time).
- Money/shares fields stay plain JS `number` (Prisma `Float`), matching the existing local JSON model in `web/lib/journal-math.ts` — do not introduce `Decimal`.
- `Trade.id` is `String @id @default(uuid())` with **no** `@db.Uuid` — the seed import must preserve legacy non-UUID slug IDs (e.g. `"mqo1lokf25w6"`) from `private/journal.json` verbatim.

---

## File Structure

```
service/
├── package.json                          NEW — NestJS app manifest
├── tsconfig.json / tsconfig.build.json   NEW
├── nest-cli.json                         NEW
├── docker-compose.yml                    NEW — local Postgres 16
├── .env.example                          MODIFY — add API_ORIGIN
├── prisma/
│   └── schema.prisma                     NEW — User, AuthIdentity, Trade, TradeExit
├── scripts/
│   └── seed-import.ts                    NEW — imports private/journal.json as user #1
└── src/
    ├── main.ts                           NEW — bootstrap, cookie-parser, ValidationPipe
    ├── app.module.ts                     NEW
    ├── health/health.controller.ts       NEW — GET /health
    ├── prisma/prisma.service.ts          NEW
    ├── prisma/prisma.module.ts           NEW
    ├── auth/
    │   ├── session.util.ts               NEW — sign/verify session JWT
    │   ├── session.guard.ts              NEW — cookie auth guard
    │   ├── current-user.decorator.ts     NEW
    │   ├── google-oauth.client.ts        NEW — OIDC code flow wrapper
    │   ├── auth.service.ts               NEW — findOrCreateUserFromGoogle
    │   ├── auth.controller.ts            NEW — /auth/google, /callback, /me, /logout
    │   └── auth.module.ts                NEW
    └── trades/
        ├── dto/create-trade.dto.ts       NEW
        ├── dto/update-trade.dto.ts       NEW
        ├── dto/create-exit.dto.ts        NEW
        ├── trades.service.ts             NEW — CRUD + ownership + auto-close
        ├── trades.controller.ts          NEW
        └── trades.module.ts              NEW

web/
├── next.config.ts                        MODIFY — add rewrites
├── .env.local                            MODIFY — JOURNAL_API_ORIGIN (dev only, gitignored)
├── lib/journal.ts                        DELETE — fs-based, replaced by API
├── app/journal/
│   ├── page.tsx                          MODIFY — SSR fetch from API, login gate
│   ├── LoginGate.tsx                     NEW — "log in with Google" screen
│   ├── JournalContent.tsx                MODIFY — apiCreate/apiUpdate/apiAddExit/apiDelete
│   └── api/route.ts                      DELETE — replaced by NestJS API via rewrite
├── app/Header.tsx                        MODIFY — remove isLocal gate (2 spots)
├── app/Landing.tsx                       MODIFY — remove isLocal gate
├── app/layout.tsx                        MODIFY — stop passing isLocal to Header
└── app/page.tsx                          MODIFY — stop passing isLocal to Landing
```

---

### Task 1: Scaffold the NestJS app skeleton

**Files:**
- Create: `service/package.json`, `service/tsconfig.json`, `service/tsconfig.build.json`, `service/nest-cli.json`
- Create: `service/src/main.ts`, `service/src/app.module.ts`, `service/src/health/health.controller.ts`
- Test: manual (`curl`) — no unit test framework wired yet, that comes with Task 5

**Interfaces:**
- Produces: a bootable Nest app listening on `process.env.PORT ?? 4000`, `GET /health` → `{ ok: true }`.

- [ ] **Step 1: Write `service/package.json`**

```json
{
  "name": "journal-api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "test": "jest",
    "seed:import": "ts-node scripts/seed-import.ts"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/mapped-types": "^2.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@prisma/client": "^6.0.0",
    "prisma": "^6.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "cookie-parser": "^1.4.7",
    "google-auth-library": "^9.14.0",
    "jsonwebtoken": "^9.0.2",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/cookie-parser": "^1.4.7",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Write `service/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": false
  }
}
```

- [ ] **Step 3: Write `service/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts", "scripts"]
}
```

- [ ] **Step 4: Write `service/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": { "deleteOutDir": true }
}
```

- [ ] **Step 5: Write `service/src/health/health.controller.ts`**

```typescript
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { ok: true };
  }
}
```

- [ ] **Step 6: Write `service/src/app.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 7: Write `service/src/main.ts`**

```typescript
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
}
bootstrap();
```

- [ ] **Step 8: Install dependencies**

Run: `cd service && npm install`
Expected: installs cleanly, creates `service/package-lock.json` and `service/node_modules`.

- [ ] **Step 9: Boot the app and verify health check**

Run: `cd service && npm run start:dev` (leave running), in another shell: `curl -s localhost:4000/health`
Expected: `{"ok":true}`

- [ ] **Step 10: Commit**

```bash
git add service/package.json service/tsconfig.json service/tsconfig.build.json service/nest-cli.json service/src/main.ts service/src/app.module.ts service/src/health/health.controller.ts
git commit -m "service: scaffold NestJS app skeleton with health check"
```

---

### Task 2: Prisma schema (Phase 1 tables) + client generation

**Files:**
- Create: `service/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma models `User`, `AuthIdentity`, `Trade`, `TradeExit` and a generated `@prisma/client` — consumed by every later task via `PrismaService`.

- [ ] **Step 1: Write `service/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id             String         @id @default(uuid())
  email          String         @unique
  name           String?
  avatarUrl      String?        @map("avatar_url")
  role           String         @default("user")
  status         String         @default("active")
  createdAt      DateTime       @default(now()) @map("created_at")
  authIdentities AuthIdentity[]
  trades         Trade[]

  @@map("users")
}

model AuthIdentity {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id])
  provider  String
  subject   String
  email     String
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([provider, subject])
  @@map("auth_identities")
}

// id is a plain String (not @db.Uuid) so legacy non-UUID slugs imported
// from private/journal.json (e.g. "mqo1lokf25w6") can be inserted verbatim.
model Trade {
  id               String      @id @default(uuid())
  userId           String      @map("user_id")
  user             User        @relation(fields: [userId], references: [id])
  ticker           String
  catalystType     String      @map("catalyst_type")
  linkedReportDate String?     @map("linked_report_date")
  entryPrice       Float       @map("entry_price")
  shares           Float
  entryDate        DateTime    @map("entry_date") @db.Date
  plannedTP        Json        @map("planned_tp")
  plannedSL        Float       @map("planned_sl")
  status           String
  realizedPnL      Float?      @map("realized_pnl")
  notes            String?
  createdAt        DateTime    @default(now()) @map("created_at")
  updatedAt        DateTime    @updatedAt @map("updated_at")
  exits            TradeExit[]

  @@map("trades")
}

model TradeExit {
  id      String   @id @default(uuid())
  tradeId String   @map("trade_id")
  trade   Trade    @relation(fields: [tradeId], references: [id], onDelete: Cascade)
  date    DateTime @db.Date
  price   Float
  shares  Float
  note    String?

  @@map("trade_exits")
}
```

- [ ] **Step 2: Generate the Prisma client (no live DB needed for this step)**

Run: `cd service && npx prisma generate`
Expected: `Generated Prisma Client` message, no errors (this only reads the schema file, doesn't connect to `DATABASE_URL`).

- [ ] **Step 3: Commit**

```bash
git add service/prisma/schema.prisma
git commit -m "service: add Prisma schema for Phase 1 (users, auth_identities, trades, trade_exits)"
```

---

### Task 3: Local Postgres via Docker + first migration

**Blocked on:** Docker Desktop must be installed and running (`docker info` succeeds). If not ready yet, write the files but pause before Step 3.

**Files:**
- Create: `service/docker-compose.yml`
- Create: `service/prisma/migrations/**` (generated)

- [ ] **Step 1: Write `service/docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: radar
      POSTGRES_PASSWORD: radar
      POSTGRES_DB: journal
    volumes: [pgdata:/var/lib/postgresql/data]
volumes:
  pgdata:
```

- [ ] **Step 2: Start Postgres**

Run: `cd service && docker compose up -d`
Expected: `Container service-db-1  Started`. Verify with `docker compose ps` (STATUS should be `running`/`healthy`).

- [ ] **Step 3: Run the first migration**

Run: `cd service && npx prisma migrate dev --name init`
Expected: creates `service/prisma/migrations/<timestamp>_init/migration.sql`, applies it, prints `Your database is now in sync with your schema.`

- [ ] **Step 4: Commit**

```bash
git add service/docker-compose.yml service/prisma/migrations
git commit -m "service: add docker-compose Postgres + initial Prisma migration"
```

---

### Task 4: PrismaService wiring

**Files:**
- Create: `service/src/prisma/prisma.service.ts`, `service/src/prisma/prisma.module.ts`
- Modify: `service/src/app.module.ts:1-10` — import `PrismaModule`

**Interfaces:**
- Produces: `PrismaService` (extends `PrismaClient`), injectable anywhere via `PrismaModule` (`@Global()`).

- [ ] **Step 1: Write `service/src/prisma/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Write `service/src/prisma/prisma.module.ts`**

```typescript
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Modify `service/src/app.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 4: Verify the app still boots (requires Postgres running from Task 3)**

Run: `cd service && npm run start:dev`, then `curl -s localhost:4000/health`
Expected: `{"ok":true}` with no Prisma connection errors in the log.

- [ ] **Step 5: Commit**

```bash
git add service/src/prisma service/src/app.module.ts
git commit -m "service: wire up global PrismaModule"
```

---

### Task 5: Session JWT helpers (sign/verify)

**Files:**
- Create: `service/src/auth/session.util.ts`
- Test: `service/src/auth/session.util.spec.ts`

**Interfaces:**
- Produces: `signSession(payload: SessionPayload, secret: string): string`, `verifySession(token: string, secret: string): SessionPayload`, `interface SessionPayload { userId: string }` — consumed by `SessionGuard` (Task 6) and `AuthController` (Task 8).

- [ ] **Step 1: Write the failing test — `service/src/auth/session.util.spec.ts`**

```typescript
import { signSession, verifySession } from "./session.util";

describe("session.util", () => {
  const secret = "test-secret";

  it("round-trips a valid session token", () => {
    const token = signSession({ userId: "user-123" }, secret);
    const payload = verifySession(token, secret);
    expect(payload.userId).toBe("user-123");
  });

  it("throws when the secret doesn't match", () => {
    const token = signSession({ userId: "user-123" }, secret);
    expect(() => verifySession(token, "wrong-secret")).toThrow();
  });

  it("throws on a malformed token", () => {
    expect(() => verifySession("not-a-jwt", secret)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd service && npx jest session.util --no-coverage`
Expected: FAIL — `Cannot find module './session.util'`

- [ ] **Step 3: Write `service/src/auth/session.util.ts`**

```typescript
import jwt from "jsonwebtoken";

export interface SessionPayload {
  userId: string;
}

export function signSession(payload: SessionPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}

export function verifySession(token: string, secret: string): SessionPayload {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === "string" || !("userId" in decoded)) {
    throw new Error("Invalid session payload");
  }
  return { userId: (decoded as SessionPayload).userId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd service && npx jest session.util --no-coverage`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add service/src/auth/session.util.ts service/src/auth/session.util.spec.ts
git commit -m "service: add session JWT sign/verify helpers"
```

---

### Task 6: SessionGuard + CurrentUser decorator

**Files:**
- Create: `service/src/auth/session.guard.ts`, `service/src/auth/current-user.decorator.ts`
- Test: `service/src/auth/session.guard.spec.ts`

**Interfaces:**
- Consumes: `verifySession` from `./session.util` (Task 5).
- Produces: `SessionGuard implements CanActivate` (sets `req.userId`), `CurrentUser` param decorator returning `req.userId: string` — consumed by `AuthController.me` (Task 8) and `TradesController` (Task 10).

- [ ] **Step 1: Write the failing test — `service/src/auth/session.guard.spec.ts`**

```typescript
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SessionGuard } from "./session.guard";
import { signSession } from "./session.util";

function fakeContext(cookies: Record<string, string>): ExecutionContext {
  const req: any = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe("SessionGuard", () => {
  const secret = "test-secret";
  const config = { get: () => secret } as unknown as ConfigService;
  const guard = new SessionGuard(config);

  it("allows a request with a valid session cookie and sets req.userId", () => {
    const token = signSession({ userId: "user-123" }, secret);
    const ctx = fakeContext({ session: token });
    expect(guard.canActivate(ctx)).toBe(true);
    expect((ctx.switchToHttp().getRequest() as any).userId).toBe("user-123");
  });

  it("rejects a request with no session cookie", () => {
    expect(() => guard.canActivate(fakeContext({}))).toThrow(UnauthorizedException);
  });

  it("rejects a request with a tampered session cookie", () => {
    expect(() => guard.canActivate(fakeContext({ session: "garbage" }))).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd service && npx jest session.guard --no-coverage`
Expected: FAIL — `Cannot find module './session.guard'`

- [ ] **Step 3: Write `service/src/auth/session.guard.ts`**

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verifySession } from "./session.util";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const token = req.cookies?.session;
    if (!token) throw new UnauthorizedException("Not logged in");
    try {
      const payload = verifySession(token, this.config.get<string>("SESSION_SECRET")!);
      req.userId = payload.userId;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid session");
    }
  }
}
```

- [ ] **Step 4: Write `service/src/auth/current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return req.userId;
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd service && npx jest session.guard --no-coverage`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add service/src/auth/session.guard.ts service/src/auth/session.guard.spec.ts service/src/auth/current-user.decorator.ts
git commit -m "service: add SessionGuard + CurrentUser decorator"
```

---

### Task 7: AuthService — findOrCreateUserFromGoogle (auto-link by verified email)

**Files:**
- Create: `service/src/auth/auth.service.ts`
- Test: `service/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (Task 4) — mocked in tests.
- Produces: `interface GoogleProfile { sub: string; email: string; emailVerified: boolean; name?: string; picture?: string }`, `AuthService.findOrCreateUserFromGoogle(profile: GoogleProfile): Promise<User>`, `AuthService.getById(id: string): Promise<User>` — consumed by `AuthController` (Task 9).

- [ ] **Step 1: Write the failing test — `service/src/auth/auth.service.spec.ts`**

```typescript
import { AuthService, GoogleProfile } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

function makePrismaMock() {
  return {
    authIdentity: { findUnique: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn() },
  } as unknown as PrismaService;
}

const profile: GoogleProfile = {
  sub: "google-sub-1",
  email: "owner@example.com",
  emailVerified: true,
  name: "Owner",
  picture: "https://example.com/pic.jpg",
};

describe("AuthService.findOrCreateUserFromGoogle", () => {
  it("returns the linked user when the identity already exists", async () => {
    const prisma = makePrismaMock();
    (prisma.authIdentity.findUnique as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: "user-1", email: profile.email });

    const service = new AuthService(prisma);
    const user = await service.findOrCreateUserFromGoogle(profile);

    expect(user.id).toBe("user-1");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("links to an existing user by verified email when no identity exists yet", async () => {
    const prisma = makePrismaMock();
    (prisma.authIdentity.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "seeded-user", email: profile.email });
    (prisma.authIdentity.create as jest.Mock).mockResolvedValue({});

    const service = new AuthService(prisma);
    const user = await service.findOrCreateUserFromGoogle(profile);

    expect(user.id).toBe("seeded-user");
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.authIdentity.create).toHaveBeenCalledWith({
      data: { userId: "seeded-user", provider: "google", subject: profile.sub, email: profile.email },
    });
  });

  it("creates a brand-new user when no identity and no existing user match", async () => {
    const prisma = makePrismaMock();
    (prisma.authIdentity.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: "new-user", email: profile.email });
    (prisma.authIdentity.create as jest.Mock).mockResolvedValue({});

    const service = new AuthService(prisma);
    const user = await service.findOrCreateUserFromGoogle(profile);

    expect(user.id).toBe("new-user");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: profile.email, name: profile.name, avatarUrl: profile.picture },
    });
  });

  it("does not auto-link by email when Google reports email_verified: false", async () => {
    const prisma = makePrismaMock();
    (prisma.authIdentity.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: "new-user-2", email: profile.email });
    (prisma.authIdentity.create as jest.Mock).mockResolvedValue({});

    const service = new AuthService(prisma);
    await service.findOrCreateUserFromGoogle({ ...profile, emailVerified: false });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd service && npx jest auth.service --no-coverage`
Expected: FAIL — `Cannot find module './auth.service'`

- [ ] **Step 3: Write `service/src/auth/auth.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { User } from "@prisma/client";

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateUserFromGoogle(profile: GoogleProfile): Promise<User> {
    const identity = await this.prisma.authIdentity.findUnique({
      where: { provider_subject: { provider: "google", subject: profile.sub } },
    });
    if (identity) {
      return this.prisma.user.findUniqueOrThrow({ where: { id: identity.userId } });
    }

    // Auto-link to an existing user by email ONLY when Google asserts the email
    // is verified — prevents an unverified email claim from hijacking an account.
    let user = profile.emailVerified ? await this.prisma.user.findUnique({ where: { email: profile.email } }) : null;

    if (!user) {
      user = await this.prisma.user.create({
        data: { email: profile.email, name: profile.name, avatarUrl: profile.picture },
      });
    }

    await this.prisma.authIdentity.create({
      data: { userId: user.id, provider: "google", subject: profile.sub, email: profile.email },
    });

    return user;
  }

  getById(id: string): Promise<User> {
    return this.prisma.user.findUniqueOrThrow({ where: { id } });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd service && npx jest auth.service --no-coverage`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add service/src/auth/auth.service.ts service/src/auth/auth.service.spec.ts
git commit -m "service: add AuthService with verified-email auto-link"
```

---

### Task 8: Google OIDC client wrapper

**Files:**
- Create: `service/src/auth/google-oauth.client.ts`
- Test: `service/src/auth/google-oauth.client.spec.ts`

**Interfaces:**
- Produces: `class GoogleOAuthClient { generateAuthUrl(state: string): string; exchangeCodeForProfile(code: string): Promise<GoogleProfile> }` — consumed by `AuthController` (Task 9). `exchangeCodeForProfile` calls real Google endpoints and is **not** unit-tested here (no network in tests); it is exercised manually in the Task 9 end-to-end check.

- [ ] **Step 1: Write the failing test — `service/src/auth/google-oauth.client.spec.ts`**

```typescript
import { GoogleOAuthClient } from "./google-oauth.client";

describe("GoogleOAuthClient.generateAuthUrl", () => {
  it("builds a Google auth URL with the expected client id, redirect_uri, scope and state", () => {
    const client = new GoogleOAuthClient("client-id-123", "client-secret", "http://localhost:4000/auth/callback");
    const url = new URL(client.generateAuthUrl("state-abc"));

    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("client-id-123");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:4000/auth/callback");
    expect(url.searchParams.get("scope")).toContain("email");
    expect(url.searchParams.get("state")).toBe("state-abc");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd service && npx jest google-oauth.client --no-coverage`
Expected: FAIL — `Cannot find module './google-oauth.client'`

- [ ] **Step 3: Write `service/src/auth/google-oauth.client.ts`**

```typescript
import { OAuth2Client } from "google-auth-library";
import { GoogleProfile } from "./auth.service";

export class GoogleOAuthClient {
  private readonly client: OAuth2Client;

  constructor(
    private readonly clientId: string,
    clientSecret: string,
    redirectUri: string,
  ) {
    this.client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  generateAuthUrl(state: string): string {
    return this.client.generateAuthUrl({
      scope: ["openid", "email", "profile"],
      state,
    });
  }

  async exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
    const { tokens } = await this.client.getToken(code);
    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: this.clientId,
    });
    const payload = ticket.getPayload()!;
    return {
      sub: payload.sub,
      email: payload.email!,
      emailVerified: !!payload.email_verified,
      name: payload.name,
      picture: payload.picture,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd service && npx jest google-oauth.client --no-coverage`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add service/src/auth/google-oauth.client.ts service/src/auth/google-oauth.client.spec.ts
git commit -m "service: add Google OIDC code-flow client wrapper"
```

---

### Task 9: AuthController + AuthModule (wires Tasks 5–8 together)

**Files:**
- Create: `service/src/auth/auth.controller.ts`, `service/src/auth/auth.module.ts`
- Modify: `service/src/app.module.ts` — import `AuthModule`
- Modify: `service/.env.example` — add `API_ORIGIN`
- Modify: `/Users/nitiponchingthongchai/Documents/cowork/stock-radar-weekly/service/.env` — add `API_ORIGIN=http://localhost:4000` (gitignored, not committed)

**Interfaces:**
- Consumes: `AuthService` (Task 7), `GoogleOAuthClient` (Task 8), `signSession`/`verifySession` (Task 5), `SessionGuard`/`CurrentUser` (Task 6).
- Produces: `GET /auth/google`, `GET /auth/callback`, `GET /auth/me` (guarded), `POST /auth/logout`.

- [ ] **Step 1: Add `API_ORIGIN` to `service/.env.example`**

```bash
# Copy to service/.env and fill real values — .env is gitignored, NEVER commit it.
DATABASE_URL=postgresql://radar:radar@localhost:5432/journal
SESSION_SECRET=            # openssl rand -base64 32 (dev value, different from prod)
GOOGLE_CLIENT_ID=          # Google Cloud Console → OAuth client (same as prod is fine)
GOOGLE_CLIENT_SECRET=
API_ORIGIN=http://localhost:4000   # this service's own public origin — used to build the OAuth redirect_uri; set to the Railway URL in prod
WEB_ORIGIN=http://localhost:3000
PORT=4000
```

- [ ] **Step 2: Add the same `API_ORIGIN=http://localhost:4000` line to `service/.env`** (manually — file is gitignored, do not `cat` secrets into chat)

- [ ] **Step 3: Write `service/src/auth/auth.controller.ts`**

```typescript
import { Controller, Get, Post, Query, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { GoogleOAuthClient } from "./google-oauth.client";
import { SessionGuard } from "./session.guard";
import { CurrentUser } from "./current-user.decorator";
import { signSession } from "./session.util";

const OAUTH_STATE_COOKIE = "oauth_state";
const SESSION_COOKIE = "session";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private googleClient(): GoogleOAuthClient {
    return new GoogleOAuthClient(
      this.config.get<string>("GOOGLE_CLIENT_ID")!,
      this.config.get<string>("GOOGLE_CLIENT_SECRET")!,
      `${this.config.get<string>("API_ORIGIN")}/auth/callback`,
    );
  }

  @Get("google")
  google(@Res() res: Response) {
    const state = randomUUID();
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 5 * 60 * 1000,
    });
    res.redirect(this.googleClient().generateAuthUrl(state));
  }

  @Get("callback")
  async callback(@Query("code") code: string, @Query("state") state: string, @Req() req: Request, @Res() res: Response) {
    if (!code || !state || state !== req.cookies?.[OAUTH_STATE_COOKIE]) {
      throw new UnauthorizedException("Invalid OAuth state");
    }
    const profile = await this.googleClient().exchangeCodeForProfile(code);
    const user = await this.authService.findOrCreateUserFromGoogle(profile);
    const token = signSession({ userId: user.id }, this.config.get<string>("SESSION_SECRET")!);

    res.clearCookie(OAUTH_STATE_COOKIE);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: THIRTY_DAYS_MS,
    });
    res.redirect(`${this.config.get<string>("WEB_ORIGIN")}/journal`);
  }

  @Get("me")
  @UseGuards(SessionGuard)
  async me(@CurrentUser() userId: string) {
    const user = await this.authService.getById(userId);
    return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status };
  }

  @Post("logout")
  logout(@Res() res: Response) {
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  }
}
```

- [ ] **Step 4: Write `service/src/auth/auth.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 5: Modify `service/src/app.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 6: Run the existing unit test suite (regression check)**

Run: `cd service && npx jest --no-coverage`
Expected: PASS (all suites from Tasks 5–8)

- [ ] **Step 7: Manual end-to-end check (requires Postgres running + real Google OAuth client registered with `http://localhost:4000/auth/callback`)**

Run: `cd service && npm run start:dev`, then open `http://localhost:4000/auth/google` in a browser, complete Google login.
Expected: redirected to `http://localhost:3000/journal` (404 is fine — `web/` isn't wired yet until Task 14) with a `session` cookie set; `curl -s --cookie "session=<value>" localhost:4000/auth/me` returns your user JSON.

- [ ] **Step 8: Commit**

```bash
git add service/src/auth/auth.controller.ts service/src/auth/auth.module.ts service/src/app.module.ts service/.env.example
git commit -m "service: add AuthController (Google OIDC login, session cookie, /auth/me)"
```

---

### Task 10: TradesService — CRUD, ownership guard, auto-close on exit

**Files:**
- Create: `service/src/trades/trades.service.ts`
- Test: `service/src/trades/trades.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (mocked in tests).
- Produces:
  - `TradesService.findAll(userId: string): Promise<Trade[]>`
  - `TradesService.findOne(id: string, userId: string): Promise<Trade>` (throws `NotFoundException` on missing/not-owned)
  - `TradesService.create(userId: string, dto: CreateTradeDto): Promise<Trade>`
  - `TradesService.update(id: string, userId: string, dto: UpdateTradeDto): Promise<Trade>`
  - `TradesService.remove(id: string, userId: string): Promise<void>`
  - `TradesService.addExit(id: string, userId: string, dto: CreateExitDto): Promise<Trade>` — auto-closes + computes `realizedPnL` when exited shares reach total shares.
  All consumed by `TradesController` (Task 11).

- [ ] **Step 1: Write the failing test — `service/src/trades/trades.service.spec.ts`**

```typescript
import { NotFoundException } from "@nestjs/common";
import { TradesService } from "./trades.service";
import { PrismaService } from "../prisma/prisma.service";

function makePrismaMock() {
  return {
    trade: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    tradeExit: { create: jest.fn(), findMany: jest.fn() },
  } as unknown as PrismaService;
}

const OWNER = "user-1";
const OTHER = "user-2";

describe("TradesService", () => {
  it("findOne throws NotFoundException when the trade belongs to a different user", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findUnique as jest.Mock).mockResolvedValue({ id: "t1", userId: OTHER });
    const service = new TradesService(prisma);

    await expect(service.findOne("t1", OWNER)).rejects.toThrow(NotFoundException);
  });

  it("findOne throws NotFoundException when the trade doesn't exist", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findUnique as jest.Mock).mockResolvedValue(null);
    const service = new TradesService(prisma);

    await expect(service.findOne("missing", OWNER)).rejects.toThrow(NotFoundException);
  });

  it("addExit closes the trade and computes realizedPnL once all shares are exited", async () => {
    const prisma = makePrismaMock();
    const trade = { id: "t1", userId: OWNER, shares: 2, entryPrice: 100 };
    (prisma.trade.findUnique as jest.Mock).mockResolvedValue(trade);
    (prisma.tradeExit.create as jest.Mock).mockResolvedValue({});
    (prisma.tradeExit.findMany as jest.Mock).mockResolvedValue([{ shares: 2, price: 120 }]);
    (prisma.trade.update as jest.Mock).mockImplementation(({ data }) => ({ ...trade, ...data }));

    const service = new TradesService(prisma);
    const updated = await service.addExit("t1", OWNER, { date: "2026-07-01", price: 120, shares: 2 });

    expect(updated.status).toBe("closed");
    expect(updated.realizedPnL).toBe(40); // 2 * (120 - 100)
  });

  it("addExit leaves the trade open when shares remain", async () => {
    const prisma = makePrismaMock();
    const trade = { id: "t1", userId: OWNER, shares: 5, entryPrice: 100 };
    (prisma.trade.findUnique as jest.Mock).mockResolvedValue(trade);
    (prisma.tradeExit.create as jest.Mock).mockResolvedValue({});
    (prisma.tradeExit.findMany as jest.Mock).mockResolvedValue([{ shares: 2, price: 120 }]);
    (prisma.trade.update as jest.Mock).mockImplementation(({ data }) => ({ ...trade, ...data }));

    const service = new TradesService(prisma);
    const updated = await service.addExit("t1", OWNER, { date: "2026-07-01", price: 120, shares: 2 });

    expect(updated.status).toBeUndefined(); // no status/realizedPnL update applied
  });

  it("update rejects a trade owned by a different user", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findUnique as jest.Mock).mockResolvedValue({ id: "t1", userId: OTHER });
    const service = new TradesService(prisma);

    await expect(service.update("t1", OWNER, { notes: "hijack attempt" })).rejects.toThrow(NotFoundException);
    expect(prisma.trade.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd service && npx jest trades.service --no-coverage`
Expected: FAIL — `Cannot find module './trades.service'`

- [ ] **Step 3: Write the DTOs — `service/src/trades/dto/create-trade.dto.ts`**

```typescript
import { IsArray, IsNumber, IsOptional, IsString, ArrayMinSize, ArrayMaxSize } from "class-validator";

export class CreateTradeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  ticker!: string;

  @IsString()
  catalystType!: string;

  @IsOptional()
  @IsString()
  linkedReportDate?: string;

  @IsNumber()
  entryPrice!: number;

  @IsNumber()
  shares!: number;

  @IsString()
  entryDate!: string;

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber({}, { each: true })
  plannedTP!: number[];

  @IsNumber()
  plannedSL!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

- [ ] **Step 4: Write `service/src/trades/dto/update-trade.dto.ts`**

```typescript
import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateTradeDto } from "./create-trade.dto";

export class UpdateTradeDto extends PartialType(OmitType(CreateTradeDto, ["id"] as const)) {}
```

(`@nestjs/mapped-types` was added to `service/package.json` in Task 1, Step 1.)

- [ ] **Step 5: Write `service/src/trades/dto/create-exit.dto.ts`**

```typescript
import { IsNumber, IsOptional, IsString } from "class-validator";

export class CreateExitDto {
  @IsString()
  date!: string;

  @IsNumber()
  price!: number;

  @IsNumber()
  shares!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
```

- [ ] **Step 6: Write `service/src/trades/trades.service.ts`**

```typescript
import { Injectable, NotFoundException } from "@nestjs/common";
import { Trade } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTradeDto } from "./dto/create-trade.dto";
import { UpdateTradeDto } from "./dto/update-trade.dto";
import { CreateExitDto } from "./dto/create-exit.dto";

@Injectable()
export class TradesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.trade.findMany({
      where: { userId },
      include: { exits: true },
      orderBy: { entryDate: "desc" },
    });
  }

  async findOne(id: string, userId: string): Promise<Trade> {
    const trade = await this.prisma.trade.findUnique({ where: { id } });
    if (!trade || trade.userId !== userId) throw new NotFoundException("Trade not found");
    return trade;
  }

  create(userId: string, dto: CreateTradeDto) {
    return this.prisma.trade.create({
      data: {
        ...(dto.id ? { id: dto.id } : {}),
        userId,
        ticker: dto.ticker.toUpperCase(),
        catalystType: dto.catalystType,
        linkedReportDate: dto.linkedReportDate,
        entryPrice: dto.entryPrice,
        shares: dto.shares,
        entryDate: new Date(dto.entryDate),
        plannedTP: dto.plannedTP,
        plannedSL: dto.plannedSL,
        status: "open",
        notes: dto.notes,
      },
      include: { exits: true },
    });
  }

  async update(id: string, userId: string, dto: UpdateTradeDto) {
    await this.findOne(id, userId);
    return this.prisma.trade.update({
      where: { id },
      data: {
        ...(dto.ticker !== undefined && { ticker: dto.ticker.toUpperCase() }),
        ...(dto.catalystType !== undefined && { catalystType: dto.catalystType }),
        ...(dto.linkedReportDate !== undefined && { linkedReportDate: dto.linkedReportDate }),
        ...(dto.entryPrice !== undefined && { entryPrice: dto.entryPrice }),
        ...(dto.shares !== undefined && { shares: dto.shares }),
        ...(dto.entryDate !== undefined && { entryDate: new Date(dto.entryDate) }),
        ...(dto.plannedTP !== undefined && { plannedTP: dto.plannedTP }),
        ...(dto.plannedSL !== undefined && { plannedSL: dto.plannedSL }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { exits: true },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    await this.prisma.trade.delete({ where: { id } });
  }

  async addExit(id: string, userId: string, dto: CreateExitDto) {
    const trade = await this.findOne(id, userId);
    await this.prisma.tradeExit.create({
      data: { tradeId: id, date: new Date(dto.date), price: dto.price, shares: dto.shares, note: dto.note },
    });

    const exits = await this.prisma.tradeExit.findMany({ where: { tradeId: id } });
    const exitedShares = exits.reduce((sum, e) => sum + e.shares, 0);

    const data: { status?: string; realizedPnL?: number } = {};
    if (exitedShares >= trade.shares) {
      data.status = "closed";
      data.realizedPnL = exits.reduce((sum, e) => sum + e.shares * (e.price - trade.entryPrice), 0);
    }

    return this.prisma.trade.update({ where: { id }, data, include: { exits: true } });
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd service && npx jest trades.service --no-coverage`
Expected: PASS (5 tests)

- [ ] **Step 8: Commit**

```bash
git add service/src/trades/trades.service.ts service/src/trades/trades.service.spec.ts service/src/trades/dto
git commit -m "service: add TradesService (CRUD, ownership guard, auto-close on exit)"
```

---

### Task 11: TradesController + TradesModule

**Files:**
- Create: `service/src/trades/trades.controller.ts`, `service/src/trades/trades.module.ts`
- Modify: `service/src/app.module.ts` — import `TradesModule`

**Interfaces:**
- Consumes: `TradesService` (Task 10), `SessionGuard`/`CurrentUser` (Task 6).
- Produces: `GET /trades`, `GET /trades/:id`, `POST /trades`, `PATCH /trades/:id`, `DELETE /trades/:id`, `POST /trades/:id/exits` — all guarded by `SessionGuard`.
- Note: `DELETE /trades/:id/exits` from the architecture doc's API table is intentionally **not** implemented — no UI in `JournalContent.tsx` deletes a single exit; adding it now would be speculative (YAGNI). Revisit if/when the UI needs it.

- [ ] **Step 1: Write `service/src/trades/trades.controller.ts`**

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { TradesService } from "./trades.service";
import { CreateTradeDto } from "./dto/create-trade.dto";
import { UpdateTradeDto } from "./dto/update-trade.dto";
import { CreateExitDto } from "./dto/create-exit.dto";

@Controller("trades")
@UseGuards(SessionGuard)
export class TradesController {
  constructor(private readonly trades: TradesService) {}

  @Get()
  findAll(@CurrentUser() userId: string) {
    return this.trades.findAll(userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() userId: string) {
    return this.trades.findOne(id, userId);
  }

  @Post()
  create(@Body() dto: CreateTradeDto, @CurrentUser() userId: string) {
    return this.trades.create(userId, dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTradeDto, @CurrentUser() userId: string) {
    return this.trades.update(id, userId, dto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() userId: string) {
    await this.trades.remove(id, userId);
    return { ok: true };
  }

  @Post(":id/exits")
  addExit(@Param("id") id: string, @Body() dto: CreateExitDto, @CurrentUser() userId: string) {
    return this.trades.addExit(id, userId, dto);
  }
}
```

- [ ] **Step 2: Write `service/src/trades/trades.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { TradesController } from "./trades.controller";
import { TradesService } from "./trades.service";

@Module({
  controllers: [TradesController],
  providers: [TradesService],
})
export class TradesModule {}
```

- [ ] **Step 3: Modify `service/src/app.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { TradesModule } from "./trades/trades.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, TradesModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 4: Build check**

Run: `cd service && npm run build`
Expected: compiles with no TypeScript errors.

- [ ] **Step 5: Manual smoke test (requires Postgres + a logged-in session cookie from Task 9 Step 7)**

Run: `curl -s --cookie "session=<value>" localhost:4000/trades`
Expected: `[]` (empty array — no trades yet until Task 12's seed import runs).

- [ ] **Step 6: Commit**

```bash
git add service/src/trades/trades.controller.ts service/src/trades/trades.module.ts service/src/app.module.ts
git commit -m "service: add TradesController (CRUD + exits, session-guarded)"
```

---

### Task 12: Seed import — private/journal.json → user #1

**Files:**
- Create: `service/scripts/seed-import.ts`

**Interfaces:**
- Consumes: `PrismaClient` directly (standalone script, not a Nest provider), `web/lib/journal-types.ts`'s `JournalFile`/`Trade` shape (read as plain JSON, not imported as a TS module — this script has no dependency on `web/`).
- Produces: a runnable `npm run seed:import -- <email>` that populates `users`, `auth_identities` is **not** touched here (that's created on first Google login and auto-linked by email per Task 7) — this script only seeds `users` + `trades` + `trade_exits`.

- [ ] **Step 1: Write `service/scripts/seed-import.ts`**

```typescript
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
  if (!email) {
    console.error("Usage: npm run seed:import -- <owner-email>");
    process.exit(1);
  }

  const journalPath = resolve(__dirname, "../../private/journal.json");
  const journal: LegacyJournalFile = JSON.parse(readFileSync(journalPath, "utf-8"));

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
```

- [ ] **Step 2: Run the import (requires Postgres up + migration applied)**

Run: `cd service && npm run seed:import -- nitipon.ching@gmail.com`
Expected: `User #1: <uuid> (nitipon.ching@gmail.com)`, one `imported trade ...` line per trade in `private/journal.json`, then `Done — imported N trades.`

- [ ] **Step 3: Verify via API**

Log in via `http://localhost:4000/auth/google` with the same Google account (`nitipon.ching@gmail.com`), then:
Run: `curl -s --cookie "session=<value>" localhost:4000/trades | head -c 500`
Expected: the imported trades, now owned by the logged-in user (auto-linked by email in `AuthService.findOrCreateUserFromGoogle`).

- [ ] **Step 4: Commit**

```bash
git add service/scripts/seed-import.ts
git commit -m "service: add seed-import script for private/journal.json -> user #1"
```

---

### Task 13: Next.js rewrite proxy

**Files:**
- Modify: `web/next.config.ts`
- Modify: `web/.env.local` (gitignored — create if missing)

**Interfaces:**
- Produces: browser requests to `/api/journal/*` on `web/` are transparently proxied to `JOURNAL_API_ORIGIN` (same-origin from the browser's point of view, so cookies set by the API are first-party).

- [ ] **Step 1: Modify `web/next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["676d-124-122-125-200.ngrok-free.app", "*.ngrok-free.app"],
  async rewrites() {
    return [
      {
        source: "/api/journal/:path*",
        destination: `${process.env.JOURNAL_API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Add to `web/.env.local`** (create the file if it doesn't exist — already gitignored)

```bash
JOURNAL_API_ORIGIN=http://localhost:4000
```

- [ ] **Step 3: Verify the rewrite (requires `service` running on :4000 and `web` dev server running)**

Run: `cd web && npm run dev` (separate shell), then `curl -s localhost:3000/api/journal/health`
Expected: `{"ok":true}` (proxied through to the NestJS `/health` route).

- [ ] **Step 4: Commit**

```bash
git add web/next.config.ts
git commit -m "web: add /api/journal/* rewrite proxy to Journal API"
```

(Note: `web/.env.local` is gitignored — nothing to commit there, just confirm it's set locally.)

---

### Task 14: Point `web/app/journal/page.tsx` at the API + login gate

**Files:**
- Create: `web/app/journal/LoginGate.tsx`
- Modify: `web/app/journal/page.tsx` (full rewrite)
- Delete: `web/lib/journal.ts`
- Delete: `web/app/journal/api/route.ts`

**Interfaces:**
- Consumes: `Trade` from `web/lib/journal-types.ts` (unchanged), `computeStats` from `web/lib/journal-math.ts` (unchanged), `getAllReports`/`getAllReportsGrouped` from `web/lib/reports.ts` (unchanged — reports stay in git, untouched by this migration).
- Produces: `JournalPage` now fetches trades from the API via the session cookie instead of `fs`; renders `<LoginGate />` when there's no valid session.

- [ ] **Step 1: Write `web/app/journal/LoginGate.tsx`**

```tsx
import Link from "next/link";

export function LoginGate() {
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, fontFamily: "var(--font-display, sans-serif)" }}>
        Trade Journal
      </h1>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24, fontFamily: "var(--font-mono, monospace)" }}>
        Log in with Google to view and manage your trades.
      </p>
      <Link
        href="/api/journal/auth/google"
        style={{
          display: "inline-block", padding: "10px 20px", borderRadius: 8,
          background: "#10b981", color: "#fff", fontWeight: 800, fontSize: 13,
          textDecoration: "none", fontFamily: "var(--font-mono, monospace)",
        }}
      >
        Log in with Google
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `web/app/journal/page.tsx`**

```tsx
// ─── Trade Journal Page ───────────────────────────────────────────────────────
// Trades now live in the Journal API (Postgres via Railway) — this page fetches
// them server-side, forwarding the session cookie. See docs/architecture/journal-api.md.

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { Trade } from "@/lib/journal-types";
import { computeStats } from "@/lib/journal-math";
import { getAllReports, getAllReportsGrouped } from "@/lib/reports";
import { JournalContent } from "./JournalContent";
import { LoginGate } from "./LoginGate";

const API_ORIGIN = process.env.JOURNAL_API_ORIGIN ?? "http://localhost:4000";

export default async function JournalPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return <LoginGate />;
  }

  const headers = { Cookie: `session=${sessionCookie}` };
  const tradesRes = await fetch(`${API_ORIGIN}/trades`, { headers, cache: "no-store" });

  if (!tradesRes.ok) {
    return <LoginGate />;
  }

  const trades: Trade[] = await tradesRes.json();
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
    { reportDate: string; price: number; tp1: number; tp2: number; tp3: number; tightStop: number | null; catalystType: string | null }[]
  > = {};
  for (const [ticker, reps] of Object.entries(grouped)) {
    reportsByTicker[ticker] = reps.map((r) => ({
      reportDate: r.generatedAt.slice(0, 10).replace(/-/g, ""),
      price: r.price,
      tp1: r.entryStrategy.tp1.price,
      tp2: r.entryStrategy.tp2.price,
      tp3: r.entryStrategy.tp3.price,
      tightStop: r.entryStrategy.stopLoss.tight ?? null,
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
    />
  );
}
```

Note: `validation` prop is dropped (was previously `readValidation()` from `private/journal-validation.json`) — the validator skill's write path stays local-only until Phase 2 wires it to `PUT /trades/:id/validation` via PAT (`docs/architecture/journal-api.md` §5). `JournalContent`'s `validation` prop already defaults to `null` (`web/app/journal/JournalContent.tsx:968`), so this is a no-op change to its call site, not a breaking one.

- [ ] **Step 3: Delete `web/lib/journal.ts`** (fs-based helpers — only consumers were `page.tsx`, just rewritten, and `api/route.ts`, deleted in the next step)

- [ ] **Step 4: Delete `web/app/journal/api/route.ts`** (replaced entirely by the NestJS API reached through the Task 13 rewrite)

- [ ] **Step 5: Commit**

```bash
git add web/app/journal/page.tsx web/app/journal/LoginGate.tsx
git rm web/lib/journal.ts web/app/journal/api/route.ts
git commit -m "web: journal page reads from the API with session cookie, adds login gate"
```

---

### Task 15: Point `JournalContent.tsx` at the new REST endpoints

**Files:**
- Modify: `web/app/journal/JournalContent.tsx`

**Interfaces:**
- Consumes: `/api/journal/trades` (POST), `/api/journal/trades/:id` (PATCH, DELETE), `/api/journal/trades/:id/exits` (POST) — all proxied per Task 13.
- Produces: `handleSave` now branches create vs. update; exit logging goes through a dedicated `handleAddExit`; `ExitForm`'s `onClose` prop is split into `onSubmit`/`onCancel`.

- [ ] **Step 1: Replace the API helpers block (`web/app/journal/JournalContent.tsx:129-151`)**

```typescript
// ── API helpers ───────────────────────────────────────────────────────────────

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(body.message)) return body.message.join(", ");
  return body.message ?? fallback;
}

async function apiCreate(trade: Trade): Promise<Trade> {
  const res = await fetch("/api/journal/trades", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trade),
  });
  if (!res.ok) throw new Error(await readError(res, `Create failed (${res.status})`));
  return res.json();
}

async function apiUpdate(trade: Trade): Promise<Trade> {
  const res = await fetch(`/api/journal/trades/${trade.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trade),
  });
  if (!res.ok) throw new Error(await readError(res, `Update failed (${res.status})`));
  return res.json();
}

async function apiAddExit(tradeId: string, exit: TradeExit): Promise<Trade> {
  const res = await fetch(`/api/journal/trades/${tradeId}/exits`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(exit),
  });
  if (!res.ok) throw new Error(await readError(res, `Exit failed (${res.status})`));
  return res.json();
}

async function apiDelete(id: string): Promise<void> {
  const res = await fetch(`/api/journal/trades/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res, `Delete failed (${res.status})`));
}
```

- [ ] **Step 2: Replace `ExitForm` (`web/app/journal/JournalContent.tsx:436-498`)**

```tsx
// ── Exit Form ─────────────────────────────────────────────────────────────────

function ExitForm({ trade, onSubmit, onCancel }: {
  trade: Trade;
  onSubmit: (exit: TradeExit) => void;
  onCancel: () => void;
}) {
  const exitedSoFar = trade.exits.reduce((s, e) => s + e.shares, 0);
  const remaining = trade.shares - exitedSoFar;

  const [price, setPrice] = useState("");
  const [shares, setShares] = useState(remaining > 0 ? fmtShares(remaining) : "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  function submit() {
    const exitShares = parseDecimalInput(shares);
    if (exitShares <= 0) {
      alert("Please enter shares greater than 0.");
      return;
    }
    if (exitShares > remaining + 1e-9) {
      alert(`Cannot exit more than ${fmtShares(remaining)} shares remaining.`);
      return;
    }
    onSubmit({ date, price: parseFloat(price), shares: exitShares, note: note || undefined });
  }

  return (
    <div style={{ background: "var(--bg, #0f172a)", border: "1px solid #f59e0b40", borderRadius: 10, padding: "14px 16px", marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)", marginBottom: 10 }}>
        LOG EXIT · {fmtShares(remaining)} shares remaining
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
        <Field label="Exit Date">
          <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Exit Price $">
          <input style={inputStyle} type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Shares">
          <input style={inputStyle} type="text" inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Note">
          <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="TP1 hit, stop, etc." />
        </Field>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button onClick={submit} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "#f59e0b", color: "#000", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}>
          Log Exit
        </button>
        <button onClick={onCancel} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `TradeRow`'s props and its `ExitForm` usage (`web/app/journal/JournalContent.tsx:549-559` and `:913-919`)**

Change the prop signature:

```typescript
function TradeRow({ trade, priceInfo, validatorResult, validationGeneratedAt, onEdit, onDelete, onAddExit }: {
  trade: Trade;
  priceInfo: PriceInfo | null;
  validatorResult?: ValidatorResult;
  validationGeneratedAt?: string;
  onEdit: () => void;
  onDelete: () => void;
  onAddExit: (exit: TradeExit) => void;
}) {
```

And its exit-form render:

```tsx
{showExitForm && (
  <ExitForm
    trade={trade}
    onSubmit={(exit) => { setShowExitForm(false); onAddExit(exit); }}
    onCancel={() => setShowExitForm(false)}
  />
)}
```

- [ ] **Step 4: Update `handleSave`, add `handleAddExit`, and the `TradeRow` call site in `JournalContent` (`web/app/journal/JournalContent.tsx:1018-1048` and `:1186-1196`)**

```typescript
const handleSave = useCallback(async (trade: Trade) => {
  if (!trade.ticker.trim()) {
    alert("Please enter a ticker before saving.");
    return;
  }
  if (trade.shares <= 0) {
    alert("Please enter a share amount greater than 0.");
    return;
  }
  const isNew = !trades.some((t) => t.id === trade.id);
  try {
    const saved = isNew ? await apiCreate(trade) : await apiUpdate(trade);
    setTrades((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      return idx >= 0 ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
    });
    setShowForm(false);
    setEditTrade(null);
  } catch (err) {
    alert(err instanceof Error ? err.message : "Failed to save trade");
  }
}, [trades]);

const handleAddExit = useCallback(async (tradeId: string, exit: TradeExit) => {
  try {
    const updated = await apiAddExit(tradeId, exit);
    setTrades((prev) => prev.map((t) => (t.id === tradeId ? updated : t)));
  } catch (err) {
    alert(err instanceof Error ? err.message : "Failed to log exit");
  }
}, []);

const handleDelete = useCallback(async (id: string) => {
  if (!confirm("Delete this trade?")) return;
  try {
    await apiDelete(id);
    setTrades((prev) => prev.filter((t) => t.id !== id));
  } catch (err) {
    alert(err instanceof Error ? err.message : "Failed to delete trade");
  }
}, []);
```

And the `TradeRow` call site:

```tsx
<TradeRow
  key={trade.id}
  trade={trade}
  priceInfo={livePriceMap[trade.ticker] ?? null}
  validatorResult={validation?.results[trade.ticker]}
  validationGeneratedAt={validation?.generatedAt}
  onEdit={() => { setEditTrade(trade); setShowForm(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
  onDelete={() => handleDelete(trade.id)}
  onAddExit={(exit) => handleAddExit(trade.id, exit)}
/>
```

- [ ] **Step 5: Type check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification (requires Tasks 9–14 all working end to end)**

Run: `cd web && npm run dev`, visit `http://localhost:3000/journal`, log in, create a trade, log a partial exit, log a final exit (confirm it flips to CLOSED with correct P&L), edit a trade, delete a trade.
Expected: every action persists (reload the page and confirm state survived — it's now in Postgres, not local state).

- [ ] **Step 7: Commit**

```bash
git add web/app/journal/JournalContent.tsx
git commit -m "web: JournalContent talks to the Journal API (create/update/exit/delete)"
```

---

### Task 16: Remove the `isLocal` gate — Journal link always visible

**Files:**
- Modify: `web/app/Header.tsx:97, 154`
- Modify: `web/app/Landing.tsx:252, 258, 421`
- Modify: `web/app/layout.tsx:52, 106`
- Modify: `web/app/page.tsx:34`

**Interfaces:**
- Removes the `isLocal` prop entirely from `Header` and `Landing` — the Journal nav link is now gated by login (Task 14's `LoginGate`), not by `process.env.VERCEL`.

- [ ] **Step 1: Modify `web/app/Header.tsx`** — change the function signature (`:66`) to drop `isLocal`:

```typescript
export function Header({ lastUpdated }: { lastUpdated: string }) {
```

Then unwrap both gated blocks (`:97-100` and `:154-157`) from `{isLocal && (...)}` to just the `<Link>` directly, e.g.:

```tsx
<Link href="/journal" title="Journal" style={{ fontSize: 11, color: "#f59e0b", textDecoration: "none", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, letterSpacing: "0.3px" }}>
  📒 Journal
</Link>
```

(and the matching mobile-menu copy at the second occurrence).

- [ ] **Step 2: Modify `web/app/Landing.tsx`** — remove the `isLocal = false` default param and `isLocal?: boolean` type (`:252, 258`), and unwrap the gated block at `:421-429` to a plain `<Link>`.

- [ ] **Step 3: Modify `web/app/layout.tsx:52, 106`** — delete the `const isLocal = !process.env.VERCEL;` line and stop passing `isLocal={isLocal}` to `<Header>`.

- [ ] **Step 4: Modify `web/app/page.tsx:34`** — stop passing `isLocal={!process.env.VERCEL}` to `<Landing>`.

- [ ] **Step 5: Type check + grep for stragglers**

Run: `cd web && npx tsc --noEmit && grep -rn "isLocal" web/app --include="*.tsx" --include="*.ts"`
Expected: `tsc` passes with no errors; `grep` returns no matches.

- [ ] **Step 6: Commit**

```bash
git add web/app/Header.tsx web/app/Landing.tsx web/app/layout.tsx web/app/page.tsx
git commit -m "web: remove isLocal gate on Journal nav link (login-gated now, not env-gated)"
```

---

### Task 17: Railway pre-deploy readiness check (local, no live Railway needed)

**Files:** none — verification only.

- [ ] **Step 1: Confirm `prisma`/`@prisma/client` are in `dependencies`**

Run: `cd service && node -e "const p=require('./package.json'); if(!p.dependencies.prisma || !p.dependencies['@prisma/client']) { console.error('FAIL'); process.exit(1);} console.log('OK')"`
Expected: `OK`

- [ ] **Step 2: Confirm the `start` script matches Railway's expectation**

Run: `cd service && node -e "const p=require('./package.json'); if(p.scripts.start !== 'node dist/main') { console.error('FAIL'); process.exit(1);} console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Confirm a clean build from scratch**

Run: `cd service && rm -rf dist && npm run build && ls dist/main.js`
Expected: `dist/main.js` exists.

- [ ] **Step 4: Confirm `prisma migrate deploy` (the Railway pre-deploy command) runs cleanly against the local DB**

Run: `cd service && npx prisma migrate deploy`
Expected: `No pending migrations to apply.` (since Task 3 already ran `migrate dev`).

No commit for this task — it's a readiness check, not a code change. If any step fails, fix the underlying file from the relevant earlier task before moving on.

---

## Explicitly out of scope for this plan (do separately, per the runbook)

- Creating the Railway project, Postgres service, and setting Railway environment variables (`docs/architecture/journal-api-deployment.md` §3) — one-time human task in the Railway dashboard.
- Registering the production redirect URI in Google Cloud Console (§2) — already done for the dev redirect URI per the user's note that `service/.env` is filled in; confirm the prod URI is added when Railway's public domain is known.
- Setting `JOURNAL_API_ORIGIN` in Vercel's environment variables (§4) — one-time human task in the Vercel dashboard, done once the Railway URL exists.
- Everything under Phase 2 (whitelist mode, PAT issuance, migrating `scripts/fetch-backtest-prices.mjs` and the `analyze-journal` validator skill to the API, retiring `private/journal.json`) and Phase 3 (reports queryable) per `docs/architecture/journal-api.md` §5.
