'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf, trackFileDownload } from '@/app/Audit/Utils/TrackedDownload';
import { COMPANY, VOUCHER_LABELS, formatAED, linesTotal, type CashVoucher } from './voucherTypes';

type RGB = [number, number, number];
const C = {
  ink: [15, 15, 15] as RGB,
  ink2: [38, 38, 38] as RGB,
  gold: [212, 175, 55] as RGB,
  goldDark: [168, 134, 30] as RGB,
  goldSoft: [251, 248, 238] as RGB,
  goldLine: [233, 217, 163] as RGB,
  slate500: [100, 116, 139] as RGB,
  slate400: [148, 163, 184] as RGB,
  slate200: [226, 232, 240] as RGB,
  slate100: [241, 245, 249] as RGB,
  white: [255, 255, 255] as RGB,
};

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const hasArabic = (s: string) => ARABIC.test(s || '');

function fmtDate(d: string): string {
  if (!d) return '—';
  const p = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  return Number.isNaN(p.getTime()) ? d : p.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Draws text in Helvetica, or Amiri (right aligned inside the box) when it contains Arabic. */
function smartText(doc: jsPDF, text: string, x: number, y: number, width: number, size: number, bold = true): number {
  const value = text || '—';
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

function label(doc: jsPDF, text: string, x: number, y: number, color: RGB = C.slate500) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...color);
  doc.text(text.toUpperCase(), x, y, { charSpace: 0.6 });
}

function infoBox(doc: jsPDF, title: string, value: string, x: number, y: number, w: number, h = 16) {
  doc.setDrawColor(...C.slate200);
  doc.setFillColor(...C.white);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  label(doc, title, x + 4, y + 5.5);
  doc.setTextColor(...C.ink);
  smartText(doc, value, x + 4, y + 11.8, w - 8, 11);
}

export type VoucherPdfOptions = {
  signature?: string | null;   // base64 image of the signing user
  printedBy?: string;
  mode?: 'download' | 'print';
};

export async function generateVoucherPdf(v: CashVoucher, opts: VoucherPdfOptions = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  try {
    await addArabicFont(doc);
  } catch {
    // Arabic font is only needed for Arabic names; continue without it
  }

  const L = VOUCHER_LABELS[v.TYPE];
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = W - M * 2;

  // ── Header band ──────────────────────────────────────────
  doc.setFillColor(...C.ink);
  doc.rect(0, 0, W, 27, 'F');
  doc.setFillColor(...C.gold);
  doc.rect(0, 27, W, 1.4, 'F');

  // monogram
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.6);
  doc.roundedRect(M, 5, 17, 17, 3, 3, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.gold);
  doc.text('AM', M + 8.5, 16.5, { align: 'center' });

  // company block (two lines so it never runs into the title)
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(COMPANY.shortName, M + 22, 11, { charSpace: 0.4 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.slate200);
  doc.text('Trading Sole Proprietorship L.L.C', M + 22, 16.5);

  // title, right aligned (manual width so letter spacing doesn't overflow)
  const rightText = (text: string, yy: number, size: number, color: RGB, spacing: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const w = doc.getTextWidth(text) + spacing * (text.length - 1);
    doc.text(text, W - M - w, yy, { charSpace: spacing });
  };
  rightText(L.title, 12, 14, C.gold, 0.9);
  rightText(v.TYPE === 'IN' ? 'CASH IN' : 'CASH OUT', 18, 7, C.white, 0.8);

  // ── Info boxes ───────────────────────────────────────────
  let y = 37;
  const gap = 4;
  const bw = (CW - gap * 2) / 3;
  infoBox(doc, 'Voucher No.', v.ID, M, y, bw);
  infoBox(doc, 'Date', fmtDate(v.DATE), M + bw + gap, y, bw);
  infoBox(doc, 'Payment Method', v.REFERENCE ? `${v.PAYMENT_METHOD} · ${v.REFERENCE}` : v.PAYMENT_METHOD || 'Cash', M + (bw + gap) * 2, y, bw);
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
  doc.text(formatAED(v.AMOUNT), M + 8, y + 18);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...C.ink2);
  const words = doc.splitTextToSize(v.AMOUNT_IN_WORDS || '', CW - 16) as string[];
  doc.text(words.slice(0, 2), M + 8, y + 24.5);
  y += 30 + 9;

  // ── Parties ──────────────────────────────────────────────
  const half = (CW - 8) / 2;
  const drawField = (title: string, value: string, x: number, w: number) => {
    label(doc, title, x, y);
    doc.setTextColor(...C.ink);
    const h = smartText(doc, value, x, y + 7, w, 12.5);
    doc.setDrawColor(...C.ink);
    doc.setLineWidth(0.35);
    doc.line(x, y + 9 + Math.max(h - 4.5, 0), x + w, y + 9 + Math.max(h - 4.5, 0));
    return 9 + Math.max(h - 4.5, 0);
  };
  const h1 = drawField(L.party, v.PARTY, M, v.VIA ? half : CW);
  const h2 = v.VIA ? drawField(L.via, v.VIA, M + half + 8, half) : 0;
  y += Math.max(h1, h2) + 9;

  // ── Description ──────────────────────────────────────────
  if (v.DESCRIPTION) {
    label(doc, 'Description', M, y);
    y += 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const desc = hasArabic(v.DESCRIPTION) ? null : (doc.splitTextToSize(v.DESCRIPTION, CW - 10) as string[]);
    const lineCount = desc ? desc.length : Math.ceil(v.DESCRIPTION.length / 90) + 1;
    const boxH = Math.max(14, lineCount * 5 + 8);
    doc.setFillColor(...C.slate100);
    doc.roundedRect(M, y, CW, boxH, 2, 2, 'F');
    doc.setTextColor(...C.ink2);
    if (desc) doc.text(desc, M + 5, y + 7);
    else smartText(doc, v.DESCRIPTION, M + 5, y + 7, CW - 10, 10, false);
    y += boxH + 8;
  }

  // ── Invoices table ───────────────────────────────────────
  const lines = v.LINES || [];
  if (lines.length) {
    const withAmounts = lines.some((l) => Number(l.amount) > 0);
    const withParty = lines.some((l) => l.party);
    label(doc, `Invoices (${lines.length})`, M, y);
    y += 2.5;
    const head = [['#', 'Invoice No.', ...(withParty ? ['Customer'] : []), ...(withAmounts ? ['Amount'] : [])]];
    const body = lines.map((l, i) => [
      String(i + 1),
      l.ref,
      ...(withParty ? [l.party || ''] : []),
      ...(withAmounts ? [l.amount ? formatAED(l.amount) : ''] : []),
    ]);
    const foot = withAmounts
      ? [['', 'Total', ...(withParty ? [''] : []), formatAED(linesTotal(lines))]]
      : undefined;

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 24 },
      showFoot: 'lastPage',
      head,
      body,
      foot,
      theme: 'plain',
      styles: { halign: 'center', font: 'helvetica', fontSize: 9, cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 3 }, textColor: C.ink, lineColor: C.slate200, lineWidth: { bottom: 0.2 } as any },
      headStyles: { halign: 'center', fillColor: C.ink, textColor: C.gold, fontStyle: 'bold', fontSize: 8 },
      footStyles: { halign: 'center', fillColor: C.goldSoft, textColor: C.ink, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 10, textColor: C.slate500 } },
      didParseCell: (data) => {
        const raw = String(data.cell.raw ?? '');
        if (data.section === 'body' && hasArabic(raw)) {
          data.cell.styles.font = 'Amiri';
          data.cell.styles.fontStyle = 'normal';
          data.cell.styles.halign = 'center';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Signatures (kept at the bottom of the last page) ─────
  const sigTop = Math.max(y, H - 62);
  if (sigTop > H - 62) {
    doc.addPage();
  }
  const sy = sigTop > H - 62 ? H - 62 : sigTop;
  const sw = (CW - 20) / 2;
  const sign = (title: string, name: string, x: number, image?: string | null) => {
    label(doc, title, x, sy);
    if (image) {
      try {
        doc.addImage(image, 'PNG', x + 4, sy + 3, 42, 18);
      } catch {
        // ignore a broken signature image
      }
    }
    doc.setDrawColor(...C.ink);
    doc.setLineWidth(0.35);
    doc.line(x, sy + 24, x + sw, sy + 24);
    doc.setTextColor(...C.ink);
    smartText(doc, name || ' ', x, sy + 29.5, sw, 9.5);
  };
  const ourSide = v.CREATED_BY || opts.printedBy || '';
  sign(L.signLeft, ourSide, M, opts.signature);
  sign(L.signRight, v.TYPE === 'IN' ? (v.VIA || v.PARTY) : v.PARTY, M + sw + 20);

  // ── Footer on every page ─────────────────────────────────
  const pages = doc.getNumberOfPages();
  const printed = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...C.gold);
    doc.rect(M, H - 16, CW, 0.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.slate500);
    doc.text(`System generated voucher · ${v.ID} · Printed ${printed}${opts.printedBy ? ` by ${opts.printedBy}` : ''}`, M, H - 10.5);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 10.5, { align: 'right' });
  }

  const fileName = `${v.ID}_${(v.PARTY || '').replace(/[^\w؀-ۿ -]+/g, '').trim().slice(0, 40) || 'voucher'}.pdf`;
  if (opts.mode === 'print') {
    const url = doc.output('bloburl');
    window.open(url as unknown as string, '_blank');
    trackFileDownload(fileName);
  } else {
    saveTrackedPdf(doc, fileName);
  }
  return fileName;
}
