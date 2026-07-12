DROP FUNCTION IF EXISTS get_sales_top_10(text, text, int, int, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS get_sales_stock_raw_data(text, text, text, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION get_sales_top_10(
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

  WITH base_sales AS (
    SELECT 
      invoicedate::date as idate,
      invoicenumber,
      customerid,
      COALESCE(NULLIF(TRIM(customermainname), ''), TRIM(customername), 'Unknown') as customer_main,
      COALESCE(NULLIF(TRIM(customername), ''), TRIM(customermainname), 'Unknown') as customer_sub,
      producttag,
      product,
      barcode,
      amount,
      qty,
      productid
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

  products_agg AS (
    SELECT 
      COALESCE(productid, barcode, product) as key_id,
      MAX(productid) as "productId",
      MAX(barcode) as barcode,
      array_agg(DISTINCT product) as products,
      SUM(amount) as "totalAmount",
      SUM(qty) as "totalQty",
      COUNT(DISTINCT invoicenumber) as transactions
    FROM base_sales
    GROUP BY COALESCE(productid, barcode, product)
  ),

  main_cust_agg AS (
    SELECT 
      customer_main as customer,
      SUM(amount) as "totalAmount",
      SUM(qty) as "totalQty",
      COUNT(DISTINCT invoicenumber) as transactions
    FROM base_sales
    GROUP BY customer_main
  ),

  sub_cust_agg AS (
    SELECT 
      customer_sub as customer,
      SUM(amount) as "totalAmount",
      SUM(qty) as "totalQty",
      COUNT(DISTINCT invoicenumber) as transactions
    FROM base_sales
    GROUP BY customer_sub
  )

  SELECT json_build_object(
    'productsData', (SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json) FROM products_agg p),
    'mainCustomersData', (SELECT COALESCE(json_agg(row_to_json(mc)), '[]'::json) FROM main_cust_agg mc),
    'subCustomersData', (SELECT COALESCE(json_agg(row_to_json(sc)), '[]'::json) FROM sub_cust_agg sc)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';


-- Stock Report Raw Data Fetcher
CREATE OR REPLACE FUNCTION get_sales_stock_raw_data(
  p_user_id text,
  p_invoice_type text DEFAULT 'all',
  p_year text DEFAULT NULL,
  p_month text DEFAULT NULL,
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
  ELSIF p_year IS NOT NULL AND p_year != 'All' THEN
    IF p_month IS NOT NULL AND p_month != 'All' THEN
      v_curr_from := to_date(p_year || '-' || p_month || '-01', 'YYYY-MM-DD');
      v_curr_to := (v_curr_from + interval '1 month - 1 day')::date;
    ELSE
      v_curr_from := to_date(p_year || '-01-01', 'YYYY-MM-DD');
      v_curr_to := to_date(p_year || '-12-31', 'YYYY-MM-DD');
    END IF;
  END IF;

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) INTO v_result
  FROM (
    SELECT 
      invoicedate as "invoiceDate",
      invoicenumber as "invoiceNumber",
      customerid as "customerId",
      customermainname as "customerMainName",
      customername as "customerName",
      productid as "productId",
      product as product,
      barcode as barcode,
      productcost as "productCost",
      productprice as "productPrice",
      amount,
      qty
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
  ) r;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';
