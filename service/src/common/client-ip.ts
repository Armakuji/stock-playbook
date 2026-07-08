import type { IncomingMessage } from "http";

type RequestLike = IncomingMessage & { ip?: string };

/**
 * Real client IP behind Vercel's rewrite proxy (Browser → Vercel → Railway).
 * Vercel's own multi-hop infra can alter the standard x-forwarded-for, so it
 * exposes this header specifically to carry the original browser IP — same
 * header already used for pino request logging (see app.module.ts).
 *
 * Falls back to Express's req.ip for local dev, where there's no Vercel hop
 * in front of the API.
 */
export function getClientIp(req: RequestLike): string | null {
  const forwarded = req.headers["x-vercel-forwarded-for"];
  const vercelIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof vercelIp === "string" && vercelIp.trim().length > 0) {
    return vercelIp.split(",")[0].trim();
  }
  return req.ip ?? null;
}
