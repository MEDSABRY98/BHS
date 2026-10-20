'use client';

// Salesperson Analysis — Daily Sales PDF download (sidebar button).
// The document itself is built in DailySalesReportBuilder.ts (shared with Scheduled Reports).

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import type { DailySalesReportData } from '../Utils/DailyTypes';
import { buildDailySalesReportPdf } from './DailySalesReportBuilder';

export async function ExportDailySalesReport(data: DailySalesReportData): Promise<void> {
  const { doc, fileName } = await buildDailySalesReportPdf(data, addArabicFont);
  saveTrackedPdf(doc, fileName);
}
