import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { TradesModule } from "./trades/trades.module";

const isProd = process.env.NODE_ENV === "production";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: isProd ? "info" : "debug",
        // prod: plain JSON lines (Railway can parse/filter them) · dev: pino-pretty
        transport: isProd ? undefined : { target: "pino-pretty", options: { colorize: true, singleLine: true } },
        // Railway polls /health frequently — logging every poll would drown out real traffic.
        autoLogging: { ignore: (req) => req.url === "/health" },
        // req.userId is set by SessionGuard once a request authenticates — surfaces
        // who did what without needing to grep the log line's nested req object.
        customProps: (req) => ({ userId: (req as unknown as { userId?: string }).userId }),
        // Never let a session cookie or bearer token leak into log output.
        redact: {
          paths: ["req.headers.cookie", "req.headers.authorization"],
          censor: "[REDACTED]",
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
