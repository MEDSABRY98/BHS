const { Client } = require('pg');

const sql = `
-- Create web_Suppliers_Purchase table
CREATE TABLE IF NOT EXISTS "public"."web_Suppliers_Purchase" (
    "ID" text NOT NULL,
    "DATE" date,
    "INVOICE NUMBER" text,
    "SUPPLIER ID" text,
    "PRODUCT ID" text,
    "UNIT PRICE" numeric,
    "QTY" numeric
);

-- Set Primary Key
ALTER TABLE "public"."web_Suppliers_Purchase" 
ADD CONSTRAINT "web_Suppliers_Purchase_pkey" PRIMARY KEY ("ID");

-- Set Row Level Security
ALTER TABLE "public"."web_Suppliers_Purchase" ENABLE ROW LEVEL SECURITY;

-- Create basic policies
CREATE POLICY "Enable read access for all users" ON "public"."web_Suppliers_Purchase" FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON "public"."web_Suppliers_Purchase" FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON "public"."web_Suppliers_Purchase" FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON "public"."web_Suppliers_Purchase" FOR DELETE USING (true);
`;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to Supabase.");
    await client.query(sql);
    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

main();
