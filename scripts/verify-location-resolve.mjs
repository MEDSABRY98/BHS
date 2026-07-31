import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { buildLocationRegistry, resolveLocationName } from '../app/InventoryAnalysis/Utils/locationRegistry.ts';
import { getNetQtyEffect, isMoveInLocationScope } from '../app/InventoryAnalysis/Utils/locationTypes.ts';

const env = readFileSync('.env.local', 'utf8');
const sb = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(),
  env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim(),
);

const { data: locs } = await sb.from('web_INVENTORY_LOCATIONS').select('*');
const registry = buildLocationRegistry(locs || []);

const { data: sample } = await sb
  .from('web_INVENTORY_MOVES')
  .select('"LOCATION FROM", "LOCATION TO", QTY')
  .limit(5);

console.log('Registry internal warehouses:', registry.internalWarehouseNames.length);
console.log('Customers ID:', registry.customersLocationId);

sample?.forEach((row, i) => {
  const from = resolveLocationName(String(row['LOCATION FROM']), registry);
  const to = resolveLocationName(String(row['LOCATION TO']), registry);
  const effect = getNetQtyEffect(from, to, Number(row.QTY) || 0);
  console.log(`\nMove ${i + 1}: ${row['LOCATION FROM']} -> ${from}`);
  console.log(`         ${row['LOCATION TO']} -> ${to}`);
  console.log('  effect:', effect);
  console.log('  in Mazyad scope:', isMoveInLocationScope(from, to, 'M/WH/Mazyad'));
});
