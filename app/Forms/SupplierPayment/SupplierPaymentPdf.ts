'use client';

// One-page Supplier Payment PDF — same look as the Employee Charge form:
// white header with navy/gold hairline, date/method/currency strip, supplier card,
// period + due date, amount box + amount in words, notes, signatures.

import jsPDF from 'jspdf';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { COMPANY_NAME, amountToWords, formatAmount, formatDate, formatLongDate } from '../EmployeeCharge/Utils/EmployeeChargeTypes';
import { methodLabel, type SupplierPayment } from './SupplierPaymentTypes';

type RGB = [number, number, number];
const C = {
  navy: [24, 46, 86] as RGB,
  accent: [196, 160, 82] as RGB,
  soft: [245, 247, 251] as RGB,
  border: [222, 227, 236] as RGB,
  ink: [17, 24, 39] as RGB,
  text: [55, 65, 81] as RGB,
  grey: [110, 117, 130] as RGB,
  white: [255, 255, 255] as RGB,
};

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const hasArabic = (s: string) => ARABIC.test(s || '');

const W = 210;
const PH = 297;
const M = 16;
const CW = W - M * 2;

export async function generateSupplierPaymentPdf(form: SupplierPayment) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  if ([form.SUPPLIER_NAME, form.NOTES].some(hasArabic)) {
    try {
      await addArabicFont(doc);
    } catch {
      // continue without the Arabic font
    }
  }
  doc.setProperties({ title: `Supplier Payment — ${form.SUPPLIER_NAME}`, author: COMPANY_NAME });

  const label = (t: string, x: number, y: number, c: RGB = C.grey, size = 6.6) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(...c);
    doc.text(t.toUpperCase(), x, y, { charSpace: 0.55 });
  };
  const textFont = (s: string, style: 'normal' | 'bold' = 'normal') => {
    if (hasArabic(s)) doc.setFont('Amiri', 'normal');
    else doc.setFont('helvetica', style);
  };

  // ── Top hairline ─────────────────────────────────────────
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, W, 5, 'F');
  doc.setFillColor(...C.accent);
  doc.rect(0, 5, W, 0.6, 'F');

  // ── Company (left) ───────────────────────────────────────
  doc.setFillColor(...C.navy);
  doc.roundedRect(M, 13, 15, 15, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.accent);
  doc.text('AM', M + 7.5, 22.3, { align: 'center' });
  doc.setTextColor(...C.navy);
  doc.setFontSize(12.5);
  doc.text(COMPANY_NAME, M + 19, 19, { charSpace: 0.3 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...C.grey);
  doc.text('Forms  ·  Supplier Payment', M + 19, 24.5);

  // ── Title (right) ────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...C.navy);
  const sp = 1;
  const t1 = 'SUPPLIER';
  const t2 = 'PAYMENT';
  doc.text(t1, W - M - (doc.getTextWidth(t1) + sp * (t1.length - 1)), 18.5, { charSpace: sp });
  doc.text(t2, W - M - (doc.getTextWidth(t2) + sp * (t2.length - 1)), 25, { charSpace: sp });

  // ── Date / Method / Currency strip ──────────────────────
  let y = 36;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.setFillColor(...C.soft);
  doc.roundedRect(M, y, CW, 15, 2.5, 2.5, 'FD');
  const cols: [string, string][] = [
    ['Date', formatLongDate(form.DATE)],
    ['Payment Method', methodLabel(form.METHOD)],
    ['Currency', 'UAE Dirham (AED)'],
  ];
  cols.forEach(([l, v], i) => {
    const x = M + 6 + (i * CW) / 3;
    if (i) {
      doc.setDrawColor(...C.border);
      doc.line(x - 3.5, y + 3, x - 3.5, y + 12);
    }
    label(l, x, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(...(i === 1 ? C.navy : C.ink));
    doc.text(v, x, y + 11.6);
  });

  // ── Supplier card ───────────────────────────────────────
  y += 15 + 7;
  const cardH = 19;
  doc.setDrawColor(...C.border);
  doc.setFillColor(...C.white);
  doc.roundedRect(M, y, CW, cardH, 2.5, 2.5, 'FD');
  doc.setFillColor(...C.navy);
  doc.rect(M, y + 4, 1.4, cardH - 8, 'F');
  label('Pay To (Supplier)', M + 6, y + 6.5, C.accent, 6.8);
  textFont(form.SUPPLIER_NAME, 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...C.ink);
  if (hasArabic(form.SUPPLIER_NAME)) doc.text(form.SUPPLIER_NAME, W - M - 6, y + 13.8, { align: 'right' });
  else doc.text(doc.splitTextToSize(form.SUPPLIER_NAME, CW - 12)[0], M + 6, y + 13.8);
  y += cardH + 7;

  // ── Period · Payment term · Due date (cheque) ───────────
  const isCheque = form.METHOD === 'cheque';
  // three boxes → short dates so the period fits
  const crowded = isCheque && !!form.PAYMENT_TERM.trim();
  const fmtPeriod = crowded ? formatDate : formatLongDate;
  const boxes: [string, string][] = [
    ['Period', `${fmtPeriod(form.PERIOD_FROM)}  –  ${fmtPeriod(form.PERIOD_TO)}`],
    ...(form.PAYMENT_TERM.trim() ? ([['Payment Term', form.PAYMENT_TERM.trim()]] as [string, string][]) : []),
    ...(isCheque ? ([['Cheque Due Date', formatLongDate(form.DUE_DATE || '')]] as [string, string][]) : []),
  ];
  const gap = 6;
  const bw = (CW - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach(([l, v], i) => {
    const x = M + i * (bw + gap);
    doc.setDrawColor(...C.border);
    doc.setFillColor(...C.white);
    doc.roundedRect(x, y, bw, 16, 2.5, 2.5, 'FD');
    label(l, x + 5, y + 6, C.navy);
    textFont(v, 'bold');
    doc.setFontSize(boxes.length > 2 ? 9 : 10);
    doc.setTextColor(...C.ink);
    const shown = doc.splitTextToSize(v, bw - 10)[0];
    if (hasArabic(v)) doc.text(shown, x + bw - 5, y + 12, { align: 'right' });
    else doc.text(shown, x + 5, y + 12);
  });
  y += 16 + 8;

  // ── Amount in words (left) + amount (right) ────────────
  const tw = 70;
  const tx = W - M - tw;
  const ww = CW - tw - 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.8);
  const words = doc.splitTextToSize(amountToWords(form.AMOUNT), ww - 12) as string[];
  const boxH = Math.max(22, 14 + words.length * 4.2);

  doc.setFillColor(...C.navy);
  doc.roundedRect(tx, y, tw, boxH, 2.5, 2.5, 'F');
  label('Amount to Pay', tx + 5, y + 7, C.accent, 6.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.white);
  doc.text(`AED ${formatAmount(form.AMOUNT)}`, W - M - 5, y + boxH - 6, { align: 'right' });

  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.border);
  doc.roundedRect(M, y, ww, boxH, 2.5, 2.5, 'FD');
  doc.setFillColor(...C.accent);
  doc.rect(M, y + 4, 1.2, boxH - 8, 'F');
  label('Amount in words', M + 6, y + 6.5, C.navy);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.8);
  doc.setTextColor(...C.ink);
  doc.text(words, M + 6, y + 12, { lineHeightFactor: 1.35 });
  y += boxH + 8;

  // ── Notes (only when written) ───────────────────────────
  if (form.NOTES.trim()) {
    label('Notes', M, y, C.navy, 7);
    y += 3;
    textFont(form.NOTES);
    doc.setFontSize(9.2);
    const lines = doc.splitTextToSize(form.NOTES.trim(), CW - 12) as string[];
    const lineH = 9.2 * 1.45 * 0.3528;
    const notesH = Math.max(16, 8 + lines.length * lineH + 3);
    doc.setDrawColor(...C.border);
    doc.setFillColor(...C.white);
    doc.roundedRect(M, y, CW, notesH, 2.5, 2.5, 'FD');
    doc.setTextColor(...C.text);
    if (hasArabic(form.NOTES)) doc.text(lines, W - M - 6, y + 7, { align: 'right', lineHeightFactor: 1.45 });
    else doc.text(lines, M + 6, y + 7, { lineHeightFactor: 1.45 });
    y += notesH + 7;
  }

  // ── Signatures: Accounts Department · CEO (bottom of the page) ──
  let sy = Math.max(y + 18, PH - 48);
  if (sy > PH - 30) {
    doc.addPage();
    sy = 40;
  }
  const signers = ['Accounts Department', 'CEO'];
  const sgap = 30;
  const sw = (CW - sgap * (signers.length - 1)) / signers.length;
  signers.forEach((title, i) => {
    const x = M + i * (sw + sgap);
    label(title, x, sy, C.navy, 7);
    doc.setDrawColor(...C.ink);
    doc.setLineWidth(0.35);
    doc.line(x, sy + 20, x + sw, sy + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...C.grey);
    doc.text('Signature & Date', x, sy + 25);
  });

  // ── Page numbers ────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  if (pages > 1) {
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.grey);
      doc.text(`Page ${p} of ${pages}`, W - M, PH - 8, { align: 'right' });
    }
  }

  const safeName = (form.SUPPLIER_NAME || '').replace(/[^\w؀-ۿ -]+/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
  const fileName = `Supplier_Payment_${safeName || 'Supplier'}_${form.DATE}.pdf`;
  saveTrackedPdf(doc, fileName);
  return fileName;
}
