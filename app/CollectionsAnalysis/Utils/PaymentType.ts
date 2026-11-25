/**
 * هذا الملف مسؤول عن تحديد نوع الفاتورة/الحركة (هل هي دفعة لينا ولا مرتجع علينا)
 * من واقع الداتا اللي جاية من الداتا بيز.
 */

export type PaymentCategory = 'Payment' | 'Refund' | 'Other';

export const getPaymentCategory = (row: { number?: string | null, debit?: number | null, credit?: number | null, isCustomerVendor?: boolean }): PaymentCategory => {
  if (!row) return 'Other';
  
  const num = (row.number || '').toUpperCase();
  const credit = row.credit ?? 0;
  const debit = row.debit ?? 0;
  const isVendor = row.isCustomerVendor === true;

  // 1. الفواتير اللي بتبدأ بـ BNK هي حركات بنكية/إيصالات نقدية
  if (num.startsWith('BNK')) {
    // لو الحركة معاها Debit (مدين) -> دي فلوس العميل أخدها كمرتجع أو شيك ارتد (مرتجع - علينا)
    if (debit > 0.01) {
      // لو العميل ده يعتبر كمان مورد، الفلوس دي مدفوعة لحسابه كمورد فمش بتتحسب مرتجع دفعات
      if (isVendor) {
        return 'Other';
      }
      return 'Refund';
    }
    // غير كده هي دفعة عادية دفعها العميل (تحصيل - لينا)
    return 'Payment';
  }
  
  // 2. الفواتير اللي مبدأتش بـ BNK بس معاها Credit (دائن) -> بتعتبر دفعات أو تسويات لصالحنا
  if (credit > 0.01) {
    return 'Payment';
  }

  // 3. أي حركة تانية (زي مبيعات SAL, أو مرتجعات مبيعات RSAL, إلخ) مش بنعتبرها دفعات
  return 'Other';
};
