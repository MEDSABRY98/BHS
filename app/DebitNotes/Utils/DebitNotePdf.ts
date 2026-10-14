'use client';

// One-page Debit Note PDF — same content and navy identity as the issued DN document,
// with a cleaner layout: header band, info tiles, party cards, lines table, total panel.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/Audit/Utils/TrackedDownload';
import { ISSUED_BY, ISSUED_TO, SUPPORTING_TEXT, formatAmount, formatLongDate, type DebitNote } from './DebitNoteTypes';

type RGB = [number, number, number];
const C = {
  navy: [31, 56, 100] as RGB,
  navyDark: [21, 39, 72] as RGB,
  accent: [86, 140, 214] as RGB,
  accentSoft: [170, 196, 232] as RGB,
  soft: [243, 246, 251] as RGB,
  zebra: [248, 250, 253] as RGB,
  border: [221, 227, 237] as RGB,
  ink: [17, 24, 39] as RGB,
  text: [55, 65, 81] as RGB,
  grey: [107, 114, 128] as RGB,
  white: [255, 255, 255] as RGB,
};

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const hasArabic = (s: string) => ARABIC.test(s || '');

const W = 210;
const M = 18;
const CW = W - M * 2;

function font(doc: jsPDF, text: string, style: 'normal' | 'bold' | 'italic' = 'normal') {
  if (hasArabic(text)) doc.setFont('Amiri', 'normal');
  else doc.setFont('helvetica', style);
}

function smallLabel(doc: jsPDF, text: string, x: number, y: number, color: RGB = C.grey) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...color);
  doc.text(text.toUpperCase(), x, y, { charSpace: 0.5 });
}

export async function generateDebitNotePdf(note: DebitNote) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  if ([note.BODY_TEXT, ...note.LINES.map((l) => l.description)].some(hasArabic)) {
    try {
      await addArabicFont(doc);
    } catch {
      // continue without Arabic font
    }
  }
  doc.setProperties({ title: `Debit Note ${note.ID}`, author: ISSUED_BY.name });

  // ── Header band ──────────────────────────────────────────
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, W, 24, 'F');
  doc.setFillColor(...C.navyDark);
  doc.rect(0, 24, W, 1, 'F');
  doc.setFillColor(...C.accent);
  doc.rect(0, 25, W, 0.7, 'F');

  // monogram
  doc.setDrawColor(...C.accentSoft);
  doc.setLineWidth(0.5);
  doc.roundedRect(M, 5, 14, 14, 2.5, 2.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.white);
  doc.text('AM', M + 7, 13.6, { align: 'center' });

  // company
  doc.setFontSize(11);
  doc.text(ISSUED_BY.name, M + 19, 11, { charSpace: 0.3 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...C.accentSoft);
  doc.text(`${ISSUED_BY.branch}  ·  Trade License No. ${ISSUED_BY.license}`, M + 19, 16.3);

  // title (right)
  const right = (text: string, y: number, size: number, color: RGB, spacing: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const w = doc.getTextWidth(text) + spacing * (text.length - 1);
    doc.text(text, W - M - w, y, { charSpace: spacing });
  };
  right('DEBIT NOTE', 14.6, 16, C.white, 1.1);

  // ── Number & date: one line ──────────────────────────────
  let y = 32;
  const gap = 4;
  doc.setFillColor(...C.soft);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, 11, 2.5, 2.5, 'FD');
  doc.setFillColor(...C.accent);
  doc.rect(M, y + 2.5, 1.2, 6, 'F');
  const field = (label: string, value: string, x: number, alignRight = false) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    const lw = doc.getTextWidth(label.toUpperCase()) + label.length * 0.5;
    doc.setFontSize(10);
    const vw = doc.getTextWidth(value);
    const start = alignRight ? x - (lw + 3 + vw) : x;
    smallLabel(doc, label, start, y + 7.1);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.ink);
    doc.text(value, start + lw + 3, y + 7.3);
  };
  field('Debit Note No.', note.ID, M + 6);
  field('Date', formatLongDate(note.NOTE_DATE), W - M - 6, true);

  // ── Party cards ──────────────────────────────────────────
  y += 11 + 7;
  const half = (CW - gap) / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  const nameH = Math.max(
    (doc.splitTextToSize(ISSUED_BY.name, half - 10) as string[]).length,
    (doc.splitTextToSize(ISSUED_TO.name, half - 10) as string[]).length,
  );
  const cardH = 14 + nameH * 4 + 9;
  const party = (title: string, p: typeof ISSUED_BY, x: number) => {
    doc.setFillColor(...C.soft);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, half, cardH, 2.5, 2.5, 'FD');
    // chip
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    const chipW = doc.getTextWidth(title.toUpperCase()) + title.length * 0.4 + 7;
    doc.setFillColor(...C.navy);
    doc.roundedRect(x + 5, y + 4, chipW, 5.5, 2.7, 2.7, 'F');
    doc.setTextColor(...C.white);
    doc.text(title.toUpperCase(), x + 5 + chipW / 2, y + 7.7, { align: 'center', charSpace: 0.4 });
    // name
    doc.setFontSize(8.6);
    doc.setTextColor(...C.ink);
    const nameLines = doc.splitTextToSize(p.name, half - 10) as string[];
    doc.text(nameLines, x + 5, y + 15.5);
    let py = y + 15.5 + nameLines.length * 4 + 1.5;
    ([['Branch', p.branch], ['Trade License No.', p.license]] as [string, string][]).forEach(([l, v]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(...C.grey);
      doc.text(`${l}:`, x + 5, py);
      const lw = doc.getTextWidth(`${l}:`) + 1.5;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.text);
      doc.text(v, x + 5 + lw, py);
      py += 4.2;
    });
  };
  party('Issued By', ISSUED_BY, M);
  party('Issued To', ISSUED_TO, M + half + gap);
  y += cardH + 9;

  // ── Letter ──────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.ink);
  doc.text('Dear Sirs,', M, y);
  y += 5.5;
  font(doc, note.BODY_TEXT);
  doc.setFontSize(9.3);
  doc.setTextColor(...C.text);
  const body = doc.splitTextToSize(note.BODY_TEXT, CW) as string[];
  if (hasArabic(note.BODY_TEXT)) doc.text(body, W - M, y, { align: 'right' });
  else doc.text(body, M, y, { lineHeightFactor: 1.4 });
  y += body.length * 4.6 + 3;

  // ── Lines table ─────────────────────────────────────────
  const descW = CW - 14 - 36;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 24 },
    theme: 'plain',
    head: [['No.', 'Description', 'Amount (AED)']],
    body: note.LINES.map((l, i) => [String(i + 1).padStart(2, '0'), l.description, formatAmount(l.amount)]),
    styles: { font: 'helvetica', fontSize: 8.8, textColor: C.ink, cellPadding: { top: 3.2, bottom: 3.2, left: 3.5, right: 3.5 }, halign: 'center', valign: 'middle' },
    headStyles: { halign: 'center', fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 7.6, cellPadding: { top: 3, bottom: 3, left: 3.5, right: 3.5 } },
    columnStyles: { 0: { cellWidth: 14, textColor: C.accent, fontStyle: 'bold' }, 1: { cellWidth: descW }, 2: { cellWidth: 36, halign: 'center', fontStyle: 'bold' } },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      if (d.row.index % 2 === 1) d.cell.styles.fillColor = C.zebra;
      if (d.column.index === 1 && hasArabic(String(d.cell.raw ?? ''))) {
        d.cell.styles.font = 'Amiri';
        d.cell.styles.fontStyle = 'normal';
      }
    },
    didDrawCell: (d) => {
      if (d.section === 'body') {
        d.doc.setDrawColor(...C.border);
        d.doc.setLineWidth(0.25);
        d.doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ── Total panel ─────────────────────────────────────────
  const tpw = 96;
  doc.setFillColor(...C.navy);
  doc.roundedRect(W - M - tpw, y, tpw, 13, 2.5, 2.5, 'F');
  smallLabel(doc, 'Total Amount Debited', W - M - tpw + 5, y + 8, C.accentSoft);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C.white);
  doc.text(`AED ${formatAmount(note.TOTAL)}`, W - M - 5, y + 8.6, { align: 'right' });
  y += 13 + 7;

  // ── Amount in words ─────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  const words = doc.splitTextToSize(note.AMOUNT_IN_WORDS, CW - 12) as string[];
  const wh = 9 + words.length * 4.3;
  doc.setFillColor(...C.soft);
  doc.roundedRect(M, y, CW, wh, 2.5, 2.5, 'F');
  doc.setFillColor(...C.accent);
  doc.rect(M, y, 1.4, wh, 'F');
  smallLabel(doc, 'Amount in words', M + 6, y + 5.5, C.navy);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...C.ink);
  doc.text(words, M + 6, y + 10.5);
  y += wh + 7;

  // ── Supporting documents ───────────────────────────────
  smallLabel(doc, 'Supporting documents', M, y, C.navy);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.grey);
  doc.text(doc.splitTextToSize(SUPPORTING_TEXT, CW) as string[], M, y + 5);

  const fileName = `${note.ID}_Debit_Note.pdf`;
  saveTrackedPdf(doc, fileName);
  return fileName;
}
