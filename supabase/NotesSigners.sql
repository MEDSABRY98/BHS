-- =====================================================================
-- BHS — Debit / Credit Notes: optional signatures (Salah, Tarek Hassan)
-- The signatures chosen on the form are saved with the note, so a re-printed PDF looks the same.
-- Run once in Supabase SQL Editor (after DebitNotes.sql and CreditNotes.sql).
-- =====================================================================

alter table public."web_DEBIT_NOTES"
  add column if not exists "EXTRA_SIGNERS" jsonb not null default '[]'::jsonb;

alter table public."web_CREDIT_NOTES"
  add column if not exists "EXTRA_SIGNERS" jsonb not null default '[]'::jsonb;
