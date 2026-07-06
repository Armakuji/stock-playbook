-- Bilingual AI validation copy (EN + TH per trade)
ALTER TABLE "trade_validations" ADD COLUMN "summary_th" TEXT NOT NULL DEFAULT '';
ALTER TABLE "trade_validations" ADD COLUMN "action_th" TEXT NOT NULL DEFAULT '';
