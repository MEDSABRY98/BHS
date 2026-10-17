-- ROI module: run once in the Supabase SQL editor (safe to run again).
-- One row = the support given to ONE customer for ONE month.
create table if not exists public."web_ROI_ENTRIES" (
  "ID"             text primary key,            -- ROI-0001
  "CUSTOMER_ID"    text        not null,        -- sub customer id (bhs_CUSTOMERS."CUSTOMER ID")
  "SALESPERSON_ID" text,                        -- bhs_USERS."ID" of the salesperson the support is grouped under
  "SUPPORT_MONTH"  text        not null check ("SUPPORT_MONTH" ~ '^\d{4}-(0[1-9]|1[0-2])$'),  -- YYYY-MM
  "SUPPORT_AMOUNT" numeric     not null check ("SUPPORT_AMOUNT" > 0),                          -- AED
  "NOTES"          text        not null default '',
  "CREATED_BY"     text,
  "CREATED_AT"     timestamptz not null default now()
);

create index if not exists web_roi_entries_customer_idx    on public."web_ROI_ENTRIES" ("CUSTOMER_ID");
create index if not exists web_roi_entries_salesperson_idx on public."web_ROI_ENTRIES" ("SALESPERSON_ID");
create index if not exists web_roi_entries_month_idx       on public."web_ROI_ENTRIES" ("SUPPORT_MONTH");

-- same access model as the other web_* tables (server uses the service-role key)
alter table public."web_ROI_ENTRIES" enable row level security;

-- ─────────────────────────────────────────────────────────────
-- OPTIONAL: only if you already saved supports in the first version
-- (table web_ROI_SUPPORTS, one row per period). This copies them as one row
-- per month into the new table; run it once, then you can drop the old table.
-- ─────────────────────────────────────────────────────────────
-- insert into public."web_ROI_ENTRIES"
--   ("ID","CUSTOMER_ID","SALESPERSON_ID","SUPPORT_MONTH","SUPPORT_AMOUNT","NOTES","CREATED_BY","CREATED_AT")
-- select 'ROI-' || lpad((row_number() over (order by o."ID", m.month))::text, 4, '0'),
--        o."CUSTOMER_ID", o."SALESPERSON_ID", to_char(m.month, 'YYYY-MM'),
--        o."MONTHLY_SUPPORT", o."NOTES", o."CREATED_BY", o."CREATED_AT"
-- from public."web_ROI_SUPPORTS" o
-- cross join lateral generate_series(to_date(o."START_MONTH" || '-01', 'YYYY-MM-DD'),
--                                    to_date(o."END_MONTH"   || '-01', 'YYYY-MM-DD'),
--                                    interval '1 month') as m(month);
-- drop table public."web_ROI_SUPPORTS";
