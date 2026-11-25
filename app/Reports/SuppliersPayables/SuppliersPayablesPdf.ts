'use client';

// Suppliers Payables PDF — same visual identity as the supplier statement (gold / black, Amiri for Arabic names).

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { enableArabicBidi } from '@/app/Components/Pdf/bidi';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { periodLabel, type PayablesPeriod, type PayablesRow } from './SuppliersPayablesData';

const C = {
  gold: [184, 134, 11] as [number, number, number],
  goldLight: [244, 233, 216] as [number, number, number],
  black: [26, 26, 26] as [number, number, number],
  gray: [107, 107, 107] as [number, number, number],
  light: [245, 245, 245] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [217, 217, 217] as [number, number, number],
};
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const term = (days: number) => (days > 0 ? `${days} days` : 'Immediate');
const pad = (n: number) => String(n).padStart(2, '0');
const today = () => {
  const d = new Date();
  return `${pad(d.getDate())}-${d.toLocaleDateString('en-US', { month: 'short' })}-${d.getFullYear()}`;
};

export type PayablesSection = { period: PayablesPeriod; rows: PayablesRow[] };

/** One supplier payables PDF; every section (month) starts on its own page. */
export async function generateSuppliersPayablesMultiPdf(sections: PayablesSection[]) {
  const jsPDF = (await import('jspdf')).default;
  const at: any = await import('jspdf-autotable');
  const autoTable = at.default || at;

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: 'Suppliers Payables' });
  await addArabicFont(doc);
  enableArabicBidi(doc);
  const margin = 10;
  const W = doc.internal.pageSize.getWidth();
  const cw = W - margin * 2;

  sections.forEach((section, index) => {
    const { rows, period } = section;
    if (index > 0) doc.addPage();
    const total = rows.reduce((s, r) => s + r.open, 0);

    // header
    let y = 15;
    doc.setDrawColor(...C.gold);
    doc.setLineWidth(0.7);
    doc.line(margin, y + 4, margin + cw, y + 4);
    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...C.black);
    doc.text('SUPPLIERS PAYABLES', margin, y);
    y += 6;
    doc.setFontSize(11);
    doc.setTextColor(...C.gold);
    doc.text('ALMARAI ALARABIA TRADING', margin, y);
    y += 3;

    doc.setFillColor(...C.goldLight);
    doc.rect(margin, y, cw, 20, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.text('PERIOD', margin + 5, y + 6);
    doc.text('SUPPLIERS', margin + cw * 0.52, y + 6);
    doc.text('REPORT DATE', margin + cw * 0.72, y + 6);
    doc.setFontSize(11);
    doc.setTextColor(...C.black);
    doc.text(periodLabel(period), margin + 5, y + 14);
    doc.text(String(rows.length), margin + cw * 0.52, y + 14);
    doc.text(today(), margin + cw * 0.72, y + 14);
    y += 26;

    const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
    const body = sorted.map((r, i) => [String(i + 1), r.name, term(r.termDays), fmt(r.open)]);
    const options: any = {
      startY: y,
      margin: { left: margin, right: margin, top: 15, bottom: 20 },
      head: [['#', 'SUPPLIER', 'PAYMENT TERM', 'OPEN AMOUNT (AED)']],
      body,
      foot: [['', 'TOTAL', '', fmt(total)]],
      showFoot: 'lastPage',
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9, valign: 'middle', halign: 'center', cellPadding: 3, lineColor: C.border, lineWidth: { top: 0.3, bottom: 0.3, left: 0, right: 0 } },
      headStyles: { fillColor: C.black, textColor: C.white, fontStyle: 'bold', lineWidth: 0 },
      footStyles: { fillColor: C.black, textColor: C.gold, fontStyle: 'bold', fontSize: 10, lineWidth: 0 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { font: 'Amiri', halign: 'center' }, 2: { cellWidth: 36 }, 3: { cellWidth: 48, fontStyle: 'bold' } },
      didParseCell: (d: any) => {
        if (d.section === 'body') d.cell.styles.fillColor = d.row.index % 2 === 1 ? C.light : C.white;
      },
    };
    if (!body.length) options.body = [['', 'No open payables for this period', '', '']];
    if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(options);
    else autoTable(doc, options);
  });

  // page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.text(`Page ${i} of ${pages}`, W - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
  }

  const tag = (pr: PayablesPeriod) => `${pr.year}${pr.month ? `-${pad(pr.month)}` : ''}`;
  const name = sections.length === 1 ? tag(sections[0].period) : `${tag(sections[0].period)}_to_${tag(sections[sections.length - 1].period)}`;
  saveTrackedPdf(doc, `Suppliers_Payables_${name}.pdf`);
}

/** Single period (kept for existing callers). */
export async function generateSuppliersPayablesPdf(rows: PayablesRow[], period: PayablesPeriod) {
  return generateSuppliersPayablesMultiPdf([{ period, rows }]);
}
