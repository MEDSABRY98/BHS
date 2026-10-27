'use client';

// The drawing lives in StatementPdfCore.ts (also used on the server by Mail Center).

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { SupplierStatementRow, safeFileName } from './StatementData';
import { buildSupplierStatementDoc } from './StatementPdfCore';

export async function generateSupplierStatementPDF(supplierName: string, rows: SupplierStatementRow[]) {
  const doc = await buildSupplierStatementDoc(supplierName, rows, addArabicFont);
  saveTrackedPdf(doc, `${safeFileName(supplierName)}_Statement.pdf`);
}
