'use client';

// ════════════════════════════════════════════════════════════════
//  Payments Analysis — PDF report
//   Page 1 : KPI cards (net collected vs last year, paying customers,
//            number of payments) + monthly chart (this period vs last year)
//   Page 2 : Cities collections table
//   Next   : Customers collections table
//   Last   : Customers who did not pay in the period (with balance)
//  Period  : the global filter dates (no filter → 1 Jan this year … today),
//            compared with the same dates one year earlier.
// ════════════════════════════════════════════════════════════════

import type { InvoiceRow } from '@/types';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/Audit/Utils/TrackedDownload';
import { getInvoiceType } from '@/app/CustomersAnalysis/Utils/InvoiceType';
import { getPaymentCategory } from '../Utils/PaymentType';

export type PaymentsReportInput = {
  data: InvoiceRow[];
  dateRange: { start: string; end: string };
  selectedTags: string[];
  selectedClasses: string[];
  selectedCities: string[];
};

type RGB = [number, number, number];
const C = {
  ink: [15, 23, 42] as RGB, // slate-900
  text: [51, 65, 85] as RGB, // slate-700
  muted: [100, 116, 139] as RGB, // slate-500
  line: [226, 232, 240] as RGB, // slate-200
  soft: [248, 250, 252] as RGB, // slate-50
  gold: [212, 175, 55] as RGB,
  goldDark: [184, 134, 11] as RGB,
  goldSoft: [253, 246, 220] as RGB,
  green: [5, 150, 105] as RGB,
  greenSoft: [209, 250, 229] as RGB,
  red: [220, 38, 38] as RGB,
  redSoft: [254, 226, 226] as RGB,
  prev: [203, 213, 225] as RGB, // slate-300 (last year bars)
  white: [255, 255, 255] as RGB,
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─────────────────────────────────────────────────────────────
//  Data
// ─────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOf = (v: unknown) => String(v ?? '').split('T')[0];

function shiftYear(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(y + years, m, 0).getDate(); // keeps 29 Feb valid
  return `${y + years}-${pad(m)}-${pad(Math.min(d, last))}`;
}

function resolvePeriod(range: { start: string; end: string }) {
  const today = new Date();
  const start = range.start || `${today.getFullYear()}-01-01`;
  const end = range.end || isoDate(today);
  return { start, end, prevStart: shiftYear(start, -1), prevEnd: shiftYear(end, -1) };
}

function passesFilters(row: InvoiceRow, input: PaymentsReportInput): boolean {
  if (input.selectedTags.length > 0) {
    if (!row.customerTag) return false;
    const tags = row.customerTag.split(',').map((t) => t.trim()).filter(Boolean);
    if (!tags.some((t) => input.selectedTags.includes(t))) return false;
  }
  if (input.selectedClasses.length > 0) {
    if (!row.customerClass || !input.selectedClasses.includes(row.customerClass.trim())) return false;
  }
  if (input.selectedCities.length > 0) {
    if (!row.city || !input.selectedCities.includes(row.city.trim())) return false;
  }
  return true;
}

/** Same rows the module's tabs use: payments and returned payments. */
function isPaymentRow(row: InvoiceRow) {
  const t = getInvoiceType(row);
  return t === 'Payment' || t === 'R-Payment';
}

/** +credit for a payment, −debit for a refund, 0 otherwise. */
function netAmount(row: InvoiceRow) {
  const cat = getPaymentCategory(row);
  if (cat === 'Payment') return Number(row.credit) || 0;
  if (cat === 'Refund') return -(Number(row.debit) || 0);
  return 0;
}

type PeriodStats = {
  net: number;
  collected: number;
  refunded: number;
  payments: number;
  customers: Set<string>;
  byMonth: Map<string, number>; // 'YYYY-MM' → net
};

function periodStats(rows: InvoiceRow[]): PeriodStats {
  const s: PeriodStats = { net: 0, collected: 0, refunded: 0, payments: 0, customers: new Set(), byMonth: new Map() };
  for (const r of rows) {
    const cat = getPaymentCategory(r);
    if (cat === 'Other') continue;
    const amount = netAmount(r);
    s.net += amount;
    if (cat === 'Payment') {
      s.collected += amount;
      s.payments += 1;
      if (r.customerId) s.customers.add(r.customerId);
    } else {
      s.refunded += -amount;
    }
    const key = dayOf(r.date).slice(0, 7);
    s.byMonth.set(key, (s.byMonth.get(key) || 0) + amount);
  }
  return s;
}

function buildReport(input: PaymentsReportInput) {
  const period = resolvePeriod(input.dateRange);
  const filtered = input.data.filter((r) => passesFilters(r, input));
  const payRows = filtered.filter(isPaymentRow);

  const inRange = (r: InvoiceRow, a: string, b: string) => {
    const d = dayOf(r.date);
    return !!d && d >= a && d <= b;
  };
  const current = payRows.filter((r) => inRange(r, period.start, period.end));
  const previous = payRows.filter((r) => inRange(r, period.prevStart, period.prevEnd));
  const cur = periodStats(current);
  const prev = periodStats(previous);

  // months of the period (chart)
  const months: { label: string; current: number; previous: number }[] = [];
  const [sy, sm] = period.start.split('-').map(Number);
  const [ey, em] = period.end.split('-').map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${pad(m)}`;
    const prevKey = `${y - 1}-${pad(m)}`;
    months.push({
      label: sy === ey ? MONTHS[m - 1] : `${MONTHS[m - 1]} ${String(y).slice(2)}`,
      current: cur.byMonth.get(key) || 0,
      previous: prev.byMonth.get(prevKey) || 0,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  // cities
  const cityMap = new Map<string, { city: string; net: number; payments: number; customers: Set<string> }>();
  for (const r of current) {
    const cat = getPaymentCategory(r);
    if (cat === 'Other') continue;
    const city = (r.city || 'UNKNOWN').trim() || 'UNKNOWN';
    const e = cityMap.get(city) || { city, net: 0, payments: 0, customers: new Set<string>() };
    e.net += netAmount(r);
    if (cat === 'Payment') {
      e.payments += 1;
      if (r.customerId) e.customers.add(r.customerId);
    }
    cityMap.set(city, e);
  }
  const cities = Array.from(cityMap.values()).sort((a, b) => b.net - a.net);

  // customers
  const custMap = new Map<
    string,
    { id: string; name: string; city: string; collected: number; refunded: number; payments: number; last: string }
  >();
  for (const r of current) {
    const cat = getPaymentCategory(r);
    if (cat === 'Other') continue;
    const id = r.customerId || 'UNKNOWN';
    const e = custMap.get(id) || {
      id,
      name: r.customerName || 'Unknown Customer',
      city: r.city || '',
      collected: 0,
      refunded: 0,
      payments: 0,
      last: '',
    };
    if (cat === 'Payment') {
      e.collected += Number(r.credit) || 0;
      e.payments += 1;
      const d = dayOf(r.date);
      if (d > e.last) e.last = d;
    } else {
      e.refunded += Number(r.debit) || 0;
    }
    custMap.set(id, e);
  }
  const customers = Array.from(custMap.values())
    .map((c) => ({ ...c, net: c.collected - c.refunded }))
    .sort((a, b) => b.net - a.net);

  // customers with a balance who did not pay in the period (same rule as the Unpaid tab)
  const payingIds = new Set(current.filter((r) => getPaymentCategory(r) === 'Payment').map((r) => r.customerId));
  const balMap = new Map<string, { id: string; name: string; city: string; balance: number; last: string }>();
  for (const r of filtered) {
    if (!r.customerId) continue;
    const e = balMap.get(r.customerId) || {
      id: r.customerId,
      name: r.customerName || 'Unknown',
      city: r.city || '',
      balance: 0,
      last: '',
    };
    e.balance += (Number(r.debit) || 0) - (Number(r.credit) || 0);
    if (getInvoiceType(r) === 'Payment') {
      const d = dayOf(r.date);
      if (d > e.last) e.last = d;
    }
    balMap.set(r.customerId, e);
  }
  const unpaid = Array.from(balMap.values())
    .filter((c) => c.balance > 1 && !payingIds.has(c.id))
    .sort((a, b) => b.balance - a.balance);

  return { period, cur, prev, months, cities, customers, unpaid };
}

// ─────────────────────────────────────────────────────────────
//  Formatting
// ─────────────────────────────────────────────────────────────
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
const change = (cur: number, prev: number): number | null => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null);
const daysSince = (iso: string) => {
  if (!iso) return null;
  const t = new Date(`${iso}T00:00:00`).getTime();
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
};

// ─────────────────────────────────────────────────────────────
//  PDF
// ─────────────────────────────────────────────────────────────
export async function exportPaymentsReport(input: PaymentsReportInput): Promise<void> {
  const report = buildReport(input);
  const { period, cur, prev, months, cities, customers, unpaid } = report;

  const jsPDF = (await import('jspdf')).default;
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc: any = new jsPDF('p', 'mm', 'a4');
  let hasArabic = true;
  try {
    await addArabicFont(doc);
  } catch {
    hasArabic = false; // names in Arabic will not render, the rest still works
  }
  const nameFont = hasArabic ? 'Amiri' : 'helvetica';
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const periodText = `${fmtDay(period.start)}  -  ${fmtDay(period.end)}`;
  const prevText = `${fmtDay(period.prevStart)}  -  ${fmtDay(period.prevEnd)}`;

  const filterParts: string[] = [];
  if (input.selectedCities.length) filterParts.push(`Cities: ${input.selectedCities.join(', ')}`);
  if (input.selectedTags.length) filterParts.push(`Tags: ${input.selectedTags.join(', ')}`);
  if (input.selectedClasses.length) filterParts.push(`Classes: ${input.selectedClasses.join(', ')}`);
  const filterText = filterParts.length ? filterParts.join('   |   ') : 'All customers';

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (style: 'normal' | 'bold' = 'normal', size = 10) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };

  // ── header used on every page ──
  const header = (title: string, subtitle: string) => {
    setFill(C.ink);
    doc.rect(0, 0, W, 30, 'F');
    setFill(C.gold);
    doc.rect(0, 30, W, 1.2, 'F');
    font('bold', 17);
    setText(C.white);
    doc.text(title, M, 14);
    font('normal', 9);
    setText([203, 213, 225]);
    doc.text(subtitle, M, 21);
    font('bold', 9);
    setText(C.gold);
    doc.text('PAYMENTS ANALYSIS', W - M, 12, { align: 'right' });
    font('normal', 8);
    setText([203, 213, 225]);
    doc.text(periodText, W - M, 18, { align: 'right' });
    doc.text(doc.splitTextToSize(filterText, 90)[0], W - M, 23.5, { align: 'right' });
  };

  const sectionTitle = (text: string, y: number) => {
    setFill(C.gold);
    doc.roundedRect(M, y - 4, 1.6, 6, 0.8, 0.8, 'F');
    font('bold', 12);
    setText(C.ink);
    doc.text(text, M + 4, y + 0.6);
  };

  // ════════════ PAGE 1 — overview ════════════
  header('Collections Report', `Generated ${fmtDay(isoDate(new Date()))}  •  compared with ${prevText}`);

  // KPI cards
  const cardTop = 40;
  const gap = 5;
  const cardW = (W - M * 2 - gap * 2) / 3;
  const cardH = 44;

  const card = (
    x: number,
    label: string,
    value: string,
    prevValue: string,
    pct: number | null,
    accent: RGB,
  ) => {
    setFill(C.white);
    setDraw(C.line);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cardTop, cardW, cardH, 3, 3, 'FD');
    setFill(accent);
    doc.roundedRect(x, cardTop, cardW, 2.2, 1.1, 1.1, 'F');

    font('bold', 7.5);
    setText(C.muted);
    doc.text(label.toUpperCase(), x + 5, cardTop + 10);

    font('bold', value.length > 14 ? 14 : 17);
    setText(C.ink);
    doc.text(value, x + 5, cardTop + 21);

    // change badge
    const up = (pct ?? 0) >= 0;
    const badge = pct === null ? 'NEW' : `${up ? '+' : ''}${pct.toFixed(1)}%`;
    font('bold', 8);
    const bw = doc.getTextWidth(badge) + 6;
    setFill(pct === null ? C.goldSoft : up ? C.greenSoft : C.redSoft);
    doc.roundedRect(x + 5, cardTop + 26, bw, 6, 3, 3, 'F');
    setText(pct === null ? C.goldDark : up ? C.green : C.red);
    doc.text(badge, x + 5 + bw / 2, cardTop + 30.2, { align: 'center' });
    font('normal', 7.5);
    setText(C.muted);
    doc.text('vs last year', x + 5 + bw + 2.5, cardTop + 30.2);

    font('normal', 7.5);
    setText(C.muted);
    doc.text(`Last year: ${prevValue}`, x + 5, cardTop + 39);
  };

  card(M, 'Net Collected', money(cur.net), money(prev.net), change(cur.net, prev.net), C.gold);
  card(
    M + cardW + gap,
    'Paying Customers',
    whole(cur.customers.size),
    whole(prev.customers.size),
    change(cur.customers.size, prev.customers.size),
    C.green,
  );
  card(
    M + (cardW + gap) * 2,
    'Number of Payments',
    whole(cur.payments),
    whole(prev.payments),
    change(cur.payments, prev.payments),
    C.ink,
  );

  // gross / refunds strip
  const stripY = cardTop + cardH + 6;
  setFill(C.soft);
  setDraw(C.line);
  doc.roundedRect(M, stripY, W - M * 2, 13, 3, 3, 'FD');
  const strip = [
    ['Gross Collected', money(cur.collected)],
    ['Refunds / Returned', money(cur.refunded)],
    ['Avg Payment', money(cur.payments ? cur.collected / cur.payments : 0)],
    ['Avg per Customer', money(cur.customers.size ? cur.net / cur.customers.size : 0)],
  ];
  const colW = (W - M * 2) / strip.length;
  strip.forEach(([label, value], i) => {
    const cx = M + colW * i + colW / 2;
    font('normal', 7);
    setText(C.muted);
    doc.text(label, cx, stripY + 5, { align: 'center' });
    font('bold', 9.5);
    setText(C.ink);
    doc.text(value, cx, stripY + 10.5, { align: 'center' });
  });

  // ── chart ──
  const chartTop = stripY + 24;
  sectionTitle('Monthly Net Collections', chartTop);
  font('normal', 8);
  setText(C.muted);
  doc.text('This period vs same months last year', M + 4, chartTop + 6);

  // legend
  const legend = (x: number, color: RGB, label: string) => {
    setFill(color);
    doc.roundedRect(x, chartTop - 3.2, 4, 4, 1, 1, 'F');
    font('normal', 8);
    setText(C.text);
    doc.text(label, x + 5.5, chartTop);
  };
  legend(W - M - 62, C.gold, 'This period');
  legend(W - M - 30, C.prev, 'Last year');

  const plotX = M + 16;
  const plotY = chartTop + 14;
  const plotW = W - M - plotX;
  const plotH = 88;
  const values = months.flatMap((mo) => [mo.current, mo.previous]);
  const maxV = Math.max(0, ...values);
  const minV = Math.min(0, ...values);
  const niceStep = (range: number) => {
    const raw = range / 4 || 1;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  };
  const step = niceStep(maxV - minV);
  const top = Math.ceil(maxV / step) * step || step;
  const bottom = Math.floor(minV / step) * step;
  const yOf = (v: number) => plotY + plotH - ((v - bottom) / (top - bottom)) * plotH;

  // grid + axis labels
  doc.setLineWidth(0.2);
  for (let v = bottom; v <= top + step / 2; v += step) {
    const gy = yOf(v);
    setDraw(v === 0 ? [148, 163, 184] : C.line);
    doc.line(plotX, gy, plotX + plotW, gy);
    font('normal', 6.5);
    setText(C.muted);
    doc.text(shortMoney(v), plotX - 2, gy + 1, { align: 'right' });
  }

  // bars
  const slot = plotW / Math.max(months.length, 1);
  const barW = Math.min(9, slot * 0.34);
  const zeroY = yOf(0);
  const bar = (x: number, v: number, color: RGB) => {
    if (!v) return;
    const y1 = yOf(v);
    const h = Math.abs(zeroY - y1);
    if (h < 0.2) return;
    setFill(color);
    doc.rect(x, Math.min(y1, zeroY), barW, h, 'F');
  };
  months.forEach((mo, i) => {
    const cx = plotX + slot * i + slot / 2;
    bar(cx - barW - 0.4, mo.current, C.gold);
    bar(cx + 0.4, mo.previous, C.prev);
    font('normal', months.length > 14 ? 5.5 : 7);
    setText(C.text);
    doc.text(mo.label, cx, plotY + plotH + 5, { align: 'center' });
    if (months.length <= 12 && mo.current) {
      font('bold', 5.8);
      setText(C.goldDark);
      doc.text(shortMoney(mo.current), cx - barW / 2 - 0.4, Math.min(yOf(mo.current), zeroY) - 1.2, {
        align: 'center',
      });
    }
  });

  // top cities preview under the chart
  const prevY = plotY + plotH + 16;
  sectionTitle('Top Cities', prevY);
  const topCities = cities.slice(0, 5);
  const maxCity = Math.max(1, ...topCities.map((c) => Math.abs(c.net)));
  topCities.forEach((c, i) => {
    const ry = prevY + 8 + i * 8;
    font('bold', 8.5);
    setText(C.ink);
    doc.text(c.city, M + 4, ry);
    const bx = M + 48;
    const bwMax = W - M - bx - 40;
    setFill(C.soft);
    doc.roundedRect(bx, ry - 3.2, bwMax, 4, 2, 2, 'F');
    setFill(C.gold);
    doc.roundedRect(bx, ry - 3.2, Math.max(2, (Math.abs(c.net) / maxCity) * bwMax), 4, 2, 2, 'F');
    font('bold', 8.5);
    setText(C.ink);
    doc.text(money(c.net), W - M, ry, { align: 'right' });
  });

  // ── shared table style ──
  const tableBase = {
    theme: 'plain',
    margin: { left: M, right: M, top: 40, bottom: 16 },
    styles: { fontSize: 8, cellPadding: 2.4, textColor: C.text, lineColor: C.line, lineWidth: 0, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    alternateRowStyles: { fillColor: C.soft },
    footStyles: { fillColor: C.goldSoft, textColor: C.ink, fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
    showFoot: 'lastPage',
    didParseCell: (d: any) => {
      if (d.section === 'body') {
        d.cell.styles.lineWidth = { bottom: 0.15 };
        d.cell.styles.lineColor = C.line;
      }
      // totals row: same alignment as the column it sits under
      if (d.section === 'foot') {
        const colStyle = d.table?.styles?.columnStyles?.[d.column.index];
        if (colStyle?.halign) d.cell.styles.halign = colStyle.halign;
      }
    },
  };

  // ════════════ PAGE 2 — cities ════════════
  doc.addPage();
  const cityHeader = () => header('Cities Collections', `${cities.length} cities  •  net collected ${money(cur.net)}`);
  cityHeader();
  const cityStart = doc.internal.getCurrentPageInfo().pageNumber;
  const cityTotal = cities.reduce((s, c) => s + c.net, 0);
  autoTable(doc, {
    ...tableBase,
    startY: 40,
    head: [['#', 'City', 'Net Collected', 'Share', 'Payments', 'Customers', 'Avg Payment']],
    body: cities.map((c, i) => [
      i + 1,
      c.city,
      money(c.net),
      cityTotal ? `${((c.net / cityTotal) * 100).toFixed(1)}%` : '-',
      whole(c.payments),
      whole(c.customers.size),
      money(c.payments ? c.net / c.payments : 0),
    ]),
    foot: [
      [
        '',
        'TOTAL',
        money(cityTotal),
        '100%',
        whole(cities.reduce((s, c) => s + c.payments, 0)),
        whole(cur.customers.size),
        money(cur.payments ? cityTotal / cur.payments : 0),
      ],
    ],
    columnStyles: {
      0: { halign: 'center', cellWidth: 10, textColor: C.muted },
      1: { halign: 'center', fontStyle: 'bold', textColor: C.ink },
      2: { halign: 'center', fontStyle: 'bold', textColor: C.ink },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
    },
    didDrawPage: () => {
      if (doc.internal.getCurrentPageInfo().pageNumber !== cityStart) cityHeader();
    },
  });

  // ════════════ customers ════════════
  doc.addPage();
  const custHeader = () => header('Customers Collections', `${customers.length} paying customers  •  ${whole(cur.payments)} payments`);
  custHeader();
  const custStart = doc.internal.getCurrentPageInfo().pageNumber;
  autoTable(doc, {
    ...tableBase,
    startY: 40,
    head: [['#', 'Customer', 'City', 'Net Collection', 'Payments', 'Last Payment']],
    body: customers.map((c, i) => [
      i + 1,
      c.name,
      c.city,
      money(c.net),
      whole(c.payments),
      fmtDay(c.last),
    ]),
    foot: [
      [
        '',
        'TOTAL',
        '',
        money(customers.reduce((s, c) => s + c.net, 0)),
        whole(customers.reduce((s, c) => s + c.payments, 0)),
        '',
      ],
    ],
    columnStyles: {
      0: { halign: 'center', cellWidth: 9, textColor: C.muted },
      1: { halign: 'center', font: nameFont, textColor: C.ink, cellWidth: 74 },
      2: { halign: 'center', cellWidth: 26 },
      3: { halign: 'center', fontStyle: 'bold', textColor: C.ink },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 26 },
    },
    didDrawPage: () => {
      if (doc.internal.getCurrentPageInfo().pageNumber !== custStart) custHeader();
    },
  });

  // ════════════ customers who did not pay ════════════
  doc.addPage();
  const unpaidTotal = unpaid.reduce((s, c) => s + c.balance, 0);
  const unpaidHeader = () =>
    header('Customers Who Did Not Pay', `${unpaid.length} customers with a balance and no payment in the period  •  ${money(unpaidTotal)}`);
  unpaidHeader();
  const unpaidStart = doc.internal.getCurrentPageInfo().pageNumber;
  autoTable(doc, {
    ...tableBase,
    startY: 40,
    head: [['#', 'Customer', 'City', 'Balance', 'Last Payment', 'Days Since']],
    body: unpaid.map((c, i) => {
      const days = daysSince(c.last);
      return [i + 1, c.name, c.city, money(c.balance), c.last ? fmtDay(c.last) : 'Never', days === null ? '-' : whole(days)];
    }),
    foot: [['', 'TOTAL', '', money(unpaidTotal), '', '']],
    columnStyles: {
      0: { halign: 'center', cellWidth: 10, textColor: C.muted },
      1: { halign: 'center', font: nameFont, textColor: C.ink, cellWidth: 70 },
      2: { halign: 'center', cellWidth: 24 },
      3: { halign: 'center', fontStyle: 'bold', textColor: C.ink },
      4: { halign: 'center', cellWidth: 26 },
      5: { halign: 'center', cellWidth: 22 },
    },
    didParseCell: (d: any) => {
      tableBase.didParseCell(d);
      if (d.section === 'body' && d.column.index === 5) {
        const days = Number(String(d.cell.raw).replace(/,/g, ''));
        if (!Number.isNaN(days) && days > 90) d.cell.styles.textColor = C.red;
        else if (!Number.isNaN(days) && days > 30) d.cell.styles.textColor = C.goldDark;
      }
      if (d.section === 'body' && d.column.index === 4 && d.cell.raw === 'Never') {
        d.cell.styles.textColor = C.red;
      }
    },
    didDrawPage: () => {
      if (doc.internal.getCurrentPageInfo().pageNumber !== unpaidStart) unpaidHeader();
    },
  });

  // ── footer on every page ──
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    setDraw(C.line);
    doc.setLineWidth(0.2);
    doc.line(M, H - 10, W - M, H - 10);
    font('normal', 7);
    setText(C.muted);
    doc.text('Payments Analysis Report', M, H - 6);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 6, { align: 'right' });
  }

  saveTrackedPdf(doc, `Payments_Report_${period.start}_${period.end}.pdf`);
}
