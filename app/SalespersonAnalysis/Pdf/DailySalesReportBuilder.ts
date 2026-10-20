// ════════════════════════════════════════════════════════════════
//  Salesperson Analysis — Daily Sales PDF (sidebar button + Scheduled Reports email)
//  Builds the document only (works in the browser and on the server);
//  DailySalesReport.ts downloads it, the scheduled reports runner emails it.
//  Page 1+: the whole company for the chosen day(s) compared with the period
//  of the same length right before; then one section per salesperson.
//  Same sales rules as the Sales tab (returns = negative lines, profit only on
//  lines that have a cost).
// ════════════════════════════════════════════════════════════════

import type { DailySalesLine, DailySalesReportData, DailyTotals } from '../Utils/DailyTypes';

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
  white: [255, 255, 255] as RGB,
};

const money = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = (n: number) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const shortMoney = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return whole(n);
};
const fmtDay = (iso: string) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const weekday = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};
const change = (cur: number, prev: number): number | null => {
  if (!prev) return cur ? null : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
};
const pctText = (v: number | null) => (v === null || !Number.isFinite(v) ? 'NEW' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`);
const share = (v: number, total: number) => (total ? `${((v / total) * 100).toFixed(1)}%` : '-');
const shortCategory = (c: string) => {
  const parts = String(c || '').split('/').map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : c;
};
const nowText = () => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(t.getDate())}/${p(t.getMonth() + 1)}/${t.getFullYear()} ${p(t.getHours())}:${p(t.getMinutes())}`;
};

/** Totals of a set of lines (same rules as the Sales tab). */
function totalsOf(lines: DailySalesLine[]): DailyTotals & { products: number } {
  const t = { gross: 0, returns: 0, net: 0, invoices: 0, customers: 0, qty: 0, profit: 0, costedSales: 0, products: 0 };
  const inv = new Set<string>();
  const cus = new Set<string>();
  const prod = new Set<string>();
  for (const l of lines) {
    const q = Math.abs(l.qty);
    t.net += l.amount;
    if (l.amount > 0) {
      t.gross += l.amount;
      t.qty += q;
      if (l.invoice) inv.add(l.invoice);
      if (l.customerId) cus.add(l.customerId);
      if (l.productId) prod.add(l.productId);
      if (l.cost > 0) {
        t.profit += l.amount - l.cost * q;
        t.costedSales += l.amount;
      }
    } else if (l.amount < 0) {
      t.returns += -l.amount;
      if (l.cost > 0) {
        t.profit += l.amount + l.cost * q;
        t.costedSales += l.amount;
      }
    }
  }
  t.invoices = inv.size;
  t.customers = cus.size;
  t.products = prod.size;
  return t;
}
const margin = (t: { profit: number; costedSales: number }) => (t.costedSales > 0 ? (t.profit / t.costedSales) * 100 : null);

type Group = { key: string; lines: DailySalesLine[]; net: number; gross: number; returns: number; qty: number; invoices: number; customers: number };
function groupBy(lines: DailySalesLine[], keyOf: (l: DailySalesLine) => string): Group[] {
  const map = new Map<string, DailySalesLine[]>();
  for (const l of lines) {
    const k = keyOf(l);
    const arr = map.get(k);
    if (arr) arr.push(l);
    else map.set(k, [l]);
  }
  return Array.from(map, ([key, ls]) => {
    const t = totalsOf(ls);
    return { key, lines: ls, net: t.net, gross: t.gross, returns: t.returns, qty: t.qty, invoices: t.invoices, customers: t.customers };
  }).sort((a, b) => b.net - a.net);
}

/** addFont: loads the Arabic font (Amiri) into the doc — throw if it can't (names fall back to helvetica). */
export async function buildDailySalesReportPdf(
  data: DailySalesReportData,
  addFont: (doc: any) => Promise<void>,
): Promise<{ doc: any; fileName: string }> {
  const { period, prevPeriod, lines, showCosts } = data;
  const oneDay = period.start === period.end;
  const total = totalsOf(lines);
  const prev = data.prevTotals;
  const custName = (id: string) => data.customers[id]?.name || id || '-';
  const custCity = (id: string) => data.customers[id]?.city || '-';
  const spName = (id: string) => data.salespersons[id] || id;
  const prodName = (id: string) => data.products[id]?.name || id || '-';

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
  const TOP = 38;

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (style: 'normal' | 'bold' = 'normal', size = 10) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };

  const periodText = oneDay ? `${weekday(period.start)} ${fmtDay(period.start)}` : `${fmtDay(period.start)}  -  ${fmtDay(period.end)}`;
  const prevText = prevPeriod.start === prevPeriod.end ? fmtDay(prevPeriod.start) : `${fmtDay(prevPeriod.start)} - ${fmtDay(prevPeriod.end)}`;

  // ── page header ──
  let section = 'Company Overview';
  const header = () => {
    setFill(C.ink);
    doc.rect(0, 0, W, 28, 'F');
    setFill(C.gold);
    doc.rect(0, 28, W, 1.2, 'F');
    font('bold', 16);
    setText(C.white);
    doc.text(oneDay ? 'Daily Sales Report' : 'Sales Report', M, 13);
    doc.setFont(nameFont, 'normal');
    doc.setFontSize(10);
    setText([203, 213, 225]);
    doc.text(section, M, 20.5);
    font('bold', 9);
    setText(C.gold);
    doc.text('SALESPERSON ANALYSIS', W - M, 11, { align: 'right' });
    font('normal', 8);
    setText([203, 213, 225]);
    doc.text(periodText, W - M, 16.5, { align: 'right' });
    doc.text(`compared with ${prevText}  •  generated ${nowText()}`, W - M, 22, { align: 'right' });
  };
  let y = 0;
  const newPage = (name: string) => {
    if (y > 0) doc.addPage();
    section = name;
    header();
    y = TOP;
  };
  const ensure = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      header();
      y = TOP;
    }
  };

  const sectionTitle = (text: string, sub?: string) => {
    ensure(18);
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

  // ── KPI cards ──
  type Card = { label: string; value: string; change?: number | null; invert?: boolean; foot?: string; accent: RGB };
  const cards = (list: Card[], perRow = 3, ch = 27) => {
    const gap = 4;
    const cw = (W - M * 2 - gap * (perRow - 1)) / perRow;
    for (let i = 0; i < list.length; i += perRow) {
      ensure(ch + 4);
      list.slice(i, i + perRow).forEach((c, j) => {
        const x = M + j * (cw + gap);
        setFill(C.white);
        setDraw(C.line);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, cw, ch, 3, 3, 'FD');
        setFill(c.accent);
        doc.roundedRect(x, y, cw, 1.8, 0.9, 0.9, 'F');
        font('bold', 6.8);
        setText(C.muted);
        doc.text(c.label.toUpperCase(), x + 3.5, y + 7.5);
        font('bold', c.value.length > 14 ? 11 : 13);
        setText(C.ink);
        doc.text(c.value, x + 3.5, y + 15);
        let fx = x + 3.5;
        if (c.change !== undefined) {
          const good = c.change === null ? null : c.invert ? c.change <= 0 : c.change >= 0;
          const badge = pctText(c.change);
          font('bold', 6.8);
          const bw = doc.getTextWidth(badge) + 5;
          setFill(good === null ? C.goldSoft : good ? C.greenSoft : C.redSoft);
          doc.roundedRect(fx, y + ch - 8.5, bw, 5, 2.5, 2.5, 'F');
          setText(good === null ? C.goldDark : good ? C.green : C.red);
          doc.text(badge, fx + bw / 2, y + ch - 5, { align: 'center' });
          fx += bw + 2;
        }
        if (c.foot) {
          font('normal', 6.5);
          setText(C.muted);
          doc.text(doc.splitTextToSize(c.foot, cw - (fx - x) - 3)[0], fx, y + ch - 5);
        }
      });
      y += ch + 4;
    }
    y += 1;
  };

  // ── horizontal bars (one value per row) ──
  const hBars = (rows: { label: string; value: number }[], color: RGB = C.gold) => {
    if (!rows.length) return;
    const rowH = 6.2;
    const height = rows.length * rowH;
    ensure(height + 8);
    const labelW = 46;
    const x0 = M + labelW;
    const plotW = W - M - x0 - 22;
    const maxV = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
    rows.forEach((r, i) => {
      const by = y + i * rowH;
      doc.setFont(nameFont, 'normal');
      doc.setFontSize(8);
      setText(C.text);
      const label = doc.splitTextToSize(r.label, labelW - 3)[0];
      doc.text(label, x0 - 2, by + 4, { align: 'right' });
      setFill(C.soft);
      doc.rect(x0, by + 1, plotW, rowH - 2, 'F');
      const w = (Math.abs(r.value) / maxV) * plotW;
      setFill(r.value < 0 ? C.red : color);
      if (w > 0.2) doc.rect(x0, by + 1, w, rowH - 2, 'F');
      font('bold', 7);
      setText(C.ink);
      doc.text(shortMoney(r.value), x0 + plotW + 2, by + 4);
    });
    y += height + 6;
  };

  // ── tables ──
  const table = (opts: {
    title?: string;
    sub?: string;
    head: string[];
    body: any[][];
    foot?: any[];
    nameCols?: number[];
    boldCols?: number[];
    colWidths?: Record<number, number>;
    fontSize?: number;
    didParseCell?: (d: any) => void;
  }) => {
    // small tables stay in one piece; long ones start where they are and continue on the next page
    ensure(Math.min(55, 22 + (Math.max(opts.body.length, 1) + (opts.foot ? 2 : 1)) * 6.6));
    if (opts.title) sectionTitle(opts.title, opts.sub);
    const columnStyles: Record<number, any> = {};
    opts.head.forEach((_, i) => {
      columnStyles[i] = { halign: 'center' }; // every column centred (header and rows)
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
      margin: { left: M, right: M, top: TOP, bottom: 16 },
      head: [opts.head],
      body: opts.body.length ? opts.body : [[{ content: 'No data', colSpan: opts.head.length, styles: { textColor: C.muted } }]],
      foot: opts.foot && opts.body.length ? [opts.foot] : undefined,
      showFoot: 'lastPage',
      styles: { fontSize: opts.fontSize ?? 7.6, cellPadding: 1.8, textColor: C.text, halign: 'center', valign: 'middle', lineWidth: 0, overflow: 'linebreak' },
      headStyles: { fillColor: C.ink, textColor: C.gold, fontStyle: 'bold', fontSize: (opts.fontSize ?? 7.6) - 0.4, halign: 'center' },
      footStyles: { fillColor: C.goldSoft, textColor: C.ink, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: C.soft },
      columnStyles,
      willDrawPage: () => header(),
      didParseCell: (d: any) => {
        if (d.section === 'body' && d.row.index > 0) {
          d.cell.styles.lineWidth = { top: 0.1 };
          d.cell.styles.lineColor = C.line;
        }
        opts.didParseCell?.(d);
      },
    });
    y = (doc.lastAutoTable?.finalY || y) + 8;
  };
  const growthCell = (col: number) => (d: any) => {
    if (d.section !== 'body' || d.column.index !== col) return;
    const raw = String(d.cell.raw ?? '');
    if (raw === 'NEW' || raw === '-') {
      d.cell.styles.textColor = C.goldDark;
    } else if (raw.startsWith('+')) d.cell.styles.textColor = C.green;
    else if (raw.startsWith('-')) d.cell.styles.textColor = C.red;
    d.cell.styles.fontStyle = 'bold';
  };
  const negCell = (cols: number[]) => (d: any) => {
    if (d.section !== 'body' || !cols.includes(d.column.index)) return;
    if (String(d.cell.raw ?? '').startsWith('-')) d.cell.styles.textColor = C.red;
  };

  // ════════════════ COMPANY OVERVIEW ════════════════
  newPage(data.allSalespersons ? 'All Salespersons' : spName(Object.keys(data.salespersons)[0] || ''));

  const avgInv = total.invoices ? total.gross / total.invoices : 0;
  const prevAvgInv = prev.invoices ? prev.gross / prev.invoices : 0;
  const curMargin = margin(total);
  const prevMargin = margin(prev);
  const kpis: Card[] = [
    { label: 'Net Sales', value: `AED ${money(total.net)}`, change: change(total.net, prev.net), foot: `prev ${shortMoney(prev.net)}`, accent: C.gold },
    { label: 'Gross Sales', value: `AED ${money(total.gross)}`, change: change(total.gross, prev.gross), foot: `prev ${shortMoney(prev.gross)}`, accent: C.goldDark },
    {
      label: 'Returns',
      value: `AED ${money(total.returns)}`,
      change: change(total.returns, prev.returns),
      invert: true,
      foot: total.gross ? `${((total.returns / total.gross) * 100).toFixed(1)}% of gross` : '',
      accent: C.red,
    },
    { label: 'Invoices', value: whole(total.invoices), change: change(total.invoices, prev.invoices), foot: `prev ${whole(prev.invoices)}`, accent: C.ink },
    { label: 'Customers', value: whole(total.customers), change: change(total.customers, prev.customers), foot: `prev ${whole(prev.customers)}`, accent: C.ink },
    { label: 'Avg Invoice', value: `AED ${money(avgInv)}`, change: change(avgInv, prevAvgInv), foot: 'gross / invoices', accent: C.ink },
    { label: 'Items Sold', value: whole(total.qty), change: change(total.qty, prev.qty), foot: `${whole(total.products)} products`, accent: C.green },
  ];
  if (showCosts) {
    kpis.push(
      { label: 'Gross Profit', value: `AED ${money(total.profit)}`, change: change(total.profit, prev.profit), foot: `prev ${shortMoney(prev.profit)}`, accent: C.green },
      {
        label: 'Margin',
        value: curMargin === null ? '-' : `${curMargin.toFixed(1)}%`,
        foot: prevMargin === null ? '' : `prev ${prevMargin.toFixed(1)}%`,
        accent: C.green,
      },
    );
  }
  cards(kpis);

  // ── salespersons ranking ──
  const bySp = groupBy(lines, (l) => l.salespersonId);
  const spIds = new Set([...bySp.map((g) => g.key), ...Object.keys(data.prevNetBySalesperson).filter((k) => data.salespersons[k])]);
  if (data.allSalespersons) {
    const head = ['#', 'Salesperson', 'Invoices', 'Customers', 'Gross', 'Returns', 'Net', 'Share', `vs ${oneDay ? 'Prev Day' : 'Prev'}`];
    if (showCosts) head.push('Profit', 'Margin');
    const body = bySp.map((g, i) => {
      const t = totalsOf(g.lines);
      const row: any[] = [
        String(i + 1),
        spName(g.key),
        whole(g.invoices),
        whole(g.customers),
        money(g.gross),
        g.returns ? `-${money(g.returns)}` : '0.00',
        money(g.net),
        share(g.net, total.net),
        pctText(change(g.net, data.prevNetBySalesperson[g.key] || 0)),
      ];
      if (showCosts) row.push(money(t.profit), margin(t) === null ? '-' : `${margin(t)!.toFixed(1)}%`);
      return row;
    });
    const foot: any[] = ['', 'Total', whole(total.invoices), whole(total.customers), money(total.gross), total.returns ? `-${money(total.returns)}` : '0.00', money(total.net), '100%', pctText(change(total.net, prev.net))];
    if (showCosts) foot.push(money(total.profit), curMargin === null ? '-' : `${curMargin.toFixed(1)}%`);
    table({
      title: 'Sales by Salesperson',
      sub: `${bySp.length} salesperson${bySp.length === 1 ? '' : 's'} sold in this period${spIds.size > bySp.length ? ` • ${spIds.size - bySp.length} sold in the previous period only` : ''}`,
      head,
      body,
      foot,
      nameCols: [1],
      boldCols: [6],
      colWidths: { 0: 7 },
      fontSize: showCosts ? 7 : 7.6,
      didParseCell: (d) => {
        growthCell(8)(d);
        negCell([5])(d);
      },
    });
    if (bySp.length > 1) {
      sectionTitle('Net Sales by Salesperson');
      hBars(bySp.map((g) => ({ label: spName(g.key), value: g.net })));
    }
  }

  // ── by day (several days only) ──
  if (!oneDay) {
    const byDay = groupBy(lines, (l) => l.date).sort((a, b) => a.key.localeCompare(b.key));
    table({
      title: 'Sales by Day',
      head: ['Date', 'Day', 'Invoices', 'Customers', 'Gross', 'Returns', 'Net'],
      body: byDay.map((g) => [fmtDay(g.key), weekday(g.key), whole(g.invoices), whole(g.customers), money(g.gross), g.returns ? `-${money(g.returns)}` : '0.00', money(g.net)]),
      boldCols: [6],
      didParseCell: negCell([5]),
    });
  }

  // ── top customers ──
  const byCustomer = groupBy(lines, (l) => l.customerId);
  table({
    title: 'Top Customers',
    sub: `${byCustomer.length} customer${byCustomer.length === 1 ? '' : 's'} • top 15 by net sales`,
    head: ['#', 'Customer', 'City', ...(data.allSalespersons ? ['Salesperson'] : []), 'Invoices', 'Net', 'Share'],
    body: byCustomer.slice(0, 15).map((g, i) => [
      String(i + 1),
      custName(g.key),
      custCity(g.key),
      ...(data.allSalespersons ? [spName(g.lines[0].salespersonId)] : []),
      whole(g.invoices),
      money(g.net),
      share(g.net, total.net),
    ]),
    nameCols: data.allSalespersons ? [1, 3] : [1],
    boldCols: [data.allSalespersons ? 5 : 4],
    colWidths: { 0: 7 },
  });

  // ── top products ──
  const byProduct = groupBy(lines, (l) => l.productId);
  table({
    title: 'Top Products',
    sub: `${byProduct.length} product${byProduct.length === 1 ? '' : 's'} • top 15 by net sales`,
    head: ['#', 'Barcode', 'Product', 'Qty', 'Net', 'Share'],
    body: byProduct
      .slice(0, 15)
      .map((g, i) => [String(i + 1), data.products[g.key]?.barcode || '-', prodName(g.key), whole(g.qty), money(g.net), share(g.net, total.net)]),
    nameCols: [2],
    boldCols: [4],
    colWidths: { 0: 7, 1: 26 },
  });

  // ── by city / by category ──
  const byCity = groupBy(lines, (l) => custCity(l.customerId));
  table({
    title: 'Sales by City',
    head: ['City', 'Customers', 'Invoices', 'Net', 'Share'],
    body: byCity.slice(0, 12).map((g) => [g.key, whole(g.customers), whole(g.invoices), money(g.net), share(g.net, total.net)]),
    nameCols: [0],
    boldCols: [3],
  });
  const byCategory = groupBy(lines, (l) => shortCategory(data.products[l.productId]?.category || 'Uncategorized'));
  table({
    title: 'Sales by Category',
    head: ['Category', 'Products', 'Qty', 'Net', 'Share'],
    body: byCategory
      .slice(0, 12)
      .map((g) => [g.key, whole(new Set(g.lines.map((l) => l.productId)).size), whole(g.qty), money(g.net), share(g.net, total.net)]),
    nameCols: [0],
    boldCols: [3],
  });

  // ── returns ──
  const returns = lines.filter((l) => l.amount < 0).sort((a, b) => a.amount - b.amount);
  if (returns.length) {
    const head = ['Invoice', ...(oneDay ? [] : ['Date']), 'Customer', ...(data.allSalespersons ? ['Salesperson'] : []), 'Product', 'Qty', 'Amount'];
    table({
      title: 'Returns',
      sub: `${returns.length} return line${returns.length === 1 ? '' : 's'} • AED ${money(total.returns)}${returns.length > 25 ? ' • biggest 25' : ''}`,
      head,
      body: returns
        .slice(0, 25)
        .map((l) => [
          l.invoice || '-',
          ...(oneDay ? [] : [fmtDay(l.date)]),
          custName(l.customerId),
          ...(data.allSalespersons ? [spName(l.salespersonId)] : []),
          prodName(l.productId),
          whole(Math.abs(l.qty)),
          `-${money(Math.abs(l.amount))}`,
        ]),
      nameCols: ['Customer', 'Salesperson', 'Product'].map((h) => head.indexOf(h)).filter((i) => i >= 0),
      fontSize: 7,
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === head.length - 1) {
          d.cell.styles.textColor = C.red;
          d.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }

  // ════════════════ ONE SECTION PER SALESPERSON ════════════════
  for (const g of bySp) {
    newPage(spName(g.key));
    const t = totalsOf(g.lines);
    const prevNet = data.prevNetBySalesperson[g.key] || 0;
    const m = margin(t);
    const spCards: Card[] = [
      { label: 'Net Sales', value: `AED ${money(t.net)}`, change: change(t.net, prevNet), foot: `prev ${shortMoney(prevNet)}`, accent: C.gold },
      { label: 'Share of Total', value: share(t.net, total.net), foot: data.allSalespersons ? `rank ${bySp.indexOf(g) + 1} of ${bySp.length}` : '', accent: C.goldDark },
      { label: 'Gross / Returns', value: `${shortMoney(t.gross)} / ${shortMoney(t.returns)}`, foot: t.gross ? `returns ${((t.returns / t.gross) * 100).toFixed(1)}%` : '', accent: C.red },
      { label: 'Invoices', value: whole(t.invoices), foot: `avg AED ${money(t.invoices ? t.gross / t.invoices : 0)}`, accent: C.ink },
      { label: 'Customers', value: whole(t.customers), foot: `${whole(t.qty)} items • ${whole(t.products)} products`, accent: C.ink },
      showCosts
        ? { label: 'Gross Profit', value: `AED ${money(t.profit)}`, foot: m === null ? '' : `margin ${m.toFixed(1)}%`, accent: C.green }
        : { label: 'Avg per Customer', value: `AED ${money(t.customers ? t.net / t.customers : 0)}`, accent: C.green },
    ];
    cards(spCards);

    // invoices
    const byInvoice = groupBy(g.lines, (l) => `${l.invoice}|${l.customerId}|${l.date}`).sort(
      (a, b) => a.lines[0].date.localeCompare(b.lines[0].date) || a.lines[0].invoice.localeCompare(b.lines[0].invoice, undefined, { numeric: true }),
    );
    table({
      title: 'Invoices',
      sub: `${byInvoice.length} invoice${byInvoice.length === 1 ? '' : 's'} (returns included)`,
      head: ['#', 'Invoice', ...(oneDay ? [] : ['Date']), 'Customer', 'City', 'Lines', 'Gross', 'Returns', 'Net'],
      body: byInvoice.map((iv, i) => {
        const l0 = iv.lines[0];
        return [
          String(i + 1),
          l0.invoice || '-',
          ...(oneDay ? [] : [fmtDay(l0.date)]),
          custName(l0.customerId),
          custCity(l0.customerId),
          whole(iv.lines.length),
          money(iv.gross),
          iv.returns ? `-${money(iv.returns)}` : '0.00',
          money(iv.net),
        ];
      }),
      foot: ['', 'Total', ...(oneDay ? [] : ['']), '', '', whole(g.lines.length), money(t.gross), t.returns ? `-${money(t.returns)}` : '0.00', money(t.net)],
      nameCols: [oneDay ? 2 : 3, oneDay ? 3 : 4],
      boldCols: [oneDay ? 7 : 8],
      colWidths: { 0: 7 },
      fontSize: 7.2,
      didParseCell: negCell([oneDay ? 6 : 7]),
    });

    // top products of this salesperson
    const prods = groupBy(g.lines, (l) => l.productId);
    table({
      title: 'Top Products',
      sub: `${prods.length} product${prods.length === 1 ? '' : 's'} • top 10`,
      head: ['#', 'Barcode', 'Product', 'Qty', 'Net', 'Share'],
      body: prods.slice(0, 10).map((p, i) => [String(i + 1), data.products[p.key]?.barcode || '-', prodName(p.key), whole(p.qty), money(p.net), share(p.net, t.net)]),
      nameCols: [2],
      boldCols: [4],
      colWidths: { 0: 7, 1: 26 },
    });
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

  const name = oneDay ? `Daily_Sales_${period.start}` : `Sales_${period.start}_to_${period.end}`;
  return { doc, fileName: `${name}.pdf` };
}
