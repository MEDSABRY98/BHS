'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import {
  COMPANY_NAME,
  compareLines,
  formatAmount,
  formatDate,
  missingInvoices,
  round2,
  uaeDateOf,
  type PettyCash,
  type PettyCashLine,
} from './PettyCashTypes';

type RGB = [number, number, number];
const C = {
  ink: [15, 15, 15] as RGB,
  ink2: [38, 38, 38] as RGB,
  gold: [212, 175, 55] as RGB,
  goldDark: [168, 134, 30] as RGB,
  goldSoft: [251, 248, 238] as RGB,
  goldLine: [233, 217, 163] as RGB,
  green: [21, 128, 61] as RGB,
  red: [185, 28, 28] as RGB,
  slate500: [100, 116, 139] as RGB,
  slate200: [226, 232, 240] as RGB,
  white: [255, 255, 255] as RGB,
};

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const hasArabic = (s: string) => ARABIC.test(s || '');

function label(doc: jsPDF, text: string, x: number, y: number, color: RGB = C.slate500) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...color);
  doc.text(text.toUpperCase(), x, y, { charSpace: 0.6 });
}

function smartText(doc: jsPDF, text: string, x: number, y: number, width: number, size: number, bold = true) {
  const value = text || '—';
  if (hasArabic(value)) {
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(size + 1);
    const lines = doc.splitTextToSize(value, width) as string[];
    doc.text(lines.slice(0, 2), x + width, y, { align: 'right' });
    return;
  }
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(value, width) as string[];
  doc.text(lines.slice(0, 2), x, y);
}

function infoBox(doc: jsPDF, title: string, value: string, x: number, y: number, w: number, valueColor: RGB = C.ink) {
  doc.setDrawColor(...C.slate200);
  doc.setFillColor(...C.white);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, 16, 2, 2, 'FD');
  label(doc, title, x + 4, y + 5.5);
  doc.setTextColor(...valueColor);
  smartText(doc, value, x + 4, y + 11.8, w - 8, 10.5);
}

const safe = (s: string) => (s || '').replace(/[^\w؀-ۿ -]+/g, '').trim().slice(0, 40);

/**
 * One petty cash → claim (PC-0001).
 * Several → statement with all their rows.
 */
export async function generatePettyCashPdf(items: PettyCash[], opts: { printedBy?: string; period?: string; showAccount?: boolean } = {}) {
  if (!items.length) throw new Error('Nothing to export');
  const single = items.length === 1 ? items[0] : null;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  try {
    await addArabicFont(doc);
  } catch {
    // Arabic font is only needed for Arabic text; continue without it
  }

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const CW = W - M * 2;

  // all rows together: beneficiary, then invoice date (oldest first)
  const rows: (PettyCashLine & { NO: string })[] = items.flatMap((p) => p.LINES.map((l) => ({ ...l, NO: p.ID }))).sort(compareLines);
  const total = round2(rows.reduce((s, l) => s + l.AMOUNT, 0));
  const taxTotal = round2(rows.reduce((s, l) => s + (l.IS_TAX_INVOICE ? l.AMOUNT : 0), 0));
  const noInvoice = missingInvoices(rows);
  const employees = Array.from(new Set(items.map((p) => p.EMPLOYEE_NAME || p.CREATED_BY).filter(Boolean)));

  // ── Header band ──────────────────────────────────────────
  doc.setFillColor(...C.ink);
  doc.rect(0, 0, W, 27, 'F');
  doc.setFillColor(...C.gold);
  doc.rect(0, 27, W, 1.4, 'F');

  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.6);
  doc.roundedRect(M, 5, 17, 17, 3, 3, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.gold);
  doc.text('AM', M + 8.5, 16.5, { align: 'center' });

  doc.setTextColor(...C.white);
  doc.setFontSize(12.5);
  doc.text(COMPANY_NAME, M + 22, 15.6, { charSpace: 0.4 });

  const rightText = (text: string, yy: number, size: number, color: RGB, spacing: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const w = doc.getTextWidth(text) + spacing * (text.length - 1);
    doc.text(text, W - M - w, yy, { charSpace: spacing });
  };
  rightText(single ? 'PETTY CASH CLAIM' : 'PETTY CASH STATEMENT', 12, 14, C.gold, 0.9);
  rightText(single ? single.ID : `${items.length} CLAIMS`, 18, 7, C.white, 0.8);

  // ── Info boxes ───────────────────────────────────────────
  let y = 36;
  const gap = 4;
  const bw = (CW - gap * 2) / 3;
  if (single) {
    infoBox(doc, 'Claim No.', single.ID, M, y, bw);
    infoBox(doc, 'Submitted On', formatDate(uaeDateOf(single.CREATED_AT)), M + bw + gap, y, bw);
    infoBox(doc, 'Employee', single.EMPLOYEE_NAME || single.CREATED_BY, M + (bw + gap) * 2, y, bw);
  } else {
    infoBox(doc, 'Employee', employees.length === 1 ? employees[0] : `${employees.length} employees`, M, y, bw);
    infoBox(doc, 'Period', opts.period || 'All', M + bw + gap, y, bw);
    infoBox(doc, 'Claims / Rows', `${items.length} / ${rows.length}`, M + (bw + gap) * 2, y, bw);
  }
  y += 16 + 5;

  // ── Amount panel ─────────────────────────────────────────
  doc.setFillColor(...C.goldSoft);
  doc.setDrawColor(...C.goldLine);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, 22, 2.5, 2.5, 'FD');
  doc.setFillColor(...C.gold);
  doc.rect(M, y, 2.2, 22, 'F');
  label(doc, 'Total Amount', M + 8, y + 7, C.goldDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.ink);
  doc.text(`AED ${formatAmount(total)}`, M + 8, y + 16.5);

  const stat = (title: string, value: string, x: number, color: RGB) => {
    label(doc, title, x, y + 7, C.goldDark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(value, x, y + 15.5);
  };
  stat('Tax Invoices', formatAmount(taxTotal), M + CW * 0.52, C.ink);
  stat('Without Invoice', `${noInvoice} row${noInvoice === 1 ? '' : 's'}`, M + CW * 0.77, noInvoice ? C.red : C.green);
  y += 22 + 6;

  if (single?.NOTES) {
    label(doc, 'Notes', M, y);
    doc.setTextColor(...C.ink2);
    smartText(doc, single.NOTES, M, y + 5, CW, 9, false);
    y += 13;
  }

  // ── Rows table ───────────────────────────────────────────
  const head = [['#', ...(single ? [] : ['Claim']), 'Invoice Date', 'Description', 'Beneficiary', 'Amount', 'Invoice']];
  const body = rows.map((l, i) => [
    String(i + 1),
    ...(single ? [] : [l.NO]),
    formatDate(l.INVOICE_DATE),
    l.DESCRIPTION,
    l.BENEFICIARY,
    formatAmount(l.AMOUNT),
    l.HAS_INVOICE ? 'Yes' : 'No',
  ]);
  const amountCol = head[0].length - 2;
  const invoiceCol = amountCol + 1;
  const foot = [[{ content: 'Total', colSpan: amountCol, styles: { halign: 'right' as const } }, formatAmount(total), '']];
  const descCol = single ? 2 : 3;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 22 },
    showFoot: 'lastPage',
    head,
    body,
    foot,
    theme: 'plain',
    styles: {
      halign: 'center',
      valign: 'middle',
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 2.4, bottom: 2.4, left: 2, right: 2 },
      textColor: C.ink,
      lineColor: C.slate200,
      lineWidth: { bottom: 0.2 } as any,
    },
    headStyles: { fillColor: C.ink, textColor: C.gold, fontStyle: 'bold', fontSize: 7.5 },
    footStyles: { fillColor: C.goldSoft, textColor: C.ink, fontStyle: 'bold', fontSize: 9.5 },
    columnStyles: {
      0: { cellWidth: 8, textColor: C.slate500 },
      [descCol]: { cellWidth: 'auto' },
      [invoiceCol]: { cellWidth: 15 },
      [amountCol]: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const raw = String(data.cell.raw ?? '');
      if (hasArabic(raw)) {
        data.cell.styles.font = 'Amiri';
        data.cell.styles.fontStyle = 'normal';
        data.cell.styles.fontSize = 9;
      }
      if (data.column.index === invoiceCol) data.cell.styles.textColor = raw === 'Yes' ? C.green : C.red;
    },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // ── Signatures (right after the table) ───────────────────
  const sigH = 34;
  if (y > H - 22 - sigH) {
    doc.addPage();
    y = 20;
  }
  const sy = y;
  const sw = (CW - 16) / 3;
  const sign = (title: string, name: string, x: number) => {
    label(doc, title, x, sy);
    doc.setDrawColor(...C.ink);
    doc.setLineWidth(0.35);
    doc.line(x, sy + 18, x + sw, sy + 18);
    doc.setTextColor(...C.ink);
    smartText(doc, name || ' ', x, sy + 23.5, sw, 9);
  };
  sign('Employee', employees.length === 1 ? employees[0] : '', M);
  sign('Accounts Department', '', M + sw + 8);
  sign('CEO', '', M + (sw + 8) * 2);

  // ── Footer on every page ─────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...C.gold);
    doc.rect(M, H - 15, CW, 0.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.slate500);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 9.5, { align: 'right' });
  }

  const fileName = single
    ? `${single.ID}_${safe(single.EMPLOYEE_NAME || single.CREATED_BY) || 'PettyCash'}.pdf`
    : `PettyCash_Statement_${employees.length === 1 ? safe(employees[0]) + '_' : ''}${new Date().toISOString().slice(0, 10)}.pdf`;
  saveTrackedPdf(doc, fileName);
  return fileName;
}
