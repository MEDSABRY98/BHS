-- ============================================================
-- Suppliers DB — month card summaries
-- Replaces paginated DATE fetches in JS (~1000 rows per round-trip)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_web_suppliers_invoices_date_type
  ON "web_Suppliers_Invoices" ("DATE", "TYPE");

CREATE INDEX IF NOT EXISTS idx_web_suppliers_purchase_date
  ON "web_Suppliers_Purchase" ("DATE");

DROP FUNCTION IF EXISTS get_suppliers_invoices_months_summary(text);
CREATE OR REPLACE FUNCTION get_suppliers_invoices_months_summary(p_type text)
RETURNS TABLE(year int, month int, count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(YEAR FROM i."DATE"::date)::int AS year,
    EXTRACT(MONTH FROM i."DATE"::date)::int AS month,
    COUNT(*)::bigint AS count
  FROM "web_Suppliers_Invoices" i
  WHERE i."DATE" IS NOT NULL
    AND i."TYPE" = p_type
  GROUP BY 1, 2
  ORDER BY year DESC, month DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';

DROP FUNCTION IF EXISTS get_suppliers_purchase_months_summary();
CREATE OR REPLACE FUNCTION get_suppliers_purchase_months_summary()
RETURNS TABLE(year int, month int, count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(YEAR FROM p."DATE"::date)::int AS year,
    EXTRACT(MONTH FROM p."DATE"::date)::int AS month,
    COUNT(*)::bigint AS count
  FROM "web_Suppliers_Purchase" p
  WHERE p."DATE" IS NOT NULL
  GROUP BY 1, 2
  ORDER BY year DESC, month DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';
