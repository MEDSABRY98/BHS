-- ============================================================
-- RPC 1: get_inventory_balance_report
-- Replaces getProductsBalanceReportData() — the heaviest function
-- Computes opening stock, period movements, ending stock per product
-- ============================================================

DROP FUNCTION IF EXISTS get_inventory_balance_report(text, text);
DROP FUNCTION IF EXISTS get_inventory_balance_report(text, text, boolean);
DROP FUNCTION IF EXISTS get_inventory_product_period_movements(text, text, text);

CREATE OR REPLACE FUNCTION get_inventory_balance_report(
  p_date_from text DEFAULT NULL,
  p_date_to   text DEFAULT NULL,
  p_include_movements boolean DEFAULT false
)
RETURNS json AS $$
DECLARE
  v_result   json;
  v_from_date timestamptz;
  v_to_date   timestamptz;
BEGIN
  IF p_date_from IS NOT NULL AND p_date_from != '' THEN
    v_from_date := (p_date_from || 'T00:00:00.000Z')::timestamptz;
  END IF;
  IF p_date_to IS NOT NULL AND p_date_to != '' THEN
    v_to_date := (p_date_to || 'T23:59:59.999Z')::timestamptz;
  END IF;

  WITH classified AS (
    SELECT
      m."PRODUCT ID" AS product_id,
      m."DATE"::timestamptz AS move_date,
      TRIM(m."LOCATION FROM") AS loc_from,
      TRIM(m."LOCATION TO")   AS loc_to,
      COALESCE(m."QTY"::numeric, 0) AS qty,
      (TRIM(m."LOCATION FROM") IN ('M/WH/Mazyad','S/WH/S20','GM/WH/Game area','HA/WH/Hashi')) AS from_internal,
      (TRIM(m."LOCATION TO")   IN ('M/WH/Mazyad','S/WH/S20','GM/WH/Game area','HA/WH/Hashi')) AS to_internal
    FROM "web_INVENTORY_MOVES" m
    WHERE m."PRODUCT ID" IS NOT NULL
      AND m."QTY" IS NOT NULL
      AND m."QTY"::numeric != 0
  ),
  valid_moves AS (
    SELECT * FROM classified
    WHERE (from_internal OR to_internal)
      AND NOT (from_internal AND to_internal)
  ),
  with_effects AS (
    SELECT
      *,
      CASE WHEN to_internal THEN qty ELSE -qty END AS effect,
      CASE
        WHEN move_date IS NOT NULL AND v_from_date IS NOT NULL AND move_date < v_from_date THEN 'opening'
        WHEN move_date IS NOT NULL AND v_to_date   IS NOT NULL AND move_date > v_to_date   THEN 'future'
        ELSE 'period'
      END AS period,
      CASE WHEN to_internal THEN loc_from ELSE loc_to END AS other_loc
    FROM valid_moves
  ),

  -- Opening stock per product
  opening AS (
    SELECT product_id, SUM(effect) AS opening_stock
    FROM with_effects WHERE period = 'opening'
    GROUP BY product_id
  ),

  -- Period movement aggregates per product
  period_agg AS (
    SELECT
      product_id,
      SUM(CASE WHEN other_loc = 'Partners/Vendors'                                  THEN effect ELSE 0 END) AS net_vendors,
      SUM(CASE WHEN other_loc = 'Partners/Customers'                                 THEN effect ELSE 0 END) AS net_customers,
      SUM(CASE WHEN other_loc = 'Virtual Locations/Inventory adjustment'              THEN effect ELSE 0 END) AS net_adjustment,
      SUM(CASE WHEN other_loc NOT IN ('Partners/Vendors','Partners/Customers','Virtual Locations/Inventory adjustment')
               THEN effect ELSE 0 END) AS net_production
    FROM with_effects WHERE period = 'period'
    GROUP BY product_id
  ),

  -- Period movements detail (individual rows) per product — only when requested
  period_detail AS (
    SELECT
      product_id,
      json_agg(json_build_object(
        'date',         to_char(move_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'reference',    '-',
        'locationFrom', loc_from,
        'locationTo',   loc_to,
        'qty',          qty,
        'type',         CASE
          WHEN to_internal AND other_loc = 'Partners/Vendors'                       THEN 'vendor_in'
          WHEN NOT to_internal AND other_loc = 'Partners/Vendors'                   THEN 'vendor_return'
          WHEN to_internal AND other_loc = 'Partners/Customers'                     THEN 'customer_return'
          WHEN NOT to_internal AND other_loc = 'Partners/Customers'                 THEN 'customer_sale'
          WHEN to_internal AND other_loc LIKE 'Physical Locations/Subcontracting%'  THEN 'subcontracting_in'
          WHEN NOT to_internal AND other_loc LIKE 'Physical Locations/Subcontracting%' THEN 'subcontracting_out'
          WHEN to_internal AND other_loc = 'Virtual Locations/Inventory adjustment' THEN 'adjustment_in'
          WHEN NOT to_internal AND other_loc = 'Virtual Locations/Inventory adjustment' THEN 'adjustment_out'
          WHEN to_internal AND other_loc = 'Virtual Locations/Production'           THEN 'production_in'
          WHEN NOT to_internal AND other_loc = 'Virtual Locations/Production'       THEN 'production_out'
          WHEN to_internal THEN 'production_in'
          ELSE 'production_out'
        END
      )) AS movements
    FROM with_effects
    WHERE period = 'period' AND p_include_movements
    GROUP BY product_id
  ),

  -- Combine everything per product
  combined AS (
    SELECT
      p."PRODUCT ID"       AS "productId",
      p."PRODUCT BARCODE"  AS "barcode",
      p."PRODUCT NAME"     AS "productName",
      COALESCE(
        NULLIF(TRIM(regexp_replace(TRIM(COALESCE(p."PRODUCT CATEGORY", '')), '^.*\/', '')), ''),
        'Uncategorized'
      ) AS "category",
      COALESCE(o.opening_stock, 0)  AS "openingStock",
      COALESCE(pa.net_vendors, 0)   AS "netVendors",
      COALESCE(pa.net_customers, 0) AS "netCustomers",
      COALESCE(pa.net_production, 0) AS "netProduction",
      COALESCE(pa.net_adjustment, 0) AS "netAdjustment",
      COALESCE(o.opening_stock, 0)
        + COALESCE(pa.net_vendors, 0)
        + COALESCE(pa.net_customers, 0)
        + COALESCE(pa.net_production, 0)
        + COALESCE(pa.net_adjustment, 0) AS "endingStock",
      CASE
        WHEN p_include_movements THEN COALESCE(pd.movements, '[]'::json)
        ELSE '[]'::json
      END AS "periodMovements"
    FROM "bhs_PRODUCTS" p
    LEFT JOIN opening     o  ON o.product_id = p."PRODUCT ID"
    LEFT JOIN period_agg  pa ON pa.product_id = p."PRODUCT ID"
    LEFT JOIN period_detail pd ON pd.product_id = p."PRODUCT ID" AND p_include_movements
    WHERE p."PRODUCT NAME" IS NOT NULL AND TRIM(p."PRODUCT NAME") != ''
  )
  SELECT COALESCE(json_agg(row_json ORDER BY "productName"), '[]'::json)
  INTO v_result
  FROM (
    SELECT
      (
        json_build_object(
          'productId', "productId",
          'barcode', "barcode",
          'productName', "productName",
          'category', "category",
          'openingStock', "openingStock",
          'netVendors', "netVendors",
          'netCustomers', "netCustomers",
          'netProduction', "netProduction",
          'netAdjustment', "netAdjustment",
          'endingStock', "endingStock"
        )::jsonb
        || jsonb_build_object(
          'periodMovements',
          CASE
            WHEN p_include_movements THEN COALESCE("periodMovements", '[]'::json)::jsonb
            ELSE '[]'::jsonb
          END
        )
      )::json AS row_json,
      "productName"
    FROM combined
    WHERE "productId" IN (SELECT DISTINCT product_id FROM with_effects)
       OR "openingStock" != 0
       OR "endingStock" != 0
  ) report_rows;

  IF v_result IS NULL THEN v_result := '[]'::json; END IF;

  RETURN json_build_object('success', true, 'data', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '60s';


-- ============================================================
-- RPC 1b: get_inventory_product_period_movements
-- Returns period ledger rows for a single product (lazy-loaded details)
-- ============================================================

CREATE OR REPLACE FUNCTION get_inventory_product_period_movements(
  p_product_id text,
  p_date_from  text DEFAULT NULL,
  p_date_to    text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_result    json;
  v_from_date timestamptz;
  v_to_date   timestamptz;
BEGIN
  IF p_product_id IS NULL OR TRIM(p_product_id) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Product ID is required');
  END IF;

  IF p_date_from IS NOT NULL AND p_date_from != '' THEN
    v_from_date := (p_date_from || 'T00:00:00.000Z')::timestamptz;
  END IF;
  IF p_date_to IS NOT NULL AND p_date_to != '' THEN
    v_to_date := (p_date_to || 'T23:59:59.999Z')::timestamptz;
  END IF;

  WITH classified AS (
    SELECT
      m."DATE"::timestamptz AS move_date,
      TRIM(m."LOCATION FROM") AS loc_from,
      TRIM(m."LOCATION TO")   AS loc_to,
      COALESCE(m."QTY"::numeric, 0) AS qty,
      COALESCE(NULLIF(TRIM(m.REFERENCE), ''), '-') AS reference,
      (TRIM(m."LOCATION FROM") IN ('M/WH/Mazyad','S/WH/S20','GM/WH/Game area','HA/WH/Hashi')) AS from_internal,
      (TRIM(m."LOCATION TO")   IN ('M/WH/Mazyad','S/WH/S20','GM/WH/Game area','HA/WH/Hashi')) AS to_internal
    FROM "web_INVENTORY_MOVES" m
    WHERE m."PRODUCT ID" = TRIM(p_product_id)
      AND m."QTY" IS NOT NULL
      AND m."QTY"::numeric != 0
      AND (v_from_date IS NULL OR m."DATE"::timestamptz >= v_from_date)
      AND (v_to_date   IS NULL OR m."DATE"::timestamptz <= v_to_date)
  ),
  ledger_rows AS (
    SELECT
      move_date,
      reference,
      loc_from,
      loc_to,
      qty,
      CASE
        WHEN from_internal AND to_internal THEN 'transfer'
        WHEN to_internal AND loc_from = 'Partners/Vendors'                       THEN 'vendor_in'
        WHEN NOT to_internal AND loc_to = 'Partners/Vendors'                     THEN 'vendor_return'
        WHEN to_internal AND loc_from = 'Partners/Customers'                     THEN 'customer_return'
        WHEN NOT to_internal AND loc_to = 'Partners/Customers'                     THEN 'customer_sale'
        WHEN to_internal AND loc_from LIKE 'Physical Locations/Subcontracting%'    THEN 'subcontracting_in'
        WHEN NOT to_internal AND loc_to LIKE 'Physical Locations/Subcontracting%' THEN 'subcontracting_out'
        WHEN to_internal AND loc_from = 'Virtual Locations/Inventory adjustment' THEN 'adjustment_in'
        WHEN NOT to_internal AND loc_to = 'Virtual Locations/Inventory adjustment' THEN 'adjustment_out'
        WHEN to_internal AND loc_from = 'Virtual Locations/Production'           THEN 'production_in'
        WHEN NOT to_internal AND loc_to = 'Virtual Locations/Production'           THEN 'production_out'
        WHEN to_internal THEN 'production_in'
        ELSE 'production_out'
      END AS move_type
    FROM classified
    WHERE (from_internal OR to_internal)
  )
  SELECT COALESCE(json_agg(json_build_object(
    'date',         to_char(move_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'reference',    reference,
    'locationFrom', loc_from,
    'locationTo',   loc_to,
    'qty',          qty,
    'type',         move_type
  ) ORDER BY move_date DESC), '[]'::json)
  INTO v_result
  FROM ledger_rows;

  RETURN json_build_object('success', true, 'data', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';


-- ============================================================
-- RPC 2: get_inventory_product_analysis
-- Replaces getSingleProductAnalysis()
-- Returns summary + period breakdown (monthly or daily) for one product
-- ============================================================

DROP FUNCTION IF EXISTS get_inventory_product_analysis(text, int, int, text, text, text);

CREATE OR REPLACE FUNCTION get_inventory_product_analysis(
  p_product_id text,
  p_year       int     DEFAULT NULL,
  p_month      int     DEFAULT NULL,
  p_date_from  text    DEFAULT NULL,
  p_date_to    text    DEFAULT NULL,
  p_preset     text    DEFAULT 'all'
)
RETURNS json AS $$
DECLARE
  v_result     json;
  v_granularity text;
  v_filter_start timestamptz;
  v_filter_end   timestamptz;
  v_now         timestamptz := now();
BEGIN
  -- Determine granularity and date bounds
  v_granularity := CASE WHEN p_preset = '7days' THEN 'day' ELSE 'month' END;

  IF p_preset IS NOT NULL AND p_preset != 'all' AND p_preset != '' THEN
    IF p_preset = '7days' THEN
      v_filter_start := date_trunc('day', v_now) - interval '7 days';
    ELSIF p_preset = '1month' THEN
      v_filter_start := date_trunc('day', v_now) - interval '1 month';
    ELSIF p_preset = '3months' THEN
      v_filter_start := date_trunc('day', v_now) - interval '3 months';
    ELSIF p_preset = '6months' THEN
      v_filter_start := date_trunc('day', v_now) - interval '6 months';
    END IF;
    v_filter_end := v_now;
  ELSIF p_date_from IS NOT NULL AND p_date_from != '' THEN
    v_filter_start := (p_date_from || 'T00:00:00.000Z')::timestamptz;
    v_filter_end := CASE WHEN p_date_to IS NOT NULL AND p_date_to != ''
                         THEN (p_date_to || 'T23:59:59.999Z')::timestamptz
                         ELSE v_now END;
  ELSIF p_year IS NOT NULL THEN
    IF p_month IS NOT NULL AND p_month BETWEEN 1 AND 12 THEN
      v_filter_start := make_timestamp(p_year, p_month, 1, 0, 0, 0);
      v_filter_end   := (make_timestamp(p_year, p_month, 1, 0, 0, 0) + interval '1 month - 1 second');
    ELSE
      v_filter_start := make_timestamp(p_year, 1, 1, 0, 0, 0);
      v_filter_end   := make_timestamp(p_year, 12, 31, 23, 59, 59);
    END IF;
  ELSE
    v_filter_start := NULL;
    v_filter_end   := v_now;
  END IF;

  WITH product_moves AS (
    SELECT
      m."DATE"::timestamptz AS move_date,
      TRIM(m."LOCATION FROM") AS loc_from,
      TRIM(m."LOCATION TO")   AS loc_to,
      COALESCE(m."QTY"::numeric, 0) AS qty
    FROM "web_INVENTORY_MOVES" m
    WHERE m."PRODUCT ID" = TRIM(p_product_id)
      AND m."QTY" IS NOT NULL
      AND m."QTY"::numeric != 0
  ),
  -- Ending balance: total net effect of ALL moves (no date filter)
  ending_calc AS (
    SELECT COALESCE(SUM(
      CASE
        WHEN TRIM(loc_to) IN ('M/WH/Mazyad','S/WH/S20','GM/WH/Game area','HA/WH/Hashi')
             AND NOT (TRIM(loc_from) IN ('M/WH/Mazyad','S/WH/S20','GM/WH/Game area','HA/WH/Hashi'))
        THEN qty
        WHEN TRIM(loc_from) IN ('M/WH/Mazyad','S/WH/S20','GM/WH/Game area','HA/WH/Hashi')
             AND NOT (TRIM(loc_to) IN ('M/WH/Mazyad','S/WH/S20','GM/WH/Game area','HA/WH/Hashi'))
        THEN -qty
        ELSE 0
      END
    ), 0) AS ending_stock
    FROM product_moves
  ),
  -- Find min date if no filter start
  min_date_calc AS (
    SELECT MIN(move_date) AS min_date FROM product_moves
  ),
  effective_start AS (
    SELECT COALESCE(
      v_filter_start,
      (SELECT date_trunc('month', min_date) FROM min_date_calc),
      date_trunc('month', v_now)
    ) AS start_date
  ),
  -- Filtered moves
  filtered AS (
    SELECT * FROM product_moves
    WHERE (v_filter_start IS NULL OR move_date >= v_filter_start)
      AND (v_filter_end   IS NULL OR move_date <= v_filter_end)
  ),
  -- Aggregate totals
  totals AS (
    SELECT
      COALESCE(SUM(CASE WHEN loc_to = 'Partners/Customers'   THEN qty ELSE 0 END), 0) AS total_sales,
      COALESCE(SUM(CASE WHEN loc_from = 'Partners/Customers' THEN qty ELSE 0 END), 0) AS total_returns,
      COALESCE(SUM(CASE WHEN loc_from = 'Partners/Vendors'   THEN qty ELSE 0 END), 0) AS total_purchases_in,
      COALESCE(SUM(CASE WHEN loc_to = 'Partners/Vendors'     THEN qty ELSE 0 END), 0) AS total_purchases_out
    FROM filtered
  ),
  -- Generate period buckets
  periods AS (
    SELECT
      CASE WHEN v_granularity = 'day'
        THEN to_char(d::date, 'YYYY-MM-DD')
        ELSE to_char(d, 'YYYY-MM')
      END AS key,
      CASE WHEN v_granularity = 'day'
        THEN to_char(d::date, 'Dy, Mon DD')
        ELSE to_char(d, 'FMMonth YYYY')
      END AS label,
      d::date AS period_date
    FROM generate_series(
      (SELECT start_date FROM effective_start),
      COALESCE(v_filter_end, v_now),
      CASE WHEN v_granularity = 'day' THEN '1 day'::interval ELSE '1 month'::interval END
    ) d
  ),
  -- Aggregate per period
  period_moves AS (
    SELECT
      CASE WHEN v_granularity = 'day'
        THEN to_char(move_date AT TIME ZONE 'UTC', 'YYYY-MM-DD')
        ELSE to_char(move_date AT TIME ZONE 'UTC', 'YYYY-MM')
      END AS key,
      COALESCE(SUM(CASE WHEN loc_to = 'Partners/Customers'   THEN qty ELSE 0 END), 0) AS sales,
      COALESCE(SUM(CASE WHEN loc_from = 'Partners/Customers' THEN qty ELSE 0 END), 0) AS returns,
      COALESCE(SUM(CASE WHEN loc_from = 'Partners/Vendors'   THEN qty ELSE 0 END), 0) AS purchases_in,
      COALESCE(SUM(CASE WHEN loc_to = 'Partners/Vendors'     THEN qty ELSE 0 END), 0) AS purchases_out
    FROM filtered
    GROUP BY key
  ),
  -- Build monthly/daily data array
  period_data AS (
    SELECT json_build_object(
      'key',       p.key,
      'label',     p.label,
      'sales',     COALESCE(pm.sales, 0),
      'returns',   COALESCE(pm.returns, 0),
      'purchases', COALESCE(pm.purchases_in, 0) - COALESCE(pm.purchases_out, 0)
    ) AS item
    FROM periods p
    LEFT JOIN period_moves pm ON pm.key = p.key
    ORDER BY p.period_date DESC
  )
  SELECT json_build_object(
    'success', true,
    'data', json_build_object(
      'summary', json_build_object(
        'sales',        t.total_sales,
        'returns',      t.total_returns,
        'returnsRate',  CASE WHEN t.total_sales > 0
                            THEN ROUND((t.total_returns::numeric / t.total_sales) * 100, 2)::text
                            ELSE '0' END,
        'netPurchases', t.total_purchases_in - t.total_purchases_out,
        'netFlow',      (t.total_purchases_in - t.total_purchases_out) - t.total_sales,
        'currentStock', ec.ending_stock,
        'endingBalance', ec.ending_stock
      ),
      'monthlyData', (
        SELECT COALESCE(json_agg(item), '[]'::json) FROM period_data
      ),
      'granularity', v_granularity
    )
  )
  INTO v_result
  FROM totals t, ending_calc ec;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';


-- ============================================================
-- RPC 3: get_inventory_product_orders
-- Replaces getProductOrdersData()
-- Returns products with 120-day sales + 4-month breakdown
-- ============================================================

DROP FUNCTION IF EXISTS get_inventory_product_orders();

CREATE OR REPLACE FUNCTION get_inventory_product_orders()
RETURNS json AS $$
DECLARE
  v_result json;
  v_now    timestamptz := now();
  v_120_days_ago timestamptz;
  v_month0_start timestamptz;
  v_month1_start timestamptz;
  v_month2_start timestamptz;
  v_month3_start timestamptz;
  v_month0_label text;
  v_month1_label text;
  v_month2_label text;
  v_month3_label text;
BEGIN
  v_120_days_ago := v_now - interval '120 days';
  -- Month boundaries (current month = 0, previous = 1, etc.)
  v_month0_start := date_trunc('month', v_now);
  v_month1_start := date_trunc('month', v_now - interval '1 month');
  v_month2_start := date_trunc('month', v_now - interval '2 months');
  v_month3_start := date_trunc('month', v_now - interval '3 months');

  v_month0_label := to_char(v_month0_start, 'Mon YY');
  v_month1_label := to_char(v_month1_start, 'Mon YY');
  v_month2_label := to_char(v_month2_start, 'Mon YY');
  v_month3_label := to_char(v_month3_start, 'Mon YY');

  WITH customer_moves AS (
    SELECT
      m."PRODUCT ID" AS product_id,
      m."DATE"::timestamptz AS move_date,
      COALESCE(m."QTY"::numeric, 0) AS qty
    FROM "web_INVENTORY_MOVES" m
    WHERE m."LOCATION TO" = 'Partners/Customers'
      AND m."PRODUCT ID" IS NOT NULL
      AND m."QTY" IS NOT NULL
      AND m."QTY"::numeric != 0
  ),
  product_sales AS (
    SELECT
      product_id,
      SUM(CASE WHEN move_date >= v_120_days_ago THEN qty ELSE 0 END) AS sales_qty,
      SUM(CASE WHEN move_date >= v_month0_start AND move_date < v_month0_start + interval '1 month' THEN qty ELSE 0 END) AS m0,
      SUM(CASE WHEN move_date >= v_month1_start AND move_date < v_month1_start + interval '1 month' THEN qty ELSE 0 END) AS m1,
      SUM(CASE WHEN move_date >= v_month2_start AND move_date < v_month2_start + interval '1 month' THEN qty ELSE 0 END) AS m2,
      SUM(CASE WHEN move_date >= v_month3_start AND move_date < v_month3_start + interval '1 month' THEN qty ELSE 0 END) AS m3
    FROM customer_moves
    GROUP BY product_id
  ),
  product_balance AS (
    SELECT
      m."PRODUCT ID" AS product_id,
      SUM(
        CASE
          WHEN TRIM(m."LOCATION TO") IN ('M/WH/Mazyad','S/WH/S20','GM/WH/Game area','HA/WH/Hashi')
               AND NOT (TRIM(m."LOCATION FROM") IN ('M/WH/Mazyad','S/WH/S20','GM/WH/Game area','HA/WH/Hashi'))
          THEN COALESCE(m."QTY"::numeric, 0)
          WHEN TRIM(m."LOCATION FROM") IN ('M/WH/Mazyad','S/WH/S20','GM/WH/Game area','HA/WH/Hashi')
               AND NOT (TRIM(m."LOCATION TO") IN ('M/WH/Mazyad','S/WH/S20','GM/WH/Game area','HA/WH/Hashi'))
          THEN -COALESCE(m."QTY"::numeric, 0)
          ELSE 0
        END
      ) AS ending_stock
    FROM "web_INVENTORY_MOVES" m
    WHERE m."PRODUCT ID" IS NOT NULL
      AND m."QTY" IS NOT NULL
      AND m."QTY"::numeric != 0
    GROUP BY m."PRODUCT ID"
  )
  SELECT json_agg(json_build_object(
    'productId',      p."PRODUCT ID",
    'barcode',        COALESCE(p."PRODUCT BARCODE", ''),
    'productName',    p."PRODUCT NAME",
    'tags',           COALESCE(NULLIF(TRIM(regexp_replace(TRIM(COALESCE(p."PRODUCT CATEGORY", '')), '^.*\/', '')), ''), ''),
    'qty',            COALESCE(pb.ending_stock, 0),
    'salesQty',       COALESCE(ps.sales_qty, 0),
    'salesBreakdown', json_build_array(
      json_build_object('label', v_month3_label, 'qty', COALESCE(ps.m3, 0)),
      json_build_object('label', v_month2_label, 'qty', COALESCE(ps.m2, 0)),
      json_build_object('label', v_month1_label, 'qty', COALESCE(ps.m1, 0)),
      json_build_object('label', v_month0_label, 'qty', COALESCE(ps.m0, 0))
    )
  ) ORDER BY p."PRODUCT NAME")
  INTO v_result
  FROM "bhs_PRODUCTS" p
  INNER JOIN product_sales ps ON ps.product_id = p."PRODUCT ID"
  LEFT JOIN product_balance pb ON pb.product_id = p."PRODUCT ID"
  WHERE p."PRODUCT NAME" IS NOT NULL AND TRIM(p."PRODUCT NAME") != '';

  IF v_result IS NULL THEN v_result := '[]'::json; END IF;

  RETURN json_build_object('success', true, 'data', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';

-- ============================================================
-- RPC 4: Inventory Moves DB — month/day card summaries
-- Replaces fetchAllMoveDates() JS fallback (~90k row paginated fetch)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_web_inventory_moves_date
  ON "web_INVENTORY_MOVES" ("DATE");

DROP FUNCTION IF EXISTS get_inventory_moves_months_summary();
CREATE OR REPLACE FUNCTION get_inventory_moves_months_summary()
RETURNS TABLE(year int, month int, count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(YEAR FROM m."DATE" AT TIME ZONE 'UTC')::int AS year,
    EXTRACT(MONTH FROM m."DATE" AT TIME ZONE 'UTC')::int AS month,
    COUNT(*)::bigint AS count
  FROM "web_INVENTORY_MOVES" m
  WHERE m."DATE" IS NOT NULL
  GROUP BY 1, 2
  ORDER BY year DESC, month DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';

DROP FUNCTION IF EXISTS get_inventory_moves_days_summary(int, int);
CREATE OR REPLACE FUNCTION get_inventory_moves_days_summary(
  p_year int,
  p_month int
)
RETURNS TABLE(date text, day int, count bigint) AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  v_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  IF p_month = 12 THEN
    v_end := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'UTC');
  ELSE
    v_end := make_timestamptz(p_year, p_month + 1, 1, 0, 0, 0, 'UTC');
  END IF;

  RETURN QUERY
  WITH day_counts AS (
    SELECT (m."DATE" AT TIME ZONE 'UTC')::date AS move_day
    FROM "web_INVENTORY_MOVES" m
    WHERE m."DATE" >= v_start
      AND m."DATE" < v_end
  )
  SELECT
    to_char(move_day, 'YYYY-MM-DD') AS date,
    EXTRACT(DAY FROM move_day)::int AS day,
    COUNT(*)::bigint AS count
  FROM day_counts
  GROUP BY move_day
  ORDER BY move_day DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';
