// Scheduled Reports — the list of report builders (server only).
// Each report lives in its own file in ../Reports (the PDF and the email).
// Add a new report: a file in ../Reports, its id in Utils/Types.ts → REPORT_TYPES, and one line here.

import type { Builder } from '../Reports/Shared';
import { DailySalesReport } from '../Reports/DailySales';
import { DebitCollectionsReport } from '../Reports/DebitCollections';

export type { BuiltReport } from '../Reports/Shared';

export const REPORT_BUILDERS: Record<string, Builder> = {
  'salesperson-daily': DailySalesReport,
  'salesperson-debit-collections': DebitCollectionsReport,
};
