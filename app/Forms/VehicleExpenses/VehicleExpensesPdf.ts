'use client';

// Vehicle Expenses form — the analysis PDF (A4 portrait, same look as the other BHS form PDFs):
// totals, fuel vs maintenance split, expenses by vehicle (with share bars), highlights,
// Page X of Y.

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { formatAmount, GroupByVehicle, pct, round2, Totals, type VehicleExpenseLine } from './VehicleExpensesTypes';

type RGB = [number, number, number];
const COLORS = {
  gold: [184, 134, 11] as RGB,
  goldSoft: [212, 175, 55] as RGB,
  goldLight: [244, 233, 216] as RGB,
  black: [26, 26, 26] as RGB,
  navy: [24, 46, 86] as RGB,
  gray: [107, 107, 107] as RGB,
  lightGray: [245, 245, 245] as RGB,
  white: [255, 255, 255] as RGB,
  border: [217, 217, 217] as RGB,
  red: [190, 18, 60] as RGB,
  redSoft: [254, 226, 226] as RGB,
};

const today = () => {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

function sectionTitle(doc: any, title: string, x: number, y: number) {
  doc.setFillColor(...COLORS.gold);
  doc.rect(x, y - 4, 1.6, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.black);
  doc.text(title, x + 4, y);
}

/** room left on the page? otherwise a new page; returns the y to continue from */
function ensureSpace(doc: any, y: number, need: number): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + need > h - 18) {
    doc.addPage();
    return 16;
  }
  return y;
}

function drawHeader(doc: any, margin: number, pageWidth: number): number {
  const contentWidth = pageWidth - margin * 2;
  let y = 12;
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.7);
  doc.line(margin, y, margin + contentWidth, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...COLORS.black);
  doc.text('VEHICLE EXPENSES ANALYSIS', margin, y);
  y += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text('ALMARAI ALARABIA TRADING', margin, y);

  const value = today();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.black);
  doc.text(value, margin + contentWidth, y, { align: 'right' });
  const vw = doc.getTextWidth(value);
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.gray);
  doc.text('DATE', margin + contentWidth - vw - 2, y, { align: 'right' });
  return y + 7;
}

function drawKpis(doc: any, lines: VehicleExpenseLine[], vehicles: number, y: number, margin: number, pageWidth: number): number {
  const contentWidth = pageWidth - margin * 2;
  const t = Totals(lines);
  const boxes: [string, string, string, RGB][] = [
    ['TOTAL EXPENSES', formatAmount(t.total), 'AED', COLORS.black],
    ['FUEL', formatAmount(t.fuel), `${pct(t.fuel, t.total).toFixed(1)}% of total`, COLORS.gold],
    ['MAINTENANCE', formatAmount(t.maintenance), `${pct(t.maintenance, t.total).toFixed(1)}% of total`, COLORS.navy],
    ['VEHICLES', String(vehicles), `Avg ${formatAmount(vehicles ? round2(t.total / vehicles) : 0)} per vehicle`, COLORS.black],
  ];
  const gap = 3;
  const w = (contentWidth - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach(([label, value, sub, color], i) => {
    const x = margin + i * (w + gap);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, 19);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text(label, x + 3.5, y + 5);
    doc.setFontSize(12.5);
    doc.setTextColor(...color);
    doc.text(value, x + 3.5, y + 11.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text(sub, x + 3.5, y + 16);
  });
  y += 19 + 7;

  // fuel vs maintenance split bar
  const fuelW = contentWidth * (t.total ? t.fuel / t.total : 0);
  doc.setFillColor(...COLORS.goldSoft);
  doc.rect(margin, y, fuelW, 6, 'F');
  doc.setFillColor(...COLORS.navy);
  doc.rect(margin + fuelW, y, contentWidth - fuelW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.white);
  if (fuelW > 28) doc.text(`Fuel ${pct(t.fuel, t.total).toFixed(1)}%`, margin + 2.5, y + 4.2);
  if (contentWidth - fuelW > 34) doc.text(`Maintenance ${pct(t.maintenance, t.total).toFixed(1)}%`, margin + contentWidth - 2.5, y + 4.2, { align: 'right' });
  return y + 6 + 9;
}

function runTable(doc: any, autoTable: any, options: any) {
  if (typeof doc.autoTable === 'function') doc.autoTable(options);
  else if (typeof autoTable === 'function') autoTable(doc, options);
}

const baseStyles = {
  font: 'helvetica',
  fontSize: 8.5,
  valign: 'middle',
  halign: 'center',
  cellPadding: 2.3,
  lineColor: COLORS.border,
  lineWidth: { top: 0.2, bottom: 0.2, left: 0, right: 0 },
  overflow: 'linebreak',
};
const headStyles = { fillColor: COLORS.black, textColor: COLORS.gold, fontStyle: 'bold', fontSize: 8.2, lineWidth: 0 };
const footStyles = { fillColor: COLORS.black, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8.7, lineWidth: 0 };

/** share column: a gold bar (relative to the biggest share) + the % on the right */
function shareBar(maxShare: number) {
  return (data: any) => {
    if (data.section !== 'body' || data.column.dataKey !== 'share') return;
    const share = Number(data.cell.raw?.share ?? 0);
    const cell = data.cell;
    const barMax = cell.width - 17;
    const w = maxShare ? (barMax * share) / maxShare : 0;
    data.doc.setFillColor(...COLORS.goldLight);
    data.doc.rect(cell.x + 2, cell.y + cell.height / 2 - 1.6, barMax, 3.2, 'F');
    data.doc.setFillColor(...COLORS.goldSoft);
    data.doc.rect(cell.x + 2, cell.y + cell.height / 2 - 1.6, Math.max(0.4, w), 3.2, 'F');
    data.doc.setFont('helvetica', 'bold');
    data.doc.setFontSize(7.8);
    data.doc.setTextColor(...COLORS.black);
    data.doc.text(`${share.toFixed(1)}%`, cell.x + cell.width - 2, cell.y + cell.height / 2 + 1.2, { align: 'right' });
  };
}

function addPageNumbers(doc: any, pageWidth: number, margin: number) {
  const total = doc.getNumberOfPages();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text(`Page ${i} of ${total}`, pageWidth - margin, h - 7, { align: 'right' });
  }
}

export async function exportVehicleExpensesPdf(lines: VehicleExpenseLine[]) {
  const jsPDF = (await import('jspdf')).default;
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc: any = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: 'Vehicle Expenses Analysis' });
  await addArabicFont(doc);

  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  const vehicles = GroupByVehicle(lines);
  const t = Totals(lines);

  let y = drawHeader(doc, margin, pageWidth);
  y = drawKpis(doc, lines, vehicles.length, y, margin, pageWidth);

  // ── 1 · by vehicle ──
  sectionTitle(doc, 'Expenses by Vehicle', margin, y);
  const maxShare = Math.max(0, ...vehicles.map((v) => v.share));
  runTable(doc, autoTable, {
    startY: y + 3,
    margin: { left: margin, right: margin, bottom: 14 },
    columns: [
      { header: '#', dataKey: 'no' },
      { header: 'VEHICLE', dataKey: 'vehicle' },
      { header: 'DRIVER', dataKey: 'driver' },
      { header: 'FUEL', dataKey: 'fuel' },
      { header: 'MAINTENANCE', dataKey: 'maintenance' },
      { header: 'TOTAL', dataKey: 'total' },
      { header: 'SHARE', dataKey: 'share' },
    ],
    body: vehicles.map((v, i) => ({
      no: String(i + 1),
      vehicle: v.vehicle,
      driver: v.drivers.join(' / ') || '-',
      fuel: v.fuel ? formatAmount(v.fuel) : '-',
      maintenance: v.maintenance ? formatAmount(v.maintenance) : '-',
      total: formatAmount(v.total),
      share: { content: '', share: v.share },
    })),
    foot: [{ no: '', vehicle: 'TOTAL', driver: '', fuel: formatAmount(t.fuel), maintenance: formatAmount(t.maintenance), total: formatAmount(t.total), share: '100%' }],
    showFoot: 'lastPage',
    theme: 'plain',
    styles: baseStyles,
    headStyles,
    footStyles,
    columnStyles: {
      no: { cellWidth: 9, textColor: COLORS.gray },
      vehicle: { cellWidth: 28, font: 'Amiri', fontStyle: 'normal' },
      driver: { font: 'Amiri', fontStyle: 'normal' },
      fuel: { cellWidth: 26, textColor: COLORS.gold, fontStyle: 'bold' },
      maintenance: { cellWidth: 26, textColor: COLORS.navy, fontStyle: 'bold' },
      total: { cellWidth: 27, fontStyle: 'bold' },
      share: { cellWidth: 38 },
    },
    didParseCell: (data: any) => {
      if (data.section !== 'body') return;
      data.cell.styles.fillColor = data.row.index % 2 === 1 ? COLORS.lightGray : COLORS.white;
    },
    didDrawCell: shareBar(maxShare),
  });
  y = doc.lastAutoTable.finalY + 9;

  // ── 2 · highlights ──
  const avg = vehicles.length ? t.total / vehicles.length : 0;
  const byFuel = [...vehicles].sort((a, b) => b.fuel - a.fuel)[0];
  const byMaint = [...vehicles].sort((a, b) => b.maintenance - a.maintenance)[0];
  const above = vehicles.filter((v) => avg && v.total > avg * 1.5);
  const maintHeavy = vehicles.filter((v) => v.maintenance > v.fuel);
  const notes: string[] = [];
  if (vehicles[0]) notes.push(`Highest total: ${vehicles[0].vehicle} — ${formatAmount(vehicles[0].total)} (${vehicles[0].share.toFixed(1)}% of all expenses).`);
  if (byFuel && byFuel.fuel > 0) notes.push(`Highest fuel: ${byFuel.vehicle} — ${formatAmount(byFuel.fuel)}.`);
  if (byMaint && byMaint.maintenance > 0) notes.push(`Highest maintenance: ${byMaint.vehicle} — ${formatAmount(byMaint.maintenance)}.`);
  notes.push(`Average per vehicle: ${formatAmount(round2(avg))}.`);
  if (above.length) notes.push(`More than 50% above the average: ${above.map((v) => v.vehicle).join(', ')}.`);
  if (maintHeavy.length) notes.push(`Maintenance higher than fuel (check the vehicle condition): ${maintHeavy.map((v) => v.vehicle).join(', ')}.`);

  y = ensureSpace(doc, y, 10 + notes.length * 6);
  sectionTitle(doc, 'Highlights', margin, y);
  y += 6;
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.black);
  for (const n of notes) {
    const wrapped = doc.splitTextToSize(n, contentWidth - 6) as string[];
    y = ensureSpace(doc, y, wrapped.length * 5);
    doc.setFillColor(...COLORS.gold);
    doc.circle(margin + 1.5, y - 1.2, 0.8, 'F');
    doc.text(wrapped, margin + 5, y);
    y += wrapped.length * 5 + 1;
  }
  y += 5;


  addPageNumbers(doc, pageWidth, margin);
  saveTrackedPdf(doc, `Vehicle_Expenses_${new Date().toISOString().slice(0, 10)}.pdf`);
}
