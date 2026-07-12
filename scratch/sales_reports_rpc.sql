DROP FUNCTION IF EXISTS get_sales_reports_data(text, int, int, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION get_sales_reports_data(
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
  v_rep_display_name text;
  
  -- Timing Period bounds (Dates)
  v_curr_from date;
  v_curr_to date;
  v_prev_from date;
  v_prev_to date;
  v_smly_from date;
  v_smly_to date;
  v_prev_prev_from date;
  v_prev_prev_to date;
  v_smly_prev_from date;
  v_smly_prev_to date;

  v_reporting_mode text;
  v_reporting_mode_label text;
  v_primary_amount_label text;
  v_period_label text;

  -- User matching for target logic
  v_target_user_id text := NULL;
  v_target_type text := 'sales_rep';

  -- Results
  v_result json;
BEGIN
  -- 1. Check Manager permissions
  v_is_manager := is_sales_manager(p_user_id);
  
  SELECT "NAME" INTO v_user_name 
  FROM "bhs_USERS" 
  WHERE "ID" = UPPER(TRIM(p_user_id));

  -- Resolve rep display name
  IF p_sales_rep IS NOT NULL THEN
    v_rep_display_name := p_sales_rep;
    SELECT "ID" INTO v_target_user_id FROM "bhs_USERS" WHERE UPPER(TRIM("NAME")) = UPPER(TRIM(p_sales_rep)) LIMIT 1;
    v_target_type := 'sales_rep';
  ELSIF p_merchandiser IS NOT NULL THEN
    v_rep_display_name := p_merchandiser;
    SELECT "ID" INTO v_target_user_id FROM "bhs_USERS" WHERE UPPER(TRIM("NAME")) = UPPER(TRIM(p_merchandiser)) LIMIT 1;
    v_target_type := 'merchandiser';
  ELSIF v_is_manager THEN
    v_rep_display_name := 'All Sales Reps';
    v_target_user_id := NULL;
  ELSE
    v_rep_display_name := COALESCE(v_user_name, p_user_id);
    v_target_user_id := UPPER(TRIM(p_user_id));
    v_target_type := 'sales_rep';
  END IF;

  -- 2. Resolve Periods
  IF p_date_from IS NOT NULL OR p_date_to IS NOT NULL THEN
    v_curr_from := COALESCE(p_date_from::date, date_trunc('month', CURRENT_DATE)::date);
    v_curr_to := COALESCE(p_date_to::date, (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date);
    
    -- Prev period has same length
    v_prev_to := v_curr_from - interval '1 day';
    v_prev_from := v_prev_to - (v_curr_to - v_curr_from);
    
    -- Same period last year
    v_smly_from := v_curr_from - interval '1 year';
    v_smly_to := v_curr_to - interval '1 year';
  ELSE
    DECLARE
      y int := COALESCE(p_year, extract(year from CURRENT_DATE)::int);
      m int := COALESCE(p_month, extract(month from CURRENT_DATE)::int);
      py int := y;
      pm int := m - 1;
    BEGIN
      IF pm < 1 THEN
        pm := 12;
        py := py - 1;
      END IF;
      v_curr_from := to_date(y || '-' || m || '-01', 'YYYY-MM-DD');
      v_curr_to := (v_curr_from + interval '1 month - 1 day')::date;
      
      v_prev_from := to_date(py || '-' || pm || '-01', 'YYYY-MM-DD');
      v_prev_to := (v_prev_from + interval '1 month - 1 day')::date;
      
      v_smly_from := v_curr_from - interval '1 year';
      v_smly_to := v_curr_to - interval '1 year';
    END;
  END IF;

  v_prev_prev_to := v_prev_from - interval '1 day';
  v_prev_prev_from := v_prev_to - (v_prev_to - v_prev_from);

  v_smly_prev_to := v_smly_from - interval '1 day';
  v_smly_prev_from := v_smly_to - (v_smly_to - v_smly_from);

  v_reporting_mode := p_invoice_type;
  v_reporting_mode_label := CASE WHEN p_invoice_type = 'sales' THEN 'Sales Only' WHEN p_invoice_type = 'returns' THEN 'Returns Only' ELSE 'Net Sales' END;
  v_primary_amount_label := CASE WHEN p_invoice_type = 'returns' THEN 'Returns Amount (AED)' ELSE 'Net Amount (AED)' END;
  v_period_label := to_char(v_curr_from, 'Month DD, YYYY') || ' - ' || to_char(v_curr_to, 'Month DD, YYYY');

  -- 3. Execute queries and assemble final JSON
  
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
      productcost
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
  
  metrics_curr AS (
    SELECT 
      COALESCE(SUM(amount), 0) as total_sales,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as sales_amount,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as grv_amount,
      COUNT(DISTINCT invoicenumber) as invoices,
      COUNT(DISTINCT CASE WHEN amount < 0 THEN invoicenumber ELSE NULL END) as grv_invoices,
      COUNT(DISTINCT customerid) as active_customers
    FROM base_sales
    WHERE idate >= v_curr_from AND idate <= v_curr_to
  ),

  metrics_prev AS (
    SELECT 
      COALESCE(SUM(amount), 0) as total_sales,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as sales_amount,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as grv_amount,
      COUNT(DISTINCT invoicenumber) as invoices,
      COUNT(DISTINCT CASE WHEN amount < 0 THEN invoicenumber ELSE NULL END) as grv_invoices,
      COUNT(DISTINCT customerid) as active_customers
    FROM base_sales
    WHERE idate >= v_prev_from AND idate <= v_prev_to
  ),

  metrics_smly AS (
    SELECT 
      COALESCE(SUM(amount), 0) as total_sales,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as sales_amount,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as grv_amount,
      COUNT(DISTINCT invoicenumber) as invoices,
      COUNT(DISTINCT CASE WHEN amount < 0 THEN invoicenumber ELSE NULL END) as grv_invoices,
      COUNT(DISTINCT customerid) as active_customers
    FROM base_sales
    WHERE idate >= v_smly_from AND idate <= v_smly_to
  ),

  -- Targets summary
  target_summary AS (
    SELECT COALESCE(SUM("TARGET_AMOUNT"), 0) as amount
    FROM "web_Sales_DB_TARGET"
    WHERE 
      "YEAR" = extract(year from v_curr_from)::int 
      AND "MONTH" = extract(month from v_curr_from)::int
      AND (v_target_user_id IS NULL OR UPPER(TRIM("USER_ID")) = v_target_user_id)
      AND ("TARGET_TYPE" = v_target_type)
  ),

  -- Sparkline arrays (for the last 8 months)
  spark_data AS (
    SELECT 
      extract(year from idate)::int as yr,
      extract(month from idate)::int as mn,
      COALESCE(SUM(amount), 0) as total_sales,
      COUNT(DISTINCT invoicenumber) as invoices,
      COUNT(DISTINCT customerid) as active_customers
    FROM base_sales
    WHERE idate >= (v_curr_from - interval '8 months') AND idate <= v_curr_to
    GROUP BY yr, mn
  ),

  -- Daily sales for calendar
  daily_sales AS (
    SELECT 
      extract(day from idate)::int as day,
      to_char(idate, 'YYYY-MM-DD') as date,
      COALESCE(SUM(amount), 0) as amount
    FROM base_sales
    WHERE idate >= v_curr_from AND idate <= v_curr_to
    GROUP BY day, date
    ORDER BY day
  ),

  -- Top Sales Invoices
  top_sales_invoices AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY SUM(amount) DESC) as rank,
      to_char(idate, 'DD/MM/YYYY') as date,
      invoicenumber as "invoiceNumber",
      MAX(customer_sub) as "customerName",
      SUM(amount) as amount
    FROM base_sales
    WHERE idate >= v_curr_from AND idate <= v_curr_to AND UPPER(invoicenumber) LIKE 'SAL%'
    GROUP BY invoicenumber, idate
    ORDER BY amount DESC
    LIMIT 10
  ),

  -- Top Return Invoices
  top_return_invoices AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY SUM(ABS(amount)) DESC) as rank,
      to_char(idate, 'DD/MM/YYYY') as date,
      invoicenumber as "invoiceNumber",
      MAX(customer_sub) as "customerName",
      SUM(ABS(amount)) as amount
    FROM base_sales
    WHERE idate >= v_curr_from AND idate <= v_curr_to AND UPPER(invoicenumber) LIKE 'RSAL%'
    GROUP BY invoicenumber, idate
    ORDER BY amount DESC
    LIMIT 10
  ),

  -- Main customer groups
  cust_current_main AS (
    SELECT customer_main as name, SUM(amount) as amount, COUNT(DISTINCT invoicenumber) as invoices
    FROM base_sales
    WHERE idate >= v_curr_from AND idate <= v_curr_to
    GROUP BY customer_main
  ),
  cust_prev_main AS (
    SELECT customer_main as name, SUM(amount) as amount
    FROM base_sales
    WHERE idate >= v_prev_from AND idate <= v_prev_to
    GROUP BY customer_main
  ),
  cust_smly_main AS (
    SELECT customer_main as name, SUM(amount) as amount
    FROM base_sales
    WHERE idate >= v_smly_from AND idate <= v_smly_to
    GROUP BY customer_main
  ),

  -- Sub customer groups
  cust_current_sub AS (
    SELECT customer_sub as name, SUM(amount) as amount, COUNT(DISTINCT invoicenumber) as invoices
    FROM base_sales
    WHERE idate >= v_curr_from AND idate <= v_curr_to
    GROUP BY customer_sub
  ),
  cust_prev_sub AS (
    SELECT customer_sub as name, SUM(amount) as amount
    FROM base_sales
    WHERE idate >= v_prev_from AND idate <= v_prev_to
    GROUP BY customer_sub
  ),
  cust_smly_sub AS (
    SELECT customer_sub as name, SUM(amount) as amount
    FROM base_sales
    WHERE idate >= v_smly_from AND idate <= v_smly_to
    GROUP BY customer_sub
  ),

  -- Mapped Main Customer comparison rows (prevMonth)
  cust_compare_prev_main AS (
    SELECT 
      COALESCE(c.name, p.name) as name,
      COALESCE(c.amount, 0) as currentAmount,
      COALESCE(p.amount, 0) as compareAmount,
      COALESCE(c.amount, 0) - COALESCE(p.amount, 0) as changeAmount,
      CASE 
        WHEN COALESCE(p.amount, 0) != 0 THEN ((COALESCE(c.amount, 0) - COALESCE(p.amount, 0))/ABS(COALESCE(p.amount, 0)))*100
        ELSE CASE WHEN COALESCE(c.amount, 0) > 0 THEN 100 ELSE 0 END
      END as changePct
    FROM cust_current_main c
    FULL OUTER JOIN cust_prev_main p ON c.name = p.name
  ),

  -- Mapped Main Customer comparison rows (smly)
  cust_compare_smly_main AS (
    SELECT 
      COALESCE(c.name, s.name) as name,
      COALESCE(c.amount, 0) as currentAmount,
      COALESCE(s.amount, 0) as compareAmount,
      COALESCE(c.amount, 0) - COALESCE(s.amount, 0) as changeAmount,
      CASE 
        WHEN COALESCE(s.amount, 0) != 0 THEN ((COALESCE(c.amount, 0) - COALESCE(s.amount, 0))/ABS(COALESCE(s.amount, 0)))*100
        ELSE CASE WHEN COALESCE(c.amount, 0) > 0 THEN 100 ELSE 0 END
      END as changePct
    FROM cust_current_main c
    FULL OUTER JOIN cust_smly_main s ON c.name = s.name
  ),

  -- Mapped Sub Customer comparison rows (prevMonth)
  cust_compare_prev_sub AS (
    SELECT 
      COALESCE(c.name, p.name) as name,
      COALESCE(c.amount, 0) as currentAmount,
      COALESCE(p.amount, 0) as compareAmount,
      COALESCE(c.amount, 0) - COALESCE(p.amount, 0) as changeAmount,
      CASE 
        WHEN COALESCE(p.amount, 0) != 0 THEN ((COALESCE(c.amount, 0) - COALESCE(p.amount, 0))/ABS(COALESCE(p.amount, 0)))*100
        ELSE CASE WHEN COALESCE(c.amount, 0) > 0 THEN 100 ELSE 0 END
      END as changePct
    FROM cust_current_sub c
    FULL OUTER JOIN cust_prev_sub p ON c.name = p.name
  ),

  -- Mapped Sub Customer comparison rows (smly)
  cust_compare_smly_sub AS (
    SELECT 
      COALESCE(c.name, s.name) as name,
      COALESCE(c.amount, 0) as currentAmount,
      COALESCE(s.amount, 0) as compareAmount,
      COALESCE(c.amount, 0) - COALESCE(s.amount, 0) as changeAmount,
      CASE 
        WHEN COALESCE(s.amount, 0) != 0 THEN ((COALESCE(c.amount, 0) - COALESCE(s.amount, 0))/ABS(COALESCE(s.amount, 0)))*100
        ELSE CASE WHEN COALESCE(c.amount, 0) > 0 THEN 100 ELSE 0 END
      END as changePct
    FROM cust_current_sub c
    FULL OUTER JOIN cust_smly_sub s ON c.name = s.name
  ),

  -- Monthly comparisons for chart (last 6 months)
  monthly_chart AS (
    SELECT 
      to_char(g.m_date, 'Mon') as month,
      COALESCE(SUM(CASE WHEN base.idate >= g.m_date AND base.idate < (g.m_date + interval '1 month') THEN base.amount ELSE 0 END), 0) as actual,
      COALESCE((
        SELECT SUM("TARGET_AMOUNT")
        FROM "web_Sales_DB_TARGET"
        WHERE 
          "YEAR" = extract(year from g.m_date)::int 
          AND "MONTH" = extract(month from g.m_date)::int
          AND (v_target_user_id IS NULL OR UPPER(TRIM("USER_ID")) = v_target_user_id)
          AND ("TARGET_TYPE" = v_target_type)
      ), 0) as target,
      COALESCE(SUM(CASE WHEN base.idate >= (g.m_date - interval '1 year') AND base.idate < (g.m_date - interval '1 year' + interval '1 month') THEN base.amount ELSE 0 END), 0) as lastYear,
      COALESCE(SUM(CASE WHEN base.idate >= (g.m_date - interval '1 month') AND base.idate < g.m_date THEN base.amount ELSE 0 END), 0) as prevMonth
    FROM (
      SELECT generate_series(
        (v_curr_from - interval '5 months')::timestamp,
        v_curr_from::timestamp,
        '1 month'::interval
      )::date as m_date
    ) g
    LEFT JOIN base_sales base ON base.idate >= (g.m_date - interval '1 year') AND base.idate <= (g.m_date + interval '1 month')
    GROUP BY g.m_date
    ORDER BY g.m_date
  )

  SELECT json_build_object(
    'repDisplayName', v_rep_display_name,
    'periodLabel', v_period_label,
    'reportingMode', v_reporting_mode,
    'reportingModeLabel', v_reporting_mode_label,
    'primaryAmountLabel', v_primary_amount_label,
    'compareModes', json_build_object(
      'prevMonth', json_build_object('label', to_char(v_prev_from, 'Month DD, YYYY') || ' - ' || to_char(v_prev_to, 'Month DD, YYYY')),
      'sameMonthLastYear', json_build_object('label', to_char(v_smly_from, 'Month DD, YYYY') || ' - ' || to_char(v_smly_to, 'Month DD, YYYY'))
    ),
    'kpis', (
      SELECT json_build_object(
        'totalSales', json_build_object(
          'value', CASE WHEN v_reporting_mode = 'sales' THEN c.sales_amount WHEN v_reporting_mode = 'returns' THEN c.grv_amount ELSE c.total_sales END,
          'changePct', CASE 
            WHEN v_reporting_mode = 'sales' THEN 
              CASE WHEN p.sales_amount > 0 THEN ((c.sales_amount - p.sales_amount)/p.sales_amount)*100 ELSE 0 END
            WHEN v_reporting_mode = 'returns' THEN 
              CASE WHEN p.grv_amount > 0 THEN ((c.grv_amount - p.grv_amount)/p.grv_amount)*100 ELSE 0 END
            ELSE 
              CASE WHEN p.total_sales != 0 THEN ((c.total_sales - p.total_sales)/ABS(p.total_sales))*100 ELSE 0 END
          END,
          'salesAmount', c.sales_amount,
          'returnsAmount', c.grv_amount,
          'sparkline', (SELECT COALESCE(json_agg(total_sales), '[]'::json) FROM spark_data)
        ),
        'targetAchievement', json_build_object(
          'value', CASE WHEN (SELECT amount FROM target_summary) > 0 THEN (c.sales_amount / (SELECT amount FROM target_summary)) * 100 ELSE 0 END,
          'targetAmount', (SELECT amount FROM target_summary),
          'actualAmount', c.sales_amount,
          'changePct', 0
        ),
        'invoices', json_build_object(
          'value', c.invoices,
          'changeAbs', c.invoices - p.invoices,
          'sparkline', (SELECT COALESCE(json_agg(invoices), '[]'::json) FROM spark_data)
        ),
        'activeCustomers', json_build_object(
          'value', c.active_customers,
          'changeAbs', c.active_customers - p.active_customers,
          'sparkline', (SELECT COALESCE(json_agg(active_customers), '[]'::json) FROM spark_data)
        ),
        'avgInvoiceValue', json_build_object(
          'value', CASE WHEN c.invoices > 0 THEN c.total_sales / c.invoices ELSE 0 END,
          'changePct', CASE 
            WHEN p.invoices > 0 AND c.invoices > 0 AND (p.total_sales / p.invoices) != 0 
            THEN (((c.total_sales / c.invoices) - (p.total_sales / p.invoices)) / ABS(p.total_sales / p.invoices)) * 100 
            ELSE 0 
          END
        ),
        'newCustomers', json_build_object(
          'value', 0,
          'changeAbs', 0
        )
      ) FROM metrics_curr c, metrics_prev p
    ),
    'kpiViews', json_build_object(
      'prevMonth', (
        SELECT json_build_object(
          'totalSales', json_build_object(
            'value', CASE WHEN v_reporting_mode = 'sales' THEN c.sales_amount WHEN v_reporting_mode = 'returns' THEN c.grv_amount ELSE c.total_sales END,
            'changePct', CASE 
              WHEN v_reporting_mode = 'sales' THEN 
                CASE WHEN p.sales_amount > 0 THEN ((c.sales_amount - p.sales_amount)/p.sales_amount)*100 ELSE 0 END
              WHEN v_reporting_mode = 'returns' THEN 
                CASE WHEN p.grv_amount > 0 THEN ((c.grv_amount - p.grv_amount)/p.grv_amount)*100 ELSE 0 END
              ELSE 
                CASE WHEN p.total_sales != 0 THEN ((c.total_sales - p.total_sales)/ABS(p.total_sales))*100 ELSE 0 END
            END,
            'salesAmount', c.sales_amount,
            'returnsAmount', c.grv_amount,
            'sparkline', (SELECT COALESCE(json_agg(total_sales), '[]'::json) FROM spark_data)
          ),
          'targetAchievement', json_build_object(
            'value', CASE WHEN (SELECT amount FROM target_summary) > 0 THEN (c.sales_amount / (SELECT amount FROM target_summary)) * 100 ELSE 0 END,
            'targetAmount', (SELECT amount FROM target_summary),
            'actualAmount', c.sales_amount,
            'changePct', 0
          ),
          'invoices', json_build_object(
            'value', c.invoices,
            'changeAbs', c.invoices - p.invoices,
            'sparkline', (SELECT COALESCE(json_agg(invoices), '[]'::json) FROM spark_data)
          ),
          'activeCustomers', json_build_object(
            'value', c.active_customers,
            'changeAbs', c.active_customers - p.active_customers,
            'sparkline', (SELECT COALESCE(json_agg(active_customers), '[]'::json) FROM spark_data)
          ),
          'avgInvoiceValue', json_build_object(
            'value', CASE WHEN c.invoices > 0 THEN c.total_sales / c.invoices ELSE 0 END,
            'changePct', CASE 
              WHEN p.invoices > 0 AND c.invoices > 0 AND (p.total_sales / p.invoices) != 0 
              THEN (((c.total_sales / c.invoices) - (p.total_sales / p.invoices)) / ABS(p.total_sales / p.invoices)) * 100 
              ELSE 0 
            END
          ),
          'newCustomers', json_build_object(
            'value', 0,
            'changeAbs', 0
          )
        ) FROM metrics_curr c, metrics_prev p
      ),
      'sameMonthLastYear', (
        SELECT json_build_object(
          'totalSales', json_build_object(
            'value', CASE WHEN v_reporting_mode = 'sales' THEN c.sales_amount WHEN v_reporting_mode = 'returns' THEN c.grv_amount ELSE c.total_sales END,
            'changePct', CASE 
              WHEN v_reporting_mode = 'sales' THEN 
                CASE WHEN s.sales_amount > 0 THEN ((c.sales_amount - s.sales_amount)/s.sales_amount)*100 ELSE 0 END
              WHEN v_reporting_mode = 'returns' THEN 
                CASE WHEN s.grv_amount > 0 THEN ((c.grv_amount - s.grv_amount)/s.grv_amount)*100 ELSE 0 END
              ELSE 
                CASE WHEN s.total_sales != 0 THEN ((c.total_sales - s.total_sales)/ABS(s.total_sales))*100 ELSE 0 END
            END,
            'salesAmount', c.sales_amount,
            'returnsAmount', c.grv_amount,
            'sparkline', (SELECT COALESCE(json_agg(total_sales), '[]'::json) FROM spark_data)
          ),
          'targetAchievement', json_build_object(
            'value', CASE WHEN (SELECT amount FROM target_summary) > 0 THEN (c.sales_amount / (SELECT amount FROM target_summary)) * 100 ELSE 0 END,
            'targetAmount', (SELECT amount FROM target_summary),
            'actualAmount', c.sales_amount,
            'changePct', 0
          ),
          'invoices', json_build_object(
            'value', c.invoices,
            'changeAbs', c.invoices - s.invoices,
            'sparkline', (SELECT COALESCE(json_agg(invoices), '[]'::json) FROM spark_data)
          ),
          'activeCustomers', json_build_object(
            'value', c.active_customers,
            'changeAbs', c.active_customers - s.active_customers,
            'sparkline', (SELECT COALESCE(json_agg(active_customers), '[]'::json) FROM spark_data)
          ),
          'avgInvoiceValue', json_build_object(
            'value', CASE WHEN c.invoices > 0 THEN c.total_sales / c.invoices ELSE 0 END,
            'changePct', CASE 
              WHEN s.invoices > 0 AND c.invoices > 0 AND (s.total_sales / s.invoices) != 0 
              THEN (((c.total_sales / c.invoices) - (s.total_sales / s.invoices)) / ABS(s.total_sales / s.invoices)) * 100 
              ELSE 0 
            END
          ),
          'newCustomers', json_build_object(
            'value', 0,
            'changeAbs', 0
          )
        ) FROM metrics_curr c, metrics_smly s
      )
    ),
    'topProducts', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY SUM(amount) DESC) as rank,
          barcode,
          product as name,
          SUM(qty) as qty,
          SUM(amount) as amount,
          CASE WHEN (SELECT sales_amount FROM metrics_curr) > 0 THEN (SUM(amount)/(SELECT sales_amount FROM metrics_curr))*100 ELSE 0 END as "sharePct"
        FROM base_sales
        WHERE idate >= v_curr_from AND idate <= v_curr_to
        GROUP BY barcode, product
        ORDER BY amount DESC
        LIMIT 10
      ) t
    ),
    'topCategories', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY SUM(amount) DESC) as rank,
          producttag as category,
          SUM(qty) as qty,
          SUM(amount) as amount,
          CASE WHEN (SELECT sales_amount FROM metrics_curr) > 0 THEN (SUM(amount)/(SELECT sales_amount FROM metrics_curr))*100 ELSE 0 END as "sharePct"
        FROM base_sales
        WHERE idate >= v_curr_from AND idate <= v_curr_to
        GROUP BY producttag
        ORDER BY amount DESC
        LIMIT 10
      ) t
    ),
    'topSalesInvoices', (SELECT COALESCE(json_agg(row_to_json(ts)), '[]'::json) FROM top_sales_invoices ts),
    'topReturnInvoices', (SELECT COALESCE(json_agg(row_to_json(tr)), '[]'::json) FROM top_return_invoices tr),
    'dailySalesCalendars', (
      SELECT json_build_array(
        json_build_object(
          'year', extract(year from v_curr_from)::int,
          'month', extract(month from v_curr_from)::int,
          'monthLabel', to_char(v_curr_from, 'Month'),
          'maxAmount', COALESCE((SELECT MAX(amount) FROM daily_sales), 0),
          'days', (
            SELECT COALESCE(json_agg(json_build_object(
              'day', day,
              'date', date,
              'amount', amount,
              'inRange', true
            )), '[]'::json) FROM daily_sales
          )
        )
      )
    ),
    'monthlyComparison', (
      SELECT COALESCE(json_agg(row_to_json(mc)), '[]'::json) FROM monthly_chart mc
    ),
    'customerViews', json_build_object(
      'main', json_build_object(
        'prevMonth', json_build_object(
          'topCustomers', (
            SELECT COALESCE(json_agg(row_to_json(tc)), '[]'::json)
            FROM (
              SELECT 
                ROW_NUMBER() OVER (ORDER BY currentAmount DESC) as rank,
                name,
                invoices,
                currentAmount as amount,
                changePct as "comparePct",
                CASE WHEN (SELECT total_sales FROM metrics_curr) > 0 THEN (currentAmount/(SELECT total_sales FROM metrics_curr))*100 ELSE 0 END as "sharePct"
              FROM cust_compare_prev_main m
              LEFT JOIN cust_current_main c USING (name)
              WHERE currentAmount > 0
              ORDER BY currentAmount DESC
              LIMIT 10
            ) tc
          ),
          'topGrowing', (
            SELECT COALESCE(json_agg(row_to_json(tg)), '[]'::json)
            FROM (
              SELECT ROW_NUMBER() OVER (ORDER BY changeAmount DESC) as rank, name, currentAmount, compareAmount, changeAmount, changePct
              FROM cust_compare_prev_main
              WHERE changeAmount > 0
              ORDER BY changeAmount DESC
              LIMIT 10
            ) tg
          ),
          'topDeclining', (
            SELECT COALESCE(json_agg(row_to_json(td)), '[]'::json)
            FROM (
              SELECT ROW_NUMBER() OVER (ORDER BY changeAmount ASC) as rank, name, currentAmount, compareAmount, changeAmount, changePct
              FROM cust_compare_prev_main
              WHERE changeAmount < 0
              ORDER BY changeAmount ASC
              LIMIT 10
            ) td
          ),
          'atRisk', (
            SELECT COALESCE(json_agg(row_to_json(ar)), '[]'::json)
            FROM (
              SELECT ROW_NUMBER() OVER (ORDER BY compareAmount DESC) as rank, name, compareAmount, currentAmount
              FROM cust_compare_prev_main
              WHERE currentAmount = 0 AND compareAmount > 0
              ORDER BY compareAmount DESC
              LIMIT 10
            ) ar
          )
        ),
        'sameMonthLastYear', json_build_object(
          'topCustomers', (
            SELECT COALESCE(json_agg(row_to_json(tc)), '[]'::json)
            FROM (
              SELECT 
                ROW_NUMBER() OVER (ORDER BY currentAmount DESC) as rank,
                name,
                invoices,
                currentAmount as amount,
                changePct as "comparePct",
                CASE WHEN (SELECT total_sales FROM metrics_curr) > 0 THEN (currentAmount/(SELECT total_sales FROM metrics_curr))*100 ELSE 0 END as "sharePct"
              FROM cust_compare_smly_main m
              LEFT JOIN cust_current_main c USING (name)
              WHERE currentAmount > 0
              ORDER BY currentAmount DESC
              LIMIT 10
            ) tc
          ),
          'topGrowing', (
            SELECT COALESCE(json_agg(row_to_json(tg)), '[]'::json)
            FROM (
              SELECT ROW_NUMBER() OVER (ORDER BY changeAmount DESC) as rank, name, currentAmount, compareAmount, changeAmount, changePct
              FROM cust_compare_smly_main
              WHERE changeAmount > 0
              ORDER BY changeAmount DESC
              LIMIT 10
            ) tg
          ),
          'topDeclining', (
            SELECT COALESCE(json_agg(row_to_json(td)), '[]'::json)
            FROM (
              SELECT ROW_NUMBER() OVER (ORDER BY changeAmount ASC) as rank, name, currentAmount, compareAmount, changeAmount, changePct
              FROM cust_compare_smly_main
              WHERE changeAmount < 0
              ORDER BY changeAmount ASC
              LIMIT 10
            ) td
          ),
          'atRisk', (
            SELECT COALESCE(json_agg(row_to_json(ar)), '[]'::json)
            FROM (
              SELECT ROW_NUMBER() OVER (ORDER BY compareAmount DESC) as rank, name, compareAmount, currentAmount
              FROM cust_compare_smly_main
              WHERE currentAmount = 0 AND compareAmount > 0
              ORDER BY compareAmount DESC
              LIMIT 10
            ) ar
          )
        )
      ),
      'sub', json_build_object(
        'prevMonth', json_build_object(
          'topCustomers', (
            SELECT COALESCE(json_agg(row_to_json(tc)), '[]'::json)
            FROM (
              SELECT 
                ROW_NUMBER() OVER (ORDER BY currentAmount DESC) as rank,
                name,
                invoices,
                currentAmount as amount,
                changePct as "comparePct",
                CASE WHEN (SELECT total_sales FROM metrics_curr) > 0 THEN (currentAmount/(SELECT total_sales FROM metrics_curr))*100 ELSE 0 END as "sharePct"
              FROM cust_compare_prev_sub m
              LEFT JOIN cust_current_sub c USING (name)
              WHERE currentAmount > 0
              ORDER BY currentAmount DESC
              LIMIT 10
            ) tc
          ),
          'topGrowing', (
            SELECT COALESCE(json_agg(row_to_json(tg)), '[]'::json)
            FROM (
              SELECT ROW_NUMBER() OVER (ORDER BY changeAmount DESC) as rank, name, currentAmount, compareAmount, changeAmount, changePct
              FROM cust_compare_prev_sub
              WHERE changeAmount > 0
              ORDER BY changeAmount DESC
              LIMIT 10
            ) tg
          ),
          'topDeclining', (
            SELECT COALESCE(json_agg(row_to_json(td)), '[]'::json)
            FROM (
              SELECT ROW_NUMBER() OVER (ORDER BY changeAmount ASC) as rank, name, currentAmount, compareAmount, changeAmount, changePct
              FROM cust_compare_prev_sub
              WHERE changeAmount < 0
              ORDER BY changeAmount ASC
              LIMIT 10
            ) td
          ),
          'atRisk', (
            SELECT COALESCE(json_agg(row_to_json(ar)), '[]'::json)
            FROM (
              SELECT ROW_NUMBER() OVER (ORDER BY compareAmount DESC) as rank, name, compareAmount, currentAmount
              FROM cust_compare_prev_sub
              WHERE currentAmount = 0 AND compareAmount > 0
              ORDER BY compareAmount DESC
              LIMIT 10
            ) ar
          )
        ),
        'sameMonthLastYear', json_build_object(
          'topCustomers', (
            SELECT COALESCE(json_agg(row_to_json(tc)), '[]'::json)
            FROM (
              SELECT 
                ROW_NUMBER() OVER (ORDER BY currentAmount DESC) as rank,
                name,
                invoices,
                currentAmount as amount,
                changePct as "comparePct",
                CASE WHEN (SELECT total_sales FROM metrics_curr) > 0 THEN (currentAmount/(SELECT total_sales FROM metrics_curr))*100 ELSE 0 END as "sharePct"
              FROM cust_compare_smly_sub m
              LEFT JOIN cust_current_sub c USING (name)
              WHERE currentAmount > 0
              ORDER BY currentAmount DESC
              LIMIT 10
            ) tc
          ),
          'topGrowing', (
            SELECT COALESCE(json_agg(row_to_json(tg)), '[]'::json)
            FROM (
              SELECT ROW_NUMBER() OVER (ORDER BY changeAmount DESC) as rank, name, currentAmount, compareAmount, changeAmount, changePct
              FROM cust_compare_smly_sub
              WHERE changeAmount > 0
              ORDER BY changeAmount DESC
              LIMIT 10
            ) tg
          ),
          'topDeclining', (
            SELECT COALESCE(json_agg(row_to_json(td)), '[]'::json)
            FROM (
              SELECT ROW_NUMBER() OVER (ORDER BY changeAmount ASC) as rank, name, currentAmount, compareAmount, changeAmount, changePct
              FROM cust_compare_smly_sub
              WHERE changeAmount < 0
              ORDER BY changeAmount ASC
              LIMIT 10
            ) td
          ),
          'atRisk', (
            SELECT COALESCE(json_agg(row_to_json(ar)), '[]'::json)
            FROM (
              SELECT ROW_NUMBER() OVER (ORDER BY compareAmount DESC) as rank, name, compareAmount, currentAmount
              FROM cust_compare_smly_sub
              WHERE currentAmount = 0 AND compareAmount > 0
              ORDER BY compareAmount DESC
              LIMIT 10
            ) ar
          )
        )
      )
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '30s';
