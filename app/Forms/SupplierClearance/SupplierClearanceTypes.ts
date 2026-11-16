// Supplier Clearance form (checkpoints before a supplier is cleared): shared types.
// Saved forms go to the shared forms archive (DATA = SupplierClearance).

export const SUPPLIER_CLEARANCE_FORM_ID = 'supplier-clearance';

export type ClearanceAnswer = 'yes' | 'no' | 'na';
export const ANSWERS: { id: ClearanceAnswer; label: string }[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
  { id: 'na', label: 'N/A' },
];

export type ClearanceDecision = 'cleared' | 'conditional' | 'not-cleared';
export const DECISIONS: { id: ClearanceDecision; label: string; hint: string }[] = [
  { id: 'cleared', label: 'Cleared', hint: 'All checkpoints are fine' },
  { id: 'conditional', label: 'Cleared with conditions', hint: 'Payment can go on, the remarks must be followed up' },
  { id: 'not-cleared', label: 'Not cleared', hint: 'Hold the payment until the issues are solved' },
];

export interface Checkpoint {
  id: string;
  section: string;
  text: string;
}

/** The SOP: every checkpoint is answered Yes / No / N/A (a "No" needs a remark). */
export const CHECKPOINTS: Checkpoint[] = [
  { id: 'ret-collected', section: 'Returns', text: 'All goods returned to the supplier have been collected by the supplier.' },
  { id: 'ret-credit', section: 'Returns', text: 'Credit notes for all returned goods have been received from the supplier.' },
  { id: 'ret-pending', section: 'Returns', text: 'There are no pending or disputed return requests.' },

  { id: 'q-complaints', section: 'Product Quality', text: 'There are no open quality complaints on the supplier’s products.' },
  { id: 'q-expiry', section: 'Product Quality', text: 'Expiry dates / shelf life of the delivered goods are acceptable (no expired or near-expiry stock).' },
  { id: 'q-damaged', section: 'Product Quality', text: 'There are no damaged or defective goods waiting for a claim.' },

  { id: 'd-qty', section: 'Deliveries & Documents', text: 'Quantities received match the purchase orders and the supplier invoices.' },
  { id: 'd-prices', section: 'Deliveries & Documents', text: 'Invoice prices and terms match the agreed prices and payment terms.' },
  { id: 'd-short', section: 'Deliveries & Documents', text: 'There are no pending shortages or missing items.' },

  { id: 's-recon', section: 'Settlement', text: 'The supplier statement of account is reconciled with our records.' },
  { id: 's-claims', section: 'Settlement', text: 'There are no other claims, deductions or penalties pending against the supplier.' },
];

export interface ClearanceItem {
  ID: string;
  SECTION: string;
  TEXT: string; // kept as it was when saved
  ANSWER: ClearanceAnswer;
  REMARK: string;
}

export interface SupplierClearance {
  DATE: string; // yyyy-mm-dd
  SUPPLIER_NAME: string;
  PERIOD_FROM: string; // yyyy-mm-dd
  PERIOD_TO: string; // yyyy-mm-dd
  REFERENCE: string; // optional: PO / payment number
  ITEMS: ClearanceItem[];
  DECISION: ClearanceDecision;
  NOTES: string;
}

export const decisionLabel = (d: ClearanceDecision) => DECISIONS.find((x) => x.id === d)?.label || d;
export const answerLabel = (a: ClearanceAnswer) => ANSWERS.find((x) => x.id === a)?.label || a;
