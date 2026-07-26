-- Inventory Count Reconciliation — single flat table (independent from count archive)
-- Example: mix_INVENTORY_COUNT_RECONCILIATION

CREATE TABLE IF NOT EXISTS "mix_INVENTORY_COUNT_RECONCILIATION" (
  "RECONCILIATION_ID" text NOT NULL,
  "LINE_NO" integer NOT NULL,
  "COUNT_DATE" date,
  "LABEL" text,
  "PRODUCT ID" text NOT NULL,
  "SOURCE_TYPE" text NOT NULL DEFAULT 'none',
  "SOURCE_USER" text,
  "RESULT_QTY" numeric,
  "ENDING_BALANCE" numeric,
  "DIFFERENCE" numeric,
  "MATCH_STATUS" text NOT NULL DEFAULT 'Not Found',
  "IS_MANUALLY_ADDED" boolean NOT NULL DEFAULT false,
  "SAVED_AT" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("RECONCILIATION_ID", "LINE_NO")
);

CREATE INDEX IF NOT EXISTS idx_mix_ic_reconciliation_id
  ON "mix_INVENTORY_COUNT_RECONCILIATION" ("RECONCILIATION_ID");

CREATE INDEX IF NOT EXISTS idx_mix_ic_reconciliation_saved_at
  ON "mix_INVENTORY_COUNT_RECONCILIATION" ("SAVED_AT" DESC);

CREATE INDEX IF NOT EXISTS idx_mix_ic_reconciliation_product
  ON "mix_INVENTORY_COUNT_RECONCILIATION" ("RECONCILIATION_ID", "PRODUCT ID");

ALTER TABLE "mix_INVENTORY_COUNT_RECONCILIATION" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mix_INVENTORY_COUNT_RECONCILIATION'
      AND policyname = 'mix_ic_reconciliation_select'
  ) THEN
    CREATE POLICY mix_ic_reconciliation_select ON "mix_INVENTORY_COUNT_RECONCILIATION" FOR SELECT TO public USING (true);
    CREATE POLICY mix_ic_reconciliation_insert ON "mix_INVENTORY_COUNT_RECONCILIATION" FOR INSERT TO public WITH CHECK (true);
    CREATE POLICY mix_ic_reconciliation_update ON "mix_INVENTORY_COUNT_RECONCILIATION" FOR UPDATE TO public USING (true);
    CREATE POLICY mix_ic_reconciliation_delete ON "mix_INVENTORY_COUNT_RECONCILIATION" FOR DELETE TO public USING (true);
  END IF;
END $$;
