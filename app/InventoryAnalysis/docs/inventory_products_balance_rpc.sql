-- Products Balance RPC (run once in Supabase SQL Editor)
-- Mirrors warehouse rules in app/InventoryAnalysis/Components/locationTypes.ts

CREATE OR REPLACE FUNCTION inventory_normalize_location(loc text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(coalesce(loc, '')))
    WHEN 'm/wh/mazyad' THEN 'M/WH/Mazyad'
    WHEN 's/wh/s20' THEN 'S/WH/S20'
    WHEN 'wa/wh/water' THEN 'WA/WH/Water'
    WHEN 'wa/wh/ahmed magdy' THEN 'WA/WH/Ahmed Magdy'
    WHEN 'wa/wh/omer & salam' THEN 'WA/WH/Omer & Salam'
    WHEN 'gm/wh/game area' THEN 'GM/WH/Game area'
    WHEN 'ha/wh/hashi' THEN 'HA/WH/Hashi'
    WHEN 'partners/vendors' THEN 'Partners/Vendors'
    WHEN 'partners/customers' THEN 'Partners/Customers'
    WHEN 'virtual locations/inventory adjustment' THEN 'Virtual Locations/Inventory adjustment'
    WHEN 'virtual locations/production' THEN 'Virtual Locations/Production'
    WHEN 'physical locations/subcontracting location' THEN 'Physical Locations/Subcontracting Location'
    ELSE trim(coalesce(loc, ''))
  END;
$$;

CREATE OR REPLACE FUNCTION inventory_is_internal(loc text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT inventory_normalize_location(loc) IN (
    'M/WH/Mazyad',
    'S/WH/S20',
    'WA/WH/Water',
    'GM/WH/Game area',
    'HA/WH/Hashi',
    'WA/WH/Ahmed Magdy',
    'WA/WH/Omer & Salam'
  );
$$;

CREATE OR REPLACE FUNCTION inventory_is_water_cluster(loc text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT inventory_normalize_location(loc) IN (
    'WA/WH/Water',
    'WA/WH/Ahmed Magdy',
    'WA/WH/Omer & Salam'
  );
$$;

CREATE OR REPLACE FUNCTION inventory_is_internal_transfer(loc_from text, loc_to text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_from text := inventory_normalize_location(loc_from);
  v_to text := inventory_normalize_location(loc_to);
  v_from_internal boolean;
  v_to_internal boolean;
  v_from_core boolean;
  v_to_core boolean;
BEGIN
  IF (v_from = 'WA/WH/Water' AND v_to = 'M/WH/Mazyad')
     OR (v_from = 'M/WH/Mazyad' AND v_to = 'WA/WH/Water') THEN
    RETURN true;
  END IF;

  IF inventory_is_water_cluster(v_from) AND inventory_is_water_cluster(v_to) THEN
    RETURN true;
  END IF;

  v_from_internal := inventory_is_internal(v_from);
  v_to_internal := inventory_is_internal(v_to);

  IF NOT v_from_internal OR NOT v_to_internal THEN
    RETURN false;
  END IF;

  IF inventory_is_water_cluster(v_from) OR inventory_is_water_cluster(v_to) THEN
    RETURN false;
  END IF;

  v_from_core := v_from IN ('M/WH/Mazyad', 'S/WH/S20');
  v_to_core := v_to IN ('M/WH/Mazyad', 'S/WH/S20');

  IF v_from_core AND v_to_core THEN
    RETURN true;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION inventory_net_qty_effect(loc_from text, loc_to text, qty numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_from text := inventory_normalize_location(loc_from);
  v_to text := inventory_normalize_location(loc_to);
  v_qty numeric := coalesce(qty, 0);
BEGIN
  IF inventory_is_internal_transfer(v_from, v_to) THEN
    RETURN 0;
  END IF;

  IF inventory_is_internal(v_to) AND NOT inventory_is_internal(v_from) THEN
    RETURN v_qty;
  END IF;

  IF inventory_is_internal(v_from) AND NOT inventory_is_internal(v_to) THEN
    RETURN -v_qty;
  END IF;

  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION inventory_scoped_qty_effect(
  loc_from text,
  loc_to text,
  qty numeric,
  p_location text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_from text := inventory_normalize_location(loc_from);
  v_to text := inventory_normalize_location(loc_to);
  v_qty numeric := coalesce(qty, 0);
  v_location text := inventory_normalize_location(p_location);
BEGIN
  IF v_location = '' THEN
    RETURN inventory_net_qty_effect(v_from, v_to, v_qty);
  END IF;

  IF v_to = v_location THEN
    RETURN v_qty;
  END IF;

  IF v_from = v_location THEN
    RETURN -v_qty;
  END IF;

  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION inventory_is_move_in_location_scope(
  loc_from text,
  loc_to text,
  p_location text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_from text := inventory_normalize_location(loc_from);
  v_to text := inventory_normalize_location(loc_to);
  v_location text := inventory_normalize_location(p_location);
BEGIN
  IF v_location = '' THEN
    RETURN true;
  END IF;

  RETURN v_from = v_location OR v_to = v_location;
END;
$$;

CREATE OR REPLACE FUNCTION inventory_classify_period_buckets(
  loc_from text,
  loc_to text,
  qty numeric
)
RETURNS TABLE (
  net_vendors numeric,
  net_customers numeric,
  net_production numeric,
  net_adjustment numeric,
  is_valid boolean
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_from text := inventory_normalize_location(loc_from);
  v_to text := inventory_normalize_location(loc_to);
  v_qty numeric := coalesce(qty, 0);
  v_from_internal boolean := inventory_is_internal(v_from);
  v_to_internal boolean := inventory_is_internal(v_to);
  v_other text;
BEGIN
  net_vendors := 0;
  net_customers := 0;
  net_production := 0;
  net_adjustment := 0;
  is_valid := true;

  IF inventory_is_internal_transfer(v_from, v_to) THEN
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_from_internal AND v_to_internal THEN
    IF inventory_is_water_cluster(v_from) AND NOT inventory_is_water_cluster(v_to) THEN
      RETURN NEXT;
      RETURN;
    END IF;
    IF inventory_is_water_cluster(v_to) AND NOT inventory_is_water_cluster(v_from) THEN
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF NOT v_to_internal AND NOT v_from_internal THEN
    is_valid := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_to_internal AND NOT v_from_internal THEN
    v_other := v_from;
    IF v_other = 'Partners/Vendors' THEN
      net_vendors := v_qty;
    ELSIF v_other = 'Partners/Customers' THEN
      net_customers := v_qty;
    ELSIF v_other = 'Physical Locations/Subcontracting Location' THEN
      net_production := v_qty;
    ELSIF v_other = 'Virtual Locations/Inventory adjustment' THEN
      net_adjustment := v_qty;
    ELSIF v_other = 'Virtual Locations/Production' THEN
      net_production := v_qty;
    ELSE
      net_production := v_qty;
    END IF;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_from_internal AND NOT v_to_internal THEN
    v_other := v_to;
    IF v_other = 'Partners/Customers' THEN
      net_customers := -v_qty;
    ELSIF v_other = 'Partners/Vendors' THEN
      net_vendors := -v_qty;
    ELSIF v_other = 'Physical Locations/Subcontracting Location' THEN
      net_production := -v_qty;
    ELSIF v_other = 'Virtual Locations/Inventory adjustment' THEN
      net_adjustment := -v_qty;
    ELSIF v_other = 'Virtual Locations/Production' THEN
      net_production := -v_qty;
    ELSE
      net_production := -v_qty;
    END IF;
    RETURN NEXT;
    RETURN;
  END IF;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION inventory_format_product_category(raw_category text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN trim(coalesce(raw_category, '')) = '' THEN 'Uncategorized'
    WHEN position('/' in trim(raw_category)) > 0 THEN trim(regexp_replace(trim(raw_category), '^.*/', ''))
    ELSE trim(raw_category)
  END;
$$;

DROP FUNCTION IF EXISTS get_inventory_products_balance_report(date, date);

CREATE OR REPLACE FUNCTION get_inventory_products_balance_report(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_location text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  WITH parsed_moves AS (
    SELECT
      trim(m."PRODUCT ID") AS product_id,
      m."DATE"::date AS move_date,
      coalesce(
        NULLIF(regexp_replace(trim(m."QTY"::text), ',', '', 'g'), '')::numeric,
        0
      ) AS qty,
      trim(m."LOCATION FROM") AS loc_from,
      trim(m."LOCATION TO") AS loc_to
    FROM "web_INVENTORY_MOVES" m
    WHERE m."PRODUCT ID" IS NOT NULL
      AND trim(m."PRODUCT ID") <> ''
      AND inventory_is_move_in_location_scope(
        trim(m."LOCATION FROM"),
        trim(m."LOCATION TO"),
        p_location
      )
  ),
  move_buckets AS (
    SELECT
      pm.product_id,
      CASE
        WHEN p_date_from IS NOT NULL AND pm.move_date < p_date_from THEN
          inventory_scoped_qty_effect(pm.loc_from, pm.loc_to, pm.qty, p_location)
        ELSE 0
      END AS opening_delta,
      CASE
        WHEN (p_date_to IS NULL OR pm.move_date <= p_date_to)
         AND (p_date_from IS NULL OR pm.move_date >= p_date_from)
         AND cb.is_valid
        THEN cb.net_vendors ELSE 0
      END AS net_vendors,
      CASE
        WHEN (p_date_to IS NULL OR pm.move_date <= p_date_to)
         AND (p_date_from IS NULL OR pm.move_date >= p_date_from)
         AND cb.is_valid
        THEN cb.net_customers ELSE 0
      END AS net_customers,
      CASE
        WHEN (p_date_to IS NULL OR pm.move_date <= p_date_to)
         AND (p_date_from IS NULL OR pm.move_date >= p_date_from)
         AND cb.is_valid
        THEN cb.net_production ELSE 0
      END AS net_production,
      CASE
        WHEN (p_date_to IS NULL OR pm.move_date <= p_date_to)
         AND (p_date_from IS NULL OR pm.move_date >= p_date_from)
         AND cb.is_valid
        THEN cb.net_adjustment ELSE 0
      END AS net_adjustment
    FROM parsed_moves pm
    CROSS JOIN LATERAL inventory_classify_period_buckets(pm.loc_from, pm.loc_to, pm.qty) cb
    WHERE p_date_to IS NULL OR pm.move_date <= p_date_to
  ),
  aggregated AS (
    SELECT
      product_id,
      sum(opening_delta) AS opening_stock,
      sum(net_vendors) AS net_vendors,
      sum(net_customers) AS net_customers,
      sum(net_production) AS net_production,
      sum(net_adjustment) AS net_adjustment
    FROM move_buckets
    GROUP BY product_id
  ),
  report_rows AS (
    SELECT
      trim(p."PRODUCT ID") AS product_id,
      coalesce(trim(p."PRODUCT BARCODE"), '') AS barcode,
      trim(p."PRODUCT NAME") AS product_name,
      inventory_format_product_category(p."PRODUCT CATEGORY"::text) AS category,
      coalesce(a.opening_stock, 0) AS opening_stock,
      coalesce(a.net_vendors, 0) AS net_vendors,
      coalesce(a.net_customers, 0) AS net_customers,
      coalesce(a.net_production, 0) AS net_production,
      coalesce(a.net_adjustment, 0) AS net_adjustment,
      coalesce(a.opening_stock, 0)
        + coalesce(a.net_vendors, 0)
        + coalesce(a.net_customers, 0)
        + coalesce(a.net_production, 0)
        + coalesce(a.net_adjustment, 0) AS ending_stock,
      (a.product_id IS NOT NULL) AS has_moves
    FROM "bhs_PRODUCTS" p
    LEFT JOIN aggregated a ON trim(p."PRODUCT ID") = a.product_id
    WHERE trim(coalesce(p."PRODUCT NAME", '')) <> ''
      AND (
        a.product_id IS NOT NULL
        OR coalesce(a.opening_stock, 0) <> 0
        OR (
          coalesce(a.opening_stock, 0)
          + coalesce(a.net_vendors, 0)
          + coalesce(a.net_customers, 0)
          + coalesce(a.net_production, 0)
          + coalesce(a.net_adjustment, 0)
        ) <> 0
      )
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'productId', product_id,
      'barcode', barcode,
      'productName', product_name,
      'category', category,
      'openingStock', opening_stock,
      'netVendors', net_vendors,
      'netCustomers', net_customers,
      'netProduction', net_production,
      'netAdjustment', net_adjustment,
      'endingStock', ending_stock
    )
    ORDER BY product_name
  ), '[]'::jsonb)
  INTO v_rows
  FROM report_rows;

  RETURN jsonb_build_object('success', true, 'data', v_rows);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

CREATE OR REPLACE FUNCTION get_inventory_product_period_movements(
  p_product_id text,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rows jsonb;
  v_product_id text := trim(coalesce(p_product_id, ''));
BEGIN
  IF v_product_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product ID is required');
  END IF;

  WITH parsed_moves AS (
    SELECT
      m."ID"::text AS move_id,
      m."DATE"::text AS move_date,
      coalesce(trim(m."REFERENCE"), '-') AS reference,
      trim(m."LOCATION FROM") AS loc_from,
      trim(m."LOCATION TO") AS loc_to,
      coalesce(
        NULLIF(regexp_replace(trim(m."QTY"::text), ',', '', 'g'), '')::numeric,
        0
      ) AS qty
    FROM "web_INVENTORY_MOVES" m
    WHERE trim(m."PRODUCT ID") = v_product_id
      AND (p_date_from IS NULL OR m."DATE"::date >= p_date_from)
      AND (p_date_to IS NULL OR m."DATE"::date <= p_date_to)
  ),
  classified AS (
    SELECT
      pm.move_id,
      pm.move_date,
      pm.reference,
      pm.loc_from,
      pm.loc_to,
      pm.qty,
      CASE
        WHEN inventory_is_internal_transfer(pm.loc_from, pm.loc_to) THEN 'transfer'
        WHEN inventory_is_internal(pm.loc_from) AND inventory_is_internal(pm.loc_to)
          AND inventory_is_water_cluster(pm.loc_from) AND NOT inventory_is_water_cluster(pm.loc_to) THEN 'production_out'
        WHEN inventory_is_internal(pm.loc_from) AND inventory_is_internal(pm.loc_to)
          AND inventory_is_water_cluster(pm.loc_to) AND NOT inventory_is_water_cluster(pm.loc_from) THEN 'production_in'
        WHEN inventory_is_internal(pm.loc_to) AND NOT inventory_is_internal(pm.loc_from) AND pm.loc_from = 'Partners/Vendors' THEN 'vendor_in'
        WHEN inventory_is_internal(pm.loc_to) AND NOT inventory_is_internal(pm.loc_from) AND pm.loc_from = 'Partners/Customers' THEN 'customer_return'
        WHEN inventory_is_internal(pm.loc_to) AND NOT inventory_is_internal(pm.loc_from) AND pm.loc_from = 'Physical Locations/Subcontracting Location' THEN 'subcontracting_in'
        WHEN inventory_is_internal(pm.loc_to) AND NOT inventory_is_internal(pm.loc_from) AND pm.loc_from = 'Virtual Locations/Inventory adjustment' THEN 'adjustment_in'
        WHEN inventory_is_internal(pm.loc_to) AND NOT inventory_is_internal(pm.loc_from) AND pm.loc_from = 'Virtual Locations/Production' THEN 'production_in'
        WHEN inventory_is_internal(pm.loc_to) AND NOT inventory_is_internal(pm.loc_from) THEN 'production_in'
        WHEN inventory_is_internal(pm.loc_from) AND NOT inventory_is_internal(pm.loc_to) AND pm.loc_to = 'Partners/Customers' THEN 'customer_sale'
        WHEN inventory_is_internal(pm.loc_from) AND NOT inventory_is_internal(pm.loc_to) AND pm.loc_to = 'Partners/Vendors' THEN 'vendor_return'
        WHEN inventory_is_internal(pm.loc_from) AND NOT inventory_is_internal(pm.loc_to) AND pm.loc_to = 'Physical Locations/Subcontracting Location' THEN 'subcontracting_out'
        WHEN inventory_is_internal(pm.loc_from) AND NOT inventory_is_internal(pm.loc_to) AND pm.loc_to = 'Virtual Locations/Inventory adjustment' THEN 'adjustment_out'
        WHEN inventory_is_internal(pm.loc_from) AND NOT inventory_is_internal(pm.loc_to) AND pm.loc_to = 'Virtual Locations/Production' THEN 'production_out'
        WHEN inventory_is_internal(pm.loc_from) AND NOT inventory_is_internal(pm.loc_to) THEN 'production_out'
        ELSE NULL
      END AS move_type
    FROM parsed_moves pm
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'moveId', move_id,
      'date', move_date,
      'reference', reference,
      'locationFrom', loc_from,
      'locationTo', loc_to,
      'qty', qty,
      'type', move_type
    )
    ORDER BY move_date, move_id
  ), '[]'::jsonb)
  INTO v_rows
  FROM classified
  WHERE move_type IS NOT NULL;

  RETURN jsonb_build_object('success', true, 'data', v_rows);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION inventory_normalize_location(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION inventory_is_internal(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION inventory_is_internal_transfer(text, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION inventory_net_qty_effect(text, text, numeric) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION inventory_scoped_qty_effect(text, text, numeric, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION inventory_is_move_in_location_scope(text, text, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION inventory_classify_period_buckets(text, text, numeric) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION inventory_format_product_category(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_inventory_products_balance_report(date, date, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_inventory_product_period_movements(text, date, date) TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
