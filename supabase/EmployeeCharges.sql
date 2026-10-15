-- =====================================================================
-- BHS — Forms: Employee Charge (charging an amount to an employee)
-- Table: form_EMPLOYEE_CHARGES (RLS on, no public access)
-- Reached only through app/Forms/EmployeeCharge/Service/EmployeeChargeService.ts (server actions).
-- Each user sees his own forms; the admin sees all. Numbering is shared: EC-2026-001, 002 …
-- Run once in Supabase SQL Editor.
-- =====================================================================

create table if not exists public."form_EMPLOYEE_CHARGES" (
  "ID"              text primary key,                 -- EC-2026-001 (numbered by the server, per year)
  "CHARGE_DATE"     date not null,
  "EMPLOYEE_NAME"   text not null,
  "EMPLOYEE_NO"     text,
  "AMOUNT"          numeric(14,2) not null,
  "AMOUNT_IN_WORDS" text not null,
  "DESCRIPTION"     text not null,                    -- full details, how it will be settled

  "CREATED_BY"      text not null,                    -- bhs_USERS.ID (name looked up from bhs_USERS)
  "CREATED_AT"      timestamptz not null default now(),
  "UPDATED_BY"      text,                             -- bhs_USERS.ID
  "UPDATED_AT"      timestamptz,

  constraint form_ec_id_chk     check ("ID" ~ '^EC-[0-9]{4}-[0-9]{3,}$'),
  constraint form_ec_amount_chk check ("AMOUNT" > 0),
  constraint form_ec_name_chk   check (length(btrim("EMPLOYEE_NAME")) > 0)
);

create index if not exists form_ec_created_by_idx on public."form_EMPLOYEE_CHARGES" ("CREATED_BY", "CHARGE_DATE" desc);
create index if not exists form_ec_date_idx       on public."form_EMPLOYEE_CHARGES" ("CHARGE_DATE" desc);

-- Lock it: no policies = browser keys (anon / authenticated) can't read or write.
alter table public."form_EMPLOYEE_CHARGES" enable row level security;
revoke all on table public."form_EMPLOYEE_CHARGES" from anon, authenticated;

-- ---------------------------------------------------------------------
-- Already ran the old version (table web_EMPLOYEE_CHARGES)? Run only this instead:
--   alter table public."web_EMPLOYEE_CHARGES" rename to "form_EMPLOYEE_CHARGES";
-- ---------------------------------------------------------------------
