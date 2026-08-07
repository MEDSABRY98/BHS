-- Inventory Analysis: Products Balance aggregation in Postgres.
-- Run in Supabase SQL editor (or migration). JS falls back if missing.
--
-- Mirrors app/InventoryAnalysis Utils/locationTypes + computeProductsBalanceReportDataJs bucket rules.

CREATE OR REPLACE FUNCTION public.get_inventory_products_balance(
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL,
  p_location text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_from date;
  v_to date;
  v_location text;
BEGIN
  v_from := NULLIF(trim(COALESCE(p_date_from, '')), '')::date;
  v_to := NULLIF(trim(COALESCE(p_date_to, '')), '')::date;
  v_location := NULLIF(trim(COALESCE(p_location, '')), '');

  RETURN (
    WITH
    loc_map AS (
      SELECT
        upper(trim(l."ID")) AS loc_id,
        trim(l."LOCATION NAME") AS loc_name
      FROM "web_INVENTORY_LOCATIONS" l
      WHERE coalesce(trim(l."LOCATION NAME"), '') <> ''
    ),
    canonical AS (
      SELECT * FROM (VALUES
        ('M/WH/Mazyad'),
        ('S/WH/S20'),
        ('WA/WH/Water'),
        ('WA/WH/Ahmed Magdy'),
        ('WA/WH/Omer & Salam'),
        ('GM/WH/Game area'),
        ('HA/WH/Hashi'),
        ('Partners/Vendors'),
        ('Partners/Customers'),
        ('Virtual Locations/Inventory adjustment'),
        ('Virtual Locations/Production'),
        ('Physical Locations/Subcontracting Location')
      ) AS t(name)
    ),
    resolve AS (
      -- Resolve LOC- ids and case-insensitive known names to canonical spellings
      SELECT
        m."PRODUCT ID" AS product_id,
        m."DATE"::timestamptz AS move_ts,
        COALESCE(
          (SELECT loc_name FROM loc_map WHERE loc_id = upper(trim(m."LOCATION FROM"))),
          (SELECT c.name FROM canonical c WHERE lower(c.name) = lower(trim(m."LOCATION FROM"))),
          trim(COALESCE(m."LOCATION FROM", ''))
        ) AS loc_from,
        COALESCE(
          (SELECT loc_name FROM loc_map WHERE loc_id = upper(trim(m."LOCATION TO"))),
          (SELECT c.name FROM canonical c WHERE lower(c.name) = lower(trim(m."LOCATION TO"))),
          trim(COALESCE(m."LOCATION TO", ''))
        ) AS loc_to,
        COALESCE(m."QTY", 0)::numeric AS qty
      FROM "web_INVENTORY_MOVES" m
      WHERE coalesce(trim(m."PRODUCT ID"), '') <> ''
    ),
    scoped AS (
      SELECT
        r.*,
        CASE
          WHEN v_location IS NULL THEN true
          WHEN r.loc_from = v_location OR r.loc_to = v_location THEN true
          ELSE false
        END AS in_scope,
        -- same location
        (r.loc_from <> '' AND r.loc_from = r.loc_to) AS is_same,
        -- water cluster
        (r.loc_from IN ('WA/WH/Water', 'WA/WH/Ahmed Magdy', 'WA/WH/Omer & Salam')) AS from_water,
        (r.loc_to IN ('WA/WH/Water', 'WA/WH/Ahmed Magdy', 'WA/WH/Omer & Salam')) AS to_water,
        (r.loc_from IN (
          'M/WH/Mazyad', 'S/WH/S20', 'WA/WH/Water', 'WA/WH/Ahmed Magdy',
          'WA/WH/Omer & Salam', 'GM/WH/Game area', 'HA/WH/Hashi'
        )) AS from_internal,
        (r.loc_to IN (
          'M/WH/Mazyad', 'S/WH/S20', 'WA/WH/Water', 'WA/WH/Ahmed Magdy',
          'WA/WH/Omer & Salam', 'GM/WH/Game area', 'HA/WH/Hashi'
        )) AS to_internal
      FROM resolve r
    ),
    classified AS (
      SELECT
        s.*,
        CASE
          WHEN NOT s.in_scope OR s.is_same THEN 0
          WHEN v_location IS NOT NULL AND s.loc_to = v_location THEN s.qty
          WHEN v_location IS NOT NULL AND s.loc_from = v_location THEN -s.qty
          -- aggregate net (no location filter)
          WHEN s.from_water AND s.to_water THEN 0
          WHEN (s.loc_from = 'WA/WH/Water' AND s.loc_to = 'M/WH/Mazyad')
            OR (s.loc_from = 'M/WH/Mazyad' AND s.loc_to = 'WA/WH/Water') THEN 0
          WHEN s.from_internal AND s.to_internal
            AND NOT s.from_water AND NOT s.to_water THEN 0
          WHEN s.from_internal AND s.to_internal
            AND (s.from_water OR s.to_water)
            AND NOT (
              (s.loc_from = 'WA/WH/Water' AND s.loc_to = 'M/WH/Mazyad')
              OR (s.loc_from = 'M/WH/Mazyad' AND s.loc_to = 'WA/WH/Water')
            )
            AND NOT (s.from_water AND s.to_water)
            THEN
              -- water cluster ↔ other internal (except Mazyad water pair handled above):
              -- JS getNetQtyEffect returns 0 for unrecognized internal pairs involving water
              -- except production_in/out classification still applies for buckets when both internal
              0
          WHEN s.to_internal AND NOT s.from_internal THEN s.qty
          WHEN s.from_internal AND NOT s.to_internal THEN -s.qty
          ELSE 0
        END AS scoped_effect,
        CASE
          WHEN s.is_same THEN 'same_location'
          WHEN s.from_water AND s.to_water AND s.loc_from <> s.loc_to THEN 'warehouse_transfer'
          WHEN (s.loc_from = 'WA/WH/Water' AND s.loc_to = 'M/WH/Mazyad')
            OR (s.loc_from = 'M/WH/Mazyad' AND s.loc_to = 'WA/WH/Water') THEN 'transfer'
          WHEN s.from_internal AND s.to_internal
            AND NOT s.from_water AND NOT s.to_water THEN 'transfer'
          WHEN s.from_internal AND s.to_internal AND s.from_water AND NOT s.to_water THEN 'production_out'
          WHEN s.from_internal AND s.to_internal AND s.to_water AND NOT s.from_water THEN 'production_in'
          WHEN s.to_internal AND s.loc_from = 'Partners/Vendors' THEN 'vendor_in'
          WHEN s.to_internal AND s.loc_from = 'Partners/Customers' THEN 'customer_return'
          WHEN s.to_internal AND s.loc_from = 'Physical Locations/Subcontracting Location' THEN 'subcontracting_in'
          WHEN s.to_internal AND s.loc_from = 'Virtual Locations/Inventory adjustment' THEN 'adjustment_in'
          WHEN s.to_internal AND s.loc_from = 'Virtual Locations/Production' THEN 'production_in'
          WHEN s.to_internal AND NOT s.from_internal THEN 'production_in'
          WHEN s.from_internal AND s.loc_to = 'Partners/Customers' THEN 'customer_sale'
          WHEN s.from_internal AND s.loc_to = 'Partners/Vendors' THEN 'vendor_return'
          WHEN s.from_internal AND s.loc_to = 'Physical Locations/Subcontracting Location' THEN 'subcontracting_out'
          WHEN s.from_internal AND s.loc_to = 'Virtual Locations/Inventory adjustment' THEN 'adjustment_out'
          WHEN s.from_internal AND s.loc_to = 'Virtual Locations/Production' THEN 'production_out'
          WHEN s.from_internal AND NOT s.to_internal THEN 'production_out'
          ELSE NULL
        END AS move_type,
        CASE
          WHEN s.to_internal AND s.loc_from = 'Partners/Vendors' THEN s.qty
          WHEN s.from_internal AND s.loc_to = 'Partners/Vendors' THEN -s.qty
          ELSE 0
        END AS cls_vendors,
        CASE
          WHEN s.to_internal AND s.loc_from = 'Partners/Customers' THEN s.qty
          WHEN s.from_internal AND s.loc_to = 'Partners/Customers' THEN -s.qty
          ELSE 0
        END AS cls_customers,
        CASE
          WHEN s.to_internal AND s.loc_from IN (
            'Physical Locations/Subcontracting Location',
            'Virtual Locations/Production'
          ) THEN s.qty
          WHEN s.from_internal AND s.loc_to IN (
            'Physical Locations/Subcontracting Location',
            'Virtual Locations/Production'
          ) THEN -s.qty
          WHEN s.to_internal AND NOT s.from_internal
            AND s.loc_from NOT IN (
              'Partners/Vendors', 'Partners/Customers',
              'Virtual Locations/Inventory adjustment'
            ) THEN s.qty
          WHEN s.from_internal AND NOT s.to_internal
            AND s.loc_to NOT IN (
              'Partners/Vendors', 'Partners/Customers',
              'Virtual Locations/Inventory adjustment'
            ) THEN -s.qty
          WHEN s.from_internal AND s.to_internal AND s.from_water AND NOT s.to_water THEN 0
          WHEN s.from_internal AND s.to_internal AND s.to_water AND NOT s.from_water THEN 0
          ELSE 0
        END AS cls_production,
        CASE
          WHEN s.to_internal AND s.loc_from = 'Virtual Locations/Inventory adjustment' THEN s.qty
          WHEN s.from_internal AND s.loc_to = 'Virtual Locations/Inventory adjustment' THEN -s.qty
          ELSE 0
        END AS cls_adjustment
      FROM scoped s
      WHERE s.in_scope
    ),
    periodized AS (
      SELECT
        c.*,
        CASE
          WHEN v_from IS NOT NULL AND c.move_ts IS NOT NULL AND c.move_ts < v_from::timestamptz THEN 'opening'
          WHEN v_to IS NOT NULL AND c.move_ts IS NOT NULL AND c.move_ts > (v_to::timestamp + interval '1 day' - interval '1 second') THEN 'after'
          ELSE 'period'
        END AS bucket
      FROM classified c
    ),
    agg AS (
      SELECT
        p.product_id,
        SUM(CASE WHEN p.bucket = 'opening' THEN p.scoped_effect ELSE 0 END) AS opening_stock,
        SUM(CASE WHEN p.bucket = 'period' THEN p.scoped_effect ELSE 0 END) AS period_effect,
        SUM(CASE
          WHEN p.bucket <> 'period' OR p.move_type IS NULL THEN 0
          WHEN p.move_type IN ('warehouse_transfer') THEN
            CASE WHEN v_location IS NOT NULL THEN p.scoped_effect ELSE 0 END
          ELSE 0
        END) AS net_warehouse_transfer,
        SUM(CASE
          WHEN p.bucket <> 'period' OR p.move_type IS NULL THEN 0
          WHEN p.move_type = 'transfer' THEN
            CASE WHEN v_location IS NOT NULL THEN p.scoped_effect ELSE 0 END
          ELSE 0
        END) AS net_internal_transfer,
        SUM(CASE
          WHEN p.bucket <> 'period' OR p.move_type IS NULL THEN 0
          WHEN p.move_type IN ('warehouse_transfer', 'transfer', 'same_location') THEN 0
          WHEN v_location IS NOT NULL AND p.move_type IN ('vendor_in', 'vendor_return') THEN p.scoped_effect
          WHEN v_location IS NULL THEN p.cls_vendors
          ELSE 0
        END) AS net_vendors,
        SUM(CASE
          WHEN p.bucket <> 'period' OR p.move_type IS NULL THEN 0
          WHEN p.move_type IN ('warehouse_transfer', 'transfer', 'same_location') THEN 0
          WHEN v_location IS NOT NULL AND p.move_type IN ('customer_sale', 'customer_return') THEN p.scoped_effect
          WHEN v_location IS NULL THEN p.cls_customers
          ELSE 0
        END) AS net_customers,
        SUM(CASE
          WHEN p.bucket <> 'period' OR p.move_type IS NULL THEN 0
          WHEN p.move_type IN ('warehouse_transfer', 'transfer', 'same_location') THEN 0
          WHEN v_location IS NOT NULL AND p.move_type IN (
            'production_in', 'production_out', 'subcontracting_in', 'subcontracting_out'
          ) THEN p.scoped_effect
          WHEN v_location IS NOT NULL
            AND p.move_type NOT IN (
              'vendor_in', 'vendor_return', 'customer_sale', 'customer_return',
              'adjustment_in', 'adjustment_out'
            )
            AND p.scoped_effect <> 0
            THEN p.scoped_effect
          WHEN v_location IS NULL THEN p.cls_production
          ELSE 0
        END) AS net_production,
        SUM(CASE
          WHEN p.bucket <> 'period' OR p.move_type IS NULL THEN 0
          WHEN p.move_type IN ('warehouse_transfer', 'transfer', 'same_location') THEN 0
          WHEN v_location IS NOT NULL AND p.move_type IN ('adjustment_in', 'adjustment_out') THEN p.scoped_effect
          WHEN v_location IS NULL THEN p.cls_adjustment
          ELSE 0
        END) AS net_adjustment
      FROM periodized p
      GROUP BY p.product_id
    ),
    products AS (
      SELECT
        trim(p."PRODUCT ID") AS product_id,
        trim(COALESCE(p."PRODUCT BARCODE", '')) AS barcode,
        trim(COALESCE(p."PRODUCT NAME", '')) AS product_name,
        CASE
          WHEN coalesce(trim(p."PRODUCT CATEGORY"), '') = '' THEN 'Uncategorized'
          WHEN position('/' in trim(p."PRODUCT CATEGORY")) = 0 THEN trim(p."PRODUCT CATEGORY")
          ELSE trim(substring(trim(p."PRODUCT CATEGORY") from '([^/]+)$'))
        END AS category
      FROM "bhs_PRODUCTS" p
      WHERE coalesce(trim(p."PRODUCT NAME"), '') <> ''
    ),
    rows AS (
      SELECT
        pr.product_id AS "productId",
        pr.barcode AS "barcode",
        pr.product_name AS "productName",
        pr.category AS "category",
        COALESCE(a.opening_stock, 0) AS "openingStock",
        COALESCE(a.net_vendors, 0) AS "netVendors",
        COALESCE(a.net_customers, 0) AS "netCustomers",
        COALESCE(a.net_production, 0) AS "netProduction",
        COALESCE(a.net_adjustment, 0) AS "netAdjustment",
        COALESCE(a.net_warehouse_transfer, 0) AS "netWarehouseTransfer",
        COALESCE(a.net_internal_transfer, 0) AS "netInternalTransfer",
        CASE
          WHEN v_location IS NOT NULL THEN
            COALESCE(a.opening_stock, 0) + COALESCE(a.period_effect, 0)
          ELSE
            COALESCE(a.opening_stock, 0)
            + COALESCE(a.net_vendors, 0)
            + COALESCE(a.net_customers, 0)
            + COALESCE(a.net_production, 0)
            + COALESCE(a.net_adjustment, 0)
            + COALESCE(a.net_warehouse_transfer, 0)
            + COALESCE(a.net_internal_transfer, 0)
        END AS "endingStock"
      FROM products pr
      INNER JOIN agg a ON a.product_id = pr.product_id
    )
    SELECT jsonb_build_object(
      'success', true,
      'data', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM rows r), '[]'::jsonb)
    )
  );
EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_products_balance(text, text, text) TO anon, authenticated, service_role;
