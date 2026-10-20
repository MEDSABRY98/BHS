'use client';

// P&L — full PDF report: executive summary, ratios, charts, monthly statement,
// statement Actual vs Forecast, cost structure and account-level detail.
// Charts are drawn directly with jsPDF (sharp at any zoom, no screenshots).

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import type { FinancialAccount, FinancialEntry } from '../../Service/FinancialService';

type RGB = [number, number, number];
type Mode = 'ACTUAL' | 'FORECAST';

const INK: RGB = [15, 23, 42];
const TEXT: RGB = [51, 65, 85];
const MUTED: RGB = [100, 116, 139];
const LINE: RGB = [226, 232, 240];
const SOFT: RGB = [248, 250, 252];
const GOLD: RGB = [212, 175, 55];
const GOLD_DARK: RGB = [184, 134, 11];
const GOLD_SOFT: RGB = [253, 246, 220];
const GREEN: RGB = [5, 150, 105];
const RED: RGB = [220, 38, 38];
const BLUE: RGB = [59, 130, 246];
const BLUE_SOFT: RGB = [191, 219, 254];
const EMERALD: RGB = [16, 185, 129];
const ORANGE: RGB = [249, 115, 22];
const AMBER: RGB = [234, 179, 8];
const SLATE: RGB = [100, 116, 139];
const PURPLE: RGB = [147, 51, 234];
const SKY: RGB = [14, 165, 233];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SECTIONS: { type: string; label: string; color: RGB; cost: boolean }[] = [
  { type: 'REVENUE', label: 'Revenues', color: EMERALD, cost: false },
  { type: 'COGS', label: 'Cost of Goods Sold', color: RED, cost: true },
  { type: 'DIRECT_EXPENSE', label: 'Direct Expenses', color: ORANGE, cost: true },
  { type: 'INDIRECT_EXPENSE', label: 'Indirect Expenses', color: AMBER, cost: true },
  { type: 'DEPRECIATION', label: 'Depreciation', color: SLATE, cost: true },
  { type: 'FINANCE_COST', label: 'Finance Cost', color: SKY, cost: true },
  { type: 'TAXES', label: 'Taxes', color: PURPLE, cost: true },
];

const PROFITS: { key: string; label: string; minus: string[]; margin: boolean; net?: boolean }[] = [
  { key: 'GP', label: 'Gross Profit', minus: ['COGS'], margin: true },
  { key: 'EBITDA', label: 'EBITDA', minus: ['COGS', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE'], margin: true },
  { key: 'EBIT', label: 'EBIT', minus: ['COGS', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'DEPRECIATION'], margin: true },
  { key: 'NPBT', label: 'Net Profit (Before Tax)', minus: ['COGS', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'DEPRECIATION', 'FINANCE_COST'], margin: true },
  { key: 'NPAT', label: 'Net Profit (After Tax)', minus: ['COGS', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'DEPRECIATION', 'FINANCE_COST', 'TAXES'], margin: true, net: true },
];

const money = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (n: number) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (n: number | null, d = 1) => (n === null || !Number.isFinite(n) ? '-' : `${n.toFixed(d)}%`);
const ratio = (a: number, b: number) => (b === 0 ? null : (a / b) * 100);
const short = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
};
/** variance % of actual vs forecast */
const varPct = (a: number, f: number) => (f === 0 ? (a === 0 ? 0 : a > 0 ? 100 : -100) : ((a - f) / Math.abs(f)) * 100);

export interface PLPdfInput {
  accounts: FinancialAccount[];
  entries: FinancialEntry[];
  year: number;
  startMonth: number;
  endMonth: number;
}

export async function exportPLPdfReport({ accounts, entries, year, startMonth, endMonth }: PLPdfInput): Promise<void> {
  const jsPDF = (await import('jspdf')).default;
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc: any = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: `P&L Report ${year}` });
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
  const arFont = (d: any, text: string) => {
    if (hasArabic && AR.test(text)) d.cell.styles.font = 'Amiri';
  };

  // ───────────── data ─────────────
  const months: number[] = [];
  for (let m = startMonth; m <= endMonth; m++) months.push(m);
  const mLabels = months.map((m) => MONTHS[m - 1]);
  const rangeLabel = `${MONTHS[startMonth - 1]} – ${MONTHS[endMonth - 1]} ${year}`;

  const amountMap = new Map<string, { a: number; f: number }>();
  entries.forEach((e) => amountMap.set(`${e.ACCOUNT_ID}|${e.PERIOD_MONTH}`, { a: Number(e.ACTUAL_AMOUNT) || 0, f: Number(e.FORECAST_AMOUNT) || 0 }));
  const amt = (id: string, m: number, mode: Mode) => {
    const v = amountMap.get(`${id}|${m}`);
    return v ? (mode === 'ACTUAL' ? v.a : v.f) : 0;
  };
  const accTot = (id: string, mode: Mode) => months.reduce((s, m) => s + amt(id, m, mode), 0);
  const byType = (type: string) => accounts.filter((a) => a.ACCOUNT_TYPE === type);
  const sec = (type: string, m: number, mode: Mode) => byType(type).reduce((s, a) => s + amt(a.ID, m, mode), 0);
  const secTot = (type: string, mode: Mode) => months.reduce((s, m) => s + sec(type, m, mode), 0);
  const profitM = (minus: string[], m: number, mode: Mode) => sec('REVENUE', m, mode) - minus.reduce((s, t) => s + sec(t, m, mode), 0);
  const profitT = (minus: string[], mode: Mode) => secTot('REVENUE', mode) - minus.reduce((s, t) => s + secTot(t, mode), 0);
  const category = (a: FinancialAccount) => a.ACCOUNT_CATEGORY?.trim() || 'General';

  const revA = secTot('REVENUE', 'ACTUAL');
  const revF = secTot('REVENUE', 'FORECAST');
  const P = (key: string) => PROFITS.find((p) => p.key === key)!;

  // ───────────── layout helpers ─────────────
  const M = 12;
  const pageW = () => doc.internal.pageSize.getWidth();
  const pageH = () => doc.internal.pageSize.getHeight();
  let y = 0;

  const banner = (title: string, subtitle: string) => {
    const W = pageW();
    doc.setFillColor(...INK);
    doc.rect(0, 0, W, 22, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, 22, W, 1, 'F');
    doc.rect(0, 0, 3.2, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(title, M, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text(subtitle, M, 17.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text('PROFIT & LOSS REPORT', W - M, 11, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(rangeLabel, W - M, 17.5, { align: 'right' });
    y = 31;
  };

  const newPage = (title: string, subtitle: string, orientation: 'p' | 'l' = 'p') => {
    doc.addPage('a4', orientation);
    banner(title, subtitle);
  };

  const ensure = (h: number, title: string, subtitle: string) => {
    if (y + h > pageH() - 16) newPage(title, subtitle);
  };

  const sectionTitle = (text: string, note?: string) => {
    doc.setFillColor(...GOLD);
    doc.roundedRect(M, y, 1.8, 6.5, 0.9, 0.9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.text(text, M + 5, y + 5);
    if (note) {
      const w = doc.getTextWidth(text);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(note, M + 8 + w, y + 5);
    }
    y += 10;
  };

  /** card frame with a title; returns the inner plotting box */
  type Summary = { a: number; f?: number; percent?: boolean; cost?: boolean; tint: RGB };
  const chartFrame = (x: number, yy: number, w: number, h: number, title: string, summary?: Summary) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yy, w, h, 2.5, 2.5, 'FD');
    if (!summary) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(title, x + 4, yy + 6);
      return { x: x + 14, y: yy + 12, w: w - 18, h: h - 22 };
    }
    // summary strip like the dashboard chart cards: title + period total + forecast + variance
    const fmt = (v: number) => (summary.percent ? `${v.toFixed(1)}%` : money0(v));
    doc.setFillColor(...summary.tint);
    doc.roundedRect(x + 0.3, yy + 0.3, w - 0.6, 12, 2.3, 2.3, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(x + 0.3, yy + 10, w - 0.6, 2.3, 'F');
    doc.setDrawColor(...LINE);
    doc.line(x, yy + 12.3, x + w, yy + 12.3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(...MUTED);
    doc.text(title.toUpperCase(), x + 4, yy + 4.6);
    doc.setFontSize(9.5);
    doc.setTextColor(...(summary.a < 0 ? RED : INK));
    doc.text(fmt(summary.a), x + 4, yy + 9.8);
    if (summary.f !== undefined) {
      const diff = summary.a - summary.f;
      const good = diff === 0 ? null : summary.cost ? diff < 0 : diff > 0;
      const v = summary.percent ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pts` : `${varPct(summary.a, summary.f) >= 0 ? '+' : ''}${varPct(summary.a, summary.f).toFixed(1)}%`;
      doc.setFontSize(7);
      doc.setTextColor(...(good === null ? MUTED : good ? GREEN : RED));
      doc.text(v, x + w - 4, yy + 9.8, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(...MUTED);
      doc.text(`Forecast ${fmt(summary.f)}`, x + w - 4, yy + 4.6, { align: 'right' });
    }
    return { x: x + 14, y: yy + 16, w: w - 18, h: h - 28 };
  };

  /** horizontal bars (share) */
  const hBars = (x: number, yy: number, w: number, h: number, title: string, items: { label: string; value: number; color: RGB }[], valueLabel: (v: number) => string) => {
    chartFrame(x, yy, w, h, title);
    const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
    const rowH = Math.min(7, (h - 14) / Math.max(items.length, 1));
    const labelW = 48;
    items.forEach((it, i) => {
      const ry = yy + 11 + i * rowH;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...TEXT);
      if (hasArabic && AR.test(it.label)) doc.setFont('Amiri', 'normal');
      const lab = shape(it.label);
      doc.text(doc.splitTextToSize(lab, labelW - 2)[0], x + 4, ry + rowH * 0.62);
      doc.setFont('helvetica', 'normal');
      const bw = ((w - labelW - 26) * Math.abs(it.value)) / max;
      doc.setFillColor(...SOFT);
      doc.roundedRect(x + labelW, ry + rowH * 0.2, w - labelW - 26, rowH * 0.6, 1, 1, 'F');
      doc.setFillColor(...it.color);
      if (bw > 0.3) doc.roundedRect(x + labelW, ry + rowH * 0.2, bw, rowH * 0.6, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...INK);
      doc.text(valueLabel(it.value), x + w - 4, ry + rowH * 0.62, { align: 'right' });
    });
  };

  // ───────────── page 1: executive summary ─────────────
  banner('Profit & Loss Report', `Financial year ${year}  ·  Actual vs Forecast`);

  sectionTitle('Executive Summary', 'Actual against forecast for the selected period');
  const kpis: { label: string; a: number; f: number; cost?: boolean }[] = [
    { label: 'Revenue', a: revA, f: revF },
    { label: 'Gross Profit', a: profitT(P('GP').minus, 'ACTUAL'), f: profitT(P('GP').minus, 'FORECAST') },
    { label: 'EBITDA', a: profitT(P('EBITDA').minus, 'ACTUAL'), f: profitT(P('EBITDA').minus, 'FORECAST') },
    { label: 'Net Profit (AT)', a: profitT(P('NPAT').minus, 'ACTUAL'), f: profitT(P('NPAT').minus, 'FORECAST') },
    { label: 'Total COGS', a: secTot('COGS', 'ACTUAL'), f: secTot('COGS', 'FORECAST'), cost: true },
    {
      label: 'Operating Expenses',
      a: secTot('DIRECT_EXPENSE', 'ACTUAL') + secTot('INDIRECT_EXPENSE', 'ACTUAL'),
      f: secTot('DIRECT_EXPENSE', 'FORECAST') + secTot('INDIRECT_EXPENSE', 'FORECAST'),
      cost: true,
    },
  ];
  const compactB = (n: number) => (Number.isFinite(n) ? (Math.abs(n) >= 1e5 ? short(n) : money0(n)) : '-');
  const W = pageW();
  const cardW = (W - M * 2 - 8) / 3;
  kpis.forEach((k, i) => {
    const cx = M + (i % 3) * (cardW + 4);
    const cy = y + Math.floor(i / 3) * 27;
    const v = varPct(k.a, k.f);
    const good = k.cost ? k.a <= k.f : k.a >= k.f;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, cy, cardW, 23, 2.5, 2.5, 'FD');
    doc.setFillColor(...(i < 4 ? GOLD : INK));
    doc.roundedRect(cx, cy, cardW, 1.4, 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(k.label.toUpperCase(), cx + 4, cy + 6.5);
    doc.setFontSize(12.5);
    doc.setTextColor(...(k.a < 0 ? RED : INK));
    doc.text(money0(k.a), cx + 4, cy + 13.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(`Forecast ${money0(k.f)}`, cx + 4, cy + 19);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(good ? GREEN : RED));
    doc.text(`${v >= 0 ? '+' : ''}${v.toFixed(1)}%`, cx + cardW - 4, cy + 19, { align: 'right' });
  });
  y += 27 * 2 + 4;

  // key ratios
  sectionTitle('Key Ratios', 'as % of revenue unless stated');
  const opexA = secTot('DIRECT_EXPENSE', 'ACTUAL') + secTot('INDIRECT_EXPENSE', 'ACTUAL');
  const opexF = secTot('DIRECT_EXPENSE', 'FORECAST') + secTot('INDIRECT_EXPENSE', 'FORECAST');
  const allCostA = SECTIONS.filter((s) => s.cost && s.type !== 'COGS').reduce((s, x) => s + secTot(x.type, 'ACTUAL'), 0);
  const allCostF = SECTIONS.filter((s) => s.cost && s.type !== 'COGS').reduce((s, x) => s + secTot(x.type, 'FORECAST'), 0);
  const ratioRows: [string, number | null, number | null, boolean][] = [
    ['Gross Profit Margin', ratio(profitT(P('GP').minus, 'ACTUAL'), revA), ratio(profitT(P('GP').minus, 'FORECAST'), revF), false],
    ['EBITDA Margin', ratio(profitT(P('EBITDA').minus, 'ACTUAL'), revA), ratio(profitT(P('EBITDA').minus, 'FORECAST'), revF), false],
    ['EBIT Margin', ratio(profitT(P('EBIT').minus, 'ACTUAL'), revA), ratio(profitT(P('EBIT').minus, 'FORECAST'), revF), false],
    ['Net Profit Margin (BT)', ratio(profitT(P('NPBT').minus, 'ACTUAL'), revA), ratio(profitT(P('NPBT').minus, 'FORECAST'), revF), false],
    ['Net Profit Margin (AT)', ratio(profitT(P('NPAT').minus, 'ACTUAL'), revA), ratio(profitT(P('NPAT').minus, 'FORECAST'), revF), false],
    ['COGS Ratio', ratio(secTot('COGS', 'ACTUAL'), revA), ratio(secTot('COGS', 'FORECAST'), revF), true],
    ['Operating Expense Ratio', ratio(opexA, revA), ratio(opexF, revF), true],
    ['Cost-to-Income Ratio (all expenses)', ratio(allCostA, revA), ratio(allCostF, revF), true],
    ['Effective Tax Rate (of profit before tax)', ratio(secTot('TAXES', 'ACTUAL'), profitT(P('NPBT').minus, 'ACTUAL')), ratio(secTot('TAXES', 'FORECAST'), profitT(P('NPBT').minus, 'FORECAST')), true],
    ['Revenue Achievement (actual / forecast)', ratio(revA, revF), null, false],
  ];
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: { left: M, right: M, bottom: 16 },
    head: [['Ratio', 'Actual', 'Forecast', 'Difference (pts)']],
    body: ratioRows.map(([l, a, f]) => [l, pct(a), pct(f), a === null || f === null ? '-' : `${a - f >= 0 ? '+' : ''}${(a - f).toFixed(1)}`]),
    styles: { fontSize: 8, cellPadding: 2.2, textColor: TEXT, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: INK, cellWidth: 82 }, 1: { fontStyle: 'bold', textColor: INK } },
    didParseCell: (d: any) => {
      if (d.section !== 'body') return;
      d.cell.styles.fillColor = d.row.index % 2 ? SOFT : [255, 255, 255];
      if (d.column.index === 3) {
        const [, a, f, cost] = ratioRows[d.row.index];
        if (a !== null && f !== null && a !== f) d.cell.styles.textColor = (cost ? a < f : a > f) ? GREEN : RED;
      }
    },
  });
  y = doc.lastAutoTable.finalY + 8;

  // highlights
  const npM = months.map((m) => profitM(P('NPAT').minus, m, 'ACTUAL'));
  const revM = months.map((m) => sec('REVENUE', m, 'ACTUAL'));
  // only months that already have actual figures
  const live = months.map((_, i) => i).filter((i) => revM[i] !== 0 || npM[i] !== 0);
  const pick = (arr: number[], best: boolean) =>
    live.reduce((b, i) => (b === -1 || (best ? arr[i] > arr[b] : arr[i] < arr[b]) ? i : b), -1);
  const activeMonths = live.length || 1;
  const highlights: string[] = [
    `Revenue reached ${money0(revA)} against a forecast of ${money0(revF)} (${pct(ratio(revA, revF))} achieved).`,
    `Average monthly revenue: ${money0(revA / activeMonths)} over ${live.length} month(s) with actual figures.`,
  ];
  if (live.length) {
    const rb = pick(revM, true);
    const rw = pick(revM, false);
    const pb = pick(npM, true);
    const pw = pick(npM, false);
    highlights.push(`Best revenue month: ${mLabels[rb]} (${money0(revM[rb])}); lowest: ${mLabels[rw]} (${money0(revM[rw])}).`);
    highlights.push(`Most profitable month: ${mLabels[pb]} (${money0(npM[pb])}); weakest: ${mLabels[pw]} (${money0(npM[pw])}).`);
  }
  highlights.push(`Net profit after tax: ${money0(profitT(P('NPAT').minus, 'ACTUAL'))}, a margin of ${pct(ratio(profitT(P('NPAT').minus, 'ACTUAL'), revA))}.`);
  ensure(10 + highlights.length * 6, 'Profit & Loss Report', `Financial year ${year}`);
  sectionTitle('Highlights');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.3);
  highlights.forEach((h) => {
    doc.setFillColor(...GOLD);
    doc.circle(M + 1.5, y - 1, 0.8, 'F');
    doc.setTextColor(...TEXT);
    const lines = doc.splitTextToSize(h, W - M * 2 - 6);
    doc.text(lines, M + 5, y);
    y += lines.length * 4.4 + 1.4;
  });

  // ───────────── statement: actual vs forecast ─────────────
  newPage('Income Statement', 'Actual vs forecast for the period');
  type Row = { kind: 'pill' | 'acc' | 'cat' | 'sec' | 'profit' | 'margin'; label: string; a: number; f: number; cost?: boolean; net?: boolean; pctRow?: boolean };
  const stRows: Row[] = [];
  const pushSection = (s: (typeof SECTIONS)[number]) => {
    const list = byType(s.type);
    stRows.push({ kind: 'pill', label: s.label, a: 0, f: 0 });
    const cats = Array.from(new Set(list.map(category))).sort();
    const grouped = !(cats.length === 1 && cats[0] === 'General');
    cats.forEach((c) => {
      const accs = list.filter((a) => category(a) === c);
      accs.forEach((a) => stRows.push({ kind: 'acc', label: a.ACCOUNT_NAME, a: accTot(a.ID, 'ACTUAL'), f: accTot(a.ID, 'FORECAST'), cost: s.cost }));
      if (grouped) {
        stRows.push({
          kind: 'cat',
          label: `Total ${c}`,
          a: accs.reduce((t, a) => t + accTot(a.ID, 'ACTUAL'), 0),
          f: accs.reduce((t, a) => t + accTot(a.ID, 'FORECAST'), 0),
          cost: s.cost,
        });
      }
    });
    stRows.push({ kind: 'sec', label: `Total ${s.label}`, a: secTot(s.type, 'ACTUAL'), f: secTot(s.type, 'FORECAST'), cost: s.cost });
  };
  const pushProfit = (key: string) => {
    const p = P(key);
    const a = profitT(p.minus, 'ACTUAL');
    const f = profitT(p.minus, 'FORECAST');
    stRows.push({ kind: 'profit', label: p.label, a, f, net: p.net });
    if (p.margin) stRows.push({ kind: 'margin', label: `${p.label} Margin`, a: ratio(a, revA) ?? 0, f: ratio(f, revF) ?? 0, pctRow: true, net: p.net });
  };
  const S = (t: string) => SECTIONS.find((s) => s.type === t)!;
  pushSection(S('REVENUE'));
  pushSection(S('COGS'));
  pushProfit('GP');
  pushSection(S('DIRECT_EXPENSE'));
  pushSection(S('INDIRECT_EXPENSE'));
  pushProfit('EBITDA');
  pushSection(S('DEPRECIATION'));
  pushProfit('EBIT');
  pushSection(S('FINANCE_COST'));
  pushProfit('NPBT');
  pushSection(S('TAXES'));
  pushProfit('NPAT');

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: { left: M, right: M, top: 14, bottom: 16 },
    head: [['Line', 'Actual', 'Forecast', 'Variance', 'Var %', '% of Rev.']],
    body: stRows.map((r) => {
      if (r.kind === 'pill') return [{ content: r.label.toUpperCase(), colSpan: 6 }];
      if (r.pctRow) return [r.label, pct(r.a), pct(r.f), `${r.a - r.f >= 0 ? '+' : ''}${(r.a - r.f).toFixed(1)} pts`, '', ''];
      return [shape(r.label), money(r.a), money(r.f), money(r.a - r.f), pct(varPct(r.a, r.f)), pct(ratio(r.a, revA))];
    }),
    showHead: 'everyPage',
    styles: { fontSize: 7.4, cellPadding: 1.7, textColor: TEXT, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 0: { cellWidth: 62 } },
    didParseCell: (d: any) => {
      if (d.section !== 'body') return;
      const r = stRows[d.row.index];
      const s = d.cell.styles;
      if (r.kind === 'pill') {
        s.fillColor = [255, 255, 255];
        s.textColor = GOLD_DARK;
        s.fontStyle = 'bold';
        s.fontSize = 7.5;
        s.cellPadding = { top: 3.5, bottom: 1.2, left: 1, right: 1 };
        return;
      }
      if (d.column.index === 0 && r.kind === 'acc') arFont(d, r.label);
      if (r.kind === 'cat') {
        s.fillColor = GOLD_SOFT;
        s.fontStyle = 'bold';
        s.textColor = INK;
      }
      if (r.kind === 'sec') {
        s.fillColor = [241, 245, 249];
        s.fontStyle = 'bold';
        s.textColor = INK;
      }
      if (r.kind === 'profit') {
        s.fillColor = r.net ? INK : [226, 232, 240];
        s.textColor = r.net ? (d.column.index === 0 ? [255, 255, 255] : GOLD) : INK;
        s.fontStyle = 'bold';
        s.fontSize = 8;
      }
      if (r.kind === 'margin') {
        s.fillColor = r.net ? [30, 41, 59] : SOFT;
        s.textColor = r.net ? GOLD : MUTED;
        s.fontStyle = 'italic';
      }
      if ((d.column.index === 3 || d.column.index === 4) && r.kind !== 'margin' && r.kind !== 'profit' && r.a !== r.f) {
        const good = r.cost ? r.a < r.f : r.a > r.f;
        s.textColor = good ? GREEN : RED;
      }
      if ((d.column.index === 3 || d.column.index === 4) && r.kind === 'profit' && !r.net && r.a !== r.f) s.textColor = r.a > r.f ? GREEN : RED;
    },
  });

  // ───────────── monthly statement ─────────────
  newPage('Monthly Statement', 'Actual figures by month');
  const keyLines: { label: string; fn: (m: number) => number; pctRow?: boolean; strong?: boolean; net?: boolean }[] = [
    { label: 'Revenue', fn: (m) => sec('REVENUE', m, 'ACTUAL'), strong: true },
    { label: 'COGS', fn: (m) => sec('COGS', m, 'ACTUAL') },
    { label: 'Gross Profit', fn: (m) => profitM(P('GP').minus, m, 'ACTUAL'), strong: true },
    { label: 'Gross Margin', fn: (m) => ratio(profitM(P('GP').minus, m, 'ACTUAL'), sec('REVENUE', m, 'ACTUAL')) ?? 0, pctRow: true },
    { label: 'Direct Expenses', fn: (m) => sec('DIRECT_EXPENSE', m, 'ACTUAL') },
    { label: 'Indirect Expenses', fn: (m) => sec('INDIRECT_EXPENSE', m, 'ACTUAL') },
    { label: 'EBITDA', fn: (m) => profitM(P('EBITDA').minus, m, 'ACTUAL'), strong: true },
    { label: 'EBITDA Margin', fn: (m) => ratio(profitM(P('EBITDA').minus, m, 'ACTUAL'), sec('REVENUE', m, 'ACTUAL')) ?? 0, pctRow: true },
    { label: 'Depreciation', fn: (m) => sec('DEPRECIATION', m, 'ACTUAL') },
    { label: 'EBIT', fn: (m) => profitM(P('EBIT').minus, m, 'ACTUAL'), strong: true },
    { label: 'Finance Cost', fn: (m) => sec('FINANCE_COST', m, 'ACTUAL') },
    { label: 'Net Profit (BT)', fn: (m) => profitM(P('NPBT').minus, m, 'ACTUAL'), strong: true },
    { label: 'Taxes', fn: (m) => sec('TAXES', m, 'ACTUAL') },
    { label: 'Net Profit (AT)', fn: (m) => profitM(P('NPAT').minus, m, 'ACTUAL'), net: true },
    { label: 'Net Margin', fn: (m) => ratio(profitM(P('NPAT').minus, m, 'ACTUAL'), sec('REVENUE', m, 'ACTUAL')) ?? 0, pctRow: true },
    { label: 'Revenue growth (MoM)', fn: (m) => (m === startMonth ? NaN : ratio(sec('REVENUE', m, 'ACTUAL') - sec('REVENUE', m - 1, 'ACTUAL'), sec('REVENUE', m - 1, 'ACTUAL')) ?? NaN), pctRow: true },
  ];
  const totalFor = (l: (typeof keyLines)[number]) => {
    if (l.label === 'Gross Margin') return ratio(profitT(P('GP').minus, 'ACTUAL'), revA) ?? 0;
    if (l.label === 'EBITDA Margin') return ratio(profitT(P('EBITDA').minus, 'ACTUAL'), revA) ?? 0;
    if (l.label === 'Net Margin') return ratio(profitT(P('NPAT').minus, 'ACTUAL'), revA) ?? 0;
    if (l.pctRow) return NaN;
    return months.reduce((s, m) => s + l.fn(m), 0);
  };
  const compact = (n: number) => (Number.isFinite(n) ? (Math.abs(n) >= 1e5 ? short(n) : money0(n)) : '-');
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: { left: M, right: M, top: 14, bottom: 16 },
    head: [['Line', ...mLabels, 'Total']],
    body: keyLines.map((l) => [
      l.label,
      ...months.map((m) => (l.pctRow ? (Number.isFinite(l.fn(m)) ? pct(l.fn(m)) : '-') : compact(l.fn(m)))),
      l.pctRow ? (Number.isFinite(totalFor(l)) ? pct(totalFor(l)) : '-') : compact(totalFor(l)),
    ]),
    styles: { fontSize: months.length > 9 ? 5.8 : months.length > 6 ? 6.5 : 7.4, cellPadding: { top: 1.8, bottom: 1.8, left: 0.6, right: 0.6 }, textColor: TEXT, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 36, fontStyle: 'bold', textColor: INK } },
    didParseCell: (d: any) => {
      if (d.section !== 'body') return;
      const l = keyLines[d.row.index];
      const s = d.cell.styles;
      s.fillColor = d.row.index % 2 ? SOFT : [255, 255, 255];
      if (l.strong) {
        s.fillColor = [226, 232, 240];
        s.fontStyle = 'bold';
        s.textColor = INK;
      }
      if (l.net) {
        s.fillColor = INK;
        s.textColor = d.column.index === 0 ? [255, 255, 255] : GOLD;
        s.fontStyle = 'bold';
      }
      if (l.pctRow) {
        s.fontStyle = 'italic';
        s.textColor = MUTED;
      }
      if (d.column.index > 0 && !l.pctRow && !l.net && typeof d.cell.raw === 'string' && d.cell.raw.startsWith('-') && d.cell.raw !== '-') s.textColor = RED;
    },
  });
  y = doc.lastAutoTable.finalY + 6;
  // month-by-month forecast achievement
  if (y < pageH() - 50) {
    sectionTitle('Forecast Achievement by Month', 'actual ÷ forecast');
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      margin: { left: M, right: M, bottom: 16 },
      head: [['Line', ...mLabels]],
      body: [
        ['Revenue', ...months.map((m) => pct(ratio(sec('REVENUE', m, 'ACTUAL'), sec('REVENUE', m, 'FORECAST')), 0))],
        ['Gross Profit', ...months.map((m) => pct(ratio(profitM(P('GP').minus, m, 'ACTUAL'), profitM(P('GP').minus, m, 'FORECAST')), 0))],
        ['Net Profit (AT)', ...months.map((m) => pct(ratio(profitM(P('NPAT').minus, m, 'ACTUAL'), profitM(P('NPAT').minus, m, 'FORECAST')), 0))],
      ],
      styles: { fontSize: months.length > 9 ? 6 : 7, cellPadding: { top: 1.8, bottom: 1.8, left: 0.6, right: 0.6 }, textColor: TEXT, halign: 'center' },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 36, fontStyle: 'bold', textColor: INK } },
      didParseCell: (d: any) => {
        if (d.section !== 'body' || d.column.index === 0) return;
        const v = parseFloat(String(d.cell.raw));
        if (Number.isFinite(v)) d.cell.styles.textColor = v >= 100 ? GREEN : v >= 90 ? GOLD_DARK : RED;
      },
    });
  }

  // ───────────── break-even point (same rules as the Break-Even Point tab) ─────────────
  newPage('Break-Even Point', 'Sales needed to cover all fixed costs');
  {
    // cost behaviour: COST_BEHAVIOR wins; when empty only COGS is variable, other expenses (not taxes) are fixed
    const isVariable = (a: FinancialAccount) =>
      a.ACCOUNT_TYPE !== 'REVENUE' && (a.COST_BEHAVIOR === 'VARIABLE' || (!a.COST_BEHAVIOR && a.ACCOUNT_TYPE === 'COGS'));
    const isFixed = (a: FinancialAccount) =>
      a.ACCOUNT_TYPE !== 'REVENUE' &&
      (a.COST_BEHAVIOR === 'FIXED' || (!a.COST_BEHAVIOR && ['DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'DEPRECIATION', 'FINANCE_COST'].includes(a.ACCOUNT_TYPE)));
    const revAccs = byType('REVENUE');
    const varAccs = accounts.filter(isVariable);
    const fixAccs = accounts.filter(isFixed);
    const keyOf = (name: string) =>
      name.toLowerCase().replace(/\b(revenues?|sales|cogs|cost of goods sold|cost of sales)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    // COGS follows its own revenue stream when the names match; other variable costs follow total revenue
    const driver = new Map<string, string | null>();
    varAccs.forEach((a) => {
      let d: string | null = null;
      if (a.ACCOUNT_TYPE === 'COGS') d = revAccs.find((r) => keyOf(r.ACCOUNT_NAME) === keyOf(a.ACCOUNT_NAME))?.ID ?? null;
      driver.set(a.ID, d);
    });
    const driverRev = (id: string, m: number, mode: Mode) => {
      const d = driver.get(id);
      return d ? amt(d, m, mode) : revAccs.reduce((t, r) => t + amt(r.ID, m, mode), 0);
    };
    // variable rate = actual cost / actual driver revenue over the months of the year with revenue
    const rate = new Map<string, number | null>();
    varAccs.forEach((a) => {
      let cost = 0;
      let rev = 0;
      for (let m = 1; m <= 12; m++) {
        const r = driverRev(a.ID, m, 'ACTUAL');
        if (r > 0) {
          rev += r;
          cost += amt(a.ID, m, 'ACTUAL');
        }
      }
      rate.set(a.ID, rev > 0 && cost !== 0 ? cost / rev : null);
    });
    // forecast of a variable cost left empty = actual rate x forecast driver revenue
    const bAmt = (id: string, m: number, mode: Mode) => {
      const r = rate.get(id);
      if (mode === 'FORECAST' && r !== undefined && r !== null && amt(id, m, 'FORECAST') === 0) return r * driverRev(id, m, 'FORECAST');
      return amt(id, m, mode);
    };
    const revM2 = (m: number, mode: Mode) => revAccs.reduce((t, a) => t + bAmt(a.ID, m, mode), 0);
    const varM = (m: number, mode: Mode) => varAccs.reduce((t, a) => t + bAmt(a.ID, m, mode), 0);
    const fixM = (m: number, mode: Mode) => fixAccs.reduce((t, a) => t + bAmt(a.ID, m, mode), 0);
    const sumR = (fn: (m: number, mode: Mode) => number, mode: Mode) => months.reduce((t, m) => t + fn(m, mode), 0);

    let hRev = 0;
    let hCm = 0;
    for (let m = 1; m <= 12; m++) {
      const r = revM2(m, 'ACTUAL');
      if (r > 0) {
        hRev += r;
        hCm += r - varM(m, 'ACTUAL');
      }
    }
    const histCm = hRev > 0 ? hCm / hRev : NaN;
    const cmInfo = (rev: number, cm: number, fixed: number, mode: Mode) => {
      const own = rev > 0 ? cm / rev : NaN;
      if (Number.isFinite(own) && own > 0) return { pct: own, fallback: false };
      if (mode === 'FORECAST' && (fixed !== 0 || rev > 0) && Number.isFinite(histCm) && histCm > 0) return { pct: histCm, fallback: true };
      return { pct: own, fallback: false };
    };
    const bep = (fixed: number, cm: number) => (!Number.isFinite(cm) || cm <= 0 ? NaN : fixed / cm);

    type Col = { rev: number; vc: number; cm: number; cmPct: number; fb: boolean; fc: number; be: number; mos: number; mosPct: number };
    const colFor = (m: number, mode: Mode): Col => {
      const rev = revM2(m, mode);
      const vc = varM(m, mode);
      const fc = fixM(m, mode);
      const info = cmInfo(rev, rev - vc, fc, mode);
      const be = bep(fc, info.pct);
      const mos = rev <= 0 ? NaN : rev - be;
      return { rev, vc, cm: rev - vc, cmPct: info.pct, fb: info.fallback, fc, be, mos, mosPct: Number.isFinite(mos) && rev > 0 ? (mos / rev) * 100 : NaN };
    };
    const totalFor = (mode: Mode): Col => {
      const rev = sumR(revM2, mode);
      const vc = sumR(varM, mode);
      const fc = sumR(fixM, mode);
      const info = cmInfo(rev, rev - vc, fc, mode);
      let mos = 0;
      let mosRev = 0;
      let any = false;
      months.forEach((m) => {
        const c = colFor(m, mode);
        if (Number.isFinite(c.mos)) {
          mos += c.mos;
          mosRev += c.rev;
          any = true;
        }
      });
      return {
        rev,
        vc,
        cm: rev - vc,
        cmPct: info.pct,
        fb: info.fallback,
        fc,
        be: bep(fc, info.pct),
        mos: any ? mos : NaN,
        mosPct: any && mosRev > 0 ? (mos / mosRev) * 100 : NaN,
      };
    };

    // summary cards
    const tA = totalFor('ACTUAL');
    const tF = totalFor('FORECAST');
    const fmtN = (v: number) => (Number.isFinite(v) ? money0(v) : 'N/A');
    const fmtP = (v: number, star = false) => (Number.isFinite(v) ? `${v.toFixed(1)}%${star ? '*' : ''}` : 'N/A');
    const cards: [string, string, string, RGB][] = [
      ['Revenue', fmtN(tA.rev), fmtN(tF.rev), EMERALD],
      ['Contribution Margin %', fmtP(tA.cmPct * 100), fmtP(tF.cmPct * 100, tF.fb), GOLD],
      ['Fixed Costs', fmtN(tA.fc), fmtN(tF.fc), ORANGE],
      ['Break-Even Sales', fmtN(tA.be), fmtN(tF.be), INK],
      ['Surplus / Shortfall', fmtN(tA.mos), fmtN(tF.mos), tA.mos < 0 ? RED : GREEN],
      ['Surplus %', fmtP(tA.mosPct), fmtP(tF.mosPct), tA.mosPct < 0 ? RED : GREEN],
    ];
    const pw = pageW();
    const kw = (pw - M * 2 - 8) / 3;
    cards.forEach(([label, a, f, color], i) => {
      const cx = M + (i % 3) * (kw + 4);
      const cy = y + Math.floor(i / 3) * 25;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, cy, kw, 21, 2.5, 2.5, 'FD');
      doc.setFillColor(...color);
      doc.roundedRect(cx, cy, kw, 1.4, 0.7, 0.7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text(label.toUpperCase(), cx + 4, cy + 6.5);
      doc.setFontSize(12);
      doc.setTextColor(...(a.startsWith('-') ? RED : INK));
      doc.text(a, cx + 4, cy + 13.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...MUTED);
      doc.text(`Forecast ${f}`, cx + 4, cy + 18.3);
    });
    y += 25 * 2 + 4;

    // monthly tables: actual, then forecast
    const lines: { label: string; get: (c: Col) => string; strong?: boolean; italic?: boolean; key?: boolean }[] = [
      { label: 'Revenue', get: (c) => compactB(c.rev), strong: true },
      { label: 'Variable Costs', get: (c) => compactB(c.vc) },
      { label: 'Contribution', get: (c) => compactB(c.cm), strong: true },
      { label: 'CM %', get: (c) => fmtP(c.cmPct * 100, c.fb), italic: true },
      { label: 'Fixed Costs', get: (c) => compactB(c.fc) },
      { label: 'Break-Even', get: (c) => (Number.isFinite(c.be) ? compactB(c.be) : 'N/A'), key: true },
      { label: 'Surplus / Shortfall', get: (c) => (Number.isFinite(c.mos) ? compactB(c.mos) : '-'), strong: true },
      { label: 'Surplus %', get: (c) => (Number.isFinite(c.mosPct) ? `${c.mosPct.toFixed(1)}%` : '-'), italic: true },
    ];
    const table = (mode: Mode) => {
      const cols = months.map((m) => colFor(m, mode));
      const tot = totalFor(mode);
      autoTable(doc, {
        startY: y,
        theme: 'plain',
        margin: { left: M, right: M, top: 14, bottom: 16 },
        head: [['Line', ...mLabels, 'Total']],
        body: lines.map((l) => [l.label, ...cols.map((c) => l.get(c)), l.get(tot)]),
        styles: { fontSize: months.length > 9 ? 5.8 : months.length > 6 ? 6.5 : 7.4, cellPadding: { top: 1.8, bottom: 1.8, left: 0.6, right: 0.6 }, textColor: TEXT, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: mode === 'ACTUAL' ? INK : [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 30, fontStyle: 'bold', textColor: INK } },
        didParseCell: (d: any) => {
          if (d.section !== 'body') return;
          const l = lines[d.row.index];
          const st = d.cell.styles;
          st.fillColor = d.row.index % 2 ? SOFT : [255, 255, 255];
          if (l.strong) {
            st.fillColor = [226, 232, 240];
            st.fontStyle = 'bold';
            st.textColor = INK;
          }
          if (l.key) {
            st.fillColor = INK;
            st.textColor = d.column.index === 0 ? [255, 255, 255] : GOLD;
            st.fontStyle = 'bold';
          }
          if (l.italic) {
            st.fontStyle = 'italic';
            st.textColor = MUTED;
          }
          const raw = String(d.cell.raw);
          if (d.column.index > 0 && !l.key && raw.startsWith('-') && raw !== '-') st.textColor = RED;
          if (d.column.index > 0 && l.label.startsWith('Surplus') && !raw.startsWith('-') && raw !== '-' && raw !== 'N/A') st.textColor = GREEN;
        },
      });
      y = doc.lastAutoTable.finalY + 7;
    };
    sectionTitle('Actual', 'by month');
    table('ACTUAL');
    ensure(70, 'Break-Even Point', 'Sales needed to cover all fixed costs');
    sectionTitle('Forecast', 'by month');
    table('FORECAST');

    // how it is calculated
    const notes = [
      'Contribution = Revenue - Variable Costs.   CM % = Contribution ÷ Revenue.',
      'Break-Even = Fixed Costs ÷ CM % (N/A when CM % is zero or negative).   Surplus = Revenue - Break-Even.',
      'Variable costs: accounts set as Variable (or COGS when not set). Fixed costs: accounts set as Fixed (or direct, indirect, depreciation and finance cost when not set). Taxes are excluded.',
      'Forecast: an empty forecast for a variable cost is filled with its actual rate × the forecast revenue. * = historical actual CM % used because the forecast has no valid CM %.',
    ];
    ensure(8 + notes.length * 8, 'Break-Even Point', 'Sales needed to cover all fixed costs');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    notes.forEach((n) => {
      const ls = doc.splitTextToSize(n, pw - M * 2);
      doc.text(ls, M, y);
      y += ls.length * 3.4 + 1.2;
    });
  }

  // ───────────── dashboard KPIs (landscape) ─────────────
  newPage('Dashboard', 'Key performance indicators — actual vs forecast', 'l');
  {
    const LW = pageW();
    const dirA = secTot('DIRECT_EXPENSE', 'ACTUAL');
    const dirF = secTot('DIRECT_EXPENSE', 'FORECAST');
    const indA = secTot('INDIRECT_EXPENSE', 'ACTUAL');
    const indF = secTot('INDIRECT_EXPENSE', 'FORECAST');
    const totExp = (mode: Mode) => ['DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'DEPRECIATION', 'FINANCE_COST', 'TAXES'].reduce((t, x) => t + secTot(x, mode), 0);
    const pv = (key: string, mode: Mode) => profitT(P(key).minus, mode);
    const mg = (key: string, mode: Mode) => ratio(pv(key, mode), mode === 'ACTUAL' ? revA : revF) ?? 0;
    const cards: { title: string; a: number; f: number; percent?: boolean; cost?: boolean; color: RGB }[] = [
      { title: 'Total Revenue', a: revA, f: revF, color: EMERALD },
      { title: 'Cost of Goods Sold', a: secTot('COGS', 'ACTUAL'), f: secTot('COGS', 'FORECAST'), cost: true, color: RED },
      { title: 'Gross Profit', a: pv('GP', 'ACTUAL'), f: pv('GP', 'FORECAST'), color: [20, 184, 166] },
      { title: 'Gross Margin', a: mg('GP', 'ACTUAL'), f: mg('GP', 'FORECAST'), percent: true, color: [20, 184, 166] },
      { title: 'EBITDA', a: pv('EBITDA', 'ACTUAL'), f: pv('EBITDA', 'FORECAST'), color: [99, 102, 241] },
      { title: 'EBITDA Margin', a: mg('EBITDA', 'ACTUAL'), f: mg('EBITDA', 'FORECAST'), percent: true, color: [99, 102, 241] },
      { title: 'EBIT', a: pv('EBIT', 'ACTUAL'), f: pv('EBIT', 'FORECAST'), color: BLUE },
      { title: 'EBIT Margin', a: mg('EBIT', 'ACTUAL'), f: mg('EBIT', 'FORECAST'), percent: true, color: BLUE },
      { title: 'Net Profit (Before Tax)', a: pv('NPBT', 'ACTUAL'), f: pv('NPBT', 'FORECAST'), color: GOLD },
      { title: 'Net Profit Margin', a: mg('NPBT', 'ACTUAL'), f: mg('NPBT', 'FORECAST'), percent: true, color: GOLD },
      { title: 'Direct Expenses', a: dirA, f: dirF, cost: true, color: ORANGE },
      { title: 'Indirect Expenses', a: indA, f: indF, cost: true, color: ORANGE },
      { title: 'Depreciation', a: secTot('DEPRECIATION', 'ACTUAL'), f: secTot('DEPRECIATION', 'FORECAST'), cost: true, color: SLATE },
      { title: 'Total Expenses', a: totExp('ACTUAL'), f: totExp('FORECAST'), cost: true, color: RED },
    ];
    const perRow = 5;
    const gap = 4;
    const kw = (LW - M * 2 - gap * (perRow - 1)) / perRow;
    const kh = 34;
    cards.forEach((c, i) => {
      const cx = M + (i % perRow) * (kw + gap);
      const cy = y + Math.floor(i / perRow) * (kh + gap);
      const diff = c.a - c.f;
      const good = diff === 0 ? null : c.cost ? diff < 0 : diff > 0;
      const variance = c.percent ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pts` : `${varPct(c.a, c.f) >= 0 ? '+' : ''}${varPct(c.a, c.f).toFixed(1)}%`;
      const fmt = (v: number) => (c.percent ? `${v.toFixed(1)}%` : money0(v));
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, cy, kw, kh, 2.5, 2.5, 'FD');
      doc.setFillColor(...c.color);
      doc.roundedRect(cx, cy, kw, 1.6, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text(c.title.toUpperCase(), cx + 4, cy + 7);
      doc.setFontSize(6);
      doc.setTextColor(...EMERALD);
      doc.text('ACTUAL', cx + 4, cy + 12.5);
      doc.setTextColor(...BLUE);
      doc.text('FORECAST', cx + kw / 2 + 2, cy + 12.5);
      doc.setFontSize(12);
      doc.setTextColor(...(c.a < 0 ? RED : INK));
      doc.text(fmt(c.a), cx + 4, cy + 18.5);
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text(fmt(c.f), cx + kw / 2 + 2, cy + 18.5);
      // variance badge
      doc.setFontSize(7.5);
      const badgeColor: RGB = good === null ? MUTED : good ? GREEN : RED;
      const badgeFill: RGB = good === null ? SOFT : good ? [236, 253, 245] : [254, 242, 242];
      const bw = doc.getTextWidth(variance) + 5;
      doc.setFillColor(...badgeFill);
      doc.roundedRect(cx + 4, cy + 22, bw, 5, 1, 1, 'F');
      doc.setTextColor(...badgeColor);
      doc.text(variance, cx + 6.5, cy + 25.6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...MUTED);
      doc.text('vs forecast', cx + 4 + bw + 2, cy + 25.6);
      // progress (actual / forecast)
      const prog = c.f === 0 ? (c.a > 0 ? 1 : 0) : Math.min(1, Math.abs(c.a / c.f));
      doc.setFillColor(...SOFT);
      doc.rect(cx + 0.4, cy + kh - 2.4, kw - 0.8, 2, 'F');
      doc.setFillColor(...badgeColor);
      if (prog > 0) doc.rect(cx + 0.4, cy + kh - 2.4, (kw - 0.8) * prog, 2, 'F');
    });
    y += Math.ceil(cards.length / perRow) * (kh + gap) + 2;
  }

  // ───────────── page 3: cost structure ─────────────
  newPage('Cost Structure', 'Where the revenue goes');
  const structure = SECTIONS.filter((s) => s.cost).map((s) => ({ label: s.label, value: ratio(secTot(s.type, 'ACTUAL'), revA) ?? 0, color: s.color }));
  structure.push({ label: 'Net Profit (AT)', value: ratio(profitT(P('NPAT').minus, 'ACTUAL'), revA) ?? 0, color: GREEN });
  hBars(M, y, W - M * 2, 14 + structure.length * 7, 'Share of revenue (actual)', structure, (v) => pct(v));
  y += 14 + structure.length * 7 + 6;

  const catRows: { label: string; type: string; a: number; f: number }[] = [];
  SECTIONS.filter((s) => s.cost).forEach((s) => {
    const cats = new Map<string, { a: number; f: number }>();
    byType(s.type).forEach((acc) => {
      const c = cats.get(category(acc)) || { a: 0, f: 0 };
      c.a += accTot(acc.ID, 'ACTUAL');
      c.f += accTot(acc.ID, 'FORECAST');
      cats.set(category(acc), c);
    });
    cats.forEach((v, k) => catRows.push({ label: k === 'General' ? s.label : k, type: s.type, a: v.a, f: v.f }));
  });
  const topCats = [...catRows].sort((a, b) => b.a - a.a).slice(0, 10);
  if (topCats.length) {
    const h = 14 + topCats.length * 7;
    ensure(h, 'Cost Structure', 'Where the revenue goes');
    hBars(M, y, W - M * 2, h, 'Top expense groups (actual amount)', topCats.map((c) => ({ label: c.label, value: c.a, color: SECTIONS.find((s) => s.type === c.type)!.color })), (v) => money0(v));
    y += h + 6;
  }

  newPage('Expense Groups', 'Actual vs forecast by expense group');
  sectionTitle('Expense Groups — Actual vs Forecast');
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: { left: M, right: M, top: 14, bottom: 16 },
    head: [['Group', 'Section', 'Actual', 'Forecast', 'Variance', 'Var %', '% of Revenue']],
    body: catRows.map((c) => [shape(c.label), SECTIONS.find((s) => s.type === c.type)!.label, money(c.a), money(c.f), money(c.a - c.f), pct(varPct(c.a, c.f)), pct(ratio(c.a, revA))]),
    showHead: 'everyPage',
    styles: { fontSize: 7.3, cellPadding: 1.8, textColor: TEXT, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: INK, cellWidth: 44 } },
    didParseCell: (d: any) => {
      if (d.section !== 'body') return;
      d.cell.styles.fillColor = d.row.index % 2 ? SOFT : [255, 255, 255];
      const c = catRows[d.row.index];
      if (d.column.index === 0) arFont(d, c.label);
      if (d.column.index === 4 || d.column.index === 5) d.cell.styles.textColor = c.a > c.f ? RED : c.a < c.f ? GREEN : TEXT;
    },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ───────────── footer ─────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const w = pageW();
    const h = pageH();
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, h - 9, w - M, h - 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    const t = new Date();
    doc.text(`Generated ${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`, M, h - 5);
    doc.text(`Page ${p} of ${pages}`, w - M, h - 5, { align: 'right' });
  }

  saveTrackedPdf(doc, `PnL_Report_${year}_${MONTHS[startMonth - 1]}-${MONTHS[endMonth - 1]}.pdf`);
}
