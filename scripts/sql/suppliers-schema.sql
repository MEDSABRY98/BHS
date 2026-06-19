-- Run in Supabase SQL Editor before using Suppliers Supabase features

CREATE TABLE IF NOT EXISTS public."web_Suppliers_Invoices" (
  "ID" text PRIMARY KEY,
  "DATE" date,
  "TYPE" text NOT NULL CHECK ("TYPE" IN ('Purchase', 'Refund')),
  "INVOICE NUMBER" text,
  "SUPPLIER NAME" text NOT NULL,
  "AMOUNT" numeric NOT NULL,
  "CREATED_AT" timestamptz DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_suppliers_invoices_type_date
  ON public."web_Suppliers_Invoices" ("TYPE", "DATE");
CREATE INDEX IF NOT EXISTS idx_suppliers_invoices_supplier
  ON public."web_Suppliers_Invoices" ("SUPPLIER NAME");

CREATE TABLE IF NOT EXISTS public."web_Suppliers_Matching" (
  "ID" text PRIMARY KEY,
  "SUPPLIER NAME" text NOT NULL,
  "MONTHS" text DEFAULT '',
  "UPDATED_AT" timestamptz DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_matching_name
  ON public."web_Suppliers_Matching" (lower(trim("SUPPLIER NAME")));

ALTER TABLE public."web_Suppliers_Invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."web_Suppliers_Matching" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Access" ON public."web_Suppliers_Invoices";
CREATE POLICY "Public Access" ON public."web_Suppliers_Invoices"
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON public."web_Suppliers_Matching";
CREATE POLICY "Public Access" ON public."web_Suppliers_Matching"
  FOR ALL TO public USING (true) WITH CHECK (true);
