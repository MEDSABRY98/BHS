import pkg from 'pg';
const { Client } = pkg;


const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

const sql = `
CREATE SEQUENCE IF NOT EXISTS web_customers_discounts_seq START 1;
CREATE SEQUENCE IF NOT EXISTS web_customers_discounts_settlements_seq START 1;

CREATE TABLE IF NOT EXISTS "web_CUSTOMERS_DISCOUNTS" (
    "ID" TEXT PRIMARY KEY DEFAULT 'R-' || lpad(nextval('web_customers_discounts_seq')::text, 4, '0'),
    "CUSTOMER_ID" TEXT,
    "DISCOUNT_NAME" TEXT,
    "DISCOUNT_TYPE" TEXT,
    "DISCOUNT_VALUE" NUMERIC,
    "CREATED_AT" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "web_CUSTOMERS_DISCOUNTS_SETTLEMENTS" (
    "ID" TEXT PRIMARY KEY DEFAULT 'S-' || lpad(nextval('web_customers_discounts_settlements_seq')::text, 4, '0'),
    "CUSTOMER_ID" TEXT,
    "MONTH" INTEGER,
    "YEAR" INTEGER,
    "STATUS" TEXT DEFAULT 'Pending',
    "NOTES" TEXT
);

-- Enable RLS and add basic policies if needed
ALTER TABLE "web_CUSTOMERS_DISCOUNTS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "web_CUSTOMERS_DISCOUNTS_SETTLEMENTS" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for web_CUSTOMERS_DISCOUNTS" ON "web_CUSTOMERS_DISCOUNTS";
CREATE POLICY "Enable all access for web_CUSTOMERS_DISCOUNTS" ON "web_CUSTOMERS_DISCOUNTS" FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for web_CUSTOMERS_DISCOUNTS_SETTLEMENTS" ON "web_CUSTOMERS_DISCOUNTS_SETTLEMENTS";
CREATE POLICY "Enable all access for web_CUSTOMERS_DISCOUNTS_SETTLEMENTS" ON "web_CUSTOMERS_DISCOUNTS_SETTLEMENTS" FOR ALL USING (true) WITH CHECK (true);
`;

async function run() {
  try {
    await client.connect();
    console.log("Connected to database. Executing queries...");
    await client.query(sql);
    console.log("Tables created successfully!");
  } catch (err) {
    console.error("Error executing SQL:", err);
  } finally {
    await client.end();
  }
}

run();
