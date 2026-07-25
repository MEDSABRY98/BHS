-- Inventory Count Archive tables (mix_ prefix, capital segments after mix_)
-- Example: mix_INVENTORY_COUNT_ARCHIVE

-- Rename legacy web_* lowercase tables first (one-time)
DO $$
BEGIN
  IF to_regclass('public.web_inventory_count_archive') IS NOT NULL
     AND to_regclass('public."mix_INVENTORY_COUNT_ARCHIVE"') IS NULL THEN
    ALTER TABLE web_inventory_count_archive RENAME TO "mix_INVENTORY_COUNT_ARCHIVE";
  END IF;

  IF to_regclass('public.web_inventory_count_details_archive') IS NOT NULL
     AND to_regclass('public."mix_INVENTORY_COUNT_DETAILS_ARCHIVE"') IS NULL THEN
    ALTER TABLE web_inventory_count_details_archive RENAME TO "mix_INVENTORY_COUNT_DETAILS_ARCHIVE";
  END IF;

  IF to_regclass('public.web_inventory_count_totals_archive') IS NOT NULL
     AND to_regclass('public."mix_INVENTORY_COUNT_TOTALS_ARCHIVE"') IS NULL THEN
    ALTER TABLE web_inventory_count_totals_archive RENAME TO "mix_INVENTORY_COUNT_TOTALS_ARCHIVE";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "mix_INVENTORY_COUNT_ARCHIVE" (
  "ARCHIVE_ID" text PRIMARY KEY,
  "COUNT_DATE" date,
  "LABEL" text,
  "DETAIL_ROW_COUNT" integer NOT NULL DEFAULT 0,
  "TOTAL_ROW_COUNT" integer NOT NULL DEFAULT 0,
  "RESET_LIVE" boolean NOT NULL DEFAULT false,
  "CLOSED_AT" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mix_ic_archive_closed_at
  ON "mix_INVENTORY_COUNT_ARCHIVE" ("CLOSED_AT" DESC);

CREATE TABLE IF NOT EXISTS "mix_INVENTORY_COUNT_DETAILS_ARCHIVE" (
  "ARCHIVE_ID" text NOT NULL REFERENCES "mix_INVENTORY_COUNT_ARCHIVE" ("ARCHIVE_ID") ON DELETE CASCADE,
  "ID" text NOT NULL,
  "DATE" timestamptz,
  "USER" text,
  "WAREHOUSE" text,
  "PRODUCT ID" text,
  "QTY IN BOX" numeric,
  "COUNT DETAILS" text,
  "COUNTED QTY" numeric,
  "COUNT_TYPE" text,
  PRIMARY KEY ("ARCHIVE_ID", "ID")
);

CREATE INDEX IF NOT EXISTS idx_mix_ic_details_archive_product
  ON "mix_INVENTORY_COUNT_DETAILS_ARCHIVE" ("ARCHIVE_ID", "PRODUCT ID");

CREATE INDEX IF NOT EXISTS idx_mix_ic_details_archive_type
  ON "mix_INVENTORY_COUNT_DETAILS_ARCHIVE" ("ARCHIVE_ID", "COUNT_TYPE");

CREATE TABLE IF NOT EXISTS "mix_INVENTORY_COUNT_TOTALS_ARCHIVE" (
  "ARCHIVE_ID" text NOT NULL REFERENCES "mix_INVENTORY_COUNT_ARCHIVE" ("ARCHIVE_ID") ON DELETE CASCADE,
  "ID" text NOT NULL,
  "PRODUCT ID" text,
  "COUNT_TYPE" text,
  "COUNTED QTY" numeric,
  PRIMARY KEY ("ARCHIVE_ID", "ID")
);

CREATE INDEX IF NOT EXISTS idx_mix_ic_totals_archive_product
  ON "mix_INVENTORY_COUNT_TOTALS_ARCHIVE" ("ARCHIVE_ID", "PRODUCT ID", "COUNT_TYPE");

ALTER TABLE "mix_INVENTORY_COUNT_ARCHIVE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mix_INVENTORY_COUNT_DETAILS_ARCHIVE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mix_INVENTORY_COUNT_TOTALS_ARCHIVE" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mix_INVENTORY_COUNT_ARCHIVE'
      AND policyname = 'mix_ic_archive_select'
  ) THEN
    CREATE POLICY mix_ic_archive_select ON "mix_INVENTORY_COUNT_ARCHIVE" FOR SELECT TO public USING (true);
    CREATE POLICY mix_ic_archive_insert ON "mix_INVENTORY_COUNT_ARCHIVE" FOR INSERT TO public WITH CHECK (true);
    CREATE POLICY mix_ic_archive_update ON "mix_INVENTORY_COUNT_ARCHIVE" FOR UPDATE TO public USING (true);
    CREATE POLICY mix_ic_archive_delete ON "mix_INVENTORY_COUNT_ARCHIVE" FOR DELETE TO public USING (true);

    CREATE POLICY mix_ic_details_archive_select ON "mix_INVENTORY_COUNT_DETAILS_ARCHIVE" FOR SELECT TO public USING (true);
    CREATE POLICY mix_ic_details_archive_insert ON "mix_INVENTORY_COUNT_DETAILS_ARCHIVE" FOR INSERT TO public WITH CHECK (true);
    CREATE POLICY mix_ic_details_archive_update ON "mix_INVENTORY_COUNT_DETAILS_ARCHIVE" FOR UPDATE TO public USING (true);
    CREATE POLICY mix_ic_details_archive_delete ON "mix_INVENTORY_COUNT_DETAILS_ARCHIVE" FOR DELETE TO public USING (true);

    CREATE POLICY mix_ic_totals_archive_select ON "mix_INVENTORY_COUNT_TOTALS_ARCHIVE" FOR SELECT TO public USING (true);
    CREATE POLICY mix_ic_totals_archive_insert ON "mix_INVENTORY_COUNT_TOTALS_ARCHIVE" FOR INSERT TO public WITH CHECK (true);
    CREATE POLICY mix_ic_totals_archive_update ON "mix_INVENTORY_COUNT_TOTALS_ARCHIVE" FOR UPDATE TO public USING (true);
    CREATE POLICY mix_ic_totals_archive_delete ON "mix_INVENTORY_COUNT_TOTALS_ARCHIVE" FOR DELETE TO public USING (true);
  END IF;
END $$;
