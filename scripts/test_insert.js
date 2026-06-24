const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
let envs = {};
envFile.split('\n').forEach(l => {
  let parts = l.split('=');
  if(parts.length > 1) {
    envs[parts[0]] = parts.slice(1).join('=').trim();
  }
});
fetch(`${envs.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/mix_DEBIT`, {
  method: 'POST',
  headers: {
    apikey: envs.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${envs.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify([{
    'DATE': '2026-06-24',
    'DUE DATE': '2026-06-24',
    'NUMBER': 'INV-100',
    'CUSTOMER ID': '123',
    'CITY': 'Dubai',
    'DEBIT': 100,
    'CREDIT': 0,
    'RESIDUAL AMOUNT': 100,
    'MATCHING': 'UNMATCHED'
  }])
}).then(async res => {
  console.log(res.status, await res.text());
});
