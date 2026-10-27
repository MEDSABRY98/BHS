import autoTable from 'jspdf-autotable';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { pickSignatures } from '@/app/Components/Signatures/SignaturePicker';
import { drawSignatures } from '@/app/Components/Signatures/DrawSignatures';

export type ScrapReportPdfItem = {
  barcode?: string;
  name?: string;
  qty: number;
  cost?: number;
  unit?: string;
  reason?: string;
};

function formatScrapCost(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Downloads an Inventory Scrap Report PDF named with the report serial
 * (e.g. SCR-2026-0001.pdf).
 */
export async function downloadInventoryScrapReportPDF(
  items: ScrapReportPdfItem[],
  notes: string = '',
  reportNo: string,
  disposalMethod: string = '',
) {
  const signers = await pickSignatures('inventory-scrap', { title: 'Inventory Scrap Report' });
  if (!signers) return; // cancelled
  const jsPDFModule = await import('jspdf');
  const doc = new jsPDFModule.default({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  // text boxes grow with their text (8pt lines) instead of a fixed height
  const LINE_FACTOR = 1.35;
  const LINE_MM = 8 * LINE_FACTOR * 0.3528;
  const boxHeight = (lines: number) => Math.max(16, 5 + Math.max(lines - 1, 0) * LINE_MM + 5);
  const ensureSpace = (top: number, need: number) => {
    if (top + need + 20 > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      return 20;
    }
    return top;
  };
  const gold: [number, number, number] = [212, 175, 55];
  const black: [number, number, number] = [15, 15, 15];
  const gray: [number, number, number] = [85, 85, 85];

  const today = new Date();
  const fmt = (n: number) => String(n).padStart(2, '0');
  const reportDateStr = `${fmt(today.getDate())}/${fmt(today.getMonth() + 1)}/${today.getFullYear()}`;

  // ── Header band ──────────────────────────────────────────
  doc.setFillColor(...black);
  doc.rect(0, 0, W, 27, 'F');
  doc.setFillColor(...gold);
  doc.rect(0, 27, W, 1.4, 'F');

  // monogram
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.6);
  doc.roundedRect(M, 5, 17, 17, 3, 3, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...gold);
  doc.text('AM', M + 8.5, 16.5, { align: 'center' });

  // company block
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('ALMARAI ALARABIA TRADING', M + 22, 15.6, { charSpace: 0.4 });

  // title, right aligned
  const rightText = (text: string, yy: number, size: number, color: [number, number, number], spacing: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const w = doc.getTextWidth(text) + spacing * (text.length - 1);
    doc.text(text, W - M - w, yy, { charSpace: spacing });
  };
  rightText('SCRAP REPORT', 15, 14, gold, 0.9);
  rightText('INVENTORY', 21, 8, [255, 255, 255], 0.8);

  let y = 37;
  doc.setTextColor(...gray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Report No.: ${reportNo}`, M, y);
  doc.text(`Date: ${reportDateStr}`, W - M, y, { align: 'right' });

  y += 6;

  let totalQty = 0;
  let totalCost = 0;
  const body = items.map((item, idx) => {
    const qty = Number(item.qty || 0);
    const unitCost = Number(item.cost || 0);
    totalQty += qty;
    totalCost += qty * unitCost;
    return [
      String(idx + 1),
      item.barcode || '—',
      item.name || 'Unknown Product',
      formatScrapCost(unitCost),
      String(item.qty ?? 0),
      item.unit || 'PCS',
      item.reason || '—',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Barcode', 'Product Name', 'Cost', 'Qty', 'Unit', 'Reason']],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: black,
      textColor: gold,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      textColor: black,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 28, font: 'courier', fontSize: 7 },
      2: { halign: 'center' },
      3: { cellWidth: 20, fontStyle: 'bold' },
      4: { cellWidth: 14, fontStyle: 'bold' },
      5: { cellWidth: 12 },
      6: { cellWidth: 24 },
    },
    margin: { left: M, right: M },
    foot: [['', '', 'Total', '', String(totalQty), '', '']],
    footStyles: {
      fillColor: [240, 232, 208],
      textColor: black,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
    },
  });

  y = ((doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 8;

  const summaryH = 12;
  const contentW = W - M * 2;
  if (y + summaryH + 40 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    y = 16;
  }
  doc.setFillColor(253, 252, 248);
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.4);
  doc.rect(M, y, contentW, summaryH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...gold);
  doc.text('TOTAL SCRAP COST', M + 4, y + 7.5);
  doc.setTextColor(...black);
  doc.setFontSize(10);
  doc.text(`AED ${formatScrapCost(totalCost)}`, W - M - 4, y + 7.5, { align: 'right' });

  y += summaryH + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...gold);
  doc.text('METHOD OF DISPOSAL', M, y);
  y += 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const disposalLines: string[] = disposalMethod.trim() ? doc.splitTextToSize(disposalMethod, W - M * 2 - 6) : [];
  const disposalHeight = boxHeight(disposalLines.length);
  y = ensureSpace(y, disposalHeight);
  doc.setDrawColor(224, 208, 160);
  doc.setFillColor(253, 252, 248);
  doc.rect(M, y, W - M * 2, disposalHeight, 'FD');
  doc.setTextColor(...gray);
  if (disposalLines.length) doc.text(disposalLines, M + 3, y + 5, { lineHeightFactor: LINE_FACTOR });
  y += disposalHeight + 10;

  if (notes.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...gold);
    doc.text('REMARKS & NOTES', M, y);
    y += 3;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const noteLines: string[] = doc.splitTextToSize(notes, W - M * 2 - 6);
    const notesHeight = boxHeight(noteLines.length);
    y = ensureSpace(y, notesHeight);
    doc.setDrawColor(224, 208, 160);
    doc.setFillColor(253, 252, 248);
    doc.rect(M, y, W - M * 2, notesHeight, 'FD');
    doc.setTextColor(...gray);
    doc.text(noteLines, M + 3, y + 5, { lineHeightFactor: LINE_FACTOR });
    y += notesHeight + 10;
  }

  // ── Signatures: the people chosen when exporting ──
  y = drawSignatures(doc, signers, { y: y + 4, margin: M, heading: 'Authorized Signatures', footer: 14 });

  // ── Footer: page X of Y on every page ───────────────────
  const pages = doc.getNumberOfPages();
  const H = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(136, 136, 136);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 8, { align: 'right' });
  }

  const safeName = String(reportNo || 'Scrap_Report').replace(/[\\/:*?"<>|]+/g, '_');
  saveTrackedPdf(doc, `${safeName}.pdf`);
}
