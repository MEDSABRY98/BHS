-- ════════════════════════════════════════════════════════════════════════
--  BHS · merge functions used by the website (Database → Products / Customers → Merge)
--
--    bhs_merge_ids(kind, survivor, sources)        moves every reference to the survivor ID
--    bhs_merge_products(survivor, sources, ...)    merge products  (one transaction)
--    bhs_merge_customers(survivor, sources, ...)   merge customers (one transaction)
--
--  Every table in "public" that has a PRODUCT ID / PRODUCT_ID column (or CUSTOMER ID / CUSTOMER_ID)
--  is updated automatically - new tables are picked up without changing this file.
--  Any error (for example a duplicate key) -> NOTHING is changed, and the website shows the message.
--
--  Run once in Supabase → SQL Editor. Safe to run again (create or replace).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.bhs_merge_ids(p_kind text, p_survivor text, p_sources text[])
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_cols   text[];
  v_master text;
  r        record;
  n        bigint;
  v_sum    jsonb := '{}'::jsonb;
  v_src    text[];
begin
  if p_kind = 'product' then
    v_cols := array['PRODUCT ID', 'PRODUCT_ID'];
    v_master := 'bhs_PRODUCTS';
  elsif p_kind = 'customer' then
    v_cols := array['CUSTOMER ID', 'CUSTOMER_ID'];
    v_master := 'bhs_CUSTOMERS';
  else
    raise exception 'Unknown merge kind: %', p_kind;
  end if;

  p_survivor := btrim(coalesce(p_survivor, ''));
  select coalesce(array_agg(distinct btrim(s)), '{}') into v_src
  from unnest(coalesce(p_sources, '{}')) s
  where btrim(coalesce(s, '')) <> '' and btrim(s) <> p_survivor;

  if p_survivor = '' then raise exception 'The survivor ID is empty.'; end if;
  if cardinality(v_src) = 0 then return v_sum; end if;

  for r in
    select c.relname as tbl, a.attname as col, format_type(a.atttypid, a.atttypmod) as typ
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and c.relkind in ('r', 'p')          -- real tables only (no views)
      and a.attnum > 0 and not a.attisdropped
      and a.attname = any (v_cols)
      and c.relname <> v_master
    order by c.relname, a.attname
  loop
    begin
      execute format('update public.%I set %I = $1::%s where btrim(%I::text) = any ($2)', r.tbl, r.col, r.typ, r.col)
      using p_survivor, v_src;
      get diagnostics n = row_count;
    exception when others then
      raise exception '% (%): %', r.tbl, r.col, sqlerrm using errcode = sqlstate;
    end;
    if n > 0 then
      v_sum := v_sum || jsonb_build_object(r.tbl || '.' || r.col, n);
    end if;
  end loop;

  return v_sum;
end;
$$;


-- sets one column of the survivor row (value cast to the column's own type); empty value = keep it
create or replace function public.bhs_merge_set_field(p_table text, p_id_col text, p_id text, p_col text, p_value text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_typ text;
begin
  if p_value is null or btrim(p_value) = '' then return; end if;
  select format_type(a.atttypid, a.atttypmod) into v_typ
  from pg_attribute a
  where a.attrelid = format('public.%I', p_table)::regclass and a.attname = p_col and a.attnum > 0 and not a.attisdropped;
  if v_typ is null then return; end if;   -- the column does not exist: nothing to set
  execute format('update public.%I set %I = $1::%s where btrim(%I::text) = btrim($2)', p_table, p_col, v_typ, p_id_col)
  using btrim(p_value), p_id;
end;
$$;


create or replace function public.bhs_merge_products(
  p_survivor  text,
  p_sources   text[],
  p_name      text,
  p_barcode   text,
  p_category  text,
  p_item_code numeric,
  p_unit      text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_sum jsonb;
  n     bigint;
begin
  if not exists (select 1 from public."bhs_PRODUCTS" where btrim("PRODUCT ID"::text) = btrim(p_survivor)) then
    raise exception 'Product % was not found.', p_survivor;
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'The product name is empty.';
  end if;

  -- 1) every reference -> the survivor
  v_sum := public.bhs_merge_ids('product', p_survivor, p_sources);

  -- 2) the survivor gets the chosen details (empty value = keep the current one)
  perform public.bhs_merge_set_field('bhs_PRODUCTS', 'PRODUCT ID', p_survivor, 'PRODUCT NAME', p_name);
  perform public.bhs_merge_set_field('bhs_PRODUCTS', 'PRODUCT ID', p_survivor, 'PRODUCT BARCODE', p_barcode);
  perform public.bhs_merge_set_field('bhs_PRODUCTS', 'PRODUCT ID', p_survivor, 'PRODUCT CATEGORY', p_category);
  perform public.bhs_merge_set_field('bhs_PRODUCTS', 'PRODUCT ID', p_survivor, 'ITEM CODE', p_item_code::text);
  perform public.bhs_merge_set_field('bhs_PRODUCTS', 'PRODUCT ID', p_survivor, 'UNIT', p_unit);

  -- 3) the merged products are removed
  delete from public."bhs_PRODUCTS"
  where btrim("PRODUCT ID"::text) = any (select btrim(s) from unnest(p_sources) s)
    and btrim("PRODUCT ID"::text) <> btrim(p_survivor);
  get diagnostics n = row_count;

  return v_sum || jsonb_build_object('bhs_PRODUCTS (deleted)', n);
end;
$$;


create or replace function public.bhs_merge_customers(
  p_survivor  text,
  p_sources   text[],
  p_main_name text,
  p_sub_name  text,
  p_city      text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_sum jsonb;
  n     bigint;
begin
  if not exists (select 1 from public."bhs_CUSTOMERS" where btrim("CUSTOMER ID"::text) = btrim(p_survivor)) then
    raise exception 'Customer % was not found.', p_survivor;
  end if;
  if btrim(coalesce(p_sub_name, '')) = '' then
    raise exception 'The customer name is empty.';
  end if;

  -- 1) every reference -> the survivor
  v_sum := public.bhs_merge_ids('customer', p_survivor, p_sources);

  -- 2) the survivor gets the chosen details (empty value = keep the current one)
  perform public.bhs_merge_set_field('bhs_CUSTOMERS', 'CUSTOMER ID', p_survivor, 'CUSTOMER SUB NAME', p_sub_name);
  perform public.bhs_merge_set_field('bhs_CUSTOMERS', 'CUSTOMER ID', p_survivor, 'CUSTOMER MAIN NAME', p_main_name);
  perform public.bhs_merge_set_field('bhs_CUSTOMERS', 'CUSTOMER ID', p_survivor, 'CUSTOMER CITY', p_city);

  -- 3) the merged customers are removed
  delete from public."bhs_CUSTOMERS"
  where btrim("CUSTOMER ID"::text) = any (select btrim(s) from unnest(p_sources) s)
    and btrim("CUSTOMER ID"::text) <> btrim(p_survivor);
  get diagnostics n = row_count;

  return v_sum || jsonb_build_object('bhs_CUSTOMERS (deleted)', n);
end;
$$;


-- Only the website server (service role key) may run them - never the browser / mobile app.
revoke all on function public.bhs_merge_ids(text, text, text[]) from public, anon, authenticated;
revoke all on function public.bhs_merge_set_field(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.bhs_merge_products(text, text[], text, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.bhs_merge_customers(text, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.bhs_merge_ids(text, text, text[]) to service_role;
grant execute on function public.bhs_merge_set_field(text, text, text, text, text) to service_role;
grant execute on function public.bhs_merge_products(text, text[], text, text, text, numeric, text) to service_role;
grant execute on function public.bhs_merge_customers(text, text[], text, text, text) to service_role;

-- the website API must see the new functions
notify pgrst, 'reload schema';
