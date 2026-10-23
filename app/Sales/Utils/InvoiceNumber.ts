// Sales DB invoice numbers: old Odoo sequence SAL / RSAL, new sequence INV / RINV.
// Use these instead of checking the prefix directly.
const clean = (n: unknown) => String(n ?? '').trim().toUpperCase();

/** Sales invoice (SAL… or INV…). */
export const isSalesInvoiceNo = (n: unknown): boolean => {
  const s = clean(n);
  return s.startsWith('SAL') || s.startsWith('INV');
};

/** Sales return (RSAL… or RINV…). */
export const isReturnInvoiceNo = (n: unknown): boolean => {
  const s = clean(n);
  return s.startsWith('RSAL') || s.startsWith('RINV');
};
