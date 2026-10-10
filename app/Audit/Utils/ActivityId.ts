import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'bhs_USERS_ACTIVITY';
const MIN_DIGITS = 4; // R-0001
const MAX_DIGITS = 9;

/**
 * Next sequential IDs: R-0001, R-0002 … R-9999, R-10000, R-10001 …
 * IDs are text, so 'R-9999' sorts above 'R-10000'. To find the real last number we
 * look at the longest IDs first (more digits = bigger number), then sort within that length.
 */
async function LastActivityNumber(supabase: SupabaseClient): Promise<number> {
  for (let digits = MAX_DIGITS; digits >= MIN_DIGITS; digits--) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('ID')
      .like('ID', `R-${'_'.repeat(digits)}`)
      .order('ID', { ascending: false })
      .limit(1);
    if (error) throw error;
    const match = String(data?.[0]?.ID ?? '').match(/^R-(\d+)$/i);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

export async function AllocateActivityIds(supabase: SupabaseClient, count: number): Promise<string[]> {
  if (count <= 0) return [];
  let current = await LastActivityNumber(supabase);
  return Array.from({ length: count }, () => {
    current += 1;
    return `R-${current.toString().padStart(MIN_DIGITS, '0')}`;
  });
}
