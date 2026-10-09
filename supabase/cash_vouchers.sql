-- ════════════════════════════════════════════════════════════════
--  Cash Vouchers (unified Cash In / Cash Out)
--  Run in Supabase → SQL Editor. Safe to re-run.
--  Old tables (web_Cash_Receipt, web_CASH_HANDOVER) are NOT changed.
-- ════════════════════════════════════════════════════════════════

-- 1) New table ----------------------------------------------------
create table if not exists public."web_CASH_VOUCHERS" (
  "ID"              text primary key,                 -- RV-0001 / PV-0001 (old: CAH-001 / CH-0001)
  "TYPE"            text not null check ("TYPE" in ('IN', 'OUT')),
  "DATE"            date not null,
  "PARTY"           text not null,                    -- IN: received from · OUT: paid to
  "VIA"             text,                             -- delivered by / collected by
  "AMOUNT"          numeric(14,2) not null check ("AMOUNT" >= 0),
  "AMOUNT_IN_WORDS" text,
  "PAYMENT_METHOD"  text not null default 'Cash',
  "REFERENCE"       text,                             -- cheque / transfer reference
  "DESCRIPTION"     text,
  "LINES"           jsonb not null default '[]'::jsonb, -- [{ref, party, amount}]
  "CREATED_BY"      text,
  "CREATED_BY_ID"   text,
  "CREATED_AT"      timestamptz not null default now(),
  "UPDATED_AT"      timestamptz,
  "UPDATED_BY"      text,
  "LEGACY_SOURCE"   text                              -- 'web_Cash_Receipt' / 'web_CASH_HANDOVER' for moved rows
);

create index if not exists cash_vouchers_date_idx on public."web_CASH_VOUCHERS" ("DATE" desc);
create index if not exists cash_vouchers_type_date_idx on public."web_CASH_VOUCHERS" ("TYPE", "DATE" desc);

-- Locked: only the website server (service_role key) can read/write it
alter table public."web_CASH_VOUCHERS" enable row level security;
revoke all on public."web_CASH_VOUCHERS" from anon, authenticated;


-- 2) Helpers for messy old values (text dates / amounts) -----------
create or replace function pg_temp.to_date_safe(v text) returns date language sql immutable as $$
  select case
    when v ~ '^\d{4}-\d{2}-\d{2}' then left(v, 10)::date
    when v ~ '^\d{1,2}/\d{1,2}/\d{4}$' then to_date(v, 'DD/MM/YYYY')
    else null end
$$;

create or replace function pg_temp.to_num_safe(v text) returns numeric language sql immutable as $$
  select nullif(regexp_replace(coalesce(v, ''), '[^0-9.\-]', '', 'g'), '')::numeric
$$;


-- 3) Check first: rows whose date can't be read (should return 0 rows)
select 'receipt' as src, "ID", "DATE"::text from public."web_Cash_Receipt" where pg_temp.to_date_safe("DATE"::text) is null
union all
select 'handover', "ID", "DATE"::text from public."web_CASH_HANDOVER" where pg_temp.to_date_safe("DATE"::text) is null;


-- 4) Move old Cash Receipts  ->  Cash In -------------------------
insert into public."web_CASH_VOUCHERS"
  ("ID", "TYPE", "DATE", "PARTY", "VIA", "AMOUNT", "AMOUNT_IN_WORDS", "PAYMENT_METHOD", "DESCRIPTION", "LINES", "LEGACY_SOURCE")
select
  coalesce(nullif(trim(r."RECEIPT NUMBER"), ''), r."ID"),
  'IN',
  pg_temp.to_date_safe(r."DATE"::text),
  coalesce(nullif(trim(r."RECEIVED FROM"), ''), '—'),
  nullif(trim(r."SEND BY"), ''),
  coalesce(pg_temp.to_num_safe(r."AMOUNT"::text), 0),
  r."AMOUNT IN WORDS",
  'Cash',
  nullif(trim(r."PAYMENT REASON"), ''),
  '[]'::jsonb,
  'web_Cash_Receipt'
from public."web_Cash_Receipt" r
where pg_temp.to_date_safe(r."DATE"::text) is not null
on conflict ("ID") do nothing;


-- 5) Move old Cash Handovers  ->  Cash Out -----------------------
insert into public."web_CASH_VOUCHERS"
  ("ID", "TYPE", "DATE", "PARTY", "AMOUNT", "PAYMENT_METHOD", "DESCRIPTION", "LINES", "LEGACY_SOURCE")
select
  h."ID",
  'OUT',
  pg_temp.to_date_safe(h."DATE"::text),
  coalesce(nullif(trim(h."WHO_RECEIVED"), ''), '—'),
  coalesce(pg_temp.to_num_safe(h."TOTAL_AMOUNT"::text), 0),
  'Cash',
  nullif(trim(h."NOTE"), ''),
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'ref',    coalesce(nullif(item->>'receiptNumber', ''), '—'),
      'party',  nullif(item->>'customerName', ''),
      'amount', pg_temp.to_num_safe(item->>'amount')
    ))
    from jsonb_array_elements(case when jsonb_typeof(h."ITEMS"::jsonb) = 'array' then h."ITEMS"::jsonb else '[]'::jsonb end) item
  ), '[]'::jsonb),
  'web_CASH_HANDOVER'
from public."web_CASH_HANDOVER" h
where pg_temp.to_date_safe(h."DATE"::text) is not null
on conflict ("ID") do nothing;


-- 6) Verify: counts and totals should match the old tables
select 'old receipts' as what, count(*), sum(pg_temp.to_num_safe("AMOUNT"::text)) from public."web_Cash_Receipt"
union all select 'moved IN',  count(*), sum("AMOUNT") from public."web_CASH_VOUCHERS" where "LEGACY_SOURCE" = 'web_Cash_Receipt'
union all select 'old handovers', count(*), sum(pg_temp.to_num_safe("TOTAL_AMOUNT"::text)) from public."web_CASH_HANDOVER"
union all select 'moved OUT', count(*), sum("AMOUNT") from public."web_CASH_VOUCHERS" where "LEGACY_SOURCE" = 'web_CASH_HANDOVER';
