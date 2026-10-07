import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'bhs_USERS_ACTIVITY';

export async function AllocateActivityIds(
  supabase: SupabaseClient,
  count: number,
): Promise<string[]> {
  if (count <= 0) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select('"ID"')
    .order('"ID"', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  let current = 0;
  const lastId = data?.ID as string | undefined;
  if (lastId) {
    const match = lastId.match(/^R-(\d+)$/i);
    if (match) current = parseInt(match[1], 10);
  }

  return Array.from({ length: count }, () => {
    current += 1;
    return `R-${current.toString().padStart(4, '0')}`;
  });
}
