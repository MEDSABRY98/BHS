import autoTable from 'jspdf-autotable';
import { saveTrackedPdf } from '@/app/Audit/Utils/TrackedDownload';

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
  const jsPDFModule = await import('jspdf');
  const doc = new jsPDFModule.default({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const W = doc.internal.pageSize.getWidth();
  const M = 16;
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
  doc.setFontSize(13);
  doc.text('Al Marai Al Arabia', M + 22, 11, { charSpace: 0.4 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  doc.text('Trading Sole Proprietorship L.L.C', M + 22, 16.5);

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

  doc.setDrawColor(224, 208, 160);
  doc.setFillColor(253, 252, 248);
  const disposalHeight = 16;
  doc.rect(M, y, W - M * 2, disposalHeight, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.setFontSize(8);
  if (disposalMethod.trim()) {
    const split = doc.splitTextToSize(disposalMethod, W - M * 2 - 6);
    doc.text(split, M + 3, y + 5);
  }
  y += disposalHeight + 10;

  if (notes.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...gold);
    doc.text('REMARKS & NOTES', M, y);
    y += 3;

    doc.setDrawColor(224, 208, 160);
    doc.setFillColor(253, 252, 248);
    const notesHeight = 16;
    doc.rect(M, y, W - M * 2, notesHeight, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...gray);
    doc.setFontSize(8);
    const split = doc.splitTextToSize(notes, W - M * 2 - 6);
    doc.text(split, M + 3, y + 5);
    y += notesHeight + 10;
  }

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gold);
  doc.setFontSize(8);
  doc.text('AUTHORIZED SIGNATURES', M, y);
  y += 8;

  const sigWidth = (W - M * 2 - 10) / 2;
  const roles = ['Warehouse Authority', 'Office Authority'];
  roles.forEach((role, i) => {
    const x = M + i * (sigWidth + 10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.text(role.toUpperCase(), x + sigWidth / 2, y, { align: 'center' });
    doc.setDrawColor(...black);
    doc.line(x + 5, y + 22, x + sigWidth - 5, y + 22);
    doc.setFontSize(6);
    doc.setTextColor(136, 136, 136);
    doc.text('Signature & Date', x + sigWidth / 2, y + 26, { align: 'center' });
  });

  const safeName = String(reportNo || 'Scrap_Report').replace(/[\\/:*?"<>|]+/g, '_');
  saveTrackedPdf(doc, `${safeName}.pdf`);
}
