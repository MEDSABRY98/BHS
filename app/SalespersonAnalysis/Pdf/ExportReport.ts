'use client';

// ════════════════════════════════════════════════════════════════
//  Salesperson Analysis — PDF report (Sales → Debit → Collections)
//  Same numbers as the screens (SalespersonAggregations); each table
//  shows its top 10 rows.
// ════════════════════════════════════════════════════════════════

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import {
  AGING_BUCKETS,
  Change,
  ComputeCollections,
  ComputeDebit,
  ComputeSales,
  DaysSince,
  ShiftYear,
} from '../Utils/SalespersonAggregations';
import type { AgingMode, SalespersonData } from '../Utils/Types';

const TOP = 10;

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
  greenSoft: [209, 250, 229] as RGB,
  red: [220, 38, 38] as RGB,
  redSoft: [254, 226, 226] as RGB,
  prev: [203, 213, 225] as RGB,
  white: [255, 255, 255] as RGB,
};
const BUCKET_COLORS: RGB[] = [
  [5, 150, 105],
  [212, 175, 55],
  [245, 158, 11],
  [249, 115, 22],
  [239, 68, 68],
  [153, 27, 27],
];

const money = (n: number) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = (n: number) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const shortMoney = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return whole(n);
};
const fmtDay = (iso: string) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const pct = (v: number | null) => (v === null || !Number.isFinite(v) ? 'NEW' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`);
const shortCategory = (c: string) => {
  const parts = String(c || '').split('/').map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : c;
};
const todayIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export async function ExportSalespersonReport(data: SalespersonData, agingMode: AgingMode): Promise<void> {
  const sales = ComputeSales(data);
  const debit = ComputeDebit(data, agingMode);
  const coll = ComputeCollections(data);
  const { period } = data;
  const prevEnd = ShiftYear(period.end, -1);

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
  const nameFont = hasArabic ? 'Amiri' : 'helvetica';
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const BOTTOM = H - 16;

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (style: 'normal' | 'bold' = 'normal', size = 10) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };

  // ── page header ──
  let section = 'Sales';
  const header = () => {
    setFill(C.ink);
    doc.rect(0, 0, W, 30, 'F');
    setFill(C.gold);
    doc.rect(0, 30, W, 1.2, 'F');
    doc.setFont(nameFont, 'normal');
    doc.setFontSize(17);
    setText(C.white);
    doc.text(data.salesperson.name, M, 14);
    font('normal', 9);
    setText([203, 213, 225]);
    doc.text(`${section}  •  compared with ${fmtDay(data.windowStart)} - ${fmtDay(prevEnd)}`, M, 21);
    font('bold', 9);
    setText(C.gold);
    doc.text('SALESPERSON ANALYSIS', W - M, 12, { align: 'right' });
    font('normal', 8);
    setText([203, 213, 225]);
    doc.text(`${fmtDay(period.start)}  -  ${fmtDay(period.end)}`, W - M, 18, { align: 'right' });
    doc.text(`Generated ${fmtDay(todayIso())}`, W - M, 23.5, { align: 'right' });
  };
  const newPage = (name: string) => {
    if (doc.internal.getNumberOfPages() > 1 || section !== name || doc.__used) doc.addPage();
    doc.__used = true;
    section = name;
    header();
    return 40;
  };
  let y = 0;
  const ensure = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      header();
      y = 40;
    }
  };

  const sectionTitle = (text: string, sub?: string) => {
    ensure(16);
    setFill(C.gold);
    doc.roundedRect(M, y - 4, 1.6, 6, 0.8, 0.8, 'F');
    font('bold', 12);
    setText(C.ink);
    doc.text(text, M + 4, y + 0.6);
    if (sub) {
      font('normal', 8);
      setText(C.muted);
      doc.text(sub, M + 4, y + 5.5);
    }
    y += sub ? 10 : 7;
  };

  // ── KPI cards (rows of 3) ──
  const cards = (
    list: { label: string; value: string; change?: number | null; invert?: boolean; foot?: string; accent: RGB }[],
  ) => {
    const gap = 5;
    const cw = (W - M * 2 - gap * 2) / 3;
    const ch = 30;
    for (let i = 0; i < list.length; i += 3) {
      ensure(ch + 4);
      list.slice(i, i + 3).forEach((c, j) => {
        const x = M + j * (cw + gap);
        setFill(C.white);
        setDraw(C.line);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, cw, ch, 3, 3, 'FD');
        setFill(c.accent);
        doc.roundedRect(x, y, cw, 1.8, 0.9, 0.9, 'F');
        font('bold', 7);
        setText(C.muted);
        doc.text(c.label.toUpperCase(), x + 4, y + 8);
        font('bold', c.value.length > 15 ? 12 : 14);
        setText(C.ink);
        doc.text(c.value, x + 4, y + 16.5);
        let fx = x + 4;
        if (c.change !== undefined) {
          const good = c.change === null ? null : c.invert ? c.change <= 0 : c.change >= 0;
          const badge = pct(c.change);
          font('bold', 7);
          const bw = doc.getTextWidth(badge) + 5;
          setFill(good === null ? C.goldSoft : good ? C.greenSoft : C.redSoft);
          doc.roundedRect(fx, y + 20.5, bw, 5, 2.5, 2.5, 'F');
          setText(good === null ? C.goldDark : good ? C.green : C.red);
          doc.text(badge, fx + bw / 2, y + 24, { align: 'center' });
          fx += bw + 2;
        }
        if (c.foot) {
          font('normal', 6.8);
          setText(C.muted);
          doc.text(doc.splitTextToSize(c.foot, cw - (fx - x) - 3)[0], fx, y + 24);
        }
      });
      y += ch + 4;
    }
    y += 2;
  };

  // ── grouped bars (this period vs last year, or any two series) ──
  const bars = (
    rows: { label: string; a: number; b: number }[],
    legendA: string,
    legendB: string,
    colorA: RGB = C.gold,
    colorB: RGB = C.prev,
    height = 62,
  ) => {
    ensure(height + 20);
    const lx = W - M - 70;
    [
      [legendA, colorA],
      [legendB, colorB],
    ].forEach(([label, color], i) => {
      setFill(color as RGB);
      doc.roundedRect(lx + i * 36, y - 3.2, 3.6, 3.6, 0.8, 0.8, 'F');
      font('normal', 7.5);
      setText(C.text);
      doc.text(label as string, lx + i * 36 + 5, y);
    });
    const plotX = M + 16;
    const plotY = y + 5;
    const plotW = W - M - plotX;
    const values = rows.flatMap((r) => [r.a, r.b]);
    const maxV = Math.max(0, ...values);
    const minV = Math.min(0, ...values);
    const raw = (maxV - minV) / 4 || 1;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
    const top = Math.ceil(maxV / step) * step || step;
    const bottom = Math.floor(minV / step) * step;
    const yOf = (v: number) => plotY + height - ((v - bottom) / (top - bottom)) * height;
    doc.setLineWidth(0.2);
    for (let v = bottom; v <= top + step / 2; v += step) {
      const gy = yOf(v);
      setDraw(v === 0 ? [148, 163, 184] : C.line);
      doc.line(plotX, gy, plotX + plotW, gy);
      font('normal', 6.3);
      setText(C.muted);
      doc.text(shortMoney(v), plotX - 2, gy + 1, { align: 'right' });
    }
    const slot = plotW / Math.max(rows.length, 1);
    const bw = Math.min(8, slot * 0.34);
    const zero = yOf(0);
    const bar = (x: number, v: number, color: RGB) => {
      if (!v) return;
      const y1 = yOf(v);
      const h = Math.abs(zero - y1);
      if (h < 0.2) return;
      setFill(color);
      doc.rect(x, Math.min(y1, zero), bw, h, 'F');
    };
    rows.forEach((r, i) => {
      const cx = plotX + slot * i + slot / 2;
      bar(cx - bw - 0.4, r.a, colorA);
      bar(cx + 0.4, r.b, colorB);
      font('normal', rows.length > 14 ? 5.5 : 6.8);
      setText(C.text);
      doc.text(r.label, cx, plotY + height + 4.5, { align: 'center' });
    });
    y = plotY + height + 11;
  };

  // ── single-series colored bars (aging) ──
  const bucketBars = (rows: { label: string; amount: number }[], height = 50) => {
    ensure(height + 14);
    const plotX = M + 16;
    const plotY = y;
    const plotW = W - M - plotX;
    const maxV = Math.max(1, ...rows.map((r) => Math.abs(r.amount)));
    const slot = plotW / rows.length;
    const bw = Math.min(20, slot * 0.55);
    setDraw(C.line);
    doc.setLineWidth(0.2);
    doc.line(plotX, plotY + height, plotX + plotW, plotY + height);
    rows.forEach((r, i) => {
      const cx = plotX + slot * i + slot / 2;
      const h = (Math.max(0, r.amount) / maxV) * (height - 8);
      setFill(BUCKET_COLORS[i % BUCKET_COLORS.length]);
      if (h > 0.2) doc.rect(cx - bw / 2, plotY + height - h, bw, h, 'F');
      font('bold', 6.8);
      setText(C.ink);
      doc.text(shortMoney(r.amount), cx, plotY + height - h - 1.5, { align: 'center' });
      font('normal', 7);
      setText(C.text);
      doc.text(r.label, cx, plotY + height + 4.5, { align: 'center' });
    });
    y = plotY + height + 11;
  };

  // ── tables ──
  const table = (opts: {
    title: string;
    sub?: string;
    head: string[];
    body: any[][];
    foot?: any[];
    nameCols?: number[];
    boldCols?: number[];
    colWidths?: Record<number, number>;
    didParseCell?: (d: any) => void;
  }) => {
    // keep the whole table (max 10 rows) on one page when it fits
    ensure(Math.min(BOTTOM - 40, 20 + (Math.max(opts.body.length, 1) + (opts.foot ? 2 : 1)) * 7.2));
    sectionTitle(opts.title, opts.sub);
    const columnStyles: Record<number, any> = {};
    opts.head.forEach((_, i) => {
      columnStyles[i] = { halign: 'center' };
      if (opts.nameCols?.includes(i)) columnStyles[i].font = nameFont;
      if (opts.boldCols?.includes(i)) {
        columnStyles[i].fontStyle = 'bold';
        columnStyles[i].textColor = C.ink;
      }
      if (opts.colWidths?.[i]) columnStyles[i].cellWidth = opts.colWidths[i];
    });
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      margin: { left: M, right: M, top: 40, bottom: 16 },
      head: [opts.head],
      body: opts.body.length ? opts.body : [[{ content: 'No data', colSpan: opts.head.length, styles: { textColor: C.muted } }]],
      foot: opts.foot && opts.body.length ? [opts.foot] : undefined,
      showFoot: 'lastPage',
      styles: { fontSize: 7.6, cellPadding: 2, textColor: C.text, halign: 'center', valign: 'middle', lineWidth: 0 },
      headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: 'bold', fontSize: 7.4, halign: 'center' },
      alternateRowStyles: { fillColor: C.soft },
      footStyles: { fillColor: C.goldSoft, textColor: C.ink, fontStyle: 'bold', halign: 'center' },
      columnStyles,
      didParseCell: (d: any) => {
        if (d.section === 'body') {
          d.cell.styles.lineWidth = { bottom: 0.15 };
          d.cell.styles.lineColor = C.line;
        }
        opts.didParseCell?.(d);
      },
      didDrawPage: (d: any) => {
        if (d.pageNumber > 1) header();
      },
    });
    y = doc.lastAutoTable.finalY + 9;
  };
  const growthCell = (d: any, col: number) => {
    if (d.section === 'body' && d.column.index === col) {
      const raw = String(d.cell.raw || '');
      if (raw === 'NEW') d.cell.styles.textColor = C.goldDark;
      else if (raw.startsWith('-')) d.cell.styles.textColor = C.red;
      else if (raw.startsWith('+')) d.cell.styles.textColor = C.green;
    }
  };

  // ════════════ SALES ════════════
  doc.__used = false;
  y = newPage('Sales');
  sectionTitle('Sales Overview', 'This period vs same period last year');
  cards([
    { label: 'Net Sales', value: money(sales.cur.netSales), change: Change(sales.cur.netSales, sales.prev.netSales), foot: `LY ${money(sales.prev.netSales)}`, accent: C.gold },
    { label: 'Invoices', value: whole(sales.cur.invoices), change: Change(sales.cur.invoices, sales.prev.invoices), foot: `LY ${whole(sales.prev.invoices)}`, accent: C.ink },
    { label: 'Active Customers', value: whole(sales.cur.customers), change: Change(sales.cur.customers, sales.prev.customers), foot: `LY ${whole(sales.prev.customers)}`, accent: C.green },
    { label: 'Avg Invoice', value: money(sales.avgInvoice), change: Change(sales.avgInvoice, sales.prevAvgInvoice), foot: `LY ${money(sales.prevAvgInvoice)}`, accent: C.prev },
    { label: 'Returns', value: money(sales.cur.returns), change: Change(sales.cur.returns, sales.prev.returns), invert: true, foot: `${sales.returnRate.toFixed(1)}% of gross`, accent: C.red },
    { label: 'New / Lost Customers', value: `${whole(sales.newCustomers.length)} / ${whole(sales.lostCustomers.length)}`, foot: 'New this period / lost vs last year', accent: C.ink },
  ]);
  sectionTitle('Monthly Net Sales', 'This period vs same months last year');
  bars(sales.monthly.map((m) => ({ label: m.month, a: m.current, b: m.previous })), 'This period', 'Last year');

  table({
    title: 'Sales by City',
    sub: `Top ${TOP}`,
    head: ['City', 'Net Sales', 'Share', 'Customers', 'Invoices'],
    body: sales.cities.slice(0, TOP).map((c) => [
      c.city,
      money(c.net),
      sales.cur.netSales ? `${((c.net / sales.cur.netSales) * 100).toFixed(1)}%` : '-',
      whole(c.customers),
      whole(c.invoices),
    ]),
    boldCols: [0, 1],
  });
  table({
    title: 'Top Customers',
    sub: `Top ${TOP} by net sales`,
    head: ['#', 'Customer', 'City', 'Net Sales', 'Last Year', 'Growth', 'Invoices'],
    body: sales.topCustomers.slice(0, TOP).map((c, i) => [i + 1, c.name, c.city, money(c.net), money(c.previous), pct(c.growth), whole(c.invoices)]),
    nameCols: [1],
    boldCols: [3],
    colWidths: { 0: 8, 1: 56 },
    didParseCell: (d) => growthCell(d, 5),
  });
  table({
    title: 'New Customers',
    sub: `First purchase inside the period — top ${TOP}`,
    head: ['#', 'Customer', 'City', 'First Purchase', 'Net Sales'],
    body: sales.newCustomers.slice(0, TOP).map((c, i) => [i + 1, c.name, c.city, fmtDay(c.firstPurchase), money(c.net)]),
    nameCols: [1],
    boldCols: [4],
    colWidths: { 0: 8, 1: 70 },
  });
  table({
    title: 'Lost Customers',
    sub: `Bought in the same period last year, nothing in this period — top ${TOP}`,
    head: ['#', 'Customer', 'City', 'Sales Last Year', 'Last Purchase'],
    body: sales.lostCustomers.slice(0, TOP).map((c, i) => [i + 1, c.name, c.city, money(c.previous), fmtDay(c.lastPurchase)]),
    nameCols: [1],
    boldCols: [3],
    colWidths: { 0: 8, 1: 70 },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 4) d.cell.styles.textColor = C.red;
    },
  });
  table({
    title: 'Sales by Category',
    sub: `Top ${TOP}`,
    head: ['Category', 'Net Sales', 'Share', 'Products', 'Last Year', 'Growth'],
    body: sales.categories.slice(0, TOP).map((c) => [shortCategory(c.category), money(c.net), `${c.share.toFixed(1)}%`, whole(c.products), money(c.previous), pct(c.growth)]),
    nameCols: [0],
    boldCols: [1],
    colWidths: { 0: 52 },
    didParseCell: (d) => growthCell(d, 5),
  });
  table({
    title: 'Top Products',
    sub: `Top ${TOP} by net sales`,
    head: ['#', 'Product ID', 'Barcode', 'Product', 'Category', 'Net Sales', 'Share'],
    body: sales.topProducts.slice(0, TOP).map((p, i) => [i + 1, p.id || '-', p.barcode || '-', p.name, shortCategory(p.category), money(p.net), `${p.share.toFixed(1)}%`]),
    nameCols: [3, 4],
    boldCols: [5],
    colWidths: { 0: 8, 3: 52 },
  });

  // ════════════ DEBIT ════════════
  y = newPage('Debit');
  sectionTitle('Debit Overview', `Aging by ${agingMode === 'days' ? 'days past the due date' : 'invoice month + payment term'}`);
  cards([
    { label: 'Open Debit', value: money(debit.openDebit), foot: 'His share of the balances', accent: C.gold },
    { label: 'Overdue', value: money(debit.overdue), foot: `${debit.overduePct.toFixed(1)}% of open debit`, accent: C.red },
    { label: 'Over 90 Days', value: money(debit.over90), foot: `${debit.over90Pct.toFixed(1)}% of open debit`, accent: C.ink },
    { label: 'Customers with Debit', value: whole(debit.customersCount), accent: C.prev },
  ]);
  sectionTitle('Debit Aging');
  bucketBars(debit.buckets.map((b) => ({ label: b.label, amount: b.amount })));
  table({
    title: 'Debit by City',
    sub: `Top ${TOP}`,
    head: ['City', 'Open Debit', 'Share', 'Customers'],
    body: debit.cities.slice(0, TOP).map((c) => [c.city, money(c.balance), debit.openDebit ? `${((c.balance / debit.openDebit) * 100).toFixed(1)}%` : '-', whole(c.customers)]),
    boldCols: [0, 1],
  });
  table({
    title: 'Customers Debit',
    sub: `Top ${TOP} by balance`,
    head: ['#', 'Customer', 'Balance', ...AGING_BUCKETS.map((b) => b.label), 'Last Pay'],
    body: debit.customers.slice(0, TOP).map((c, i) => [
      i + 1,
      c.name,
      money(c.balance),
      ...AGING_BUCKETS.map((b) => (Math.abs(c.aging[b.key] || 0) < 0.01 ? '-' : shortMoney(c.aging[b.key]))),
      c.lastPayment ? fmtDay(c.lastPayment) : 'Never',
    ]),
    nameCols: [1],
    boldCols: [2],
    colWidths: { 0: 7, 1: 44 },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      if (d.column.index >= 7 && d.column.index <= 8 && d.cell.raw !== '-') d.cell.styles.textColor = C.red;
      if (d.column.index === 9 && d.cell.raw === 'Never') d.cell.styles.textColor = C.red;
    },
  });

  // ════════════ COLLECTIONS ════════════
  y = newPage('Collections');
  sectionTitle('Collections Overview', 'This period vs same period last year');
  cards([
    { label: 'Net Collected', value: money(coll.cur.net), change: Change(coll.cur.net, coll.prev.net), foot: `LY ${money(coll.prev.net)}`, accent: C.gold },
    { label: 'Payments', value: whole(coll.cur.payments), change: Change(coll.cur.payments, coll.prev.payments), foot: `Avg ${money(coll.cur.avgPayment)}`, accent: C.ink },
    { label: 'Paying Customers', value: whole(coll.cur.customers), change: Change(coll.cur.customers, coll.prev.customers), foot: `LY ${whole(coll.prev.customers)}`, accent: C.green },
    { label: 'Collection Rate', value: coll.collectionRate === null ? '-' : `${coll.collectionRate.toFixed(1)}%`, foot: 'Net collected / net sales', accent: C.prev },
  ]);
  sectionTitle('Monthly Collections', 'This period vs same months last year');
  bars(coll.monthly.map((m) => ({ label: m.month, a: m.current, b: m.previous })), 'This period', 'Last year', C.gold, C.prev, 52);
  sectionTitle('Sales vs Collections', 'Net sales and net collected per month');
  bars(coll.monthly.map((m) => ({ label: m.month, a: m.sales, b: m.current })), 'Net Sales', 'Collected', C.ink, C.gold, 52);
  table({
    title: 'Collections per Customer',
    sub: `Top ${TOP} by net collected`,
    head: ['#', 'Customer', 'City', 'Net Collection', 'Payments', 'Last Payment'],
    body: coll.customers.slice(0, TOP).map((c, i) => [i + 1, c.name, c.city, money(c.net), whole(c.payments), fmtDay(c.last)]),
    nameCols: [1],
    boldCols: [3],
    colWidths: { 0: 8, 1: 64 },
  });
  table({
    title: 'Customers Who Did Not Pay',
    sub: `Balance and no payment in the period — top ${TOP}`,
    head: ['#', 'Customer', 'City', 'Balance', 'Last Payment', 'Days Since'],
    body: coll.unpaid.slice(0, TOP).map((c, i) => {
      const days = DaysSince(c.lastPayment);
      return [i + 1, c.name, c.city, money(c.balance), c.lastPayment ? fmtDay(c.lastPayment) : 'Never', days === null ? '-' : whole(days)];
    }),
    nameCols: [1],
    boldCols: [3],
    colWidths: { 0: 8, 1: 64 },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      if (d.column.index === 4 && d.cell.raw === 'Never') d.cell.styles.textColor = C.red;
      if (d.column.index === 5) {
        const days = Number(String(d.cell.raw).replace(/,/g, ''));
        if (days > 90) d.cell.styles.textColor = C.red;
        else if (days > 30) d.cell.styles.textColor = C.goldDark;
      }
    },
  });

  // ── footer ──
  const pages = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg);
    setDraw(C.line);
    doc.setLineWidth(0.2);
    doc.line(M, H - 10, W - M, H - 10);
    font('normal', 7);
    setText(C.muted);
    doc.text('Salesperson Analysis Report', M, H - 6);
    doc.text(`Page ${pg} of ${pages}`, W - M, H - 6, { align: 'right' });
  }

  const safeName = data.salesperson.name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Salesperson';
  saveTrackedPdf(doc, `${safeName}_${period.start}_${period.end}.pdf`);
}
