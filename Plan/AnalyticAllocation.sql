-- ============ Analytic Allocation module ============
-- RLS on with no policies: the tables are reachable only through the server actions (service role).

-- 1) Analytic accounts
create table if not exists "web_ANALYTIC_ACCOUNTS" (
  "ID"         bigint generated always as identity primary key,
  "NAME"       text not null unique,
  "IS_ACTIVE"  boolean not null default true,
  "CREATED_AT" timestamptz not null default now()
);

-- 2) People + default split: [{"ACCOUNT": "...", "PCT": 40 | null}]  (null = equal share)
create table if not exists "web_ANALYTIC_PEOPLE" (
  "ID"         bigint generated always as identity primary key,
  "NAME"       text not null unique,
  "NOTES"      text,
  "ACCOUNTS"   jsonb not null default '[]'::jsonb,
  "IS_ACTIVE"  boolean not null default true,
  "CREATED_AT" timestamptz not null default now(),
  "UPDATED_AT" timestamptz
);

-- 3) Archive: one row per saved allocation
--    PEOPLE: [{"NAME","PCT" | null,"SPLIT":[{"ACCOUNT","PCT" | null}]}]   (what was chosen)
--    LINES : [{"PERSON","ACCOUNT","PCT","AMOUNT"}]                         (final rounded result)
create table if not exists "web_ANALYTIC_ALLOCATIONS" (
  "ID"         bigint generated always as identity primary key,
  "TITLE"      text not null,
  "ALLOC_DATE" date not null,
  "AMOUNT"     numeric(14,2) not null check ("AMOUNT" > 0),
  "NOTES"      text,
  "PEOPLE"     jsonb not null default '[]'::jsonb,
  "LINES"      jsonb not null default '[]'::jsonb,
  "CREATED_BY" text not null,
  "CREATED_AT" timestamptz not null default now(),
  "UPDATED_BY" text,
  "UPDATED_AT" timestamptz
);
create index if not exists "web_ANALYTIC_ALLOCATIONS_DATE_IDX" on "web_ANALYTIC_ALLOCATIONS" ("ALLOC_DATE" desc);
create index if not exists "web_ANALYTIC_ALLOCATIONS_CREATED_BY_IDX" on "web_ANALYTIC_ALLOCATIONS" ("CREATED_BY");

alter table "web_ANALYTIC_ACCOUNTS"    enable row level security;
alter table "web_ANALYTIC_PEOPLE"      enable row level security;
alter table "web_ANALYTIC_ALLOCATIONS" enable row level security;

-- Starting accounts
insert into "web_ANALYTIC_ACCOUNTS" ("NAME") values
  ('AD B-CLASS'), ('AJMAN B-CLASS'), ('AJMAN COOP'), ('Alain B-CLASS'),
  ('BANI YAS COOP'), ('DXB B-CLASS'), ('Fujairah B-CLASS'), ('General Administration'),
  ('MAIR GROUP AD'), ('MAIR GROUP Alain'), ('MAIR GROUP DXB'), ('MAIR GROUP RAK'),
  ('MAIR GROUP SHJ'), ('RAK B-CLASS'), ('SHJ B-CLASS'), ('SHJ COOP'), ('U.A.Q B-CLASS')
on conflict ("NAME") do nothing;
