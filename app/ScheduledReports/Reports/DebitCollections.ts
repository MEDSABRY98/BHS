// ════════════════════════════════════════════════════════════════
//  Scheduled Reports — Debit & Collections report (one file: the PDF + the email).
//  Same numbers and layout as the Debit / Collections pages of the salesperson PDF.
//  • one salesperson  → his Debit page + his Collections page
//  • all salespersons → summary (one row per salesperson) + the company Debit and
//    Collections, then one PDF per salesperson in the same email
//  Data: SalespersonAnalysis/Service/SalespersonData.ts
// ════════════════════════════════════════════════════════════════

import {
  AGING_BUCKETS,
  Change,
  ComputeCollections,
  ComputeDebit,
  DaysSince,
  ShiftYear,
} from '@/app/SalespersonAnalysis/Utils/SalespersonAggregations';
import type { AgingMode, Period, SalespersonData } from '@/app/SalespersonAnalysis/Utils/Types';
import { BuildSalespersonData, LoadSalespersonInputs } from '@/app/SalespersonAnalysis/Service/SalespersonData';
import { listAllSalespersons } from '@/app/SalespersonAnalysis/Service/DailyReportData';
import { addArabicFontServer } from '../Server/ServerFont';
import { attachmentName, change, esc, money as moneyText, periodText, type Builder } from './Shared';

const TOP = 10;
export const ALL_SALESPERSONS_ID = '__ALL__';

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

const money = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
const rateText = (v: number | null) => (v === null || !Number.isFinite(v) ? '-' : `${v.toFixed(1)}%`);
const todayIso = () => {
  const t = new Date(Date.now() + 4 * 3600_000); // Dubai day (same on the server and in the UAE browser)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

/** All salespersons together (their shares add up to the company's ledger). */
export function MergeSalespersonData(list: SalespersonData[], period: Period): SalespersonData {
  const lastPaymentByCustomer: Record<string, string> = {};
  for (const d of list) {
    for (const [name, day] of Object.entries(d.lastPaymentByCustomer)) {
      if (!lastPaymentByCustomer[name] || day > lastPaymentByCustomer[name]) lastPaymentByCustomer[name] = day;
    }
  }
  return {
    salesperson: { id: ALL_SALESPERSONS_ID, name: 'All Salespersons' },
    period,
    windowStart: list[0]?.windowStart || ShiftYear(period.start, -1),
    showCosts: list.every((d) => d.showCosts),
    sales: list.flatMap((d) => d.sales),
    customers: Object.assign({}, ...list.map((d) => d.customers)),
    products: Object.assign({}, ...list.map((d) => d.products)),
    ledger: list.flatMap((d) => d.ledger),
    lastPaymentByCustomer,
  };
}

/** Debit older than 120 days (the 120+ aging bucket). */
const over120Of = (debit: ReturnType<typeof ComputeDebit>) => debit.buckets.find((b) => b.key === 'older')?.amount || 0;

/** The numbers of one section (also used for the email summary). */
export function DebitCollectionsTotals(data: SalespersonData, agingMode: AgingMode = 'days') {
  const debit = ComputeDebit(data, agingMode);
  const coll = ComputeCollections(data);
  return {
    openDebit: debit.openDebit,
    overdue: debit.overdue,
    overduePct: debit.overduePct,
    over120: over120Of(debit),
    over120Pct: debit.openDebit ? (over120Of(debit) / debit.openDebit) * 100 : 0,
    debitCustomers: debit.customersCount,
    netCollected: coll.cur.net,
    prevNetCollected: coll.prev.net,
    payments: coll.cur.payments,
    payingCustomers: coll.cur.customers,
    collectionRate: coll.collectionRate,
    unpaidCustomers: coll.unpaid.length,
  };
}

const isEmpty = (d: SalespersonData) => !d.ledger.length;

/**
 * sections: one per salesperson. allSalespersons = the summary + company pages first.
 * addFont: loads the Arabic font (Amiri) into the doc — throw if it can't (names fall back to helvetica).
 */
export async function BuildDebitCollectionsReportPdf(
  input: {
    period: Period;
    sections: SalespersonData[];
    allSalespersons: boolean;
    agingMode?: AgingMode;
    /** false = all salespersons: the summary + company pages only (each salesperson in his own PDF) */
    includeSections?: boolean;
  },
  addFont: (doc: any) => Promise<void>,
): Promise<{ doc: any; fileName: string }> {
  const { period } = input;
  const agingMode: AgingMode = input.agingMode || 'days';
  const sections = input.sections.filter((d) => !isEmpty(d));
  const prevEnd = ShiftYear(period.end, -1);
  const windowStart = ShiftYear(period.start, -1);

  const jsPDF = (await import('jspdf')).default;
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc: any = new jsPDF('p', 'mm', 'a4');
  let hasArabic = true;
  try {
    await addFont(doc);
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

  // ── page header (owner = whose numbers these are) ──
  let owner = '';
  let section = '';
  const header = () => {
    setFill(C.ink);
    doc.rect(0, 0, W, 30, 'F');
    setFill(C.gold);
    doc.rect(0, 30, W, 1.2, 'F');
    doc.setFont(/[؀-ۿ]/.test(owner) ? nameFont : 'helvetica', /[؀-ۿ]/.test(owner) ? 'normal' : 'bold');
    doc.setFontSize(17);
    setText(C.white);
    doc.text(owner, M, 14);
    font('normal', 9);
    setText([203, 213, 225]);
    doc.text(section === 'Summary' ? 'Summary by salesperson' : `${section}  •  compared with ${fmtDay(windowStart)} - ${fmtDay(prevEnd)}`, M, 21);
    font('bold', 9);
    setText(C.gold);
    doc.text('DEBIT & COLLECTIONS', W - M, 12, { align: 'right' });
    font('normal', 8);
    setText([203, 213, 225]);
    doc.text(`${fmtDay(period.start)}  -  ${fmtDay(period.end)}`, W - M, 18, { align: 'right' });
    doc.text(`Generated ${fmtDay(todayIso())}`, W - M, 23.5, { align: 'right' });
  };
  let started = false;
  const newPage = (who: string, name: string) => {
    if (started) doc.addPage();
    started = true;
    owner = who;
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
  const cards = (list: { label: string; value: string; change?: number | null; invert?: boolean; foot?: string; accent: RGB }[]) => {
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

  // ── grouped bars (two series) ──
  const bars = (rows: { label: string; a: number; b: number }[], legendA: string, legendB: string, colorA: RGB, colorB: RGB, height = 52) => {
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
          // Arabic text needs the Arabic font (helvetica can't draw it)
          if (/[؀-ۿ]/.test(String(d.cell.raw ?? ''))) {
            d.cell.styles.font = nameFont;
            d.cell.styles.fontStyle = 'normal';
          }
        }
        opts.didParseCell?.(d);
      },
      didDrawPage: (d: any) => {
        if (d.pageNumber > 1) header();
      },
    });
    y = doc.lastAutoTable.finalY + 9;
  };

  // ════════════ one salesperson (or the company): Debit page + Collections page ════════════
  const drawSection = (data: SalespersonData) => {
    const who = data.salesperson.name;
    const debit = ComputeDebit(data, agingMode);
    const coll = ComputeCollections(data);

    // ── DEBIT ──
    y = newPage(who, 'Debit');
    sectionTitle('Debit Overview', `Aging by ${agingMode === 'days' ? 'days past the due date' : 'invoice month + payment term'} — as of today`);
    cards([
      { label: 'Open Debit', value: money(debit.openDebit), foot: data.salesperson.id === ALL_SALESPERSONS_ID ? 'All customers balances' : 'His share of the balances', accent: C.gold },
      { label: 'Overdue', value: money(debit.overdue), foot: `${debit.overduePct.toFixed(1)}% of open debit`, accent: C.red },
      { label: 'Over 120 Days', value: money(over120Of(debit)), foot: `${(debit.openDebit ? (over120Of(debit) / debit.openDebit) * 100 : 0).toFixed(1)}% of open debit`, accent: C.ink },
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
      sub: `All ${debit.customers.length} customer${debit.customers.length === 1 ? '' : 's'} with a balance, by balance`,
      head: ['#', 'Customer', 'Balance', ...AGING_BUCKETS.map((b) => b.label), 'Last Pay'],
      foot: ['', 'Total', money(debit.openDebit), ...debit.buckets.map((b) => (Math.abs(b.amount) < 0.01 ? '-' : shortMoney(b.amount))), ''],
      body: debit.customers.map((c, i) => [
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

    // ── COLLECTIONS ──
    y = newPage(who, 'Collections');
    sectionTitle('Collections Overview', 'This period vs same period last year');
    cards([
      { label: 'Net Collected', value: money(coll.cur.net), change: Change(coll.cur.net, coll.prev.net), foot: `LY ${money(coll.prev.net)}`, accent: C.gold },
      { label: 'Payments', value: whole(coll.cur.payments), change: Change(coll.cur.payments, coll.prev.payments), foot: `Avg ${money(coll.cur.avgPayment)}`, accent: C.ink },
      { label: 'Paying Customers', value: whole(coll.cur.customers), change: Change(coll.cur.customers, coll.prev.customers), foot: `LY ${whole(coll.prev.customers)}`, accent: C.green },
      { label: 'Collection Rate', value: rateText(coll.collectionRate), foot: 'Net collected / net sales', accent: C.prev },
    ]);
    sectionTitle('Monthly Collections', 'This period vs same months last year');
    bars(coll.monthly.map((m) => ({ label: m.month, a: m.current, b: m.previous })), 'This period', 'Last year', C.gold, C.prev);
    sectionTitle('Sales vs Collections', 'Net sales and net collected per month');
    bars(coll.monthly.map((m) => ({ label: m.month, a: m.sales, b: m.current })), 'Net Sales', 'Collected', C.ink, C.gold);
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
  };

  // ════════════ ALL SALESPERSONS: summary + company pages ════════════
  if (input.allSalespersons && sections.length) {
    const all = MergeSalespersonData(sections, period);
    const t = DebitCollectionsTotals(all, agingMode);
    const rows = sections
      .map((d) => ({ name: d.salesperson.name, t: DebitCollectionsTotals(d, agingMode) }))
      .sort((a, b) => b.t.openDebit - a.t.openDebit);

    y = newPage('All Salespersons', 'Summary');
    sectionTitle('Company Overview', 'Debit as of today · collections in the period');
    cards([
      { label: 'Open Debit', value: money(t.openDebit), foot: `${whole(t.debitCustomers)} customers`, accent: C.gold },
      { label: 'Overdue', value: money(t.overdue), foot: `${t.overduePct.toFixed(1)}% of open debit`, accent: C.red },
      { label: 'Over 120 Days', value: money(t.over120), foot: `${t.over120Pct.toFixed(1)}% of open debit`, accent: C.ink },
      { label: 'Net Collected', value: money(t.netCollected), change: Change(t.netCollected, t.prevNetCollected), foot: `LY ${money(t.prevNetCollected)}`, accent: C.gold },
      { label: 'Payments', value: whole(t.payments), foot: `${whole(t.payingCustomers)} paying customers`, accent: C.ink },
      { label: 'Collection Rate', value: rateText(t.collectionRate), foot: 'Net collected / net sales', accent: C.prev },
    ]);
    table({
      title: 'By Salesperson',
      sub: 'Sorted by open debit',
      head: ['#', 'Salesperson', 'Open Debit', 'Overdue', 'Over 120', 'Net Collected', 'Payments', 'Coll. Rate'],
      body: rows.map((r, i) => [
        i + 1,
        r.name,
        money(r.t.openDebit),
        money(r.t.overdue),
        money(r.t.over120),
        money(r.t.netCollected),
        whole(r.t.payments),
        rateText(r.t.collectionRate),
      ]),
      foot: ['', 'Total', money(t.openDebit), money(t.overdue), money(t.over120), money(t.netCollected), whole(t.payments), rateText(t.collectionRate)],
      nameCols: [1],
      boldCols: [2, 5],
      colWidths: { 0: 7, 1: 42 },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 4 && String(d.cell.raw) !== '0.00') d.cell.styles.textColor = C.red;
      },
    });

    drawSection(all);
  }

  // ════════════ one section per salesperson ════════════
  if (input.includeSections !== false) for (const d of sections) drawSection(d);

  if (!started) {
    y = newPage(input.sections[0]?.salesperson.name || 'Debit & Collections', 'Debit');
    font('normal', 11);
    setText(C.muted);
    doc.text('No debit or collections data.', M, y + 6);
  }

  // ── footer: page X of Y ──
  const pages = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg);
    setDraw(C.line);
    doc.setLineWidth(0.2);
    doc.line(M, H - 10, W - M, H - 10);
    font('normal', 7);
    setText(C.muted);
    doc.text('ALMARAI ALARABIA TRADING', M, H - 6);
    doc.text(`Page ${pg} of ${pages}`, W - M, H - 6, { align: 'right' });
  }

  const who = input.allSalespersons ? 'All' : (input.sections[0]?.salesperson.name || 'Salesperson').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const when = period.start === period.end ? period.start : `${period.start}_to_${period.end}`;
  return { doc, fileName: `Debit_Collections_${who.replace(/\s+/g, '_')}_${when}.pdf` };
}

// ════════════════ EMAIL ════════════════
/** Runs fn over the list, a few at a time (each salesperson loads his own debit scope). */
async function mapLimit<T, R>(list: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
}

// one run sends several copies (all salespersons + one per salesperson): read the ledger / sales once
let inputsCache: { at: number; promise: ReturnType<typeof LoadSalespersonInputs> } | null = null;
function sharedInputs() {
  if (!inputsCache || Date.now() - inputsCache.at > 2 * 60_000) {
    const promise = LoadSalespersonInputs();
    inputsCache = { at: Date.now(), promise };
    promise.catch(() => (inputsCache = null));
  }
  return inputsCache.promise;
}

// debit aging: invoice month + payment term (months), from the 1st of the next month
const DEBIT_AGING_MODE = 'months' as const;

export const DebitCollectionsReport: Builder = async (range, reportName, salespersonId) => {
  const period = { start: range.start, end: range.end };
  const inputs = await sharedInputs();
  const everyone = await listAllSalespersons();

  let scope = 'All salespersons';
  let sections: SalespersonData[];
  if (salespersonId) {
    const id = salespersonId.trim().toUpperCase();
    scope = everyone.find((s) => s.id.trim().toUpperCase() === id)?.name || inputs.nameById.get(id) || salespersonId;
    sections = [await BuildSalespersonData({ salespersonId, period, showCosts: false, inputs })];
  } else {
    sections = await mapLimit(everyone, 4, (sp) => BuildSalespersonData({ salespersonId: sp.id, period, showCosts: false, inputs }));
  }
  sections = sections.filter((d) => d.ledger.length);
  if (!sections.length) return { scope, skip: 'No debit or collections data' };

  // all salespersons: first PDF = summary + company, then one PDF per salesperson (A-Z), all in the same email
  const toPdf = (doc: any) => Buffer.from(doc.output('arraybuffer') as ArrayBuffer);
  const { doc } = await BuildDebitCollectionsReportPdf(
    { period, sections, allSalespersons: !salespersonId, agingMode: DEBIT_AGING_MODE, includeSections: !!salespersonId },
    addArabicFontServer,
  );
  const pdf = toPdf(doc);
  const fileName = attachmentName(salespersonId ? scope : 'All Salespersons', 'Debit_Collections');
  const extraPdfs: { fileName: string; pdf: Buffer }[] = [];
  if (!salespersonId) {
    const az = [...sections].sort((a, b) => a.salesperson.name.localeCompare(b.salesperson.name, undefined, { sensitivity: 'base' }));
    for (const d of az) {
      const one = await BuildDebitCollectionsReportPdf({ period, sections: [d], allSalespersons: false, agingMode: DEBIT_AGING_MODE }, addArabicFontServer);
      extraPdfs.push({ fileName: attachmentName(d.salesperson.name, 'Debit_Collections'), pdf: toPdf(one.doc) });
    }
  }

  // short summary in the email body
  const t = DebitCollectionsTotals(salespersonId ? sections[0] : MergeSalespersonData(sections, period), DEBIT_AGING_MODE);
  const top = salespersonId
    ? []
    : sections
        .map((d) => ({ name: d.salesperson.name, t: DebitCollectionsTotals(d, DEBIT_AGING_MODE) }))
        .sort((a, b) => b.t.openDebit - a.t.openDebit)
        .slice(0, 5);
  const when = periodText(range);
  const title = salespersonId ? `${reportName} — ${scope}` : reportName;
  const rate = t.collectionRate === null || !Number.isFinite(t.collectionRate) ? '-' : `${t.collectionRate.toFixed(1)}%`;

  const row = (label: string, value: string, extra = '') =>
    `<tr><td style="padding:6px 12px;color:#64748b;font-size:13px">${label}</td><td style="padding:6px 12px;font-weight:700;font-size:14px;color:#0f172a;text-align:right">${value}</td><td style="padding:6px 12px;font-size:12px;color:#64748b;text-align:right">${extra}</td></tr>`;
  const html = `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a">
  <div style="background:#0a0f1d;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0">
    <div style="font-size:12px;letter-spacing:2px;color:#D4AF37;font-weight:700">BHS · SCHEDULED REPORT</div>
    <div style="font-size:20px;font-weight:700;margin-top:4px">${esc(title)}</div>
    <div style="font-size:13px;color:#cbd5e1;margin-top:2px">${esc(when)}</div>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:16px 10px">
    <div style="margin:0 12px 6px;font-size:12px;font-weight:700;color:#64748b;letter-spacing:1px">DEBIT (AS OF TODAY)</div>
    <table style="width:100%;border-collapse:collapse">
      ${row('Open debit', `AED ${moneyText(t.openDebit)}`, `${t.debitCustomers} customers`)}
      ${row('Overdue', `AED ${moneyText(t.overdue)}`, `${t.overduePct.toFixed(1)}%`)}
      ${row('Over 120 days', `AED ${moneyText(t.over120)}`, `${t.over120Pct.toFixed(1)}%`)}
    </table>
    <div style="margin:14px 12px 6px;font-size:12px;font-weight:700;color:#64748b;letter-spacing:1px">COLLECTIONS (${esc(when.toUpperCase())})</div>
    <table style="width:100%;border-collapse:collapse">
      ${row('Net collected', `AED ${moneyText(t.netCollected)}`, change(t.netCollected, t.prevNetCollected))}
      ${row('Payments', String(t.payments), `${t.payingCustomers} customers`)}
      ${row('Collection rate', rate)}
    </table>
    ${top.length ? `<div style="margin:14px 12px 6px;font-size:12px;font-weight:700;color:#64748b;letter-spacing:1px">TOP SALESPERSONS (OPEN DEBIT)</div>
    <table style="width:100%;border-collapse:collapse">
      ${top.map((r, i) => row(`${i + 1}. ${esc(r.name)}`, `AED ${moneyText(r.t.openDebit)}`, `Collected ${moneyText(r.t.netCollected)}`)).join('')}
    </table>` : ''}
    <p style="margin:16px 12px 4px;font-size:12px;color:#94a3b8">${extraPdfs.length ? `Attached: the summary PDF and one PDF per salesperson (${extraPdfs.length}).` : 'The full report is attached (PDF).'} Collections are compared with the same period last year.</p>
  </div>
</div>`;
  const text = [
    `${title} — ${when}`,
    `Open debit: AED ${moneyText(t.openDebit)}`,
    `Overdue: AED ${moneyText(t.overdue)} (${t.overduePct.toFixed(1)}%)`,
    `Over 120 days: AED ${moneyText(t.over120)}`,
    `Net collected: AED ${moneyText(t.netCollected)}`,
    `Payments: ${t.payments}`,
    `Collection rate: ${rate}`,
    '',
    extraPdfs.length ? `Attached: the summary PDF and one PDF per salesperson (${extraPdfs.length}).` : 'The full report is attached (PDF).',
  ].join('\n');

  return { scope, fileName, pdf, extraPdfs, subject: `${title} — ${when}`, html, text };
};
