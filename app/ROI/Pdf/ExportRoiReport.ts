'use client';

// ════════════════════════════════════════════════════════════════
//  ROI — PDF report: ONE A4 PAGE PER CUSTOMER
//  customer name on top → KPI boxes in order → assessment →
//  monthly detail table → net sales vs support chart
// ════════════════════════════════════════════════════════════════

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/Audit/Utils/TrackedDownload';
import { KpiList } from '../Utils/KpiList';
import { MonthLabel, PeriodLabel } from '../Utils/RoiCalc';
import type { RoiResult, Tone } from '../Utils/Types';

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
  amber: [217, 119, 6] as RGB,
  amberSoft: [254, 243, 199] as RGB,
  red: [220, 38, 38] as RGB,
  redSoft: [254, 226, 226] as RGB,
  slate: [148, 163, 184] as RGB,
  slateSoft: [241, 245, 249] as RGB,
  white: [255, 255, 255] as RGB,
};

const TONE: Record<Tone | 'ink' | 'gold', { bar: RGB; text: RGB }> = {
  green: { bar: C.green, text: C.green },
  amber: { bar: C.amber, text: C.amber },
  red: { bar: C.red, text: C.red },
  slate: { bar: C.slate, text: C.ink },
  ink: { bar: C.ink, text: C.ink },
  gold: { bar: C.gold, text: C.goldDark },
};
const BANNER: Record<Tone, { fill: RGB; text: RGB }> = {
  green: { fill: C.greenSoft, text: C.green },
  amber: { fill: C.amberSoft, text: C.amber },
  red: { fill: C.redSoft, text: C.red },
  slate: { fill: C.slateSoft, text: C.text },
};

const money = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = (n: number) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const shortMoney = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return whole(n);
};
const pct = (v: number | null) => (v === null || !Number.isFinite(v) ? '-' : `${v.toFixed(1)}%`);
const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const todayIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/**
 * One page per customer, in the order given. `fileName` (without .pdf) overrides the default name.
 * Month / all-customers reports pass results already sorted salesperson first, then customer.
 */
export async function ExportRoiReport(results: RoiResult[], opts: { fileName?: string } = {}): Promise<void> {
  if (!results.length) return;

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
  const BOTTOM = H - 14;

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (style: 'normal' | 'bold' = 'normal', size = 10) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };

  // Arabic text: Amiri font + letter joining / right-to-left order (jsPDF arabic plugin)
  const AR = /[\u0600-\u06FF]/;
  const shape = (t: string): string => {
    if (!hasArabic || !AR.test(t)) return t;
    try {
      return typeof doc.processArabic === 'function' ? doc.processArabic(t) : t;
    } catch {
      return t;
    }
  };

  results.forEach((r, index) => {
    if (index > 0) doc.addPage();

    // ── header: customer name first ──
    setFill(C.ink);
    doc.rect(0, 0, W, 30, 'F');
    setFill(C.gold);
    doc.rect(0, 30, W, 1.2, 'F');

    doc.setFont(nameFont, 'normal');
    let size = 19;
    doc.setFontSize(size);
    const maxNameW = W - M * 2 - 52;
    while (size > 11 && doc.getTextWidth(r.support.customerName) > maxNameW) {
      size -= 1;
      doc.setFontSize(size);
    }
    setText(C.white);
    doc.text(shape(r.support.customerName), M, 14);
    font('normal', 9);
    if (hasArabic && AR.test(r.support.salespersonName + r.support.city)) doc.setFont('Amiri', 'normal');
    setText([203, 213, 225]);
    const sub = [r.support.salespersonName, r.support.city, `Support ${PeriodLabel(r.support)}`, `Sales ${PeriodLabel({ startMonth: r.salesMonths[0].month, endMonth: r.salesMonths[r.salesMonths.length - 1].month })}`]
      .filter(Boolean)
      .join('  •  ');
    doc.text(shape(sub), M, 22);

    font('bold', 9);
    setText(C.gold);
    doc.text('ROI SUPPORT ANALYSIS', W - M, 12, { align: 'right' });
    font('normal', 8);
    setText([203, 213, 225]);
    doc.text(`Generated ${fmtDay(todayIso())}`, W - M, 18, { align: 'right' });
    doc.text(r.support.customerId, W - M, 23.5, { align: 'right' });

    // ── KPI boxes (4 per row) ──
    let y = 38;
    const boxes = KpiList(r).slice(0, -1); // the last one (assessment) gets its own banner
    const gap = 4;
    const cols = 4;
    const cw = (W - M * 2 - gap * (cols - 1)) / cols;
    const ch = 24;
    boxes.forEach((b, i) => {
      const x = M + (i % cols) * (cw + gap);
      const by = y + Math.floor(i / cols) * (ch + gap);
      const tone = TONE[b.tone];
      setFill(C.white);
      setDraw(C.line);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, by, cw, ch, 2.5, 2.5, 'FD');
      setFill(tone.bar);
      doc.roundedRect(x, by, cw, 1.6, 0.8, 0.8, 'F');

      font('bold', 6.4);
      setText(C.muted);
      doc.text(b.label.toUpperCase(), x + 3, by + 6.6, { maxWidth: cw - 6 });

      let vs = 12.5;
      font('bold', vs);
      while (vs > 7 && doc.getTextWidth(b.value) > cw - 6) {
        vs -= 0.5;
        font('bold', vs);
      }
      setText(tone.text);
      doc.text(b.value, x + 3, by + 14.5);

      if (b.foot) {
        font('normal', 6.2);
        setText(C.muted);
        doc.text(doc.splitTextToSize(b.foot, cw - 6)[0], x + 3, by + 20);
      }
    });
    y += Math.ceil(boxes.length / cols) * (ch + gap);

    // ── assessment banner ──
    const bn = BANNER[r.assessment.tone];
    setFill(bn.fill);
    doc.roundedRect(M, y, W - M * 2, 13, 2.5, 2.5, 'F');
    setFill(TONE[r.assessment.tone].bar);
    doc.roundedRect(M, y, 1.8, 13, 0.9, 0.9, 'F');
    font('bold', 7);
    setText(C.muted);
    doc.text('PRELIMINARY ASSESSMENT', M + 5, y + 5);
    font('bold', 10);
    setText(bn.text);
    doc.text(r.assessment.label, M + 5, y + 10.2);
    font('normal', 7.6);
    setText(C.text);
    const noteLines: string[] = doc.splitTextToSize(r.assessment.note, W - M * 2 - 76).slice(0, 2);
    noteLines.forEach((line, i) => doc.text(line, M + 62, y + (noteLines.length > 1 ? 6.2 : 8.2) + i * 3.8));
    y += 13 + 6;

    // ── benefit we get from this customer (written in the entry form) ──
    const benefit = (r.support.notes || '').trim();
    if (benefit) {
      font('normal', 7.8);
      const arBenefit = hasArabic && AR.test(benefit);
      if (arBenefit) doc.setFont('Amiri', 'normal');
      const lines: string[] = benefit
        .split('\n')
        .flatMap((p) => doc.splitTextToSize(p, W - M * 2 - 12) as string[])
        .slice(0, 5);
      const bh = 10 + lines.length * 3.7;
      setFill(C.goldSoft);
      doc.roundedRect(M, y, W - M * 2, bh, 2.5, 2.5, 'F');
      setFill(C.gold);
      doc.roundedRect(M, y, 1.8, bh, 0.9, 0.9, 'F');
      font('bold', 7);
      setText(C.goldDark);
      doc.text('BENEFIT FROM THIS CUSTOMER', M + 5, y + 5);
      font('normal', 7.8);
      if (arBenefit) doc.setFont('Amiri', 'normal');
      setText(C.ink);
      // Arabic lines are right-aligned
      lines.forEach((line, i) =>
        AR.test(line) && arBenefit
          ? doc.text(shape(line), W - M - 5, y + 9.4 + i * 3.7, { align: 'right' })
          : doc.text(line, M + 5, y + 9.4 + i * 3.7),
      );
      y += bh + 6;
    }
    y += 2;

    // ── monthly detail ──
    setFill(C.gold);
    doc.roundedRect(M, y - 4, 1.6, 6, 0.8, 0.8, 'F');
    font('bold', 11);
    setText(C.ink);
    doc.text('Sales - Last 3 Full Months', M + 4, y + 0.6);
    y += 5;

    const body = r.salesMonths.map((m) => [
      MonthLabel(m.month),
      money(m.support),
      money(m.gross),
      money(m.returns),
      money(m.net),
      whole(m.invoices),
      money(m.avgInvoice),
      m.avgItems.toFixed(1),
      pct(m.returnRate),
    ]);
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      margin: { left: M, right: M, top: 38, bottom: 14 },
      head: [['Sales Month', 'Support / mo', 'Gross Sales', 'Returns', 'Net Sales', 'Invoices', 'Avg Invoice', 'Avg Items', 'Return %']],
      body,
      foot: [[
        'Total',
        money(r.totalSupport),
        money(r.gross),
        money(r.returns),
        money(r.net),
        whole(r.invoices),
        money(r.avgInvoice),
        r.avgItems.toFixed(1),
        pct(r.returnRate),
      ]],
      showFoot: 'lastPage',
      styles: { fontSize: 7.4, cellPadding: 1.7, textColor: C.text, halign: 'center', valign: 'middle', lineWidth: 0 },
      headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: 'bold', fontSize: 7, halign: 'center' },
      alternateRowStyles: { fillColor: C.soft },
      footStyles: { fillColor: C.goldSoft, textColor: C.ink, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { fontStyle: 'bold', textColor: C.ink }, 4: { fontStyle: 'bold', textColor: C.ink } },
      didParseCell: (d: any) => {
        if (d.section === 'body') {
          d.cell.styles.lineWidth = { bottom: 0.15 };
          d.cell.styles.lineColor = C.line;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 9;

    // ── chart: net sales vs support (only when there is room on the page) ──
    const chartH = 34;
    if (y + chartH + 22 <= BOTTOM && r.salesMonths.length <= 12) {
      setFill(C.gold);
      doc.roundedRect(M, y - 4, 1.6, 6, 0.8, 0.8, 'F');
      font('bold', 11);
      setText(C.ink);
      doc.text('Net Sales vs Support', M + 4, y + 0.6);
      [['Net sales', C.ink], ['Support', C.gold]].forEach(([label, color], i) => {
        const lx = W - M - 54 + i * 28;
        setFill(color as RGB);
        doc.roundedRect(lx, y - 3, 3.4, 3.4, 0.8, 0.8, 'F');
        font('normal', 7.5);
        setText(C.text);
        doc.text(label as string, lx + 5, y);
      });
      y += 5;
      const plotX = M + 14;
      const plotW = W - M - plotX;
      const values = r.salesMonths.flatMap((m) => [m.net, m.support]);
      const maxV = Math.max(1, ...values);
      const minV = Math.min(0, ...values);
      const span = maxV - minV || 1;
      const yOf = (v: number) => y + chartH - ((v - minV) / span) * chartH;
      doc.setLineWidth(0.2);
      [0, 0.5, 1].forEach((t) => {
        const v = minV + span * t;
        const gy = yOf(v);
        setDraw(C.line);
        doc.line(plotX, gy, plotX + plotW, gy);
        font('normal', 6.3);
        setText(C.muted);
        doc.text(shortMoney(v), plotX - 2, gy + 1, { align: 'right' });
      });
      const slot = plotW / Math.max(r.salesMonths.length, 1);
      const bw = Math.min(9, slot * 0.34);
      const zero = yOf(0);
      r.salesMonths.forEach((m, i) => {
        const cx = plotX + slot * i + slot / 2;
        const bar = (x: number, v: number, color: RGB) => {
          const y1 = yOf(v);
          const h = Math.abs(zero - y1);
          if (h < 0.2) return;
          setFill(color);
          doc.rect(x, Math.min(y1, zero), bw, h, 'F');
        };
        bar(cx - bw - 0.4, m.net, C.ink);
        bar(cx + 0.4, m.support, C.gold);
        font('normal', r.salesMonths.length > 8 ? 5.8 : 6.8);
        setText(C.text);
        doc.text(MonthLabel(m.month), cx, y + chartH + 4.5, { align: 'center' });
      });
    }

    // ── page footer ──
    setDraw(C.line);
    doc.setLineWidth(0.2);
    doc.line(M, H - 11, W - M, H - 11);
    font('normal', 6.5);
    setText(C.muted);
    doc.text(
      'Net sales / support is a screening ratio. Sales figures cover the last 3 full months (the current month is excluded).',
      M,
      H - 7.5,
      { maxWidth: W - M * 2 - 24 },
    );
    font('normal', 7);
    doc.text(`Page ${index + 1} of ${results.length}`, W - M, H - 7.5, { align: 'right' });
  });

  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const fileName = opts.fileName
    ? `${safe(opts.fileName)}.pdf`
    : results.length === 1
      ? `ROI_${safe(results[0].support.customerName) || results[0].support.customerId}_${results[0].support.startMonth}_${results[0].support.endMonth}.pdf`
      : `ROI_Support_Analysis_${todayIso()}.pdf`;
  saveTrackedPdf(doc, fileName);
}
