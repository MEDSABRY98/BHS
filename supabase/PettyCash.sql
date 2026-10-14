-- =====================================================================
-- BHS — Petty Cash (عهد الموظفين)
-- One submission = one header (PC-0001) + many lines (up to 50 rows).
-- Tables: web_PETTY_CASH (header), web_PETTY_CASH_LINES (rows)   — RLS on, no public access
-- Reached only through server actions in app/PettyCash/Service/PettyCashService.ts
-- (getSupabaseAdmin + getSessionUser) — same pattern as web_CASH_VOUCHERS / web_TRANSFER_REQUESTS.
-- Run once in Supabase SQL Editor.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Header: one row per save
-- ---------------------------------------------------------------------
create table if not exists public."web_PETTY_CASH" (
  "ID"              text primary key,                         -- PC-0001
  "LINES_COUNT"     integer not null,
  "TOTAL_AMOUNT"    numeric(12,2) not null,
  "TAX_AMOUNT_TOTAL" numeric(12,2) not null default 0,        -- sum of lines marked tax invoice
  "NOTES"           text,

  "CREATED_BY"      text not null,                            -- user name from the session
  "CREATED_BY_ID"   text not null,                            -- bhs_USERS.ID from the session
  "CREATED_AT"      timestamptz not null default now(),
  "UPDATED_BY"      text,
  "UPDATED_AT"      timestamptz,

  constraint web_pc_id_chk    check ("ID" ~ '^PC-[0-9]{4,}$'),
  constraint web_pc_count_chk check ("LINES_COUNT" between 1 and 50),
  constraint web_pc_total_chk check ("TOTAL_AMOUNT" > 0)
);

create index if not exists web_pc_created_by_id_idx on public."web_PETTY_CASH" ("CREATED_BY_ID", "CREATED_AT" desc);
create index if not exists web_pc_created_at_idx    on public."web_PETTY_CASH" ("CREATED_AT" desc);


-- ---------------------------------------------------------------------
-- 2) Lines: the rows entered in the form
-- ---------------------------------------------------------------------
create table if not exists public."web_PETTY_CASH_LINES" (
  "ID"              bigint generated always as identity primary key,
  "PETTY_CASH_ID"   text not null references public."web_PETTY_CASH"("ID") on delete cascade,
  "LINE_NO"         integer not null,
  "INVOICE_DATE"    date not null,
  "DESCRIPTION"     text not null,                            -- البيان
  "BENEFICIARY"     text not null,                            -- المستفيد
  "AMOUNT"          numeric(12,2) not null,
  "IS_TAX_INVOICE"  boolean not null default false,           -- فاتورة ضريبية؟
  "HAS_INVOICE"     boolean not null default false,           -- معاه فاتورة أصلية؟

  constraint web_pcl_line_uq         unique ("PETTY_CASH_ID", "LINE_NO"),
  constraint web_pcl_description_chk check (length(btrim("DESCRIPTION")) > 0),
  constraint web_pcl_beneficiary_chk check (length(btrim("BENEFICIARY")) > 0),
  constraint web_pcl_amount_chk      check ("AMOUNT" > 0)
);

create index if not exists web_pcl_header_idx       on public."web_PETTY_CASH_LINES" ("PETTY_CASH_ID", "LINE_NO");
create index if not exists web_pcl_invoice_date_idx on public."web_PETTY_CASH_LINES" ("INVOICE_DATE" desc);


-- ---------------------------------------------------------------------
-- 3) Save in one transaction: number + header + all lines (all or nothing)
--    Called from the server action only:
--    getSupabaseAdmin().rpc('web_save_petty_cash', { p_user_name, p_user_id, p_notes, p_lines })
--    p_lines = [{ "INVOICE_DATE":"2026-10-14", "DESCRIPTION":"...", "BENEFICIARY":"...",
--                 "AMOUNT":12.5, "IS_TAX_INVOICE":true, "HAS_INVOICE":false }, ...]
-- ---------------------------------------------------------------------
create or replace function public.web_save_petty_cash(
  p_user_name text,
  p_user_id   text,
  p_notes     text,
  p_lines     jsonb
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_count integer;
  v_next  integer;
  v_id    text;
  v_line  jsonb;
  v_no    integer := 0;
  v_amt   numeric(12,2);
  v_date  date;
begin
  if coalesce(btrim(p_user_id), '') = '' or coalesce(btrim(p_user_name), '') = '' then
    raise exception 'Missing user';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'No rows to save';
  end if;

  v_count := jsonb_array_length(p_lines);
  if v_count < 1 then raise exception 'Add at least one row'; end if;
  if v_count > 50 then raise exception 'Maximum 50 rows per save'; end if;

  -- one save at a time takes a number
  perform pg_advisory_xact_lock(hashtext('web_PETTY_CASH_ID'));

  select coalesce(max(substring("ID" from 4)::integer), 0) + 1
    into v_next
    from public."web_PETTY_CASH";

  v_id := 'PC-' || lpad(v_next::text, 4, '0');

  insert into public."web_PETTY_CASH"
    ("ID", "LINES_COUNT", "TOTAL_AMOUNT", "TAX_AMOUNT_TOTAL", "NOTES", "CREATED_BY", "CREATED_BY_ID")
  values
    (v_id, v_count, 0.01, 0, nullif(btrim(coalesce(p_notes, '')), ''), btrim(p_user_name), btrim(p_user_id));

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_no := v_no + 1;

    v_date := nullif(v_line->>'INVOICE_DATE', '')::date;
    if v_date is null then raise exception 'Row %: invoice date is required', v_no; end if;
    if v_date > v_today then raise exception 'Row %: invoice date can''t be in the future', v_no; end if;

    v_amt := round(nullif(v_line->>'AMOUNT', '')::numeric, 2);
    if v_amt is null or v_amt <= 0 then raise exception 'Row %: amount must be greater than zero', v_no; end if;

    if coalesce(btrim(v_line->>'DESCRIPTION'), '') = '' then raise exception 'Row %: description is required', v_no; end if;
    if coalesce(btrim(v_line->>'BENEFICIARY'), '') = '' then raise exception 'Row %: beneficiary is required', v_no; end if;

    insert into public."web_PETTY_CASH_LINES"
      ("PETTY_CASH_ID", "LINE_NO", "INVOICE_DATE", "DESCRIPTION", "BENEFICIARY", "AMOUNT", "IS_TAX_INVOICE", "HAS_INVOICE")
    values
      (v_id, v_no, v_date,
       btrim(v_line->>'DESCRIPTION'),
       btrim(v_line->>'BENEFICIARY'),
       v_amt,
       coalesce((v_line->>'IS_TAX_INVOICE')::boolean, false),
       coalesce((v_line->>'HAS_INVOICE')::boolean, false));
  end loop;

  update public."web_PETTY_CASH" h
     set "TOTAL_AMOUNT"     = s.total,
         "TAX_AMOUNT_TOTAL" = s.tax_total
    from (
      select sum("AMOUNT") as total,
             coalesce(sum("AMOUNT") filter (where "IS_TAX_INVOICE"), 0) as tax_total
        from public."web_PETTY_CASH_LINES"
       where "PETTY_CASH_ID" = v_id
    ) s
   where h."ID" = v_id;

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 4) Lock it: no policies = browser keys (anon / authenticated) can't touch anything.
--    The server uses the service-role key, which bypasses RLS.
-- ---------------------------------------------------------------------
alter table public."web_PETTY_CASH"       enable row level security;
alter table public."web_PETTY_CASH_LINES" enable row level security;

revoke all on table public."web_PETTY_CASH"       from anon, authenticated;
revoke all on table public."web_PETTY_CASH_LINES" from anon, authenticated;

revoke all on function public.web_save_petty_cash(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.web_save_petty_cash(text, text, text, jsonb) to service_role;
