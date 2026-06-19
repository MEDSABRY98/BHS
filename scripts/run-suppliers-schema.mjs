import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
};

const token = get('SUPABASE_ACCESS_TOKEN');
const ref = get('SUPABASE_PROJECT_REF');
const sql = readFileSync('scripts/sql/suppliers-schema.sql', 'utf8');

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await response.text();
console.log('Schema status:', response.status);
console.log(text.slice(0, 1000));

if (!response.ok) process.exit(1);
