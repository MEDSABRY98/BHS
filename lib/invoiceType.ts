export type InvoiceTypeInput = {
  number?: string | null;
  debit?: number | null;
  credit?: number | null;
};

// Helper to classify invoice/transaction type.
// IMPORTANT: This must stay in sync with the UI's "Type" badge shown in Overdue tab.
// Helper to classify invoice/transaction type.
// IMPORTANT: This must stay in sync with the UI's "Type" badge shown in Overdue tab.
export const getInvoiceType = (inv: InvoiceTypeInput): string => {
  if (!inv) return '';
  const num = (inv.number || '').toUpperCase();
  const credit = inv.credit ?? 0;
  const debit = inv.debit ?? 0;

  if (num.startsWith('OB')) {
    return 'OB';
  } else if (num.startsWith('BNK')) {
    // BNK with Debit is a 'R-Payment' (Refund/Bounced), otherwise Payment
    return debit > 0.01 ? 'R-Payment' : 'Payment';
  } else if (num.startsWith('PBNK4')) {
    return 'Our-Paid';
  } else if (num.startsWith('SAL')) {
    return 'Sales';
  } else if (num.startsWith('RSAL')) {
    return 'Return';
  } else if (num.startsWith('JV') || num.startsWith('BIL')) {
    return 'Discount';
  } else if (credit > 0.01) {
    return 'Payment';
  }
  return 'Sales'; // Default per AllTransactionsTab logic
};


