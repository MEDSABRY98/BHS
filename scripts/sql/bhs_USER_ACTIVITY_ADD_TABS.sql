-- Add TABS column to store visited sub-tabs as JSON (one row per module session).
ALTER TABLE public."bhs_USERS_ACTIVITY"
  ADD COLUMN IF NOT EXISTS "TABS" text;

COMMENT ON COLUMN public."bhs_USERS_ACTIVITY"."TABS" IS 'JSON array of visited tabs, e.g. [{"name":"Statistics","at":"2026-08-03T..."}]';
