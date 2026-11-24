'use client';

// Supplier Clearance PDF — same look as the Supplier Payment form: navy/gold header, date / period /
// strip, supplier card, the checkpoint table (grouped, Yes / No + remarks),
// the decision, the responsibility statement, notes and signatures.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { pickSignatures } from '@/app/Components/Signatures/SignaturePicker';
import { drawSignatures, signaturesHeight } from '@/app/Components/Signatures/DrawSignatures';
import { listSignatories } from '@/app/Components/Signatures/SignatureService';
import type { Signer } from '@/app/Components/Signatures/SignatureTypes';
import { COMPANY_NAME, formatLongDate } from '../Shared/FormsUtils';
import { answerLabel, decisionLabel, type ClearanceDecision, type SupplierClearance } from './SupplierClearanceTypes';

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
  green: [21, 128, 61] as RGB,
  red: [185, 28, 28] as RGB,
  amber: [180, 110, 10] as RGB,
};
const DECISION_COLOR: Record<ClearanceDecision, RGB> = { cleared: C.green, conditional: C.amber, 'not-cleared': C.red };

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const hasArabic = (s: string) => ARABIC.test(s || '');

const W = 210;
const PH = 297;
const M = 16;
const CW = W - M * 2;

const RESPONSIBILITY =
  'By signing, the Warehouse Manager and the Supply Chain Manager confirm that the checkpoints above were verified, ' +
  'and they accept the responsibility for the supplier clearance decision recorded in this form.';

export async function generateSupplierClearancePdf(form: SupplierClearance) {
  // the people offered when exporting: the two managers who take the responsibility
  let list: { TITLE: string; NAME: string; IS_ACTIVE: boolean }[] = [];
  try {
    list = await listSignatories();
  } catch {
    // names stay blank to write by hand
  }
  const find = (re: RegExp) => list.find((p) => p.IS_ACTIVE && re.test(p.TITLE))?.NAME || '';
  const suggested: Signer[] = [
    { title: 'Warehouse Manager', name: find(/warehouse\s*manager|store\s*manager/i) },
    { title: 'Supply Chain Manager', name: find(/supply\s*chain\s*manager/i) },
  ];
  const signers = await pickSignatures('supplier-clearance', { title: 'Supplier Clearance', suggested });
  if (!signers) return null; // cancelled

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  if ([form.SUPPLIER_NAME, form.NOTES, ...form.ITEMS.map((i) => i.REMARK)].some(hasArabic)) {
    try {
      await addArabicFont(doc);
    } catch {
      // continue without the Arabic font
    }
  }
  doc.setProperties({ title: `Supplier Clearance — ${form.SUPPLIER_NAME}`, author: COMPANY_NAME });

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
  doc.text('Forms  ·  Supplier Clearance', M + 19, 24.5);

  // ── Title (right) ────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...C.navy);
  const sp = 1;
  const t1 = 'SUPPLIER';
  const t2 = 'CLEARANCE';
  doc.text(t1, W - M - (doc.getTextWidth(t1) + sp * (t1.length - 1)), 18.5, { charSpace: sp });
  doc.text(t2, W - M - (doc.getTextWidth(t2) + sp * (t2.length - 1)), 25, { charSpace: sp });

  // ── Date + Supplier in one row (the name gets the wider box) ──
  let y = 36;
  const rowH = 19;
  const dateW = 50;
  const gapW = 6;
  const supW = CW - dateW - gapW;

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.setFillColor(...C.soft);
  doc.roundedRect(M, y, dateW, rowH, 2.5, 2.5, 'FD');
  label('Date', M + 6, y + 6.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.6);
  doc.setTextColor(...C.ink);
  doc.text(formatLongDate(form.DATE), M + 6, y + 13.8);

  const sx = M + dateW + gapW;
  doc.setDrawColor(...C.border);
  doc.setFillColor(...C.white);
  doc.roundedRect(sx, y, supW, rowH, 2.5, 2.5, 'FD');
  doc.setFillColor(...C.navy);
  doc.rect(sx, y + 4, 1.4, rowH - 8, 'F');
  label('Supplier', sx + 6, y + 6.5, C.accent, 6.8);
  textFont(form.SUPPLIER_NAME, 'bold');
  doc.setTextColor(...C.ink);
  // a long name is made smaller to fit on one line (down to 8 pt), then cut
  let nameSize = 11.5;
  doc.setFontSize(nameSize);
  while (nameSize > 8 && doc.getTextWidth(form.SUPPLIER_NAME) > supW - 12) {
    nameSize -= 0.5;
    doc.setFontSize(nameSize);
  }
  const nameShown = doc.splitTextToSize(form.SUPPLIER_NAME, supW - 12)[0];
  if (hasArabic(form.SUPPLIER_NAME)) doc.text(nameShown, sx + supW - 6, y + 13.8, { align: 'right' });
  else doc.text(nameShown, sx + 6, y + 13.8);
  y += rowH + 8;

  // ── Checkpoints table (grouped by section) ──────────────
  const body: any[][] = [];
  let section = '';
  let n = 0;
  form.ITEMS.forEach((it) => {
    if (it.SECTION !== section) {
      section = it.SECTION;
      body.push([{ content: section.toUpperCase(), colSpan: 4, styles: { fillColor: C.navy, textColor: C.accent, fontStyle: 'bold', fontSize: 7.4, halign: 'left', cellPadding: { top: 1.8, bottom: 1.8, left: 3, right: 2 } } }]);
    }
    n += 1;
    body.push([String(n), it.TEXT, answerLabel(it.ANSWER).toUpperCase(), it.REMARK || '']);
  });
  autoTable(doc, {
    theme: 'plain',
    startY: y,
    margin: { left: M, right: M, top: 22, bottom: 22 },
    head: [['#', 'Checkpoint', 'Result', 'Remarks']],
    body,
    styles: { font: 'helvetica', fontSize: 8.4, valign: 'middle', cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 }, textColor: C.ink, lineColor: C.border },
    headStyles: { fillColor: C.soft, textColor: C.grey, fontStyle: 'bold', fontSize: 7, halign: 'center' },
    columnStyles: { 0: { cellWidth: 9, halign: 'center' }, 1: { cellWidth: 82 }, 2: { cellWidth: 18, halign: 'center' }, 3: { cellWidth: 'auto', halign: 'center' } },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      const raw = String(d.cell.raw ?? '');
      if (d.column.index === 2 && d.cell.colSpan === 1) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.textColor = raw === 'YES' ? C.green : raw === 'NO' ? C.red : C.grey;
      }
      if (d.column.index === 3 && hasArabic(raw)) {
        d.cell.styles.font = 'Amiri';
        d.cell.styles.fontStyle = 'normal';
        d.cell.styles.halign = 'center';
      }
    },
    didDrawCell: (d) => {
      if (d.section === 'body' && d.cell.colSpan === 1) {
        d.doc.setDrawColor(...C.border);
        d.doc.setLineWidth(0.15);
        d.doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
      }
    },
  });
  y = ((doc as any).lastAutoTable.finalY as number) + 8;

  // ── Closing block: decision + notes + responsibility + signatures stay together ──
  // (measured first; when they do not fit under the table they all start on a new page)
  const hasNotes = !!form.NOTES.trim();
  textFont(form.NOTES);
  doc.setFontSize(9.2);
  const noteLines = hasNotes ? (doc.splitTextToSize(form.NOTES.trim(), CW - 12) as string[]) : [];
  const noteLineH = 9.2 * 1.45 * 0.3528;
  const notesH = hasNotes ? Math.max(14, 8 + noteLines.length * noteLineH + 3) : 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  const resp = doc.splitTextToSize(RESPONSIBILITY, CW - 12) as string[];
  const respH = 12 + resp.length * 3.9;
  const decisionH = 14 + 7;
  const notesBlockH = hasNotes ? 3 + notesH + 7 : 0;
  const closingH = decisionH + notesBlockH + respH + 6 + signaturesHeight(doc, signers) + 6;
  if (y + closingH > PH - 16) {
    doc.addPage();
    y = 26;
  }

  // Decision
  const tone = DECISION_COLOR[form.DECISION];
  doc.setFillColor(...tone);
  doc.roundedRect(M, y, CW, 14, 2.5, 2.5, 'F');
  label('Decision', M + 6, y + 5.6, C.white, 6.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C.white);
  doc.text(decisionLabel(form.DECISION), M + 6, y + 11.2);
  y += decisionH;

  // Notes (only when written)
  if (hasNotes) {
    label('Notes', M, y, C.navy, 7);
    y += 3;
    textFont(form.NOTES);
    doc.setFontSize(9.2);
    doc.setDrawColor(...C.border);
    doc.setFillColor(...C.white);
    doc.roundedRect(M, y, CW, notesH, 2.5, 2.5, 'FD');
    doc.setTextColor(...C.text);
    if (hasArabic(form.NOTES)) doc.text(noteLines, W - M - 6, y + 7, { align: 'right', lineHeightFactor: 1.45 });
    else doc.text(noteLines, M + 6, y + 7, { lineHeightFactor: 1.45 });
    y += notesH + 7;
  }

  // Responsibility statement
  doc.setDrawColor(...C.border);
  doc.setFillColor(...C.soft);
  doc.roundedRect(M, y, CW, respH, 2.5, 2.5, 'FD');
  doc.setFillColor(...C.accent);
  doc.rect(M, y + 4, 1.2, respH - 8, 'F');
  label('Responsibility', M + 6, y + 6, C.navy, 6.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(...C.text);
  doc.text(resp, M + 6, y + 11.2);
  y += respH + 6;

  // Signatures: the people chosen when exporting (bottom of the page)
  drawSignatures(doc, signers, { y, margin: M, bottom: true, footer: 16 });

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
  const fileName = `Supplier_Clearance_${safeName || 'Supplier'}_${form.DATE}.pdf`;
  saveTrackedPdf(doc, fileName);
  return fileName;
}
