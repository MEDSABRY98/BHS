'use client';

// Discount Values — PDF of the Values tab.
// Two sections: monthly customers, then non-monthly (settled with payment).
// Inside each section the customers are grouped by city, then sorted by name.

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/Audit/Utils/TrackedDownload';

export type DiscountValuesPdfRow = {
  customerName: string;
  city: string;
  monthly: boolean;
  discountPercent: number;
  netSales: number;
  discountValue: number;
  rent: number;
};

type RGB = [number, number, number];
const INK: RGB = [15, 23, 42];
const TEXT: RGB = [51, 65, 85];
const GOLD: RGB = [212, 175, 55];
const GOLD_SOFT: RGB = [253, 246, 220];
const GOLD_DARK: RGB = [184, 134, 11];
const PURPLE: RGB = [126, 34, 206];
const GREEN: RGB = [4, 120, 87];
const MUTED: RGB = [100, 116, 139];
const SOFT: RGB = [248, 250, 252];
const CITY_BG: RGB = [241, 245, 249];
const LINE: RGB = [226, 232, 240];

// same column widths for every table (portrait A4: 210 - 2 x 12 mm = 186 mm)
const NUM_W = (186 - 9 - 50) / 6;
const WIDTHS: Record<number, { cellWidth: number }> = {
  0: { cellWidth: 9 },
  1: { cellWidth: 50 },
  2: { cellWidth: NUM_W },
  3: { cellWidth: NUM_W },
  4: { cellWidth: NUM_W },
  5: { cellWidth: NUM_W },
  6: { cellWidth: NUM_W },
  7: { cellWidth: NUM_W },
};
const withWidths = (styles: Record<number, Record<string, unknown>>) => {
  const out: Record<number, Record<string, unknown>> = {};
  for (let i = 0; i < 8; i++) out[i] = { ...WIDTHS[i], ...(styles[i] || {}) };
  return out;
};

const money = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => `${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
const share = (part: number, total: number) => (total > 0 ? pct((part / total) * 100) : '0%');
const dmy = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};
const byCityThenName = (a: DiscountValuesPdfRow, b: DiscountValuesPdfRow) =>
  (a.city || 'Unknown').localeCompare(b.city || 'Unknown') || a.customerName.localeCompare(b.customerName);

export async function exportDiscountValuesPdf(
  rows: DiscountValuesPdfRow[],
  dateFrom: string,
  dateTo: string,
  rentMonths: number,
): Promise<void> {
  if (!rows.length) return;
  const jsPDF = (await import('jspdf')).default;
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc: any = new jsPDF('p', 'mm', 'a4');
  let hasArabic = true;
  try {
    await addArabicFont(doc);
  } catch {
    hasArabic = false;
  }
  const AR = /[؀-ۿ]/;
  const shape = (t: string) => {
    if (!hasArabic || !AR.test(t)) return t;
    try {
      return typeof doc.processArabic === 'function' ? doc.processArabic(t) : t;
    } catch {
      return t;
    }
  };

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;

  const totals = rows.reduce(
    (a, r) => ({ net: a.net + r.netSales, disc: a.disc + r.discountValue, rent: a.rent + r.rent }),
    { net: 0, disc: 0, rent: 0 },
  );

  // ── header band ──
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 24, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 24, W, 1.1, 'F');
  doc.rect(0, 0, 3.2, 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('Discount Values', M, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `From ${dmy(dateFrom)} to ${dmy(dateTo)}${rentMonths > 1 ? `  ·  Rent for ${rentMonths} months` : ''}`,
    M,
    19,
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('CUSTOMERS DISCOUNTS', W - M, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  const t = new Date();
  doc.text(
    `Generated ${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`,
    W - M,
    19,
    { align: 'right' },
  );

  // ── summary cards ──
  const cards: [string, string, RGB][] = [
    ['Customers', String(rows.length), INK],
    ['Net sales (AED)', money(totals.net), INK],
    ['Discount value (AED)', money(totals.disc), GOLD_DARK],
    ['Rent (AED)', money(totals.rent), PURPLE],
  ];
  const gap = 5;
  const cw = (W - M * 2 - gap * (cards.length - 1)) / cards.length;
  cards.forEach(([label, value, color], i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, 31, cw, 17, 2.5, 2.5, 'FD');
    doc.setFillColor(...(i === 2 ? GOLD : i === 3 ? PURPLE : INK));
    doc.roundedRect(x, 31, cw, 1.5, 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 4, 37.5);
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.text(value, x + 4, 44.5);
  });

  const head = [['#', 'Customer', 'Disc. %', 'Net Sales', 'Disc. Value', 'D %', `Rent${rentMonths > 1 ? ` (${rentMonths} mo)` : ''}`, 'R %']];
  let y = 56;

  const sections: { title: string; note: string; list: DiscountValuesPdfRow[] }[] = [
    { title: 'Monthly Customers', note: 'Settled every month', list: rows.filter((r) => r.monthly).sort(byCityThenName) },
    { title: 'Non-Monthly Customers', note: 'Settled with payment', list: rows.filter((r) => !r.monthly).sort(byCityThenName) },
  ];

  const filled = sections.filter((x) => x.list.length);
  for (const section of filled) {
    const isLast = section === filled[filled.length - 1];
    const withGrand = isLast && filled.length > 1;
    if (y > H - 40) {
      doc.addPage();
      y = 16;
    }

    // section title
    doc.setFillColor(...GOLD);
    doc.roundedRect(M, y, 1.8, 7, 0.9, 0.9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(section.title, M + 5, y + 5.3);
    const titleW = doc.getTextWidth(section.title);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${section.note}  ·  ${section.list.length} customers`, M + 9 + titleW, y + 5.3);
    y += 10;

    // body with a city row before each city group
    type Meta = { kind: 'city'; city: string } | { kind: 'row'; row: DiscountValuesPdfRow };
    const meta: Meta[] = [];
    const body: any[] = [];
    let currentCity: string | null = null;
    let n = 0;
    for (const r of section.list) {
      const city = r.city || 'Unknown';
      if (city !== currentCity) {
        currentCity = city;
        const count = section.list.filter((x) => (x.city || 'Unknown') === city).length;
        meta.push({ kind: 'city', city });
        body.push([{ content: `${shape(city)}  (${count})`, colSpan: 8 }]);
      }
      n += 1;
      meta.push({ kind: 'row', row: r });
      body.push([
        String(n),
        shape(r.customerName),
        pct(r.discountPercent),
        money(r.netSales),
        money(r.discountValue),
        share(r.discountValue, totals.disc),
        money(r.rent),
        share(r.rent, totals.rent),
      ]);
    }

    const sub = section.list.reduce(
      (a, r) => ({ net: a.net + r.netSales, disc: a.disc + r.discountValue, rent: a.rent + r.rent }),
      { net: 0, disc: 0, rent: 0 },
    );

    autoTable(doc, {
      startY: y,
      theme: 'plain',
      margin: { left: M, right: M, top: 16, bottom: 14 },
      head,
      body,
      foot: [
        [
          '',
          `Total (${section.list.length})`,
          '',
          money(sub.net),
          money(sub.disc),
          share(sub.disc, totals.disc),
          money(sub.rent),
          share(sub.rent, totals.rent),
        ],
        // last section also carries the grand total of both sections
        ...(withGrand
          ? [['', `Grand total (${rows.length})`, '', money(totals.net), money(totals.disc), '100%', money(totals.rent), totals.rent > 0 ? '100%' : '0%']]
          : []),
      ],
      showHead: 'everyPage',
      showFoot: 'lastPage',
      styles: { fontSize: 7.5, cellPadding: { top: 1.8, bottom: 1.8, left: 1, right: 1 }, textColor: TEXT, halign: 'center', valign: 'middle', lineWidth: 0 },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center', cellPadding: 2.6 },
      footStyles: { fillColor: GOLD_SOFT, textColor: INK, fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: { top: 2.6, bottom: 2.6, left: 1, right: 1 } },
      columnStyles: withWidths({
        1: { fontStyle: 'bold', textColor: INK },
        2: { textColor: GREEN, fontStyle: 'bold' },
        4: { fontStyle: 'bold', textColor: GOLD_DARK },
        6: { fontStyle: 'bold', textColor: PURPLE },
      }),
      didParseCell: (d: any) => {
        if (d.section === 'foot' && d.row.index === 1) {
          d.cell.styles.fillColor = INK;
          d.cell.styles.textColor = d.column.index === 4 ? GOLD : d.column.index === 6 ? [216, 180, 254] : [255, 255, 255];
        }
        if (d.section !== 'body') return;
        const m = meta[d.row.index];
        if (!m) return;
        if (m.kind === 'city') {
          d.cell.styles.fillColor = CITY_BG;
          d.cell.styles.textColor = INK;
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.halign = 'center';
          d.cell.styles.fontSize = 8;
          if (hasArabic && AR.test(m.city)) d.cell.styles.font = 'Amiri';
          return;
        }
        d.cell.styles.lineWidth = { bottom: 0.15 };
        d.cell.styles.lineColor = LINE;
        if (d.column.index === 1 && hasArabic && AR.test(m.row.customerName)) d.cell.styles.font = 'Amiri';
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // page numbers
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, H - 9, W - M, H - 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('Discount Values', M, H - 5);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 5, { align: 'right' });
  }

  saveTrackedPdf(doc, `Discount_Values_${dateFrom}_to_${dateTo}.pdf`);
}
