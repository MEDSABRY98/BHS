'use client';

// Transfer Request form PDF — same house style as the Vouchers PDF.
// Signatures (on paper): Prepared By · Accounts Department · CEO

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf, trackFileDownload } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import {
  amountToWords,
  formatAmount,
  formatIban,
  hasArabic,
  type TransferBank,
  type TransferBeneficiary,
  type TransferRequest,
} from './TransferTypes';

type RGB = [number, number, number];
const C = {
  ink: [15, 15, 15] as RGB,
  ink2: [38, 38, 38] as RGB,
  gold: [212, 175, 55] as RGB,
  goldDark: [168, 134, 30] as RGB,
  goldSoft: [251, 248, 238] as RGB,
  goldLine: [233, 217, 163] as RGB,
  slate500: [100, 116, 139] as RGB,
  slate200: [226, 232, 240] as RGB,
  slate100: [241, 245, 249] as RGB,
  white: [255, 255, 255] as RGB,
};

const TYPE_TITLE: Record<string, string> = {
  INTERNAL: 'INTERNAL TRANSFER',
  AIN_TO_DUBAI: 'AL AIN TO DUBAI',
  DUBAI_TO_AIN: 'DUBAI TO AL AIN',
};

function fmtDate(d: string): string {
  if (!d) return '-';
  const p = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  return Number.isNaN(p.getTime()) ? d : p.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Helvetica, or Amiri right-aligned in the box when the text has Arabic. Returns the height used. */
function smartText(doc: any, text: string, x: number, y: number, width: number, size: number, bold = true): number {
  const value = text || '-';
  if (hasArabic(value)) {
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(size + 1);
    const lines = doc.splitTextToSize(value, width) as string[];
    doc.text(lines, x + width, y, { align: 'right' });
    return lines.length * (size * 0.45);
  }
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(value, width) as string[];
  doc.text(lines, x, y);
  return lines.length * (size * 0.42);
}

function label(doc: any, text: string, x: number, y: number, color: RGB = C.slate500) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...color);
  doc.text(text.toUpperCase(), x, y, { charSpace: 0.6 });
}

function infoBox(doc: any, title: string, value: string, x: number, y: number, w: number, h = 16) {
  doc.setDrawColor(...C.slate200);
  doc.setFillColor(...C.white);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  label(doc, title, x + 4, y + 5.5);
  doc.setTextColor(...C.ink);
  smartText(doc, value, x + 4, y + 11.8, w - 8, 11);
}

export interface TransferPdfData {
  request: TransferRequest;
  beneficiary: TransferBeneficiary | null;
  beneficiaryBank: TransferBank | null;
  transferBank: TransferBank | null; // internal transfers
  mode?: 'download' | 'print';
}

export async function generateTransferPdf({ request: r, beneficiary, beneficiaryBank, transferBank, mode = 'download' }: TransferPdfData) {
  const jsPDF = (await import('jspdf')).default;
  const doc: any = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setProperties({ title: `Transfer Request ${r.REQUEST_NO}` });
  try {
    await addArabicFont(doc);
  } catch {
    // only needed for Arabic names
  }

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = W - M * 2;

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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('ALMARAI ALARABIA TRADING', M + 22, 15.6, { charSpace: 0.4 });

  const rightText = (text: string, yy: number, size: number, color: RGB, spacing: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const w = doc.getTextWidth(text) + spacing * (text.length - 1);
    doc.text(text, W - M - w, yy, { charSpace: spacing });
  };
  rightText('TRANSFER REQUEST', 12, 14, C.gold, 0.9);
  rightText(TYPE_TITLE[r.TRANSFER_TYPE] || r.TRANSFER_TYPE, 18, 7, C.white, 0.8);

  // ── Info boxes ───────────────────────────────────────────
  let y = 37;
  const gap = 4;
  const bw = (CW - gap * 2) / 3;
  infoBox(doc, 'Request No.', r.REQUEST_NO, M, y, bw);
  infoBox(doc, 'Date', fmtDate(r.REQUEST_DATE), M + bw + gap, y, bw);
  infoBox(doc, 'Transfer Type', TYPE_TITLE[r.TRANSFER_TYPE] || r.TRANSFER_TYPE, M + (bw + gap) * 2, y, bw);
  y += 16 + 7;

  // ── Amount panel ─────────────────────────────────────────
  doc.setFillColor(...C.goldSoft);
  doc.setDrawColor(...C.goldLine);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, 30, 2.5, 2.5, 'FD');
  doc.setFillColor(...C.gold);
  doc.rect(M, y, 2.2, 30, 'F');
  label(doc, 'Amount', M + 8, y + 7, C.goldDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...C.ink);
  doc.text(`${r.CURRENCY} ${formatAmount(r.AMOUNT)}`, M + 8, y + 18);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...C.ink2);
  const words = doc.splitTextToSize(amountToWords(r.AMOUNT, r.CURRENCY), CW - 16) as string[];
  doc.text(words.slice(0, 2), M + 8, y + 24.5);
  y += 30 + 9;

  // ── Beneficiary details ──────────────────────────────────
  label(doc, 'Beneficiary Details', M, y, C.goldDark);
  y += 3;
  const rows: [string, string][] = [
    ['Beneficiary Name', beneficiary?.NAME || '-'],
    ['Bank', beneficiaryBank?.NAME || '-'],
    ['IBAN', beneficiary?.IBAN ? formatIban(beneficiary.IBAN) : '-'],
    ['Account No.', beneficiary?.ACCOUNT_NO || '-'],
  ];
  if (r.TRANSFER_TYPE === 'INTERNAL') rows.push(['Transfer Bank', transferBank?.NAME || '-']);

  const rowH = 11;
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, rows.length * rowH, 2, 2, 'S');
  rows.forEach(([k, v], i) => {
    const ry = y + i * rowH;
    if (i > 0) doc.line(M, ry, M + CW, ry);
    doc.setFillColor(...C.slate100);
    doc.rect(M + 0.15, ry + 0.15, 48, rowH - 0.3, 'F');
    label(doc, k, M + 4, ry + 7);
    doc.setTextColor(...C.ink);
    smartText(doc, v, M + 54, ry + 7.2, CW - 58, 10.5);
  });
  y += rows.length * rowH + 8;

  // ── Reason ───────────────────────────────────────────────
  label(doc, 'Reason for Transfer', M, y, C.goldDark);
  y += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const arabicReason = hasArabic(r.REASON);
  const reasonLines = arabicReason ? null : (doc.splitTextToSize(r.REASON || '-', CW - 10) as string[]);
  const lineCount = reasonLines ? reasonLines.length : Math.ceil((r.REASON || '').length / 85) + 1;
  const boxH = Math.max(16, lineCount * 5 + 8);
  doc.setFillColor(...C.slate100);
  doc.roundedRect(M, y, CW, boxH, 2, 2, 'F');
  doc.setTextColor(...C.ink2);
  if (reasonLines) doc.text(reasonLines, M + 5, y + 7);
  else smartText(doc, r.REASON, M + 5, y + 7, CW - 10, 10, false);
  y += boxH + 10;

  // ── Signatures: Prepared By · Accounts Department · CEO ─────────────
  const sigH = 34;
  if (y > H - 24 - sigH) {
    doc.addPage();
    y = 30;
  }
  const sy = Math.max(y, H - 24 - sigH);
  const sGap = 10;
  const sw = (CW - sGap * 2) / 3;
  const sign = (title: string, name: string, x: number) => {
    label(doc, title, x, sy);
    doc.setDrawColor(...C.ink);
    doc.setLineWidth(0.35);
    doc.line(x, sy + 22, x + sw, sy + 22);
    doc.setTextColor(...C.ink);
    if (name) smartText(doc, name, x, sy + 27.5, sw, 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.slate500);
    doc.text('Signature / Date', x, sy + (name ? 32 : 27.5));
  };
  sign('Prepared By', r.CREATED_BY_NAME || '', M);
  sign('Accounts Department', '', M + sw + sGap);
  sign('CEO', '', M + (sw + sGap) * 2);

  // ── Footer on every page ─────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...C.gold);
    doc.rect(M, H - 16, CW, 0.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.slate500);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 10.5, { align: 'right' });
  }

  const safeName = (beneficiary?.NAME || '').replace(/[^\w؀-ۿ -]+/g, '').trim().slice(0, 40);
  const fileName = `${r.REQUEST_NO}${safeName ? `_${safeName}` : ''}.pdf`;
  if (mode === 'print') {
    const url = doc.output('bloburl');
    window.open(url as unknown as string, '_blank');
    trackFileDownload(fileName);
  } else {
    saveTrackedPdf(doc, fileName);
  }
  return fileName;
}
