import type { IncomingMessage, ServerResponse } from "http";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { TradesModule } from "./trades/trades.module";

// SessionGuard attaches userId directly onto the request object (see
// session.guard.ts) — not part of Node's IncomingMessage, so it needs its own type.
interface RequestWithUserId extends IncomingMessage {
  userId?: string;
}

const isProd = process.env.NODE_ENV === "production";
// LOG_FORMAT=pretty (default, everywhere — Railway renders ANSI fine) for a
// human-readable structured log; LOG_FORMAT=json for raw single-line JSON
// once there's enough traffic that filtering by attribute in Railway matters
// more than readability.
const usePretty = (process.env.LOG_FORMAT ?? "pretty") !== "json";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: isProd ? "info" : "debug",
        transport: usePretty
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss",
                // No messageFormat: it's a single template applied to every log
                // line pino-http emits — not just the automatic req/res ones. The
                // service-layer event logs (trade created/deleted, login success)
                // don't have req/res/responseTime fields, so a req/res-shaped
                // template renders them with blank placeholders. singleLine:false
                // instead falls back to pino-pretty's default rendering: a
                // "[HH:MM:ss] LEVEL: <msg>" header line, then every field
                // (req/res/responseTime for request logs, or userId/tradeId/
                // ticker for event logs) pretty-printed underneath it — correct
                // for both shapes, and each log gets its own line block.
                singleLine: false,
              },
            }
          : undefined,
        // Railway polls /health frequently — logging every poll would drown out real traffic.
        autoLogging: { ignore: (req) => req.url === "/health" },
        // req.userId is set by SessionGuard once a request authenticates. ip reads
        // the real client address Vercel's proxy attaches to the rewritten request
        // (Vercel's own multi-hop infra can alter the standard x-forwarded-for, so
        // it exposes this header specifically to carry the original browser IP) —
        // absent in local dev, where there's no Vercel hop in front of the API.
        customProps: (req: RequestWithUserId) => ({
          userId: req.userId,
          ip: req.headers["x-vercel-forwarded-for"],
        }),
        // Never let a session cookie or bearer token leak into log output.
        redact: {
          paths: ["req.headers.cookie", "req.headers.authorization"],
          censor: "[REDACTED]",
        },
        // Drop the rest of the default req/res dump (all headers, query, params,
        // remoteAddress, response headers, ...) — method/url/statusCode plus the
        // customProps above are all that's actually useful day-to-day.
        serializers: {
          req: (req: IncomingMessage) => ({ method: req.method, url: req.url }),
          res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    PrismaModule,
    AuthModule,
    TradesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
