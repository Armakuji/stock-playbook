-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER,
    "interval" TEXT,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "features" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "plan_id" TEXT NOT NULL,
    "feature_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limit_value" INTEGER,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("plan_id","feature_id")
);

-- CreateTable
CREATE TABLE "validation_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "trades_count" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,

    CONSTRAINT "validation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_validations" (
    "trade_id" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "thesis_intact" BOOLEAN NOT NULL,
    "stop_breached" BOOLEAN NOT NULL,
    "at_risk" BOOLEAN NOT NULL,
    "summary" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "validated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_validations_pkey" PRIMARY KEY ("trade_id")
);

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_requests" ADD CONSTRAINT "validation_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_validations" ADD CONSTRAINT "trade_validations_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: free plan + ai_validation feature, lifetime limit of 3
INSERT INTO "plans" ("id", "name") VALUES ('free', 'Free')
  ON CONFLICT ("id") DO NOTHING;

INSERT INTO "features" ("id", "name", "description") VALUES
  ('ai_validation', 'AI Validation', 'Claude-powered journal validation (backlog #20)')
  ON CONFLICT ("id") DO NOTHING;

INSERT INTO "plan_features" ("plan_id", "feature_id", "enabled", "limit_value") VALUES
  ('free', 'ai_validation', true, 3)
  ON CONFLICT ("plan_id", "feature_id") DO NOTHING;
