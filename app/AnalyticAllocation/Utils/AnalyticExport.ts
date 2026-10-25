'use client';

// Excel (standard BHS look via exportStyledExcelWorkbook) and PDF for one allocation.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportStyledExcelWorkbook } from '@/app/Components/Export/ExcelExport';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { COMPANY_NAME, computeAllocation, formatAmount, formatDate, round2, type AllocationPerson } from './AnalyticTypes';

export type ExportSource = { TITLE: string; ALLOC_DATE: string; AMOUNT: number; NOTES?: string; PEOPLE: AllocationPerson[] };

const safe = (s: string) => (s || '').replace(/[^\w؀-ۿ -]+/g, '').trim().slice(0, 50) || 'Allocation';
const fileBase = (a: ExportSource) => `AnalyticAllocation_${safe(a.TITLE)}_${a.ALLOC_DATE}`;

export async function exportAllocationExcel(a: ExportSource) {
  const c = computeAllocation(a.AMOUNT, a.PEOPLE);
  const summary = [
    // each account, then its beneficiaries under it (the account's % split between them)
    ...c.accounts.flatMap((x) => [
      { 'Analytic Account': x.ACCOUNT, 'Amount (AED)': x.AMOUNT, '%': `${x.PCT.toFixed(2)}%` },
      ...x.PEOPLE.map((p) => ({ 'Analytic Account': `   ↳ ${p.NAME}`, 'Amount (AED)': p.AMOUNT, '%': `${p.PCT.toFixed(2)}%` })),
    ]),
    { 'Analytic Account': 'TOTAL', 'Amount (AED)': c.allocated, '%': '100.00%' },
  ];
  const people = [
    ...c.persons.map((p) => ({ Person: p.NAME, '% of Amount': `${p.PCT.toFixed(2)}%`, 'Amount (AED)': p.AMOUNT })),
    { Person: 'TOTAL', '% of Amount': '100.00%', 'Amount (AED)': round2(c.persons.reduce((s, p) => s + p.AMOUNT, 0)) },
  ];
  let prev = '';
  const detail = c.lines.map((l) => {
    const first = l.PERSON !== prev;
    prev = l.PERSON;
    return { Person: first ? l.PERSON : '', 'Analytic Account': l.ACCOUNT, '% of Person': `${l.PCT.toFixed(2)}%`, 'Amount (AED)': l.AMOUNT };
  });
  detail.push({ Person: 'TOTAL', 'Analytic Account': '', '% of Person': '', 'Amount (AED)': c.allocated });

  await exportStyledExcelWorkbook(
    [
      { name: 'Summary', data: summary, options: { numericColumns: ['Amount (AED)'], columnWidth: 26 } },
      { name: 'People', data: people, options: { numericColumns: ['Amount (AED)'], columnWidth: 30 } },
      { name: 'Detail', data: detail, options: { numericColumns: ['Amount (AED)'], columnWidth: 30 } },
    ],
    `${fileBase(a)}.xlsx`,
  );
}

type RGB = [number, number, number];
const C = {
  black: [17, 17, 17] as RGB,
  gold: [184, 147, 47] as RGB,
  goldL: [246, 239, 217] as RGB,
  grey: [107, 107, 107] as RGB,
  line: [227, 220, 200] as RGB,
  zebra: [251, 249, 243] as RGB,
  panel: [253, 251, 246] as RGB,
  white: [255, 255, 255] as RGB,
};
const M = 18;
const PW = 210;
const PH = 297;
const CW = PW - 2 * M;
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

const table = (doc: jsPDF, y: number, head: string[], body: string[][], widths: number[], groupBreak?: (i: number) => boolean, subRow?: (i: number) => boolean) => {
  autoTable(doc, {
    theme: 'plain',
    startY: y,
    margin: { left: M, right: M, top: 22, bottom: 22 },
    head: [head],
    body,
    styles: { font: 'helvetica', fontSize: 8.5, halign: 'center', valign: 'middle', cellPadding: { top: 1.9, bottom: 1.9, left: 2, right: 2 }, textColor: C.black, lineColor: C.line },
    headStyles: { fillColor: C.black, textColor: C.white, fontStyle: 'bold', halign: 'center' },
    columnStyles: Object.fromEntries(widths.map((w, i) => [i, { cellWidth: w }])),
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      if (ARABIC.test(String(d.cell.raw ?? ''))) {
        d.cell.styles.font = 'Amiri';
        d.cell.styles.fontStyle = 'normal';
      }
      if (d.row.index === body.length - 1) {
        d.cell.styles.fillColor = C.goldL;
        d.cell.styles.fontStyle = 'bold';
      } else if (subRow) {
        // grouped table: the group row bold on a light panel, its sub rows smaller and grey
        if (subRow(d.row.index)) {
          d.cell.styles.textColor = C.grey;
          d.cell.styles.fontSize = 8;
        } else {
          d.cell.styles.fillColor = C.zebra;
          if (d.cell.styles.font !== 'Amiri') d.cell.styles.fontStyle = 'bold';
        }
      } else if (d.row.index % 2 === 1) d.cell.styles.fillColor = C.zebra;
    },
    didDrawCell: (d) => {
      const s = d.doc;
      if (d.section === 'head') {
        s.setDrawColor(...C.gold);
        s.setLineWidth(0.6);
        s.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
        return;
      }
      if (d.row.index >= body.length - 1) return;
      const brk = !!groupBreak?.(d.row.index);
      s.setDrawColor(...(brk ? C.gold : C.line));
      s.setLineWidth(brk ? 0.4 : 0.15);
      s.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
    },
  });
  return (doc as any).lastAutoTable.finalY as number;
};

const heading = (doc: jsPDF, y: number, title: string) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.black);
  doc.text(title, M, y);
  return y + 4;
};

export async function exportAllocationPdf(a: ExportSource) {
  const c = computeAllocation(a.AMOUNT, a.PEOPLE);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  try {
    await addArabicFont(doc);
  } catch {
    // only needed for Arabic names
  }
  doc.setProperties({ title: `Analytic Allocation - ${a.TITLE}`, author: COMPANY_NAME });

  let y = 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.black);
  doc.text(doc.splitTextToSize(a.TITLE, CW)[0], M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.grey);
  doc.text(`Analytic Allocation  ·  ${formatDate(a.ALLOC_DATE)}  ·  Amounts in AED`, M, y + 6);
  y += 12;

  const kpis: [string, string][] = [
    [formatAmount(a.AMOUNT), 'Amount (AED)'],
    [String(c.persons.length), c.persons.length === 1 ? 'Person' : 'People'],
    [String(c.accounts.length), 'Analytic Accounts'],
    [formatDate(a.ALLOC_DATE), 'Date'],
  ];
  const kw = CW / kpis.length;
  doc.setFillColor(...C.panel);
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.3);
  doc.rect(M, y, CW, 17, 'FD');
  kpis.forEach(([v, l], i) => {
    const cx = M + kw * i + kw / 2;
    if (i) {
      doc.setDrawColor(...C.line);
      doc.setLineWidth(0.2);
      doc.line(M + kw * i, y, M + kw * i, y + 17);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...C.black);
    doc.text(v, cx, y + 8.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grey);
    doc.text(l, cx, y + 13.5, { align: 'center' });
  });
  y += 23;

  if (a.NOTES) {
    doc.setFont(ARABIC.test(a.NOTES) ? 'Amiri' : 'helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.grey);
    const lines = doc.splitTextToSize(a.NOTES, CW) as string[];
    doc.text(lines, M, y);
    y += lines.length * 4 + 4;
  }

  y = heading(doc, y + 2, 'By Analytic Account');
  // each account, then its beneficiaries (the account's % split between them)
  const accRows: string[][] = [];
  const isSub: boolean[] = [];
  c.accounts.forEach((x) => {
    accRows.push([x.ACCOUNT, formatAmount(x.AMOUNT), `${x.PCT.toFixed(2)}%`]);
    isSub.push(false);
    x.PEOPLE.forEach((p) => {
      accRows.push([p.NAME, formatAmount(p.AMOUNT), `${p.PCT.toFixed(2)}%`]);
      isSub.push(true);
    });
  });
  accRows.push(['Total', formatAmount(c.allocated), '100.00%']);
  y =
    table(
      doc,
      y,
      ['Analytic Account / Beneficiary', 'Amount (AED)', '% of Total'],
      accRows,
      [84, 50, 40],
      (i) => i + 1 < isSub.length && !isSub[i + 1], // gold line before the next account
      (i) => !!isSub[i],
    ) + 9;

  if (y > PH - 50) {
    doc.addPage();
    y = 22;
  }
  y = heading(doc, y, 'By Person');
  y = table(doc, y, ['Person', '% of Amount', 'Amount (AED)'], [...c.persons.map((p) => [p.NAME, `${p.PCT.toFixed(2)}%`, formatAmount(p.AMOUNT)]), ['Total', '100.00%', formatAmount(c.allocated)]], [84, 40, 50]) + 9;

  if (y > PH - 50) {
    doc.addPage();
    y = 22;
  }
  y = heading(doc, y, 'Detail: Person × Analytic Account');
  let prev = '';
  const body = c.lines.map((l) => {
    const first = l.PERSON !== prev;
    prev = l.PERSON;
    return [first ? l.PERSON : '', l.ACCOUNT, `${l.PCT.toFixed(2)}%`, formatAmount(l.AMOUNT)];
  });
  body.push(['Total', '', '', formatAmount(c.allocated)]);
  table(doc, y, ['Person', 'Analytic Account', '% of Person', 'Amount (AED)'], body, [58, 54, 28, 34], (i) => c.lines[i + 1] !== undefined && c.lines[i + 1].PERSON !== c.lines[i].PERSON);

  // Header band + page numbers on every page
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.black);
    doc.rect(0, 0, PW, 14, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(0, 14, PW, 1.2, 'F');
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(COMPANY_NAME, M, 9);
    doc.setFont('helvetica', 'normal');
    doc.text('Analytic Allocation', PW - M, 9, { align: 'right' });
    doc.setFontSize(7);
    doc.setTextColor(...C.grey);
    doc.text(`Page ${i} of ${n}`, PW - M, PH - 8, { align: 'right' });
  }

  saveTrackedPdf(doc, `${fileBase(a)}.pdf`);
}
