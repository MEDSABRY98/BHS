DROP FUNCTION IF EXISTS get_sales_overview_data(text, int, int, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION get_sales_overview_data(
  p_user_id text,
  p_year int DEFAULT NULL,
  p_month int DEFAULT NULL,
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL,
  p_invoice_type text DEFAULT 'all',
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
  
  -- Filters
  v_target_year int;
  v_curr_from date;
  v_curr_to date;

  -- Results
  v_result json;
BEGIN
  -- 1. Check Manager permissions
  v_is_manager := is_sales_manager(p_user_id);
  
  SELECT "NAME" INTO v_user_name 
  FROM "bhs_USERS" 
  WHERE "ID" = UPPER(TRIM(p_user_id));

  WITH base_sales AS (
    SELECT 
      invoicedate::date as idate,
      extract(year from invoicedate)::int as yr_date,
      extract(month from invoicedate)::int as mn,
      invoicenumber,
      customerid,
      COALESCE(NULLIF(TRIM(customermainname), ''), TRIM(customername), 'Unknown') as customer_main,
      COALESCE(NULLIF(TRIM(customername), ''), TRIM(customermainname), 'Unknown') as customer_sub,
      producttag,
      product,
      barcode,
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
  ),
  target_year_calc AS (
    SELECT COALESCE(p_year, MAX(yr_date), extract(year from CURRENT_DATE)::int) as ty FROM base_sales
  )
  SELECT ty INTO v_target_year FROM target_year_calc;

  IF v_target_year IS NULL THEN
    v_target_year := extract(year from CURRENT_DATE)::int;
  END IF;

  -- Determine date bounds for metrics
  IF p_year IS NOT NULL OR p_month IS NOT NULL OR p_date_from IS NOT NULL OR p_date_to IS NOT NULL THEN
    IF p_date_from IS NOT NULL OR p_date_to IS NOT NULL THEN
      v_curr_from := COALESCE(p_date_from::date, date_trunc('year', CURRENT_DATE)::date);
      v_curr_to := COALESCE(p_date_to::date, (date_trunc('year', CURRENT_DATE) + interval '1 year - 1 day')::date);
    ELSE
      DECLARE
        m int := COALESCE(p_month, 0);
      BEGIN
        IF m > 0 THEN
          v_curr_from := to_date(v_target_year || '-' || m || '-01', 'YYYY-MM-DD');
          v_curr_to := (v_curr_from + interval '1 month - 1 day')::date;
        ELSE
          v_curr_from := to_date(v_target_year || '-01-01', 'YYYY-MM-DD');
          v_curr_to := to_date(v_target_year || '-12-31', 'YYYY-MM-DD');
        END IF;
      END;
    END IF;
  ELSE
    -- No date filter passed: calculate metrics for all historical data
    v_curr_from := NULL;
    v_curr_to := NULL;
  END IF;

  WITH base_sales AS (
    SELECT 
      invoicedate::date as idate,
      extract(year from invoicedate)::int as yr_date,
      extract(month from invoicedate)::int as mn,
      invoicenumber,
      customerid,
      COALESCE(NULLIF(TRIM(customermainname), ''), TRIM(customername), 'Unknown') as customer_main,
      COALESCE(NULLIF(TRIM(customername), ''), TRIM(customermainname), 'Unknown') as customer_sub,
      producttag,
      product,
      barcode,
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
  ),

  -- Metrics for current selection (or all historical data if no filter)
  metrics_curr AS (
    SELECT 
      COALESCE(SUM(amount), 0) as total_amount,
      COALESCE(SUM(qty), 0) as total_qty,
      COUNT(DISTINCT customerid) as total_customers,
      COUNT(DISTINCT barcode) as total_products,
      COUNT(DISTINCT to_char(idate, 'YYYY-MM')) as months_count
    FROM base_sales
    WHERE (v_curr_from IS NULL OR idate >= v_curr_from)
      AND (v_curr_to IS NULL OR idate <= v_curr_to)
  ),

  -- Chart Data (12 Months comparison: target_year vs target_year-1)
  chart_months AS (
    SELECT m as month_num FROM generate_series(1, 12) m
  ),
  chart_current AS (
    SELECT mn, COALESCE(SUM(amount), 0) as amount, COALESCE(SUM(qty), 0) as qty
    FROM base_sales
    WHERE yr_date = v_target_year
    GROUP BY mn
  ),
  chart_prev AS (
    SELECT mn, COALESCE(SUM(amount), 0) as amount, COALESCE(SUM(qty), 0) as qty
    FROM base_sales
    WHERE yr_date = (v_target_year - 1)
    GROUP BY mn
  ),
  chart_combined AS (
    SELECT 
      m.month_num,
      CASE m.month_num 
        WHEN 1 THEN 'Jan' WHEN 2 THEN 'Feb' WHEN 3 THEN 'Mar' WHEN 4 THEN 'Apr'
        WHEN 5 THEN 'May' WHEN 6 THEN 'Jun' WHEN 7 THEN 'Jul' WHEN 8 THEN 'Aug'
        WHEN 9 THEN 'Sep' WHEN 10 THEN 'Oct' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Dec'
      END as month,
      v_target_year::text as legend_curr,
      (v_target_year - 1)::text as legend_prev,
      COALESCE(c.amount, 0) as current_amount,
      COALESCE(p.amount, 0) as prev_amount,
      COALESCE(c.amount, 0) - COALESCE(p.amount, 0) as diff,
      CASE 
        WHEN COALESCE(p.amount, 0) != 0 THEN ((COALESCE(c.amount, 0) - COALESCE(p.amount, 0))/ABS(COALESCE(p.amount, 0)))*100
        ELSE CASE WHEN COALESCE(c.amount, 0) > 0 THEN 100 ELSE 0 END
      END as percent,
      CASE WHEN (v_target_year > extract(year from CURRENT_DATE)::int) OR (v_target_year = extract(year from CURRENT_DATE)::int AND m.month_num > extract(month from CURRENT_DATE)::int) THEN true ELSE false END as is_future
    FROM chart_months m
    LEFT JOIN chart_current c ON m.month_num = c.mn
    LEFT JOIN chart_prev p ON m.month_num = p.mn
  ),

  -- Yearly Table Data
  yearly_stats AS (
    SELECT 
      yr_date as year,
      COALESCE(SUM(amount), 0) as amount,
      COALESCE(SUM(qty), 0) as qty,
      COUNT(DISTINCT customerid) as customer_count,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as gross_sales,
      COUNT(DISTINCT CASE WHEN amount > 0 THEN invoicenumber ELSE NULL END) as sales_count,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as grv_amount,
      COUNT(DISTINCT CASE WHEN amount < 0 THEN invoicenumber ELSE NULL END) as grv_count
    FROM base_sales
    GROUP BY yr_date
  ),
  yearly_stats_diff AS (
    SELECT 
      y1.year,
      y1.amount,
      y1.amount - COALESCE(y2.amount, 0) as amount_diff,
      y1.qty,
      y1.customer_count as "customerCount",
      y1.gross_sales as "grossSales",
      y1.sales_count as "salesCount",
      y1.grv_amount as "grvAmount",
      y1.grv_count as "grvCount"
    FROM yearly_stats y1
    LEFT JOIN yearly_stats y2 ON y1.year = y2.year + 1
    ORDER BY y1.year DESC
  ),

  -- Monthly Table Data for the filtered year
  monthly_stats AS (
    SELECT 
      yr_date as yr,
      mn,
      to_char(to_date(yr_date || '-' || mn || '-01', 'YYYY-MM-DD'), 'Mon YY') as month,
      yr_date || '-' || lpad(mn::text, 2, '0') as month_key,
      COALESCE(SUM(amount), 0) as amount,
      COALESCE(SUM(qty), 0) as qty,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as gross_sales,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as grv_amount,
      COUNT(DISTINCT customerid) as customer_count,
      COUNT(DISTINCT CASE WHEN amount > 0 THEN invoicenumber ELSE NULL END) as sales_count,
      COUNT(DISTINCT CASE WHEN amount < 0 THEN invoicenumber ELSE NULL END) as grv_count
    FROM base_sales
    WHERE yr_date = v_target_year
    GROUP BY yr_date, mn
  ),
  monthly_stats_diff AS (
    SELECT 
      m1.month,
      m1.month_key as "monthKey",
      m1.amount,
      m1.qty,
      m1.gross_sales as "grossSales",
      m1.grv_amount as "grvAmount",
      m1.customer_count as "customerCount",
      m1.sales_count as "salesCount",
      m1.grv_count as "grvCount",
      m1.amount - COALESCE((
        SELECT amount FROM monthly_stats m2 
        WHERE (m2.yr = m1.yr AND m2.mn = m1.mn - 1) OR (m2.yr = m1.yr - 1 AND m1.mn = 1 AND m2.mn = 12)
      ), 0) as amount_diff
    FROM monthly_stats m1
    ORDER BY m1.month_key DESC
  )

  SELECT json_build_object(
    'metrics', (
      SELECT json_build_object(
        'totalAmount', c.total_amount,
        'totalQty', c.total_qty,
        'totalCustomers', c.total_customers,
        'totalProducts', c.total_products,
        'avgMonthlyAmount', CASE WHEN c.months_count > 0 THEN c.total_amount / c.months_count ELSE c.total_amount END,
        'avgMonthlyQty', CASE WHEN c.months_count > 0 THEN c.total_qty / c.months_count ELSE c.total_qty END
      ) FROM metrics_curr c
    ),
    'chartData', (
      SELECT COALESCE(json_agg(json_build_object(
        'month', month,
        'year', substring(legend_curr from 3 for 2),
        'prevYear', substring(legend_prev from 3 for 2),
        'currentAmount', current_amount,
        'prevAmount', prev_amount,
        'diff', diff,
        'percent', percent,
        'isPositive', diff >= 0,
        'isFuture', is_future,
        'legendCurr', legend_curr,
        'legendPrev', legend_prev
      )), '[]'::json) FROM chart_combined
    ),
    'yearlyTableData', (
      SELECT COALESCE(json_agg(row_to_json(yd)), '[]'::json) FROM yearly_stats_diff yd
    ),
    'monthlyTableData', (
      SELECT COALESCE(json_agg(row_to_json(md)), '[]'::json) FROM monthly_stats_diff md
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';
