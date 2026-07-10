import { bhs_supabas } from '@/lib/supabase';

export interface HandoverItem {
  customerId: string;
  customerName: string;
  receiptNumber: string;
  amount: number;
}

export interface CashHandover {
  ID: string;
  DATE: string;
  ITEMS: HandoverItem[];
  TOTAL_AMOUNT: number;
  WHO_RECEIVED: string;
  HANDED_BY: string;
}

export async function getNextHandoverId(): Promise<string> {
  try {
    const { data, error } = await bhs_supabas
      .from('web_CASH_HANDOVER')
      .select('ID')
      .order('ID', { ascending: false })
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching next handover ID:', error);
      return 'CH-0001';
    }

    if (data && data.length > 0 && data[0].ID) {
      const lastId = data[0].ID;
      // Format: CH-XXXX
      const numMatch = lastId.match(/\d+$/);
      if (numMatch) {
        const nextNum = parseInt(numMatch[0], 10) + 1;
        return `CH-${nextNum.toString().padStart(4, '0')}`;
      }
    }

    return 'CH-0001';
  } catch (error) {
    console.error('Error in getNextHandoverId:', error);
    return 'CH-0001';
  }
}

export async function saveCashHandover(handover: CashHandover): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const { data, error } = await bhs_supabas
      .from('web_CASH_HANDOVER')
      .upsert([{
        ID: handover.ID,
        DATE: handover.DATE,
        ITEMS: handover.ITEMS,
        TOTAL_AMOUNT: handover.TOTAL_AMOUNT,
        WHO_RECEIVED: handover.WHO_RECEIVED
      }]);

    if (error) {
      console.error('Supabase Error saving handover:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving cash handover:', error);
    return { success: false, error };
  }
}

export async function getCashHandovers(): Promise<CashHandover[]> {
  try {
    const { data, error } = await bhs_supabas
      .from('web_CASH_HANDOVER')
      .select('*')
      .order('DATE', { ascending: false });

    if (error) {
      console.error('Error fetching handovers:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getCashHandovers:', error);
    return [];
  }
}

export async function deleteCashHandover(id: string): Promise<boolean> {
  try {
    const { error } = await bhs_supabas
      .from('web_CASH_HANDOVER')
      .delete()
      .eq('ID', id);

    if (error) {
      console.error('Error deleting handover:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error in deleteCashHandover:', error);
    return false;
  }
}
