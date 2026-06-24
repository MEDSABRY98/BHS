const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
let envs = {};
envFile.split('\n').forEach(l => {
  let parts = l.split('=');
  if(parts.length > 1) {
    envs[parts[0]] = parts.slice(1).join('=').trim();
  }
});
fetch(`${envs.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/mix_DEBIT?select=ID&limit=5`, {
  headers: {
    apikey: envs.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${envs.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
  }
}).then(res => res.json()).then(console.log);
