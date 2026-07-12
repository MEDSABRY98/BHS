DROP FUNCTION IF EXISTS get_sales_products_aggregated(text, text, int, int, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS get_sales_product_details_raw(text, text, text, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS get_sales_categories_aggregated(text, text, int, int, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS get_sales_new_listings(text, int, int, text, text, text, text, text, text, text);

-- 1. Products Aggregated List
CREATE OR REPLACE FUNCTION get_sales_products_aggregated(
  p_user_id text,
  p_invoice_type text DEFAULT 'all',
  p_year int DEFAULT NULL,
  p_month int DEFAULT NULL,
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_market text DEFAULT NULL,
  p_merchandiser text DEFAULT NULL,
  p_sales_rep text DEFAULT NULL,
  p_product_tag text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_is_manager boolean;
  v_user_name text;
  v_curr_from date;
  v_curr_to date;
  v_result json;
BEGIN
  v_is_manager := is_sales_manager(p_user_id);
  
  SELECT "NAME" INTO v_user_name 
  FROM "bhs_USERS" 
  WHERE "ID" = UPPER(TRIM(p_user_id));

  -- Determine date bounds
  IF p_date_from IS NOT NULL OR p_date_to IS NOT NULL THEN
    v_curr_from := COALESCE(p_date_from::date, '2000-01-01'::date);
    v_curr_to := COALESCE(p_date_to::date, '2100-01-01'::date);
  ELSIF p_year IS NOT NULL THEN
    IF p_month IS NOT NULL THEN
      v_curr_from := to_date(p_year || '-' || p_month || '-01', 'YYYY-MM-DD');
      v_curr_to := (v_curr_from + interval '1 month - 1 day')::date;
    ELSE
      v_curr_from := to_date(p_year || '-01-01', 'YYYY-MM-DD');
      v_curr_to := to_date(p_year || '-12-31', 'YYYY-MM-DD');
    END IF;
  END IF;

  WITH filtered_sales AS (
    SELECT 
      productid,
      barcode,
      product,
      amount,
      qty,
      invoicenumber
    FROM v_sales_mapped
    WHERE 
      (v_is_manager = true OR salesrepid = UPPER(TRIM(p_user_id)) OR UPPER(TRIM(salesrep)) = UPPER(TRIM(v_user_name)))
      AND (p_area IS NULL OR area = p_area)
      AND (p_market IS NULL OR market = p_market)
      AND (p_merchandiser IS NULL OR merchandiser = p_merchandiser)
      AND (p_sales_rep IS NULL OR salesrep = p_sales_rep)
      AND (p_product_tag IS NULL OR producttag = p_product_tag)
      AND (
        p_invoice_type = 'all'
        OR (p_invoice_type = 'sales' AND UPPER(invoicenumber) LIKE 'SAL%')
        OR (p_invoice_type = 'returns' AND UPPER(invoicenumber) LIKE 'RSAL%')
      )
      AND (v_curr_from IS NULL OR invoicedate::date >= v_curr_from)
      AND (v_curr_to IS NULL OR invoicedate::date <= v_curr_to)
  ),
  grouped AS (
    SELECT 
      COALESCE(productid, barcode, product) as key_id,
      MAX(productid) as productid,
      MAX(barcode) as barcode,
      MAX(product) as product,
      SUM(amount) as amount,
      SUM(qty) as qty,
      COUNT(DISTINCT CASE WHEN UPPER(invoicenumber) LIKE 'SAL%' THEN invoicenumber ELSE NULL END) as transactions,
      array_to_json(array_agg(DISTINCT LOWER(product))) as "allNames",
      array_to_json(array_agg(DISTINCT LOWER(barcode))) as "allBarcodes"
    FROM filtered_sales
    GROUP BY COALESCE(productid, barcode, product)
  )
  SELECT COALESCE(json_agg(row_to_json(g)), '[]'::json) INTO v_result
  FROM (
    SELECT productid as "productId", barcode, product, amount, qty, transactions, "allNames", "allBarcodes"
    FROM grouped
    ORDER BY amount DESC
  ) g;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';


-- 2. Product Details Modal
CREATE OR REPLACE FUNCTION get_sales_product_details_raw(
  p_user_id text,
  p_product_id text,
  p_invoice_type text DEFAULT 'all',
  p_year int DEFAULT NULL,
  p_month int DEFAULT NULL,
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_market text DEFAULT NULL,
  p_merchandiser text DEFAULT NULL,
  p_sales_rep text DEFAULT NULL,
  p_product_tag text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_is_manager boolean;
  v_user_name text;
  v_curr_from date;
  v_curr_to date;
  v_data json;
  v_all_data json;
BEGIN
  v_is_manager := is_sales_manager(p_user_id);
  
  SELECT "NAME" INTO v_user_name 
  FROM "bhs_USERS" 
  WHERE "ID" = UPPER(TRIM(p_user_id));

  -- Determine date bounds
  IF p_date_from IS NOT NULL OR p_date_to IS NOT NULL THEN
    v_curr_from := COALESCE(p_date_from::date, '2000-01-01'::date);
    v_curr_to := COALESCE(p_date_to::date, '2100-01-01'::date);
  ELSIF p_year IS NOT NULL THEN
    IF p_month IS NOT NULL THEN
      v_curr_from := to_date(p_year || '-' || p_month || '-01', 'YYYY-MM-DD');
      v_curr_to := (v_curr_from + interval '1 month - 1 day')::date;
    ELSE
      v_curr_from := to_date(p_year || '-01-01', 'YYYY-MM-DD');
      v_curr_to := to_date(p_year || '-12-31', 'YYYY-MM-DD');
    END IF;
  END IF;

  -- 1. Get raw records matching filters and date range
  WITH filtered_sales AS (
    SELECT 
      "ID",
      invoicedate as "invoiceDate",
      invoicenumber as "invoiceNumber",
      customerid as "customerId",
      productid as "productId",
      productprice as "productPrice",
      amount,
      qty,
      customermainname as "customerMainName",
      customername as "customerName",
      producttag as "productTag",
      productcost as "productCost",
      product,
      barcode,
      salesrepid as "salesRepId",
      salesrep as "salesRep",
      area,
      market,
      merchandiserid as "merchandiserId",
      merchandiser
    FROM v_sales_mapped
    WHERE 
      COALESCE(productid, barcode, product) = p_product_id
      AND (v_is_manager = true OR salesrepid = UPPER(TRIM(p_user_id)) OR UPPER(TRIM(salesrep)) = UPPER(TRIM(v_user_name)))
      AND (p_area IS NULL OR area = p_area)
      AND (p_market IS NULL OR market = p_market)
      AND (p_merchandiser IS NULL OR merchandiser = p_merchandiser)
      AND (p_sales_rep IS NULL OR salesrep = p_sales_rep)
      AND (p_product_tag IS NULL OR producttag = p_product_tag)
      AND (
        p_invoice_type = 'all'
        OR (p_invoice_type = 'sales' AND UPPER(invoicenumber) LIKE 'SAL%')
        OR (p_invoice_type = 'returns' AND UPPER(invoicenumber) LIKE 'RSAL%')
      )
  ),
  data_filtered AS (
    SELECT * FROM filtered_sales
    WHERE (v_curr_from IS NULL OR "invoiceDate"::date >= v_curr_from)
      AND (v_curr_to IS NULL OR "invoiceDate"::date <= v_curr_to)
    ORDER BY "invoiceDate" DESC
  )
  SELECT 
    COALESCE(json_agg(row_to_json(df)), '[]'::json) INTO v_data
  FROM data_filtered df;

  WITH all_sales AS (
    SELECT 
      "ID",
      invoicedate as "invoiceDate",
      invoicenumber as "invoiceNumber",
      customerid as "customerId",
      productid as "productId",
      productprice as "productPrice",
      amount,
      qty,
      customermainname as "customerMainName",
      customername as "customerName",
      producttag as "productTag",
      productcost as "productCost",
      product,
      barcode,
      salesrepid as "salesRepId",
      salesrep as "salesRep",
      area,
      market,
      merchandiserid as "merchandiserId",
      merchandiser
    FROM v_sales_mapped
    WHERE 
      COALESCE(productid, barcode, product) = p_product_id
      AND (v_is_manager = true OR salesrepid = UPPER(TRIM(p_user_id)) OR UPPER(TRIM(salesrep)) = UPPER(TRIM(v_user_name)))
      AND (p_area IS NULL OR area = p_area)
      AND (p_market IS NULL OR market = p_market)
      AND (p_merchandiser IS NULL OR merchandiser = p_merchandiser)
      AND (p_sales_rep IS NULL OR salesrep = p_sales_rep)
      AND (p_product_tag IS NULL OR producttag = p_product_tag)
      AND (
        p_invoice_type = 'all'
        OR (p_invoice_type = 'sales' AND UPPER(invoicenumber) LIKE 'SAL%')
        OR (p_invoice_type = 'returns' AND UPPER(invoicenumber) LIKE 'RSAL%')
      )
    ORDER BY "invoiceDate" DESC
  )
  SELECT 
    COALESCE(json_agg(row_to_json(al)), '[]'::json) INTO v_all_data
  FROM all_sales al;

  RETURN json_build_object('data', v_data, 'allData', v_all_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';


-- 3. Categories Aggregated List
CREATE OR REPLACE FUNCTION get_sales_categories_aggregated(
  p_user_id text,
  p_invoice_type text DEFAULT 'all',
  p_year int DEFAULT NULL,
  p_month int DEFAULT NULL,
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_market text DEFAULT NULL,
  p_merchandiser text DEFAULT NULL,
  p_sales_rep text DEFAULT NULL,
  p_product_tag text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_is_manager boolean;
  v_user_name text;
  v_curr_from date;
  v_curr_to date;
  v_result json;
BEGIN
  v_is_manager := is_sales_manager(p_user_id);
  
  SELECT "NAME" INTO v_user_name 
  FROM "bhs_USERS" 
  WHERE "ID" = UPPER(TRIM(p_user_id));

  -- Determine date bounds
  IF p_date_from IS NOT NULL OR p_date_to IS NOT NULL THEN
    v_curr_from := COALESCE(p_date_from::date, '2000-01-01'::date);
    v_curr_to := COALESCE(p_date_to::date, '2100-01-01'::date);
  ELSIF p_year IS NOT NULL THEN
    IF p_month IS NOT NULL THEN
      v_curr_from := to_date(p_year || '-' || p_month || '-01', 'YYYY-MM-DD');
      v_curr_to := (v_curr_from + interval '1 month - 1 day')::date;
    ELSE
      v_curr_from := to_date(p_year || '-01-01', 'YYYY-MM-DD');
      v_curr_to := to_date(p_year || '-12-31', 'YYYY-MM-DD');
    END IF;
  END IF;

  WITH filtered_sales AS (
    SELECT 
      COALESCE(producttag, 'Uncategorized') as category,
      amount,
      qty,
      customerid
    FROM v_sales_mapped
    WHERE 
      (v_is_manager = true OR salesrepid = UPPER(TRIM(p_user_id)) OR UPPER(TRIM(salesrep)) = UPPER(TRIM(v_user_name)))
      AND (p_area IS NULL OR area = p_area)
      AND (p_market IS NULL OR market = p_market)
      AND (p_merchandiser IS NULL OR merchandiser = p_merchandiser)
      AND (p_sales_rep IS NULL OR salesrep = p_sales_rep)
      AND (p_product_tag IS NULL OR producttag = p_product_tag)
      AND (
        p_invoice_type = 'all'
        OR (p_invoice_type = 'sales' AND UPPER(invoicenumber) LIKE 'SAL%')
        OR (p_invoice_type = 'returns' AND UPPER(invoicenumber) LIKE 'RSAL%')
      )
      AND (v_curr_from IS NULL OR invoicedate::date >= v_curr_from)
      AND (v_curr_to IS NULL OR invoicedate::date <= v_curr_to)
  ),
  grouped AS (
    SELECT 
      category,
      SUM(amount) as amount,
      SUM(qty) as qty,
      COUNT(DISTINCT customerid) as customers,
      array_to_json(array_agg(DISTINCT customerid)) as "customerIds"
    FROM filtered_sales
    GROUP BY category
  )
  SELECT COALESCE(json_agg(row_to_json(g)), '[]'::json) INTO v_result
  FROM (
    SELECT category, amount, qty, customers, "customerIds"
    FROM grouped
    ORDER BY amount DESC
  ) g;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';


-- 4. New Listings
CREATE OR REPLACE FUNCTION get_sales_new_listings(
  p_user_id text,
  p_year int DEFAULT NULL,
  p_month int DEFAULT NULL,
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_market text DEFAULT NULL,
  p_merchandiser text DEFAULT NULL,
  p_sales_rep text DEFAULT NULL,
  p_product_tag text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_is_manager boolean;
  v_user_name text;
  v_curr_from date;
  v_curr_to date;
  v_result json;
BEGIN
  v_is_manager := is_sales_manager(p_user_id);
  
  SELECT "NAME" INTO v_user_name 
  FROM "bhs_USERS" 
  WHERE "ID" = UPPER(TRIM(p_user_id));

  -- Determine date bounds
  IF p_date_from IS NOT NULL OR p_date_to IS NOT NULL THEN
    v_curr_from := COALESCE(p_date_from::date, '2000-01-01'::date);
    v_curr_to := COALESCE(p_date_to::date, '2100-01-01'::date);
  ELSIF p_year IS NOT NULL THEN
    IF p_month IS NOT NULL THEN
      v_curr_from := to_date(p_year || '-' || p_month || '-01', 'YYYY-MM-DD');
      v_curr_to := (v_curr_from + interval '1 month - 1 day')::date;
    ELSE
      v_curr_from := to_date(p_year || '-01-01', 'YYYY-MM-DD');
      v_curr_to := to_date(p_year || '-12-31', 'YYYY-MM-DD');
    END IF;
  END IF;

  WITH base_sales AS (
    -- Get sales invoices only
    SELECT 
      invoicedate::date as idate,
      invoicenumber,
      customerid,
      COALESCE(NULLIF(TRIM(customername), ''), TRIM(customermainname), 'Unknown') as customer_name,
      productid,
      barcode,
      product as product_name
    FROM v_sales_mapped
    WHERE 
      UPPER(invoicenumber) LIKE 'SAL%' AND NOT UPPER(invoicenumber) LIKE 'RSAL%'
      AND (v_is_manager = true OR salesrepid = UPPER(TRIM(p_user_id)) OR UPPER(TRIM(salesrep)) = UPPER(TRIM(v_user_name)))
      AND (p_area IS NULL OR area = p_area)
      AND (p_market IS NULL OR market = p_market)
      AND (p_merchandiser IS NULL OR merchandiser = p_merchandiser)
      AND (p_sales_rep IS NULL OR salesrep = p_sales_rep)
      AND (p_product_tag IS NULL OR producttag = p_product_tag)
  ),
  
  -- Find the absolute first purchase date for each customer + product combination
  first_purchases AS (
    SELECT 
      customerid,
      productid,
      MIN(idate) as first_date,
      MAX(customer_name) as customer_name,
      MAX(product_name) as product_name,
      MAX(barcode) as barcode
    FROM base_sales
    GROUP BY customerid, productid
  ),

  -- Filter first purchases by the date filters
  filtered_listings AS (
    SELECT 
      to_char(first_date, 'YYYY-MM') as month_key,
      productid,
      barcode,
      product_name,
      customerid,
      customer_name
    FROM first_purchases
    WHERE (v_curr_from IS NULL OR first_date >= v_curr_from)
      AND (v_curr_to IS NULL OR first_date <= v_curr_to)
  ),

  -- Group by month and product to list customers
  grouped_products AS (
    SELECT 
      month_key,
      productid as "productId",
      MAX(barcode) as barcode,
      MAX(product_name) as "productName",
      COUNT(DISTINCT customerid) as "customersCount",
      json_agg(json_build_object('id', customerid, 'name', customer_name)) as customers
    FROM filtered_listings
    GROUP BY month_key, productid
  ),

  -- Group by month to get unique metrics
  grouped_months AS (
    SELECT 
      month_key as "monthKey",
      to_char(to_date(month_key || '-01', 'YYYY-MM-DD'), 'Month YYYY') as "monthName",
      COUNT(DISTINCT "productId") as "uniqueProductsCount",
      COUNT(DISTINCT c.id) as "uniqueCustomersCount",
      json_agg(row_to_json(gp)) as products
    FROM grouped_products gp
    -- cross join / subquery to count unique customers inside the month
    CROSS JOIN LATERAL (
      SELECT DISTINCT (cust->>'id') as id 
      FROM json_array_elements(gp.customers) cust
    ) c
    GROUP BY month_key
  )

  SELECT COALESCE(json_agg(row_to_json(gm)), '[]'::json) INTO v_result
  FROM (
    SELECT "monthKey", "monthName", "uniqueProductsCount", "uniqueCustomersCount", products
    FROM grouped_months
    ORDER BY "monthKey" DESC
  ) gm;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';
