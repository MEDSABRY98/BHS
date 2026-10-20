'use client';

// One-page Employee Charge PDF — same look as the Debit Note:
// white header with navy/gold hairline, number/date/currency strip, employee card,
// details box, amount box + amount in words, acknowledgement, signatures.

import jsPDF from 'jspdf';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { ACKNOWLEDGEMENT, COMPANY_NAME, formatAmount, formatLongDate, type EmployeeCharge } from './EmployeeChargeTypes';

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

export async function generateEmployeeChargePdf(form: EmployeeCharge) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const arabic = [form.EMPLOYEE_NAME, form.DESCRIPTION].some(hasArabic);
  if (arabic) {
    try {
      await addArabicFont(doc);
    } catch {
      // continue without the Arabic font
    }
  }
  doc.setProperties({ title: `Employee Charge ${form.ID}`, author: COMPANY_NAME });

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
  doc.text('Forms  ·  Employee Charge', M + 19, 24.5);

  // ── Title (right) ────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...C.navy);
  const sp = 1;
  const t1 = 'EMPLOYEE';
  const t2 = 'CHARGE';
  doc.text(t1, W - M - (doc.getTextWidth(t1) + sp * (t1.length - 1)), 18.5, { charSpace: sp });
  doc.text(t2, W - M - (doc.getTextWidth(t2) + sp * (t2.length - 1)), 25, { charSpace: sp });

  // ── Number / Date / Currency strip ──────────────────────
  let y = 36;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.setFillColor(...C.soft);
  doc.roundedRect(M, y, CW, 15, 2.5, 2.5, 'FD');
  const cols: [string, string][] = [
    ['Form No.', form.ID],
    ['Date', formatLongDate(form.CHARGE_DATE)],
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
    doc.setTextColor(...(i === 0 ? C.navy : C.ink));
    doc.text(v, x, y + 11.6);
  });

  // ── Employee card ───────────────────────────────────────
  y += 15 + 7;
  const cardH = form.EMPLOYEE_NO ? 24 : 19;
  doc.setDrawColor(...C.border);
  doc.setFillColor(...C.white);
  doc.roundedRect(M, y, CW, cardH, 2.5, 2.5, 'FD');
  doc.setFillColor(...C.navy);
  doc.rect(M, y + 4, 1.4, cardH - 8, 'F');
  label('Charged Employee', M + 6, y + 6.5, C.accent, 6.8);
  textFont(form.EMPLOYEE_NAME, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.ink);
  if (hasArabic(form.EMPLOYEE_NAME)) doc.text(form.EMPLOYEE_NAME, W - M - 6, y + 13.5, { align: 'right' });
  else doc.text(form.EMPLOYEE_NAME, M + 6, y + 13.5);
  if (form.EMPLOYEE_NO) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...C.grey);
    doc.text('Employee No.:', M + 6, y + 19.5);
    const lw = doc.getTextWidth('Employee No.:') + 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.text);
    doc.text(form.EMPLOYEE_NO, M + 6 + lw, y + 19.5);
  }
  y += cardH + 8;

  // ── Details box (grows with the text) ───────────────────
  label('Details', M, y, C.navy, 7);
  y += 3;
  textFont(form.DESCRIPTION);
  doc.setFontSize(9.2);
  const lines = doc.splitTextToSize(form.DESCRIPTION, CW - 12) as string[];
  const lineH = 9.2 * 1.45 * 0.3528;
  const detailsH = Math.max(24, 8 + lines.length * lineH + 3);
  doc.setDrawColor(...C.border);
  doc.setFillColor(...C.white);
  doc.roundedRect(M, y, CW, detailsH, 2.5, 2.5, 'FD');
  doc.setTextColor(...C.text);
  if (hasArabic(form.DESCRIPTION)) doc.text(lines, W - M - 6, y + 7, { align: 'right', lineHeightFactor: 1.45 });
  else doc.text(lines, M + 6, y + 7, { lineHeightFactor: 1.45 });
  y += detailsH + 7;

  // ── Amount in words (left) + amount (right) ────────────
  const tw = 70;
  const tx = W - M - tw;
  const ww = CW - tw - 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.8);
  const words = doc.splitTextToSize(form.AMOUNT_IN_WORDS, ww - 12) as string[];
  const boxH = Math.max(22, 14 + words.length * 4.2);

  doc.setFillColor(...C.navy);
  doc.roundedRect(tx, y, tw, boxH, 2.5, 2.5, 'F');
  label('Amount Charged', tx + 5, y + 7, C.accent, 6.8);
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

  // ── Acknowledgement ─────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(...C.text);
  const ack = doc.splitTextToSize(ACKNOWLEDGEMENT, CW) as string[];
  doc.text(ack, M, y, { lineHeightFactor: 1.4 });
  y += ack.length * 4.4 + 4;

  // ── Signatures: Employee · Accounts Department · CEO (bottom of the page) ──
  let sy = Math.max(y + 18, PH - 48);
  if (sy > PH - 30) {
    doc.addPage();
    sy = 40;
  }
  const signers = ['Employee', 'Accounts Department', 'CEO'];
  const gap = 14;
  const sw = (CW - gap * (signers.length - 1)) / signers.length;
  signers.forEach((title, i) => {
    const x = M + i * (sw + gap);
    label(title, x, sy, C.navy, 7);
    doc.setDrawColor(...C.ink);
    doc.setLineWidth(0.35);
    doc.line(x, sy + 20, x + sw, sy + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...C.grey);
    doc.text(i === 0 ? 'Name, Signature & Date' : 'Signature & Date', x, sy + 25);
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

  const safeName = (form.EMPLOYEE_NAME || '').replace(/[^\w؀-ۿ -]+/g, '').trim().slice(0, 40);
  const fileName = `${form.ID}${safeName ? `_${safeName}` : ''}.pdf`;
  saveTrackedPdf(doc, fileName);
  return fileName;
}
