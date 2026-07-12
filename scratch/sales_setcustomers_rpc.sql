DROP FUNCTION IF EXISTS get_my_customers_data(text);

CREATE OR REPLACE FUNCTION get_my_customers_data(p_user_id text)
RETURNS json AS $$
DECLARE
  v_is_manager boolean;
  v_user_name text;
  v_result json;
BEGIN
  -- Check manager rights using the established system function
  v_is_manager := is_sales_manager(p_user_id);
  
  SELECT "NAME" INTO v_user_name 
  FROM "bhs_USERS" 
  WHERE "ID" = UPPER(TRIM(p_user_id));

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) INTO v_result
  FROM (
    SELECT 
      m."ID" as "ID",
      m."CUSTOMER ID" as "CUSTOMER ID",
      m."AREA" as "AREA",
      m."MARKET" as "MARKET",
      m."SALES_REP" as "USER_ID",
      u_rep."NAME" as "SALES_REP",
      m."MERCHANDISER" as "MERCHANDISER_ID",
      u_merch."NAME" as "MERCHANDISER",
      COALESCE(c."CUSTOMER MAIN NAME", '') as "CUSTOMER MAIN NAME",
      COALESCE(c."CUSTOMER SUB NAME", '') as "CUSTOMER SUB NAME"
    FROM "web_Sales_DB_CUSTOMERSMAPPING" m
    LEFT JOIN "bhs_CUSTOMERS" c ON UPPER(TRIM(m."CUSTOMER ID")) = UPPER(TRIM(c."CUSTOMER ID"))
    LEFT JOIN "bhs_USERS" u_rep ON m."SALES_REP" = u_rep."ID"
    LEFT JOIN "bhs_USERS" u_merch ON m."MERCHANDISER" = u_merch."ID"
    WHERE 
      v_is_manager = true 
      OR m."SALES_REP" = UPPER(TRIM(p_user_id)) 
      OR UPPER(TRIM(u_rep."NAME")) = UPPER(TRIM(v_user_name))
    ORDER BY COALESCE(c."CUSTOMER MAIN NAME", '') ASC
  ) r;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';
