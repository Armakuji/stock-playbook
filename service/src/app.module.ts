import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { TradesModule } from "./trades/trades.module";

const isProd = process.env.NODE_ENV === "production";
// LOG_FORMAT=pretty (default, everywhere — Railway renders ANSI fine) for a
// human-readable single-line log; LOG_FORMAT=json for structured JSON once
// there's enough traffic that filtering by attribute in Railway matters more
// than readability.
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
                singleLine: true,
                translateTime: "HH:MM:ss",
                messageFormat: "{req.method} {req.url} → {res.statusCode} {responseTime}ms user={userId}",
                // Without this, pino-pretty still dumps the full (now-slimmed) log
                // object after the formatted message — hide it for a single clean
                // line matching the intended "HH:MM:ss METHOD /url → status Nms
                // user=..." output.
                hideObject: true,
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
        customProps: (req) => ({
          userId: (req as unknown as { userId?: string }).userId,
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
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
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
