'use client';

// The drawing lives in GroupStatementCore.ts (also used on the server by Mail Center).

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { printPdfInSameTab } from '@/app/InvoicesTracking/Pdf/DeliveryUtils';
import { buildGroupStatementDoc } from './GroupStatementCore';

export async function generateGroupStatementPDF(
  statementTitle: string,
  groupCustomers: string[],
  invoices: any[],
  isPrint: boolean = false
) {
  const doc = await buildGroupStatementDoc(statementTitle, groupCustomers, invoices, addArabicFont);

  if (isPrint) {
    printPdfInSameTab(doc);
  } else {
    const fileName = statementTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const now = new Date();
    const currentDate = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    saveTrackedPdf(doc, `${fileName}_${currentDate}.pdf`);
  }
}
