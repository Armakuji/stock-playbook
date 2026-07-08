-- AlterTable: track the real client IP on each validation request so we can
-- enforce an IP-based rate limit alongside the per-user quota (catches
-- account-switching abuse of the AI validation feature).
ALTER TABLE "validation_requests" ADD COLUMN "ip" TEXT;

-- Index to make the rolling-window IP count in ValidationService fast.
CREATE INDEX "validation_requests_ip_requested_at_idx" ON "validation_requests"("ip", "requested_at");
