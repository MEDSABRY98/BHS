// Supplier Payment form: shared types. Saved forms go to the shared forms archive (DATA = SupplierPayment).

export const SUPPLIER_PAYMENT_FORM_ID = 'supplier-payment';

export type PaymentMethod = 'cheque' | 'transfer';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cheque', label: 'Cheque' },
  { id: 'transfer', label: 'Bank Transfer' },
];

export interface SupplierPayment {
  DATE: string; // yyyy-mm-dd — date of the request
  SUPPLIER_NAME: string;
  PERIOD_FROM: string; // yyyy-mm-dd
  PERIOD_TO: string; // yyyy-mm-dd
  AMOUNT: number;
  PAYMENT_TERM: string; // free text, e.g. "60 days"
  METHOD: PaymentMethod;
  DUE_DATE: string | null; // cheque only
  NOTES: string;
}

export const methodLabel = (m: PaymentMethod) => PAYMENT_METHODS.find((x) => x.id === m)?.label || m;
