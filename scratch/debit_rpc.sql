-- ============================================================
-- Debit Analysis — live RPC (no persistent cache)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_mix_debit_customer_id ON "mix_DEBIT" ("CUSTOMER ID");
CREATE INDEX IF NOT EXISTS idx_mix_debit_date ON "mix_DEBIT" ("DATE");
CREATE INDEX IF NOT EXISTS idx_mix_debit_matching ON "mix_DEBIT" ("MATCHING");
CREATE INDEX IF NOT EXISTS idx_mix_debit_customer_date ON "mix_DEBIT" ("CUSTOMER ID", "DATE");

DROP FUNCTION IF EXISTS get_debit_metadata();
CREATE OR REPLACE FUNCTION get_debit_metadata()
RETURNS json AS $$
DECLARE
  v_last date;
BEGIN
  SELECT MAX("DATE"::date) INTO v_last FROM "mix_DEBIT" WHERE "DATE" IS NOT NULL;

  RETURN json_build_object(
    'success', true,
    'rowCount', (SELECT COUNT(*)::bigint FROM "mix_DEBIT"),
    'customerCount', (SELECT COUNT(DISTINCT "CUSTOMER ID")::bigint FROM "mix_DEBIT" WHERE "CUSTOMER ID" IS NOT NULL),
    'lastUpdated', CASE WHEN v_last IS NULL THEN NULL ELSE to_char(v_last, 'YYYY-MM-DD') END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';

DROP FUNCTION IF EXISTS get_debit_transactions(text, text, text, int, int);
CREATE OR REPLACE FUNCTION get_debit_transactions(
  p_search text DEFAULT NULL,
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS json AS $$
DECLARE
  v_from date;
  v_to date;
  v_total bigint;
  v_rows json;
BEGIN
  IF p_date_from IS NOT NULL AND p_date_from != '' THEN
    v_from := p_date_from::date;
  END IF;
  IF p_date_to IS NOT NULL AND p_date_to != '' THEN
    v_to := p_date_to::date;
  END IF;

  WITH filtered AS (
    SELECT
      d."ID" AS id,
      d."DATE" AS date,
      d."DUE DATE" AS "dueDate",
      d."NUMBER" AS number,
      d."CUSTOMER ID" AS "customerId",
      COALESCE(c."CUSTOMER MAIN NAME", d."CUSTOMER ID", '') AS "customerName",
      COALESCE(c."CUSTOMER CITY", '') AS city,
      COALESCE(c."CUSTOMER CITY", '') AS "salesRep",
      COALESCE(d."DEBIT"::numeric, 0) AS debit,
      COALESCE(d."CREDIT"::numeric, 0) AS credit,
      COALESCE(d."RESIDUAL AMOUNT"::numeric, 0) AS "residualAmount",
      COALESCE(d."MATCHING", '') AS matching,
      COALESCE(c."CREDIT LIMIT"::numeric, 0) AS "creditLimit"
    FROM "mix_DEBIT" d
    LEFT JOIN "bhs_CUSTOMERS" c ON c."CUSTOMER ID" = d."CUSTOMER ID"
    WHERE (v_from IS NULL OR d."DATE"::date >= v_from)
      AND (v_to IS NULL OR d."DATE"::date <= v_to)
      AND (
        p_search IS NULL OR p_search = '' OR
        COALESCE(c."CUSTOMER MAIN NAME", d."CUSTOMER ID", '') ILIKE '%' || p_search || '%' OR
        COALESCE(d."NUMBER", '') ILIKE '%' || p_search || '%' OR
        COALESCE(d."MATCHING", '') ILIKE '%' || p_search || '%'
      )
  )
  SELECT COUNT(*) INTO v_total FROM filtered;

  SELECT COALESCE(json_agg(row_json ORDER BY date DESC, number), '[]'::json)
  INTO v_rows
  FROM (
    SELECT json_build_object(
      'id', id,
      'date', date,
      'dueDate', "dueDate",
      'number', number,
      'customerId', "customerId",
      'customerName', "customerName",
      'city', city,
      'salesRep', "salesRep",
      'debit', debit,
      'credit', credit,
      'residualAmount', "residualAmount",
      'matching', matching,
      'creditLimit', "creditLimit"
    ) AS row_json
    FROM filtered
    ORDER BY date DESC NULLS LAST, number
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0)
  ) sub;

  RETURN json_build_object(
    'success', true,
    'total', v_total,
    'data', v_rows
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '60s';

DROP FUNCTION IF EXISTS get_debit_customers_aggregated();
CREATE OR REPLACE FUNCTION get_debit_customers_aggregated()
RETURNS TABLE(
  "customerId" text,
  "customerName" text,
  city text,
  "creditLimit" numeric,
  "totalDebit" numeric,
  "totalCredit" numeric,
  "netDebt" numeric,
  "transactionCount" bigint,
  "lastTransactionDate" text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d."CUSTOMER ID"::text AS "customerId",
    COALESCE(c."CUSTOMER MAIN NAME", d."CUSTOMER ID", '')::text AS "customerName",
    COALESCE(c."CUSTOMER CITY", '')::text AS city,
    COALESCE(c."CREDIT LIMIT"::numeric, 0) AS "creditLimit",
    COALESCE(SUM(d."DEBIT"::numeric), 0) AS "totalDebit",
    COALESCE(SUM(d."CREDIT"::numeric), 0) AS "totalCredit",
    COALESCE(SUM(d."DEBIT"::numeric), 0) - COALESCE(SUM(d."CREDIT"::numeric), 0) AS "netDebt",
    COUNT(*)::bigint AS "transactionCount",
    to_char(MAX(d."DATE"::date), 'YYYY-MM-DD') AS "lastTransactionDate"
  FROM "mix_DEBIT" d
  LEFT JOIN "bhs_CUSTOMERS" c ON c."CUSTOMER ID" = d."CUSTOMER ID"
  WHERE d."CUSTOMER ID" IS NOT NULL
  GROUP BY d."CUSTOMER ID", c."CUSTOMER MAIN NAME", c."CUSTOMER CITY", c."CREDIT LIMIT"
  ORDER BY "customerName";
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '60s';

DROP FUNCTION IF EXISTS get_debit_payments_summary(text, text);
CREATE OR REPLACE FUNCTION get_debit_payments_summary(
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_from date;
  v_to date;
  v_total bigint;
  v_amount numeric;
  v_rows json;
BEGIN
  IF p_date_from IS NOT NULL AND p_date_from != '' THEN
    v_from := p_date_from::date;
  END IF;
  IF p_date_to IS NOT NULL AND p_date_to != '' THEN
    v_to := p_date_to::date;
  END IF;

  WITH payments AS (
    SELECT
      d."DATE"::date AS pay_date,
      COALESCE(c."CUSTOMER MAIN NAME", d."CUSTOMER ID", '') AS customer_name,
      COALESCE(d."CREDIT"::numeric, 0) - COALESCE(d."DEBIT"::numeric, 0) AS amount
    FROM "mix_DEBIT" d
    LEFT JOIN "bhs_CUSTOMERS" c ON c."CUSTOMER ID" = d."CUSTOMER ID"
    WHERE (
      UPPER(COALESCE(d."NUMBER", '')) LIKE 'BNK%' OR
      (COALESCE(d."CREDIT"::numeric, 0) > 0.01 AND UPPER(COALESCE(d."NUMBER", '')) NOT LIKE 'PBNK%')
    )
      AND (v_from IS NULL OR d."DATE"::date >= v_from)
      AND (v_to IS NULL OR d."DATE"::date <= v_to)
  )
  SELECT COUNT(*)::bigint, COALESCE(SUM(amount), 0)
  INTO v_total, v_amount
  FROM payments;

  SELECT COALESCE(json_agg(json_build_object(
    'date', to_char(pay_date, 'YYYY-MM-DD'),
    'customerName', customer_name,
    'amount', amount
  ) ORDER BY pay_date DESC), '[]'::json)
  INTO v_rows
  FROM payments;

  RETURN json_build_object(
    'success', true,
    'totalPayments', v_total,
    'totalAmount', v_amount,
    'data', v_rows
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '60s';
