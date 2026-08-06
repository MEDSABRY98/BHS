import autoTable from 'jspdf-autotable';
import { saveTrackedPdf } from '@/app/Audit/Utils/TrackedDownload';

export type ScrapReportPdfItem = {
  barcode?: string;
  name?: string;
  qty: number;
  unit?: string;
  reason?: string;
};

/**
 * Downloads an Inventory Scrap Report PDF named with the report serial
 * (e.g. SCR-2026-0001.pdf).
 */
export async function downloadInventoryScrapReportPDF(
  items: ScrapReportPdfItem[],
  notes: string = '',
  reportNo: string,
) {
  const jsPDFModule = await import('jspdf');
  const doc = new jsPDFModule.default({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const gold: [number, number, number] = [212, 175, 55];
  const black: [number, number, number] = [17, 17, 17];
  const gray: [number, number, number] = [85, 85, 85];

  const today = new Date();
  const fmt = (n: number) => String(n).padStart(2, '0');
  const reportDateStr = `${fmt(today.getDate())} / ${fmt(today.getMonth() + 1)} / ${today.getFullYear()}`;

  let y = 12;

  doc.setFillColor(...black);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Al Marai Al Arabia Trading — Sole Proprietorship L.L.C', pageWidth / 2, y + 4, {
    align: 'center',
  });

  doc.setTextColor(...gold);
  doc.setFontSize(10);
  doc.text('INVENTORY SCRAP REPORT', pageWidth / 2, y + 12, { align: 'center' });

  y = 36;
  doc.setTextColor(...gray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Report No.: ${reportNo}`, margin, y);
  doc.text(`Date: ${reportDateStr}`, pageWidth - margin, y, { align: 'right' });

  y += 5;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  let totalQty = 0;
  const body = items.map((item, idx) => {
    totalQty += Number(item.qty || 0);
    return [
      String(idx + 1),
      item.barcode || '—',
      item.name || 'Unknown Product',
      String(item.qty ?? 0),
      item.unit || 'PCS',
      item.reason || '—',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Barcode', 'Product Name', 'Qty', 'Unit', 'Reason']],
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
      1: { cellWidth: 32, font: 'courier', fontSize: 7 },
      2: { halign: 'center' },
      3: { cellWidth: 14, fontStyle: 'bold' },
      4: { cellWidth: 14 },
      5: { cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
    foot: [['', '', 'Total', String(totalQty), '', '']],
    footStyles: {
      fillColor: [240, 232, 208],
      textColor: black,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
    },
  });

  y = ((doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...gold);
  doc.text('REMARKS & NOTES', margin, y);
  y += 3;

  doc.setDrawColor(224, 208, 160);
  doc.setFillColor(253, 252, 248);
  const notesHeight = 18;
  doc.rect(margin, y, pageWidth - margin * 2, notesHeight, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.setFontSize(8);
  if (notes.trim()) {
    const split = doc.splitTextToSize(notes, pageWidth - margin * 2 - 6);
    doc.text(split, margin + 3, y + 5);
  }

  y += notesHeight + 14;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gold);
  doc.setFontSize(8);
  doc.text('AUTHORIZED SIGNATURES', margin, y);
  y += 8;

  const sigWidth = (pageWidth - margin * 2 - 10) / 2;
  const roles = ['Warehouse Manager', 'Finance & Admin Manager'];
  roles.forEach((role, i) => {
    const x = margin + i * (sigWidth + 10);
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
