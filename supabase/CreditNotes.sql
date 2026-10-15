-- =====================================================================
-- BHS — Credit Notes (Al Marai Al Ain → Al Marai Dubai FMCG)
-- Table: web_CREDIT_NOTES (RLS on, no public access)
-- Reached only through app/CreditNotes/Service/CreditNoteService.ts (server actions).
-- Each user sees his own credit notes; the admin sees all. Numbering is shared: CN-2026-001, 002 …
-- Run once in Supabase SQL Editor.
-- =====================================================================

create table if not exists public."web_CREDIT_NOTES" (
  "ID"              text primary key,                 -- CN-2026-001 (numbered by the server, per year)
  "NOTE_DATE"       date not null,
  "BODY_TEXT"       text not null,                    -- "Please note that we have credited your account …"
  "LINES"           jsonb not null default '[]'::jsonb, -- [{ "description": "...", "amount": 123.45 }]
  "TOTAL"           numeric(14,2) not null,
  "AMOUNT_IN_WORDS" text not null,

  "CREATED_BY"      text not null,                    -- bhs_USERS.ID (name looked up from bhs_USERS)
  "CREATED_AT"      timestamptz not null default now(),
  "UPDATED_BY"      text,                             -- bhs_USERS.ID
  "UPDATED_AT"      timestamptz,

  constraint web_cn_id_chk    check ("ID" ~ '^CN-[0-9]{4}-[0-9]{3,}$'),
  constraint web_cn_total_chk check ("TOTAL" > 0),
  constraint web_cn_lines_chk check (jsonb_typeof("LINES") = 'array' and jsonb_array_length("LINES") between 1 and 15)
);

create index if not exists web_cn_created_by_idx on public."web_CREDIT_NOTES" ("CREATED_BY", "NOTE_DATE" desc);
create index if not exists web_cn_note_date_idx  on public."web_CREDIT_NOTES" ("NOTE_DATE" desc);

-- Lock it: no policies = browser keys (anon / authenticated) can't read or write.
alter table public."web_CREDIT_NOTES" enable row level security;
revoke all on table public."web_CREDIT_NOTES" from anon, authenticated;
