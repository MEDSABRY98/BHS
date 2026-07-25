-- Inventory Count Archive tables + RLS (PostgreSQL / Supabase)
-- Table names are lowercase (unquoted identifiers). Column names keep quoted casing.

CREATE TABLE IF NOT EXISTS web_inventory_count_archive (
  "ARCHIVE_ID" text PRIMARY KEY,
  "COUNT_DATE" date,
  "LABEL" text,
  "DETAIL_ROW_COUNT" integer NOT NULL DEFAULT 0,
  "TOTAL_ROW_COUNT" integer NOT NULL DEFAULT 0,
  "RESET_LIVE" boolean NOT NULL DEFAULT false,
  "CLOSED_AT" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_archive_closed_at
  ON web_inventory_count_archive ("CLOSED_AT" DESC);

CREATE TABLE IF NOT EXISTS web_inventory_count_details_archive (
  "ARCHIVE_ID" text NOT NULL REFERENCES web_inventory_count_archive ("ARCHIVE_ID") ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_ic_details_archive_product
  ON web_inventory_count_details_archive ("ARCHIVE_ID", "PRODUCT ID");

CREATE INDEX IF NOT EXISTS idx_ic_details_archive_type
  ON web_inventory_count_details_archive ("ARCHIVE_ID", "COUNT_TYPE");

CREATE TABLE IF NOT EXISTS web_inventory_count_totals_archive (
  "ARCHIVE_ID" text NOT NULL REFERENCES web_inventory_count_archive ("ARCHIVE_ID") ON DELETE CASCADE,
  "ID" text NOT NULL,
  "PRODUCT ID" text,
  "COUNT_TYPE" text,
  "COUNTED QTY" numeric,
  PRIMARY KEY ("ARCHIVE_ID", "ID")
);

CREATE INDEX IF NOT EXISTS idx_ic_totals_archive_product
  ON web_inventory_count_totals_archive ("ARCHIVE_ID", "PRODUCT ID", "COUNT_TYPE");

-- RLS policies (match mix_INVENTORY_COUNT_* pattern)
ALTER TABLE web_inventory_count_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_inventory_count_details_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_inventory_count_totals_archive ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'web_inventory_count_archive'
      AND policyname = 'ic_archive_select'
  ) THEN
    CREATE POLICY ic_archive_select ON web_inventory_count_archive FOR SELECT TO public USING (true);
    CREATE POLICY ic_archive_insert ON web_inventory_count_archive FOR INSERT TO public WITH CHECK (true);
    CREATE POLICY ic_archive_update ON web_inventory_count_archive FOR UPDATE TO public USING (true);
    CREATE POLICY ic_archive_delete ON web_inventory_count_archive FOR DELETE TO public USING (true);

    CREATE POLICY ic_details_archive_select ON web_inventory_count_details_archive FOR SELECT TO public USING (true);
    CREATE POLICY ic_details_archive_insert ON web_inventory_count_details_archive FOR INSERT TO public WITH CHECK (true);
    CREATE POLICY ic_details_archive_update ON web_inventory_count_details_archive FOR UPDATE TO public USING (true);
    CREATE POLICY ic_details_archive_delete ON web_inventory_count_details_archive FOR DELETE TO public USING (true);

    CREATE POLICY ic_totals_archive_select ON web_inventory_count_totals_archive FOR SELECT TO public USING (true);
    CREATE POLICY ic_totals_archive_insert ON web_inventory_count_totals_archive FOR INSERT TO public WITH CHECK (true);
    CREATE POLICY ic_totals_archive_update ON web_inventory_count_totals_archive FOR UPDATE TO public USING (true);
    CREATE POLICY ic_totals_archive_delete ON web_inventory_count_totals_archive FOR DELETE TO public USING (true);
  END IF;
END $$;
