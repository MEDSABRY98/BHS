-- Run once in Supabase SQL editor
-- Reference table for inventory location names → stable LOC- IDs
-- Table name MUST be quoted to match other web_* tables (mixed case).

CREATE TABLE IF NOT EXISTS "web_INVENTORY_LOCATIONS" (
  "ID" text PRIMARY KEY,
  "LOCATION NAME" text NOT NULL UNIQUE,
  "LOCATION TYPE" text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_name
  ON "web_INVENTORY_LOCATIONS" ("LOCATION NAME");

COMMENT ON TABLE "web_INVENTORY_LOCATIONS" IS 'Inventory location registry: ID, display name, classification type';
COMMENT ON COLUMN "web_INVENTORY_LOCATIONS"."LOCATION TYPE" IS 'internal | internal_water_cluster | internal_core | inflow | outflow | external';

-- RLS (required — without policies Supabase returns 0 rows)
ALTER TABLE "web_INVENTORY_LOCATIONS" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'web_INVENTORY_LOCATIONS' AND policyname = 'inventory_locations_select'
  ) THEN
    CREATE POLICY inventory_locations_select ON "web_INVENTORY_LOCATIONS"
      FOR SELECT TO public USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'web_INVENTORY_LOCATIONS' AND policyname = 'inventory_locations_insert'
  ) THEN
    CREATE POLICY inventory_locations_insert ON "web_INVENTORY_LOCATIONS"
      FOR INSERT TO public WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'web_INVENTORY_LOCATIONS' AND policyname = 'inventory_locations_update'
  ) THEN
    CREATE POLICY inventory_locations_update ON "web_INVENTORY_LOCATIONS"
      FOR UPDATE TO public USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'web_INVENTORY_LOCATIONS' AND policyname = 'inventory_locations_delete'
  ) THEN
    CREATE POLICY inventory_locations_delete ON "web_INVENTORY_LOCATIONS"
      FOR DELETE TO public USING (true);
  END IF;
END $$;
