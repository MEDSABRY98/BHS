'use client';

// ════════════════════════════════════════════════════════════════
//  Customers Aging — PDF reports (landscape A4)
//  Same visual language as the Salesperson reports: dark header band
//  with a gold line, KPI cards, a stacked aging bar, clean striped tables.
//  Every table is sorted by debt (largest first).
// ════════════════════════════════════════════════════════════════

import { addArabicFont } from '@/app/Components/Pdf/shared';

type AgesRow = {
  customerName: string;
  cities: string[];
  atDate: number;
  oneToThirty: number;
  thirtyOneToSixty: number;
  sixtyOneToNinety: number;
  ninetyOneToOneTwenty: number;
  older: number;
  total: number;
};
type AgesTagRow = AgesRow & { customerTags: string[] };

type RGB = [number, number, number];
const C = {
  ink: [15, 23, 42] as RGB,
  text: [51, 65, 85] as RGB,
  muted: [100, 116, 139] as RGB,
  line: [226, 232, 240] as RGB,
  soft: [248, 250, 252] as RGB,
  gold: [212, 175, 55] as RGB,
  goldDark: [184, 134, 11] as RGB,
  goldSoft: [253, 246, 220] as RGB,
  green: [5, 150, 105] as RGB,
  red: [220, 38, 38] as RGB,
  redDark: [153, 27, 27] as RGB,
  orange: [234, 88, 12] as RGB,
  white: [255, 255, 255] as RGB,
  light: [203, 213, 225] as RGB,
};
// 0-30 (includes not yet due), 31-60, 61-90, 91-120, Older
const BUCKETS: { label: string; key: keyof AgesRow; color: RGB }[] = [
  { label: '0 - 30', key: 'oneToThirty', color: [5, 150, 105] },
  { label: '31 - 60', key: 'thirtyOneToSixty', color: [212, 175, 55] },
  { label: '61 - 90', key: 'sixtyOneToNinety', color: [249, 115, 22] },
  { label: '91 - 120', key: 'ninetyOneToOneTwenty', color: [239, 68, 68] },
  { label: 'Older', key: 'older', color: [153, 27, 27] },
];
const COMPANY = 'Al Marai Al Arabia Trading';

const money = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cell = (n: number) => (Math.abs(Number(n) || 0) < 0.005 ? '-' : money(n));
const todayText = () => {
  const t = new Date();
  return `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`;
};

const sumRows = (rows: AgesRow[]) =>
  rows.reduce(
    (a, r) => ({
      total: a.total + r.total,
      atDate: a.atDate + r.atDate,
      oneToThirty: a.oneToThirty + r.oneToThirty,
      thirtyOneToSixty: a.thirtyOneToSixty + r.thirtyOneToSixty,
      sixtyOneToNinety: a.sixtyOneToNinety + r.sixtyOneToNinety,
      ninetyOneToOneTwenty: a.ninetyOneToOneTwenty + r.ninetyOneToOneTwenty,
      older: a.older + r.older,
    }),
    { total: 0, atDate: 0, oneToThirty: 0, thirtyOneToSixty: 0, sixtyOneToNinety: 0, ninetyOneToOneTwenty: 0, older: 0 },
  );
type Totals = ReturnType<typeof sumRows>;

type Section = { label: string; rows: AgesRow[]; keepOrder?: boolean };
type SummaryRow = { label: string; customers: number } & Totals;

async function buildAgesDoc(args: {
  sections: Section[];
  summaryTitle?: string; // e.g. 'Summary by City'
  summaryLabelHead?: string; // 'City' | 'Tag'
  filterDescription: string;
  agingLabel?: string;
}) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc: any = new jsPDF('l', 'mm', 'a4');
  let hasArabic = true;
  try {
    await addArabicFont(doc);
  } catch {
    hasArabic = false;
  }
  const nameFont = hasArabic ? 'Amiri' : 'helvetica';
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const TOP = 32; // first page (full header)
  const TOP2 = 18; // every other page (slim label)

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (style: 'normal' | 'bold' = 'normal', size = 10) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };

  let heading = '';
  // full dark header only on the very first page; the other pages get just a slim section label
  const slimHeader = () => {
    setFill(C.gold);
    doc.roundedRect(M, 6, 1.6, 6, 0.8, 0.8, 'F');
    doc.setFont(nameFont, 'normal');
    doc.setFontSize(11);
    setText(C.ink);
    doc.text(heading, M + 4, 10.8);
    font('normal', 7.5);
    setText(C.muted);
    doc.text(`As of ${todayText()}${args.agingLabel ? `   |   Aging: ${args.agingLabel}` : ''}`, W - M, 10.5, { align: 'right' });
    setDraw(C.line);
    doc.setLineWidth(0.2);
    doc.line(M, 14, W - M, 14);
  };
  const header = () => {
    if (doc.internal.getCurrentPageInfo().pageNumber > 1) return slimHeader();
    setFill(C.ink);
    doc.rect(0, 0, W, 24, 'F');
    setFill(C.gold);
    doc.rect(0, 24, W, 1.1, 'F');
    font('bold', 16);
    setText(C.white);
    doc.text('Customers Aging Report', M, 11.5);
    doc.setFont(nameFont, 'normal');
    doc.setFontSize(10);
    setText(C.gold);
    doc.text(heading, M, 18.5);
    font('bold', 9);
    setText(C.gold);
    doc.text(COMPANY, W - M, 10, { align: 'right' });
    font('normal', 8);
    setText(C.light);
    doc.text(`As of ${todayText()}${args.agingLabel ? `   |   Aging: ${args.agingLabel}` : ''}`, W - M, 15.5, { align: 'right' });
    if (args.filterDescription) doc.text(`Filter: ${args.filterDescription}`, W - M, 20, { align: 'right' });
  };
  const newPage = (title: string) => {
    if (doc.__used) doc.addPage('a4', 'l');
    doc.__used = true;
    heading = title;
    header();
  };

  // ── KPI cards ──
  const cards = (list: { label: string; value: string; foot?: string; accent: RGB; arabic?: boolean }[], y: number) => {
    const gap = 5;
    const cw = (W - M * 2 - gap * (list.length - 1)) / list.length;
    const ch = 24;
    list.forEach((c, i) => {
      const x = M + i * (cw + gap);
      setFill(C.white);
      setDraw(C.line);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cw, ch, 3, 3, 'FD');
      setFill(c.accent);
      doc.roundedRect(x, y, cw, 1.8, 0.9, 0.9, 'F');
      font('bold', 7);
      setText(C.muted);
      doc.text(c.label.toUpperCase(), x + 4, y + 7.5);
      if (c.arabic) doc.setFont(nameFont, 'normal');
      else doc.setFont('helvetica', 'bold');
      doc.setFontSize(c.value.length > 22 ? 11 : 14);
      setText(C.ink);
      doc.text(doc.splitTextToSize(c.value, cw - 8)[0], x + 4, y + 15);
      if (c.foot) {
        font('normal', 7);
        setText(C.muted);
        doc.text(doc.splitTextToSize(c.foot, cw - 8)[0], x + 4, y + 20.5);
      }
    });
    return y + ch + 5;
  };

  // ── stacked aging bar + legend ──
  const agingBar = (t: Totals, y: number) => {
    const pos = BUCKETS.map((b) => Math.max(0, Number(t[b.key as keyof Totals]) || 0));
    const all = pos.reduce((a, v) => a + v, 0) || 1;
    const bw = W - M * 2;
    font('bold', 8);
    setText(C.ink);
    doc.text('Aging Distribution', M, y);
    y += 3;
    let x = M;
    pos.forEach((v, i) => {
      const w = (v / all) * bw;
      if (w < 0.2) return;
      setFill(BUCKETS[i].color);
      doc.rect(x, y, w, 5, 'F');
      x += w;
    });
    y += 9.5;
    const slot = bw / BUCKETS.length;
    BUCKETS.forEach((b, i) => {
      const lx = M + i * slot;
      setFill(b.color);
      doc.roundedRect(lx, y - 3, 3.4, 3.4, 0.8, 0.8, 'F');
      font('bold', 7.5);
      setText(C.ink);
      doc.text(b.label, lx + 5, y);
      font('normal', 7.5);
      setText(C.muted);
      doc.text(`${money(Number(t[b.key as keyof Totals]) || 0)}  (${((pos[i] / all) * 100).toFixed(1)}%)`, lx + 5, y + 4.2);
    });
    return y + 11;
  };

  const bucketColor = (i: number, raw: string): RGB | null => {
    if (raw === '-') return null;
    if (i === 2) return C.orange;
    if (i === 3) return C.red;
    if (i === 4) return C.redDark;
    return null;
  };

  // ── customers table ──
  const customersTable = (rows: AgesRow[], startY: number, startPage: number) => {
    const t = sumRows(rows);
    const body = rows.map((r, i) => [
      String(i + 1),
      r.customerName,
      r.cities.join(', ') || '',
      cell(r.total),
      ...BUCKETS.map((b) => cell(Number(r[b.key]) || 0)),
    ]);
    autoTable(doc, {
      startY,
      theme: 'plain',
      margin: { left: M, right: M, top: TOP2, bottom: 14 },
      head: [['#', 'Customer Name', 'City', 'Total Debit', ...BUCKETS.map((b) => b.label)]],
      body,
      foot: [['', 'TOTAL', '', money(t.total), ...BUCKETS.map((b) => money(Number(t[b.key as keyof Totals]) || 0))]],
      showFoot: 'lastPage',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: C.text, halign: 'center', valign: 'middle', lineWidth: 0 },
      headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: 'bold', fontSize: 8, halign: 'center' },
      alternateRowStyles: { fillColor: C.soft },
      footStyles: { fillColor: C.goldSoft, textColor: C.ink, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { font: nameFont, fontStyle: 'normal', halign: 'center', textColor: C.ink },
        2: { cellWidth: 38, font: nameFont },
        3: { cellWidth: 34, fontStyle: 'bold', textColor: C.ink },
        4: { cellWidth: 27 },
        5: { cellWidth: 27 },
        6: { cellWidth: 27 },
        7: { cellWidth: 27 },
        8: { cellWidth: 27 },
      },
      didParseCell: (d: any) => {
        if (d.section === 'body') {
          d.cell.styles.lineWidth = { bottom: 0.15 };
          d.cell.styles.lineColor = C.line;
          if (d.column.index >= 4) {
            const col = bucketColor(d.column.index - 4, String(d.cell.raw));
            if (col) d.cell.styles.textColor = col;
          }
        }
        
        if (d.section === 'foot' && d.column.index >= 4) {
          const col = bucketColor(d.column.index - 4, 'x');
          if (col) d.cell.styles.textColor = col;
        }
      },
      didDrawPage: (d: any) => {
        if (d.pageNumber !== startPage) header();
      },
    });
  };

  // ── one section = cards + aging bar + customers table ──
  args.sections.forEach((sec) => {
    const rows = sec.keepOrder ? sec.rows : [...sec.rows].sort((a, b) => b.total - a.total);
    newPage(sec.label);
    const t = sumRows(rows);
    const over90 = t.ninetyOneToOneTwenty + t.older;
    const top = rows[0];
    let y = cards(
      [
        { label: 'Total Debit', value: money(t.total), foot: 'Net debit of the customers below', accent: C.gold },
        { label: 'Customers', value: String(rows.length), foot: 'With a balance in this report', accent: C.ink },
        { label: 'Over 90 Days', value: money(over90), foot: `${t.total ? ((over90 / t.total) * 100).toFixed(1) : '0.0'}% of total debit`, accent: C.red },
        { label: 'Largest Debtor', value: top ? top.customerName : '-', foot: top ? money(top.total) : undefined, accent: C.green, arabic: true },
      ],
      doc.internal.getNumberOfPages() === 1 ? TOP - 2 : TOP2 - 1,
    );
    y = agingBar(t, y + 2);
    customersTable(rows, y, doc.internal.getNumberOfPages());
  });

  // ── summary page ──
  if (args.summaryTitle && args.sections.length > 0) {
    const summary: SummaryRow[] = args.sections
      .map((s) => ({ label: s.label, customers: s.rows.length, ...sumRows(s.rows) }))
      .sort((a, b) => b.total - a.total);
    const grand = summary.reduce((a, s) => a + s.total, 0) || 1;
    const gt = sumRows(summary as any);
    newPage(args.summaryTitle);
    const startPage = doc.internal.getNumberOfPages();
    autoTable(doc, {
      startY: doc.internal.getNumberOfPages() === 1 ? TOP - 2 : TOP2 - 1,
      theme: 'plain',
      margin: { left: M, right: M, top: TOP2, bottom: 14 },
      head: [['#', args.summaryLabelHead || 'Group', 'Customers', 'Total Debit', ...BUCKETS.map((b) => b.label), 'Share']],
      body: summary.map((s, i) => [
        String(i + 1),
        s.label,
        String(s.customers),
        cell(s.total),
        ...BUCKETS.map((b) => cell(Number(s[b.key as keyof Totals]) || 0)),
        '',
      ]),
      foot: [
        [
          '',
          'GRAND TOTAL',
          String(summary.reduce((a, s) => a + s.customers, 0)),
          money(gt.total),
          ...BUCKETS.map((b) => money(Number(gt[b.key as keyof Totals]) || 0)),
          '',
        ],
      ],
      showFoot: 'lastPage',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.6, textColor: C.text, halign: 'center', valign: 'middle', lineWidth: 0 },
      headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
      alternateRowStyles: { fillColor: C.soft },
      footStyles: { fillColor: C.goldSoft, textColor: C.ink, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { font: nameFont, halign: 'center', textColor: C.ink },
        2: { cellWidth: 25 },
        3: { cellWidth: 32, fontStyle: 'bold', textColor: C.ink },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 25 },
        7: { cellWidth: 25 },
        8: { cellWidth: 25 },
        9: { cellWidth: 34 },
      },
      didParseCell: (d: any) => {
        if (d.section === 'body') {
          d.cell.styles.lineWidth = { bottom: 0.15 };
          d.cell.styles.lineColor = C.line;
          if (d.column.index >= 4 && d.column.index <= 8) {
            const col = bucketColor(d.column.index - 4, String(d.cell.raw));
            if (col) d.cell.styles.textColor = col;
          }
        }
        
      },
      didDrawCell: (d: any) => {
        if (d.section !== 'body' || d.column.index !== 9) return;
        const s = summary[d.row.index];
        const share = Math.max(0, s.total) / grand;
        const bx = d.cell.x + 2.5;
        const bwid = d.cell.width - 5 - 11;
        const by = d.cell.y + d.cell.height / 2 - 1.2;
        setFill(C.line);
        doc.roundedRect(bx, by, bwid, 2.4, 1.2, 1.2, 'F');
        if (share > 0.004) {
          setFill(C.gold);
          doc.roundedRect(bx, by, Math.max(1.6, bwid * share), 2.4, 1.2, 1.2, 'F');
        }
        font('bold', 7);
        setText(C.ink);
        doc.text(`${(share * 100).toFixed(1)}%`, d.cell.x + d.cell.width - 2.5, by + 2.1, { align: 'right' });
      },
      didDrawPage: (d: any) => {
        if (d.pageNumber !== startPage) header();
      },
    });
  }

  // ── footer on every page ──
  const pages = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg);
    setDraw(C.line);
    doc.setLineWidth(0.2);
    doc.line(M, H - 10, W - M, H - 10);
    font('normal', 7);
    setText(C.muted);
    doc.text('Customers Aging Report', M, H - 5.5);
    doc.text(`Page ${pg} of ${pages}`, W - M, H - 5.5, { align: 'right' });
  }
  return doc.output('blob') as Blob;
}

/** One section per city (largest debt first inside each) + a summary page by city. */
export async function generateAgesPDF(filteredData: AgesRow[], filterDescription: string = 'All Customers', agingLabel?: string) {
  const groups = new Map<string, AgesRow[]>();
  filteredData.forEach((item) => {
    const key = item.cities.join(', ') || 'No City';
    groups.set(key, [...(groups.get(key) || []), item]);
  });
  const sections = Array.from(groups.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((city) => ({ label: `City: ${city}`, rows: groups.get(city)! }));
  const blob = await buildAgesDoc({ sections: sections.map((s) => ({ ...s })), summaryTitle: 'Summary by City', summaryLabelHead: 'City', filterDescription, agingLabel });
  return blob;
}

/** A single list (all customers / without tags / ...) sorted by debt. */
export async function generateSingleRegionAgesPDF(regionName: string, regionData: AgesRow[], filterDescription: string = 'All Customers', agingLabel?: string, sortByCity = false) {
  // sortByCity: city A-Z first, then the debt (largest first) inside each city
  const rows = sortByCity
    ? [...regionData].sort((a, b) => (a.cities.join(', ') || 'No City').localeCompare(b.cities.join(', ') || 'No City') || b.total - a.total)
    : regionData;
  return buildAgesDoc({ sections: [{ label: regionName, rows, keepOrder: sortByCity }], filterDescription, agingLabel });
}

/** One section per customer tag (sorted by debt) + a summary page by tag. */
export async function generateCombinedTagsAgesPDF(filteredData: AgesTagRow[], filterDescription: string = 'All Tagged Customers', agingLabel?: string) {
  const groups = new Map<string, AgesRow[]>();
  filteredData.forEach((item) => (item.customerTags || []).forEach((tag) => groups.set(tag, [...(groups.get(tag) || []), item])));
  const sections = Array.from(groups.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => ({ label: `Tag: ${tag}`, rows: groups.get(tag)! }));
  return buildAgesDoc({ sections, summaryTitle: 'Summary by Tag', summaryLabelHead: 'Tag', filterDescription, agingLabel });
}
