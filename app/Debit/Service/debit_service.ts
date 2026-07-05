'use server';

import { getSheetData } from '@/lib/supabase';

export async function getDebitData() {
  try {
    const data = await getSheetData();
    return { data };
  } catch (error) {
    console.error('Service Error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch debit data');
  }
}
