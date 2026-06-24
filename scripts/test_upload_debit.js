import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const dummyRow = {
    'DATE': '2026-06-24',
    'DUE DATE': '2026-06-24',
    'NUMBER': 'INV-100',
    'CUSTOMER ID': '123',
    'CITY': 'Dubai',
    'DEBIT': 100,
    'CREDIT': 0,
    'RESIDUAL AMOUNT': 100,
    'MATCHING': 'UNMATCHED'
  };

  const { data, error } = await supabase.from('mix_DEBIT').insert([dummyRow]);
  console.log('Error:', error);
  console.log('Data:', data);
}

test();
