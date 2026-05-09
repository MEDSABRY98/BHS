import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const app_lpos_supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('Supabase initialized with URL:', supabaseUrl?.substring(0, 20) + '...');
console.log('Supabase Key exists:', !!supabaseAnonKey);
