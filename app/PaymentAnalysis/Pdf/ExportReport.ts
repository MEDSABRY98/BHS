'use client';

// ════════════════════════════════════════════════════════════════
//  Payments Analysis — PDF report
//   Page 1 : KPI cards (net collected vs last year, paying customers,
//            number of payments) + monthly chart (this period vs last year)
//   Page 2 : Sales reps collections — each rep with his cities under him
//   Before : Customer classes analysis (share, YoY, pay rate, unpaid exposure)
//   Last   : Customers paid / not paid — untagged first (paid rows green),
//            then tagged customers grouped by tag (the TAG row is green when it paid)
//  Period  : the global filter dates (no filter → 1 Jan this year … today),
//            compared with the same dates one year earlier.
// ════════════════════════════════════════════════════════════════

import type { InvoiceRow } from '@/types';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { getInvoiceType } from '@/app/CustomersAnalysis/Utils/InvoiceType';
import { getPaymentCategory } from '../Utils/PaymentType';

export type PaymentsReportInput = {
  data: InvoiceRow[];
  dateRange: { start: string; end: string };
  selectedTags: string[];
  selectedClasses: string[];
  selectedCities: string[];
  /** How payments are split between sales reps (server: getPaymentRepAllocation). */
  repAllocation:
    | { mode: 'full'; allocation: Record<string, { rep: string; share: number }[]> }
    | { mode: 'self'; rep: string };
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

  // sales reps → their cities (a payment split between reps counts for each of them)
  type Bucket = { net: number; payments: Set<string>; customers: Set<string> };
  const newBucket = (): Bucket => ({ net: 0, payments: new Set(), customers: new Set() });
  const repMap = new Map<string, Bucket & { cities: Map<string, Bucket> }>();
  const sharesOf = (r: InvoiceRow) => {
    if (input.repAllocation.mode === 'self') return [{ rep: input.repAllocation.rep || 'Me', share: 1 }];
    const list = input.repAllocation.allocation[String(r.id)];
    return list && list.length ? list : [{ rep: 'Unassigned', share: 1 }];
  };
  current.forEach((r, idx) => {
    const cat = getPaymentCategory(r);
    if (cat === 'Other') return;
    const amount = netAmount(r);
    const city = (r.city || 'UNKNOWN').trim() || 'UNKNOWN';
    const rowKey = String(r.id ?? `row-${idx}`);
    for (const { rep, share } of sharesOf(r)) {
      const e = repMap.get(rep) || { ...newBucket(), cities: new Map<string, Bucket>() };
      const c = e.cities.get(city) || newBucket();
      for (const target of [e, c]) {
        target.net += amount * share;
        if (cat === 'Payment') {
          target.payments.add(rowKey);
          if (r.customerId) target.customers.add(r.customerId);
        }
      }
      e.cities.set(city, c);
      repMap.set(rep, e);
    }
  });
  const reps = Array.from(repMap.entries())
    .map(([rep, e]) => ({
      rep,
      net: e.net,
      payments: e.payments.size,
      customers: e.customers.size,
      cities: Array.from(e.cities.entries())
        .map(([city, c]) => ({ city, net: c.net, payments: c.payments.size, customers: c.customers.size }))
        .sort((x, y) => y.net - x.net),
    }))
    .sort((x, y) => y.net - x.net);

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
  const balMap = new Map<
    string,
    { id: string; name: string; city: string; tag: string; cls: string; balance: number; last: string }
  >();
  for (const r of filtered) {
    if (!r.customerId) continue;
    const e = balMap.get(r.customerId) || {
      id: r.customerId,
      name: r.customerName || 'Unknown',
      city: r.city || '',
      tag: '',
      cls: '',
      balance: 0,
      last: '',
    };
    if (!e.cls && r.customerClass && r.customerClass.trim()) e.cls = r.customerClass.trim();
    if (!e.tag && r.customerTag && r.customerTag.trim()) e.tag = r.customerTag.trim();
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

  // ── one list for all customers: who paid in the period and who did not ──
  // A customer is listed if he paid in the period, or still has a balance.
  type DirRow = {
    id: string;
    name: string;
    city: string;
    tag: string;
    cls: string;
    net: number;
    payments: number;
    last: string;
    balance: number;
    paid: boolean;
  };
  const dirRows: DirRow[] = [];
  for (const b of balMap.values()) {
    const c = custMap.get(b.id);
    const paid = !!c && c.payments > 0;
    if (!paid && b.balance <= 1) continue;
    dirRows.push({
      id: b.id,
      name: b.name,
      city: b.city,
      tag: b.tag,
      cls: b.cls || 'No Class',
      net: c ? c.collected - c.refunded : 0,
      payments: c ? c.payments : 0,
      last: b.last,
      balance: b.balance,
      paid,
    });
  }
  const byPaidThenAmount = (a: DirRow, b: DirRow) =>
    Number(b.paid) - Number(a.paid) || (b.paid ? b.net - a.net : b.balance - a.balance);

  const untagged = dirRows.filter((r) => !r.tag).sort(byPaidThenAmount);

  const tagMap = new Map<string, DirRow[]>();
  for (const r of dirRows) {
    if (!r.tag) continue;
    const list = tagMap.get(r.tag) || [];
    list.push(r);
    tagMap.set(r.tag, list);
  }
  // a tag counts as paid when at least one of its customers paid in the period
  const tagGroups = Array.from(tagMap.entries())
    .map(([tag, rows]) => ({
      tag,
      rows: rows.sort(byPaidThenAmount),
      paid: rows.some((r) => r.paid),
      net: rows.reduce((s, r) => s + r.net, 0),
      payments: rows.reduce((s, r) => s + r.payments, 0),
      balance: rows.reduce((s, r) => s + r.balance, 0),
      last: rows.reduce((m, r) => (r.last > m ? r.last : m), ''),
      paidCount: rows.filter((r) => r.paid).length,
    }))
    .sort((a, b) => Number(b.paid) - Number(a.paid) || (b.paid ? b.net - a.net : b.balance - a.balance));

  // ── payments by customer class (A / B / C / KA ... whatever the data holds) ──
  const clsOf = (v?: string | null) => (v || '').trim() || 'No Class';
  type ClassStat = {
    cls: string;
    net: number;
    prevNet: number;
    payments: number;
    payers: Set<string>;
    active: number;
    paidCustomers: number;
    unpaidCustomers: number;
    unpaidBalance: number;
    openBalance: number;
  };
  const classMap = new Map<string, ClassStat>();
  const classGet = (k: string) => {
    let s = classMap.get(k);
    if (!s) {
      s = { cls: k, net: 0, prevNet: 0, payments: 0, payers: new Set(), active: 0, paidCustomers: 0, unpaidCustomers: 0, unpaidBalance: 0, openBalance: 0 };
      classMap.set(k, s);
    }
    return s;
  };
  for (const r of current) {
    const cat = getPaymentCategory(r);
    if (cat === 'Other') continue;
    const s = classGet(clsOf(r.customerClass));
    s.net += netAmount(r);
    if (cat === 'Payment') {
      s.payments += 1;
      if (r.customerId) s.payers.add(r.customerId);
    }
  }
  for (const r of previous) {
    if (getPaymentCategory(r) === 'Other') continue;
    classGet(clsOf(r.customerClass)).prevNet += netAmount(r);
  }
  for (const d of dirRows) {
    const s = classGet(d.cls);
    s.active += 1;
    if (d.balance > 0) s.openBalance += d.balance;
    if (d.paid) s.paidCustomers += 1;
    else {
      s.unpaidCustomers += 1;
      s.unpaidBalance += d.balance;
    }
  }
  const classStats = Array.from(classMap.values()).sort((a, b) => {
    if (a.cls === 'No Class') return 1;
    if (b.cls === 'No Class') return -1;
    return a.cls.localeCompare(b.cls, undefined, { numeric: true, sensitivity: 'base' });
  });

  return { period, cur, prev, months, reps, customers, unpaid, untagged, tagGroups, classStats };
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
  const { period, cur, prev, months, reps, untagged, tagGroups, classStats } = report;

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

  // top sales reps preview under the chart
  const prevY = plotY + plotH + 16;
  sectionTitle('Top Sales Reps', prevY);
  const topReps = reps.slice(0, 5).map((r) => ({ city: r.rep, net: r.net }));
  const maxCity = Math.max(1, ...topReps.map((c) => Math.abs(c.net)));
  topReps.forEach((c, i) => {
    const ry = prevY + 8 + i * 8;
    // rep names can be Arabic → Arabic-capable font (no bold variant)
    doc.setFont(nameFont, 'normal');
    doc.setFontSize(9);
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

  // ════════════ PAGE 2 — sales reps and their cities ════════════
  doc.addPage();
  const repHeader = () =>
    header('Sales Reps Collections', `${reps.length} sales reps  •  net collected ${money(cur.net)}`);
  repHeader();
  const repStart = doc.internal.getCurrentPageInfo().pageNumber;
  const repTotal = reps.reduce((s, r) => s + r.net, 0);
  const pct = (v: number) => (repTotal ? `${((v / repTotal) * 100).toFixed(1)}%` : '-');
  const repBody: any[] = [];
  const repRowIdx = new Set<number>();
  reps.forEach((r, i) => {
    repRowIdx.add(repBody.length);
    repBody.push([
      i + 1,
      r.rep,
      money(r.net),
      pct(r.net),
      whole(r.payments),
      whole(r.customers),
      money(r.payments ? r.net / r.payments : 0),
    ]);
    r.cities.forEach((c) => {
      repBody.push([
        '',
        c.city,
        money(c.net),
        pct(c.net),
        whole(c.payments),
        whole(c.customers),
        money(c.payments ? c.net / c.payments : 0),
      ]);
    });
  });
  autoTable(doc, {
    ...tableBase,
    startY: 40,
    head: [['#', 'Sales Rep / City', 'Net Collection', 'Share', 'Payments', 'Customers', 'Avg Payment']],
    body: repBody,
    foot: [
      [
        '',
        'TOTAL',
        money(repTotal),
        '100%',
        whole(cur.payments),
        whole(cur.customers.size),
        money(cur.payments ? repTotal / cur.payments : 0),
      ],
    ],
    alternateRowStyles: {},
    columnStyles: {
      0: { halign: 'center', cellWidth: 10, textColor: C.muted },
      1: { halign: 'center', font: nameFont, cellWidth: 56 },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
    },
    didParseCell: (d: any) => {
      tableBase.didParseCell(d);
      if (d.section !== 'body') return;
      if (repRowIdx.has(d.row.index)) {
        // sales rep row
        d.cell.styles.fillColor = C.goldSoft;
        d.cell.styles.textColor = C.ink;
        if (d.column.index !== 1) d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fontSize = 8.5;
      } else {
        // city row under the rep
        d.cell.styles.lineWidth = 0;
        d.cell.styles.fillColor = C.white;
        d.cell.styles.textColor = C.text;
        d.cell.styles.fontSize = 7.5;
        if (d.column.index === 1) d.cell.styles.font = 'helvetica';
      }
    },
    didDrawPage: () => {
      if (doc.internal.getCurrentPageInfo().pageNumber !== repStart) repHeader();
    },
  });

  // ════════════ customer classes analysis ════════════
  doc.addPage();
  header('Customer Classes Analysis', `${classStats.length} classes  •  net collected ${money(cur.net)}  •  vs ${prevText}`);
  const classColors: RGB[] = [C.gold, C.ink, C.green, [59, 130, 246], [168, 85, 247], [244, 114, 182], [20, 184, 166], [249, 115, 22]];
  const colorOfClass = (i: number): RGB => (classStats[i]?.cls === 'No Class' ? C.prev : classColors[i % classColors.length]);
  const classNet = classStats.reduce((s, c) => s + Math.max(c.net, 0), 0);
  const classShare = (v: number) => (classNet ? (Math.max(v, 0) / classNet) * 100 : 0);

  // 1) share of collections — one stacked bar
  let cy = 44;
  sectionTitle('Share of Collections by Class', cy);
  const barY = cy + 6;
  const barFullW = W - M * 2;
  let bx0 = M;
  classStats.forEach((c, i) => {
    const w = classNet ? (Math.max(c.net, 0) / classNet) * barFullW : 0;
    if (w <= 0.2) return;
    setFill(colorOfClass(i));
    doc.rect(bx0, barY, w, 10, 'F');
    if (w > 14) {
      font('bold', 8);
      setText(colorOfClass(i) === C.ink ? C.white : C.ink);
      doc.text(`${classShare(c.net).toFixed(1)}%`, bx0 + w / 2, barY + 6.4, { align: 'center' });
    }
    bx0 += w;
  });
  // legend
  let lx = M;
  const ly = barY + 17;
  classStats.forEach((c, i) => {
    setFill(colorOfClass(i));
    doc.roundedRect(lx, ly - 3.2, 3.6, 3.6, 0.8, 0.8, 'F');
    doc.setFont(nameFont, 'normal');
    doc.setFontSize(8.5);
    setText(C.text);
    const label = `${c.cls}  ${classShare(c.net).toFixed(1)}%`;
    doc.text(label, lx + 5, ly);
    lx += 5 + doc.getTextWidth(label) + 8;
  });

  // 2) grouped bars — this period vs last year per class
  cy = ly + 12;
  sectionTitle('Net Collected: This Period vs Last Year', cy);
  const gLegend = (x: number, color: RGB, label: string) => {
    setFill(color);
    doc.roundedRect(x, cy - 3.2, 4, 4, 1, 1, 'F');
    font('normal', 8);
    setText(C.text);
    doc.text(label, x + 5.5, cy);
  };
  gLegend(W - M - 62, C.gold, 'This period');
  gLegend(W - M - 30, C.prev, 'Last year');
  const gx = M + 16;
  const gy = cy + 8;
  const gw = W - M - gx;
  const gh = 58;
  const gVals = classStats.flatMap((c) => [c.net, c.prevNet]);
  const gMax = Math.max(0, ...gVals);
  const gMin = Math.min(0, ...gVals);
  const gStepRaw = (gMax - gMin) / 4 || 1;
  const gPow = Math.pow(10, Math.floor(Math.log10(gStepRaw)));
  const gN = gStepRaw / gPow;
  const gStep = (gN <= 1 ? 1 : gN <= 2 ? 2 : gN <= 5 ? 5 : 10) * gPow;
  const gTop = Math.ceil(gMax / gStep) * gStep || gStep;
  const gBottom = Math.floor(gMin / gStep) * gStep;
  const gYof = (v: number) => gy + gh - ((v - gBottom) / (gTop - gBottom)) * gh;
  doc.setLineWidth(0.2);
  for (let v = gBottom; v <= gTop + gStep / 2; v += gStep) {
    const yy = gYof(v);
    setDraw(v === 0 ? [148, 163, 184] : C.line);
    doc.line(gx, yy, gx + gw, yy);
    font('normal', 6.5);
    setText(C.muted);
    doc.text(shortMoney(v), gx - 2, yy + 1, { align: 'right' });
  }
  const gSlot = gw / Math.max(classStats.length, 1);
  const gBarW = Math.min(16, gSlot * 0.34);
  const gZero = gYof(0);
  classStats.forEach((c, i) => {
    const cx = gx + gSlot * i + gSlot / 2;
    const drawBar = (x: number, v: number, color: RGB) => {
      if (!v) return;
      const y1 = gYof(v);
      const h = Math.abs(gZero - y1);
      if (h < 0.2) return;
      setFill(color);
      doc.rect(x, Math.min(y1, gZero), gBarW, h, 'F');
    };
    drawBar(cx - gBarW - 0.4, c.net, C.gold);
    drawBar(cx + 0.4, c.prevNet, C.prev);
    const valueLabel = (v: number, x: number, color: RGB) => {
      if (!v) return;
      font('bold', 11);
      setText(color);
      const ly2 = v >= 0 ? gYof(v) - 2 : gYof(v) + 5;
      doc.text(shortMoney(v), x, ly2, { align: 'center' });
    };
    valueLabel(c.net, cx - gBarW / 2 - 0.4, C.goldDark);
    valueLabel(c.prevNet, cx + gBarW / 2 + 0.4, C.text);
    doc.setFont(nameFont, 'normal');
    doc.setFontSize(8);
    setText(C.text);
    doc.text(c.cls, cx, gy + gh + 5, { align: 'center' });
  });

  // 3) table
  const tTop = gy + gh + 12;
  sectionTitle('Class Details', tTop);
  const sum = (f: (c: (typeof classStats)[number]) => number) => classStats.reduce((s, c) => s + f(c), 0);
  const totActive = sum((c) => c.active);
  const totPaid = sum((c) => c.paidCustomers);
  const totNet = sum((c) => c.net);
  const totPrev = sum((c) => c.prevNet);
  const pctTxt = (v: number | null) => (v === null ? 'NEW' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
  autoTable(doc, {
    ...tableBase,
    startY: tTop + 4,
    margin: { left: M, right: M, top: 40, bottom: 16 },
    head: [['Class', 'Active Cust.', 'Paid', 'Net Collected', 'Share', 'vs Last Year', 'Avg Payment', 'Unpaid Cust.', 'Unpaid Balance']],
    body: classStats.map((c) => [
      c.cls,
      whole(c.active),
      whole(c.paidCustomers),
      money(c.net),
      `${classShare(c.net).toFixed(1)}%`,
      pctTxt(change(c.net, c.prevNet)),
      money(c.payments ? c.net / c.payments : 0),
      whole(c.unpaidCustomers),
      money(c.unpaidBalance),
    ]),
    foot: [[
      'TOTAL',
      whole(totActive),
      whole(totPaid),
      money(totNet),
      '100%',
      pctTxt(change(totNet, totPrev)),
      money(cur.payments ? cur.net / cur.payments : 0),
      whole(sum((c) => c.unpaidCustomers)),
      money(sum((c) => c.unpaidBalance)),
    ]],
    styles: { ...tableBase.styles, fontSize: 7.5, cellPadding: 2.2 },
    columnStyles: { 0: { font: nameFont, fontStyle: 'normal', textColor: C.ink, cellWidth: 20 } },
    didParseCell: (d: any) => {
      tableBase.didParseCell(d);
      if (d.section !== 'body') return;
      const idx = d.column.index;
      const raw = String(d.cell.raw);
      if (idx === 5) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.textColor = raw.startsWith('-') ? C.red : C.green;
      }
      if (idx === 3) d.cell.styles.fontStyle = 'bold';
    },
  });

  // 4) auto insights
  const tbl: any = (doc as any).lastAutoTable;
  let iy = (tbl?.finalY ?? tTop + 40) + 9;
  const insights: string[] = [];
  const byNet = [...classStats].sort((a, b) => b.net - a.net);
  if (byNet[0] && classNet > 0) {
    insights.push(`Class ${byNet[0].cls} brings ${classShare(byNet[0].net).toFixed(1)}% of net collections (${money(byNet[0].net)}).`);
  }
  const growth = classStats
    .map((c) => ({ c, p: change(c.net, c.prevNet) }))
    .filter((x): x is { c: (typeof classStats)[number]; p: number } => x.p !== null);
  if (growth.length) {
    const best = [...growth].sort((a, b) => b.p - a.p)[0];
    const worst = [...growth].sort((a, b) => a.p - b.p)[0];
    insights.push(`Best growth vs last year: class ${best.c.cls} (${pctTxt(best.p)}).`);
    if (worst.c.cls !== best.c.cls && worst.p < 0) insights.push(`Biggest decline: class ${worst.c.cls} (${pctTxt(worst.p)}).`);
  }
  const mostUnpaid = [...classStats].sort((a, b) => b.unpaidBalance - a.unpaidBalance)[0];
  if (mostUnpaid && mostUnpaid.unpaidBalance > 0) {
    insights.push(
      `Highest unpaid exposure: class ${mostUnpaid.cls} - ${whole(mostUnpaid.unpaidCustomers)} customers owe ${money(mostUnpaid.unpaidBalance)} with no payment in the period.`,
    );
  }
  if (insights.length && iy < H - 40) {
    const boxH = 8 + insights.length * 6;
    setFill(C.soft);
    setDraw(C.line);
    doc.roundedRect(M, iy, W - M * 2, boxH, 3, 3, 'FD');
    font('bold', 8);
    setText(C.goldDark);
    doc.text('KEY TAKEAWAYS', M + 5, iy + 6);
    insights.forEach((t, i) => {
      font('normal', 8.5);
      setText(C.text);
      doc.text(`•  ${doc.splitTextToSize(t, W - M * 2 - 12)[0]}`, M + 5, iy + 12 + i * 6);
    });
  }

  // ════════════ customers: paid / not paid, untagged first then tags ════════════
  doc.addPage();
  const allRows = [...untagged, ...tagGroups.flatMap((g) => g.rows)];
  const paidCount = allRows.filter((r) => r.paid).length;
  const totalNet = allRows.reduce((s, r) => s + r.net, 0);
  const totalBal = allRows.reduce((s, r) => s + r.balance, 0);
  const totalPays = allRows.reduce((s, r) => s + r.payments, 0);
  const custHeader = () =>
    header(
      'Customers - Paid / Not Paid',
      `${allRows.length} customers  •  ${paidCount} paid in the period  •  ${allRows.length - paidCount} did not pay`,
    );
  custHeader();
  const custStart = doc.internal.getCurrentPageInfo().pageNumber;

  type RowKind = 'banner' | 'tag' | 'paid' | 'unpaid' | 'tagCustomer';
  const kinds: { kind: RowKind; tagPaid?: boolean }[] = [];
  const body: any[] = [];
  const banner = (text: string, soft: RGB) => {
    kinds.push({ kind: 'banner' });
    body.push([{ content: text, colSpan: 7, styles: { fillColor: soft, textColor: C.ink, fontStyle: 'bold', halign: 'left', fontSize: 9 } }]);
  };
  const lastCell = (c: { last: string }) => (c.last ? fmtDay(c.last) : 'Never');
  let n = 0;

  // 1) customers without a tag — the ones who paid get a green row
  banner(`CUSTOMERS WITHOUT TAG  (${untagged.length})`, C.goldSoft);
  untagged.forEach((c) => {
    kinds.push({ kind: c.paid ? 'paid' : 'unpaid' });
    body.push([++n, c.name, c.city, c.paid ? money(c.net) : '-', c.paid ? whole(c.payments) : '-', lastCell(c), money(c.balance)]);
  });

  // 2) tagged customers — the green is on the TAG row (when the tag paid), not on its customers
  banner(`CUSTOMERS WITH TAG  (${tagGroups.length} tags)`, C.goldSoft);
  tagGroups.forEach((g) => {
    kinds.push({ kind: 'tag', tagPaid: g.paid });
    body.push([
      '',
      `${g.tag}  (${g.paidCount}/${g.rows.length} paid)`,
      '',
      g.paid ? money(g.net) : '-',
      g.paid ? whole(g.payments) : '-',
      lastCell(g),
      money(g.balance),
    ]);
    g.rows.forEach((c) => {
      kinds.push({ kind: 'tagCustomer' });
      body.push([++n, c.name, c.city, c.paid ? money(c.net) : '-', c.paid ? whole(c.payments) : '-', lastCell(c), money(c.balance)]);
    });
  });

  autoTable(doc, {
    ...tableBase,
    startY: 40,
    head: [['#', 'Customer / Tag', 'City', 'Net Collected', 'Payments', 'Last Payment', 'Balance']],
    body,
    foot: [['', 'TOTAL', '', money(totalNet), whole(totalPays), '', money(totalBal)]],
    alternateRowStyles: {},
    columnStyles: {
      0: { halign: 'center', cellWidth: 10, textColor: C.muted },
      1: { halign: 'center', font: nameFont, textColor: C.ink, cellWidth: 70 },
      2: { halign: 'center', cellWidth: 24 },
      3: { halign: 'center', fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 24 },
      6: { halign: 'center' },
    },
    didParseCell: (d: any) => {
      tableBase.didParseCell(d);
      if (d.section !== 'body') return;
      const k = kinds[d.row.index];
      if (!k || k.kind === 'banner') return;
      if (k.kind === 'paid') {
        d.cell.styles.fillColor = C.greenSoft;
        d.cell.styles.textColor = C.ink;
      } else if (k.kind === 'tag') {
        d.cell.styles.fillColor = k.tagPaid ? C.greenSoft : C.soft;
        d.cell.styles.textColor = C.ink;
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.lineWidth = { top: 0.3, bottom: 0.15 };
        d.cell.styles.lineColor = k.tagPaid ? C.green : C.line;
      } else if (k.kind === 'tagCustomer') {
        d.cell.styles.fillColor = C.white;
        d.cell.styles.fontSize = 7.5;
      }
      // "Never" in red
      if (d.column.index === 5 && d.cell.raw === 'Never') d.cell.styles.textColor = C.red;
    },
    didDrawPage: () => {
      if (doc.internal.getCurrentPageInfo().pageNumber !== custStart) custHeader();
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
    doc.text(`Page ${p} of ${pages}`, W - M, H - 6, { align: 'right' });
  }

  saveTrackedPdf(doc, `Payments_Report_${period.start}_${period.end}.pdf`);
}
