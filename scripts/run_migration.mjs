import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=(.*)/);

if (!dbUrlMatch) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const dbUrl = dbUrlMatch[1].trim();

const client = new Client({
  connectionString: dbUrl,
});

const sql = `
CREATE SEQUENCE IF NOT EXISTS mix_debit_seq START 1;
CREATE TABLE IF NOT EXISTS "mix_DEBIT" (
    "ID" TEXT PRIMARY KEY DEFAULT 'R-' || LPAD(nextval('mix_debit_seq')::TEXT, 4, '0'),
    "DATE" DATE,
    "DUE DATE" DATE,
    "NUMBER" TEXT,
    "CUSTOMER ID" TEXT,
    "CITY" TEXT,
    "DEBIT" NUMERIC DEFAULT 0,
    "CREDIT" NUMERIC DEFAULT 0,
    "RESIDUAL AMOUNT" NUMERIC DEFAULT 0,
    "MATCHING" TEXT
);

CREATE SEQUENCE IF NOT EXISTS debit_emails_seq START 1;
CREATE TABLE IF NOT EXISTS "debit_EMILS" (
    "ID" TEXT PRIMARY KEY DEFAULT 'R-' || LPAD(nextval('debit_emails_seq')::TEXT, 4, '0'),
    "CUSTOMER ID" TEXT,
    "EMAIL_NAME" TEXT
);

CREATE SEQUENCE IF NOT EXISTS debit_emails_lulu_seq START 1;
CREATE TABLE IF NOT EXISTS "debit_EMILS_LULU" (
    "ID" TEXT PRIMARY KEY DEFAULT 'R-' || LPAD(nextval('debit_emails_lulu_seq')::TEXT, 4, '0'),
    "CUSTOMER ID" TEXT,
    "CUSTOMER CODE" TEXT,
    "TO:" TEXT,
    "CC:" TEXT
);

CREATE SEQUENCE IF NOT EXISTS debit_notes_seq START 1;
CREATE TABLE IF NOT EXISTS "debit_NOTES" (
    "ID" TEXT PRIMARY KEY DEFAULT 'R-' || LPAD(nextval('debit_notes_seq')::TEXT, 4, '0'),
    "CUSTOMER ID" TEXT,
    "NOTES" TEXT,
    "SOLVED?" BOOLEAN DEFAULT FALSE,
    "CREATED_AT" TIMESTAMPTZ DEFAULT NOW()
);
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query(sql);
    console.log('Tables created successfully.');
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
