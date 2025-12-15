export type InvoiceTypeInput = {
  number?: string | null;
  debit?: number | null;
  credit?: number | null;
};

// Helper to classify invoice/transaction type.
// IMPORTANT: This must stay in sync with the UI's "Type" badge shown in Overdue tab.
export const getInvoiceType = (inv: InvoiceTypeInput): string => {
  const num = (inv.number || '').toUpperCase();
  const credit = inv.credit ?? 0;

  if (num.startsWith('SAL')) return 'Sale';
  if (num.startsWith('RSAL')) return 'Return';
  if (num.startsWith('OB')) return 'Opening Balance';
  if (num.startsWith('BIL')) return 'Discount';
  if (num.startsWith('JV')) return 'Discount';
  if (credit > 0.01) return 'Payment';
  return 'Invoice/Txn';
};


