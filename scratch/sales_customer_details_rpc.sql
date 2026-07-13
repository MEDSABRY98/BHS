CREATE OR REPLACE FUNCTION public.get_sales_customer_details_raw(
  p_user_id text,
  p_customer_name text,
  p_customer_id text,
  p_customer_type text,
  p_year integer DEFAULT NULL::integer,
  p_month integer DEFAULT NULL::integer,
  p_date_from text DEFAULT NULL::text,
  p_date_to text DEFAULT NULL::text,
  p_invoice_type text DEFAULT 'all'::text,
  p_area text DEFAULT NULL::text,
  p_market text DEFAULT NULL::text,
  p_merchandiser text DEFAULT NULL::text,
  p_sales_rep text DEFAULT NULL::text,
  p_product_tag text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '60s'
AS $function$
DECLARE
  v_is_manager boolean;
  v_user_name text;
  v_cust_id text;
  v_cust_name text;
  v_date_from date;
  v_date_to date;
BEGIN
  v_is_manager := is_sales_manager(p_user_id);
  
  SELECT "NAME" INTO v_user_name 
  FROM "bhs_USERS" 
  WHERE "ID" = UPPER(TRIM(p_user_id));

  v_cust_id := NULLIF(TRIM(p_customer_id), '');
  v_cust_name := NULLIF(TRIM(p_customer_name), '');

  IF p_date_from IS NOT NULL AND p_date_from != '' THEN
    v_date_from := p_date_from::date;
  END IF;

  IF p_date_to IS NOT NULL AND p_date_to != '' THEN
    v_date_to := p_date_to::date;
  END IF;

  RETURN (
    WITH base_data AS (
      SELECT 
        b."ID" as id,
        b.invoicedate as "invoiceDate",
        b.invoicenumber as "invoiceNumber",
        b.customerid as "customerId",
        b.productid as "productId",
        b.productprice as "productPrice",
        b.amount,
        b.qty,
        b.customermainname as "customerMainName",
        b.customername as "customerName",
        b.producttag as "productTag",
        b.productcost as "productCost",
        b.product,
        b.barcode,
        b.salesrepid as "salesRepId",
        b.salesrep as "salesRep",
        b.area,
        b.market,
        b.merchandiserid as "merchandiserId",
        b.merchandiser
      FROM v_sales_mapped b
      WHERE 
        (v_is_manager = true OR b.salesrepid = UPPER(TRIM(p_user_id)) OR b.salesrep = v_user_name)
        AND (p_area IS NULL OR b.area = p_area)
        AND (p_market IS NULL OR b.market = p_market)
        AND (p_merchandiser IS NULL OR b.merchandiser = p_merchandiser)
        AND (p_sales_rep IS NULL OR b.salesrep = p_sales_rep)
        AND (p_product_tag IS NULL OR b.producttag = p_product_tag)
        AND (
          p_invoice_type = 'all' 
          OR (p_invoice_type = 'sales' AND UPPER(b.invoicenumber) LIKE 'SAL%')
          OR (p_invoice_type = 'returns' AND UPPER(b.invoicenumber) LIKE 'RSAL%')
        )
        AND (
          CASE WHEN p_customer_type = 'main' THEN
            (b.customermainname = v_cust_name OR b.customername = v_cust_name)
          ELSE
            (v_cust_id IS NOT NULL AND (b.customerid = v_cust_id OR UPPER(TRIM(b.customerid)) = UPPER(v_cust_id)))
            OR (b.customername = v_cust_name)
          END
        )
    ),
    filtered_data AS (
      SELECT *
      FROM base_data b2
      WHERE (p_year IS NULL OR EXTRACT(YEAR FROM b2."invoiceDate"::date) = p_year)
        AND (p_month IS NULL OR EXTRACT(MONTH FROM b2."invoiceDate"::date) = p_month)
        AND (v_date_from IS NULL OR b2."invoiceDate"::date >= v_date_from)
        AND (v_date_to IS NULL OR b2."invoiceDate"::date <= v_date_to)
    )
    SELECT json_build_object(
      'allData', COALESCE((SELECT json_agg(row_to_json(b)) FROM base_data b), '[]'::json),
      'data', COALESCE((SELECT json_agg(row_to_json(f)) FROM filtered_data f), '[]'::json)
    )
  );
END;
$function$;
