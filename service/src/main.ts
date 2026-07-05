import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import * as cookieParser from "cookie-parser";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  // Nest's own default logger stays (colorful [Nest] LOG boot output, unchanged).
  // pino-http (wired via LoggerModule in app.module.ts) handles request logging
  // only — the two are independent, no app.useLogger() swap needed.
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
}
void bootstrap();
