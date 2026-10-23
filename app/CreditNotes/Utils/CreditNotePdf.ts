'use client';

// One-page Credit Note PDF (approved design):
// white header with navy/gold hairline, number/date/currency strip, From / To cards,
// letter text, lines table, amount in words + totals box, attachments note.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { HEADER_NAME, ISSUED_BY, ISSUED_TO, SUPPORTING_TEXT, FIXED_SIGNERS, cleanSigners, formatAmount, formatLongDate, type CreditNote } from './CreditNoteTypes';

type RGB = [number, number, number];
const C = {
  navy: [24, 46, 86] as RGB,
  accent: [196, 160, 82] as RGB, // muted gold
  soft: [245, 247, 251] as RGB,
  zebra: [250, 251, 253] as RGB,
  border: [222, 227, 236] as RGB,
  ink: [17, 24, 39] as RGB,
  text: [55, 65, 81] as RGB,
  grey: [110, 117, 130] as RGB,
  white: [255, 255, 255] as RGB,
};

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const hasArabic = (s: string) => ARABIC.test(s || '');

const W = 210;
const M = 16;
const CW = W - M * 2;

export async function generateCreditNotePdf(note: CreditNote) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  if ([note.BODY_TEXT, ...note.LINES.map((l) => l.description)].some(hasArabic)) {
    try {
      await addArabicFont(doc);
    } catch {
      // continue without Arabic font
    }
  }
  doc.setProperties({ title: `Credit Note ${note.ID}`, author: HEADER_NAME });

  const label = (t: string, x: number, y: number, c: RGB = C.grey, size = 6.6) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(...c);
    doc.text(t.toUpperCase(), x, y, { charSpace: 0.55 });
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
  doc.text(HEADER_NAME, M + 19, 19, { charSpace: 0.3 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...C.grey);
  doc.text(`${ISSUED_BY.branch}  ·  Trade License No. ${ISSUED_BY.license}`, M + 19, 24.5);

  // ── Title (right) ────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.navy);
  const title = 'CREDIT NOTE';
  const sp = 1.4;
  doc.text(title, W - M - (doc.getTextWidth(title) + sp * (title.length - 1)), 21, { charSpace: sp });

  // ── Number / Date / Currency strip ──────────────────────
  let y = 36;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.setFillColor(...C.soft);
  doc.roundedRect(M, y, CW, 15, 2.5, 2.5, 'FD');
  const cols: [string, string][] = [
    ['Credit Note No.', note.ID],
    ['Date', formatLongDate(note.NOTE_DATE)],
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

  // ── From / To cards ─────────────────────────────────────
  y += 15 + 7;
  const half = (CW - 5) / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  const nameRows = Math.max(
    (doc.splitTextToSize(ISSUED_BY.name, half - 12) as string[]).length,
    (doc.splitTextToSize(ISSUED_TO.name, half - 12) as string[]).length,
  );
  const cardH = 22 + nameRows * 4.1;
  const party = (tag: string, p: typeof ISSUED_BY, x: number) => {
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.setFillColor(...C.white);
    doc.roundedRect(x, y, half, cardH, 2.5, 2.5, 'FD');
    doc.setFillColor(...C.navy);
    doc.rect(x, y + 4, 1.4, cardH - 8, 'F');
    label(tag, x + 6, y + 6.5, C.accent, 6.8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(...C.ink);
    const nl = doc.splitTextToSize(p.name, half - 12) as string[];
    doc.text(nl, x + 6, y + 12);
    let py = y + 12 + nl.length * 4.1 + 1.5;
    ([['Branch', p.branch], ['Trade License No.', p.license]] as [string, string][]).forEach(([l, v]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(...C.grey);
      doc.text(`${l}:`, x + 6, py);
      const lw = doc.getTextWidth(`${l}:`) + 1.5;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.text);
      doc.text(v, x + 6 + lw, py);
      py += 4.1;
    });
  };
  party('From', ISSUED_BY, M);
  party('To', ISSUED_TO, M + half + 5);
  y += cardH + 9;

  // ── Letter ──────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.ink);
  doc.text('Dear,', M, y);
  y += 5.5;
  if (hasArabic(note.BODY_TEXT)) doc.setFont('Amiri', 'normal');
  else doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(...C.text);
  const body = doc.splitTextToSize(note.BODY_TEXT, CW) as string[];
  if (hasArabic(note.BODY_TEXT)) doc.text(body, W - M, y, { align: 'right' });
  else doc.text(body, M, y, { lineHeightFactor: 1.45 });
  y += body.length * 4.7 + 3;

  // ── Lines table ─────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 16 },
    theme: 'plain',
    head: [['No.', 'Description', 'Amount (AED)']],
    body: note.LINES.map((l, i) => [String(i + 1).padStart(2, '0'), l.description, formatAmount(l.amount)]),
    styles: { font: 'helvetica', fontSize: 8.8, textColor: C.ink, halign: 'center', valign: 'middle', cellPadding: { top: 3.4, bottom: 3.4, left: 3, right: 3 } },
    headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 7.6, halign: 'center' },
    columnStyles: { 0: { cellWidth: 14, textColor: C.accent, fontStyle: 'bold' }, 1: { cellWidth: CW - 14 - 38 }, 2: { cellWidth: 38, fontStyle: 'bold' } },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      if (d.row.index % 2 === 1) d.cell.styles.fillColor = C.zebra;
      if (d.column.index === 1 && hasArabic(String(d.cell.raw ?? ''))) {
        d.cell.styles.font = 'Amiri';
        d.cell.styles.fontStyle = 'normal';
      }
    },
    didDrawCell: (d) => {
      if (d.section !== 'body') return;
      d.doc.setDrawColor(...C.border);
      d.doc.setLineWidth(0.25);
      d.doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
    },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ── Amount in words (left) + totals (right) ─────────────
  const tw = 78;
  const tx = W - M - tw;
  const ww = CW - tw - 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.8);
  const words = doc.splitTextToSize(note.AMOUNT_IN_WORDS, ww - 12) as string[];
  const boxH = Math.max(26, 14 + words.length * 4.2);

  doc.setDrawColor(...C.border);
  doc.setFillColor(...C.soft);
  doc.roundedRect(tx, y, tw, boxH, 2.5, 2.5, 'FD');
  const sub = (l: string, v: string, yy: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    doc.setTextColor(...C.text);
    doc.text(l, tx + 5, yy);
    doc.text(v, W - M - 5, yy, { align: 'right' });
  };
  sub('Lines', String(note.LINES.length), y + 6.5);
  sub('Subtotal (AED)', formatAmount(note.TOTAL), y + 12);
  doc.setFillColor(...C.navy);
  doc.roundedRect(tx, y + boxH - 11, tw, 11, 2.5, 2.5, 'F');
  label('Total Credited', tx + 5, y + boxH - 4.2, C.accent, 6.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...C.white);
  doc.text(`AED ${formatAmount(note.TOTAL)}`, W - M - 5, y + boxH - 3.7, { align: 'right' });

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

  // ── Attachments note ────────────────────────────────────
  doc.setFillColor(...C.accent);
  doc.circle(M + 1.2, y - 1.1, 0.9, 'F');
  label('Attachments', M + 4, y, C.navy, 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.4);
  doc.setTextColor(...C.grey);
  doc.text(SUPPORTING_TEXT, M + 4 + doc.getTextWidth('ATTACHMENTS') + 10, y);

  // ── Signatures: chosen optional ones + Accounts Department · CEO (bottom of the page) ──
  const PH = 297;
  let sy = Math.max(y + 22, PH - 48);
  if (sy > PH - 30) {
    doc.addPage();
    sy = 40;
  }
  const signers = [...cleanSigners(note.EXTRA_SIGNERS), ...FIXED_SIGNERS];
  const gap = signers.length > 2 ? 10 : 24;
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
    doc.text('Signature & Date', x, sy + 25);
  });

  const fileName = `${note.ID}_Credit_Note.pdf`;
  saveTrackedPdf(doc, fileName);
  return fileName;
}
