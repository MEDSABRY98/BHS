// Transaction type shown in the customer exports (statement Excel, net-only sheets).
// Kept apart from CstomersUtils.ts so the server can use it (Mail Center attachments).

export const getInvoiceType = (inv: { number?: string | null; credit?: number | null; debit?: number | null }): string => {
  const num = (inv.number || '').toUpperCase();
  const credit = inv.credit ?? 0;
  const debit = inv.debit ?? 0;
  if (num.startsWith('OB')) return 'Opening Balance';
  if (num.startsWith('BNK')) return 'Payment';
  if (num.startsWith('PBNK')) return debit > 0.01 ? 'Our-Paid' : 'Payment';
  if ((num.startsWith('SAL') || num.startsWith('INV'))) return 'Sale';
  if ((num.startsWith('RSAL') || num.startsWith('RINV'))) return 'Return';
  if (num.startsWith('JV') || num.startsWith('BIL')) return 'Discount';
  if (credit > 0.01) return 'Payment';
  return 'Invoice/Txn';
};
