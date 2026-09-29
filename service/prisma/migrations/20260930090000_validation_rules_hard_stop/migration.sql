-- Hard stop on trades (optional structural stop below plannedSL)
ALTER TABLE "trades" ADD COLUMN "planned_hard_sl" DOUBLE PRECISION;

-- Code-computed rule fields + structured add-more / stop decision on validations
ALTER TABLE "trade_validations" ADD COLUMN "hard_stop_breached" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trade_validations" ADD COLUMN "sl_buffer_pct" DOUBLE PRECISION;
ALTER TABLE "trade_validations" ADD COLUMN "add_more" TEXT;
ALTER TABLE "trade_validations" ADD COLUMN "stop_decision" TEXT;
