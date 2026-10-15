'use client';

// Petty Cash Analysis PDF (admin) — same layout as the standalone "Petty Cash Report" tool,
// built from the saved rows: by Account (set by the admin), Account × Beneficiary, by Beneficiary, line details.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/Audit/Utils/TrackedDownload';
import { COMPANY_NAME, compareLines, type PettyCash } from './PettyCashTypes';

type RGB = [number, number, number];
const C = {
  black: [17, 17, 17] as RGB,
  gold: [184, 147, 47] as RGB,
  goldL: [246, 239, 217] as RGB,
  grey: [107, 107, 107] as RGB,
  line: [227, 220, 200] as RGB,
  zebra: [251, 249, 243] as RGB,
  panel: [253, 251, 246] as RGB,
  muted: [207, 198, 174] as RGB,
  white: [255, 255, 255] as RGB,
};
const M = 18;
const PW = 210;
const PH = 297;
const CW = PW - 2 * M;
const UNASSIGNED = 'Unassigned';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MS = MONTHS.map((m) => m.slice(0, 3));

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const hasArabic = (s: string) => ARABIC.test(s || '');
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (Number.isFinite(n) ? (n * 100).toFixed(1) : '0.0') + '%';
const fd = (iso: string) => {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return y && m && d ? `${d} ${MS[Number(m) - 1]} ${y}` : iso;
};

type Line = { person: string; account: string; date: string; label: string; amount: number; claim: string; LINE_NO: number; BENEFICIARY: string; INVOICE_DATE: string };
type Group = { name: string; sum: number; count: number; people?: Group[] };

function group(lines: Line[], key: 'person' | 'account'): Group[] {
  const m = new Map<string, Group>();
  for (const l of lines) {
    const g = m.get(l[key]) || { name: l[key], sum: 0, count: 0 };
    g.sum += l.amount;
    g.count++;
    m.set(l[key], g);
  }
  return Array.from(m.values()).sort((a, b) => b.sum - a.sum);
}

function analyse(items: PettyCash[]) {
  const lines: Line[] = items
    .flatMap((p) =>
      p.LINES.map((l) => ({
        person: l.BENEFICIARY.trim() || 'Unspecified',
        account: String(l.ACCOUNT || '').trim() || UNASSIGNED,
        date: l.INVOICE_DATE,
        label: l.DESCRIPTION,
        amount: Number(l.AMOUNT) || 0,
        claim: p.ID,
        LINE_NO: l.LINE_NO,
        BENEFICIARY: l.BENEFICIARY,
        INVOICE_DATE: l.INVOICE_DATE,
      })),
    )
    .sort(compareLines);
  const total = lines.reduce((a, l) => a + l.amount, 0);
  const acc = group(lines, 'account');
  acc.forEach((a) => (a.people = group(lines.filter((l) => l.account === a.name), 'person')));
  const per = group(lines, 'person');
  const employees = Array.from(new Set(items.map((p) => p.CREATED_BY).filter(Boolean)));

  const dates = Array.from(new Set(lines.map((l) => l.date))).sort();
  let period = '';
  let dateText = '';
  if (dates.length) {
    const ms = Array.from(new Set(dates.map((d) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`)));
    period = ms.length > 2 ? `${ms[0]} - ${ms[ms.length - 1]}` : ms.join(' - ');
    const sameMonth = ms.length === 1;
    if (dates.length <= 8) {
      const days = dates.map((d) => (sameMonth ? String(Number(d.slice(8, 10))) : `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`));
      dateText = (days.length > 1 ? days.slice(0, -1).join(', ') + ' and ' + days[days.length - 1] : days[0]) + (sameMonth ? ' ' + ms[0] : '');
    } else {
      dateText = `${fd(dates[0])} to ${fd(dates[dates.length - 1])}`;
    }
  }
  return { lines, total, acc, per, employees, period, dateText, claims: items.map((p) => p.ID) };
}
type Analysis = ReturnType<typeof analyse>;

// ── drawing helpers ───────────────────────────────────────────
function setTextFont(doc: jsPDF, text: string, style: 'normal' | 'bold' = 'normal') {
  if (hasArabic(text)) doc.setFont('Amiri', 'normal');
  else doc.setFont('helvetica', style);
}

function heading(doc: jsPDF, y: number, title: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.black);
  doc.text(title, M, y);
  return y + 4;
}

function niceStep(max: number) {
  const raw = max / 5 || 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const chartHeight = (n: number) => n * 5.6 + 10;

function chart(doc: jsPDF, y: number, rows: Group[], total: number, isHi: (r: Group, i: number) => boolean) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  const labelW = Math.min(72, Math.max(...rows.map((r) => doc.getTextWidth(r.name))) + 3);
  const x0 = M + labelW;
  const plotW = CW - labelW - 30;
  const rowH = 5.6;
  const barH = 3.9;
  const max = Math.max(...rows.map((r) => r.sum), 1);
  const step = niceStep(max);
  const axisMax = Math.ceil(max / step) * step;
  const h = rows.length * rowH;
  const sx = (v: number) => x0 + (v / axisMax) * plotW;

  doc.setDrawColor(238, 238, 238);
  doc.setLineWidth(0.2);
  doc.setTextColor(102, 102, 102);
  doc.setFontSize(6.5);
  for (let v = 0; v <= axisMax + 1e-9; v += step) {
    const x = sx(v);
    doc.line(x, y, x, y + h);
    doc.text(v.toLocaleString('en-US'), x, y + h + 3.6, { align: 'center' });
  }
  doc.setDrawColor(187, 187, 187);
  doc.line(x0, y + h, x0 + plotW, y + h);
  doc.text('AED', x0 + plotW / 2, y + h + 7.5, { align: 'center' });

  rows.forEach((r, i) => {
    const by = y + i * rowH + (rowH - barH) / 2;
    doc.setFillColor(...(isHi(r, i) ? C.gold : C.muted));
    doc.rect(x0, by, Math.max(0.3, sx(r.sum) - x0), barH, 'F');
    doc.setTextColor(...C.black);
    setTextFont(doc, r.name);
    doc.setFontSize(hasArabic(r.name) ? 7.5 : 6.8);
    doc.text(r.name, x0 - 2, by + barH / 2 + 1.1, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 51, 51);
    doc.setFontSize(6.5);
    doc.text(`${fmt(r.sum)}  (${pct(r.sum / total)})`, sx(r.sum) + 1.5, by + barH / 2 + 1.1);
  });
  return y + h + 10;
}

const baseTable = {
  theme: 'plain' as const,
  margin: { left: M, right: M, top: 20, bottom: 22 },
  styles: { font: 'helvetica', fontSize: 8.5, halign: 'center' as const, valign: 'middle' as const, cellPadding: { top: 1.9, bottom: 1.9, left: 2, right: 2 }, textColor: C.black, lineColor: C.line },
  headStyles: { fillColor: C.black, textColor: C.white, fontStyle: 'bold' as const, halign: 'center' as const },
};

function arabicCell(d: any) {
  if (d.section === 'body' && hasArabic(String(d.cell.raw ?? ''))) {
    d.cell.styles.font = 'Amiri';
    d.cell.styles.fontStyle = 'normal';
  }
}

function headUnderline(d: any) {
  if (d.section !== 'head') return false;
  d.doc.setDrawColor(...C.gold);
  d.doc.setLineWidth(0.6);
  d.doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
  return true;
}

function simpleTable(doc: jsPDF, y: number, rows: Group[], first: string, total: number, widths: number[]) {
  const body = rows.map((r) => [r.name, fmt(r.sum), String(r.count), pct(r.sum / total), fmt(r.sum / r.count)]);
  const cnt = rows.reduce((a, r) => a + r.count, 0);
  body.push(['Total', fmt(total), String(cnt), '100.0%', fmt(cnt ? total / cnt : 0)]);
  autoTable(doc, {
    ...baseTable,
    startY: y,
    head: [[first, 'Amount (AED)', 'Lines', 'Share of Total', 'Avg per Line (AED)']],
    body,
    columnStyles: Object.fromEntries(widths.map((w, i) => [i, { cellWidth: w }])),
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      arabicCell(d);
      if (d.row.index === body.length - 1) {
        d.cell.styles.fillColor = C.goldL;
        d.cell.styles.fontStyle = 'bold';
      } else if (d.row.index % 2 === 1) d.cell.styles.fillColor = C.zebra;
    },
    didDrawCell: (d) => {
      if (headUnderline(d)) return;
      if (d.section !== 'body') return;
      const s = d.doc;
      if (d.row.index === body.length - 1) {
        s.setDrawColor(...C.gold);
        s.setLineWidth(0.4);
        s.line(d.cell.x, d.cell.y, d.cell.x + d.cell.width, d.cell.y);
      } else {
        s.setDrawColor(...C.line);
        s.setLineWidth(0.2);
        s.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
      }
    },
  });
  return (doc as any).lastAutoTable.finalY as number;
}

function breakdownTable(doc: jsPDF, y: number, D: Analysis) {
  const body: string[][] = [];
  const kinds: ('acc' | 'p' | 'gt')[] = [];
  D.acc.forEach((a) => {
    body.push([a.name, fmt(a.sum), String(a.count), '100.0%', pct(a.sum / D.total)]);
    kinds.push('acc');
    (a.people || []).forEach((p) => {
      body.push([p.name, fmt(p.sum), String(p.count), pct(p.sum / a.sum), pct(p.sum / D.total)]);
      kinds.push('p');
    });
  });
  body.push(['Grand Total', fmt(D.total), String(D.lines.length), '', pct(1)]);
  kinds.push('gt');
  autoTable(doc, {
    ...baseTable,
    startY: y,
    head: [['Account / Beneficiary', 'Amount (AED)', 'Lines', 'Share of Account', 'Share of Total']],
    body,
    styles: { ...baseTable.styles, fontSize: 8, cellPadding: { top: 1.15, bottom: 1.15, left: 2, right: 2 } },
    columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 30 }, 2: { cellWidth: 18 }, 3: { cellWidth: 32 }, 4: { cellWidth: 32 } },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      arabicCell(d);
      const k = kinds[d.row.index];
      if (k === 'acc') {
        d.cell.styles.fillColor = C.goldL;
        d.cell.styles.fontStyle = 'bold';
      }
      if (k === 'gt') {
        d.cell.styles.fillColor = C.black;
        d.cell.styles.textColor = C.white;
        d.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: (d) => {
      if (headUnderline(d)) return;
      if (d.section !== 'body') return;
      const s = d.doc;
      const k = kinds[d.row.index];
      if (k === 'acc') {
        s.setDrawColor(...C.gold);
        s.setLineWidth(0.3);
        s.line(d.cell.x, d.cell.y, d.cell.x + d.cell.width, d.cell.y);
      } else if (k === 'p') {
        s.setDrawColor(...C.line);
        s.setLineWidth(0.15);
        s.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
      }
    },
  });
  return (doc as any).lastAutoTable.finalY as number;
}

function detailsTable(doc: jsPDF, y: number, D: Analysis, multiClaim: boolean, groupLabel: string) {
  const rows = D.lines; // already: beneficiary, then invoice date
  const body = rows.map((l) => [l.person, fd(l.date), ...(multiClaim ? [l.claim] : []), l.account, l.label, fmt(l.amount)]);
  body.push(['Total', '', ...(multiClaim ? [''] : []), '', '', fmt(D.total)]);
  const widths = multiClaim ? [25, 18, 16, 40, 52, 23] : [25, 18, 50, 58, 23];
  autoTable(doc, {
    ...baseTable,
    startY: y,
    head: [['Beneficiary', 'Date', ...(multiClaim ? [groupLabel] : []), 'Account', 'Description', 'Amount (AED)']],
    body,
    styles: { ...baseTable.styles, fontSize: 7, cellPadding: { top: 1.4, bottom: 1.4, left: 1.5, right: 1.5 } },
    rowPageBreak: 'avoid',
    columnStyles: Object.fromEntries(widths.map((w, i) => [i, { cellWidth: w }])),
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      arabicCell(d);
      if (d.row.index === body.length - 1) {
        d.cell.styles.fillColor = C.goldL;
        d.cell.styles.fontStyle = 'bold';
      } else if (d.row.index % 2 === 1) d.cell.styles.fillColor = C.zebra;
    },
    didDrawCell: (d) => {
      if (headUnderline(d)) return;
      if (d.section !== 'body' || d.row.index >= body.length - 1) return;
      const cur = rows[d.row.index];
      const nxt = rows[d.row.index + 1];
      if (!cur) return;
      const brk = !!nxt && nxt.person.toLowerCase() !== cur.person.toLowerCase();
      d.doc.setDrawColor(...(brk ? C.gold : C.line));
      d.doc.setLineWidth(brk ? 0.4 : 0.15);
      d.doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
    },
  });
  return (doc as any).lastAutoTable.finalY as number;
}

function decorate(doc: jsPDF, period: string) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.black);
    doc.rect(0, 0, PW, 9, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(0, 9, PW, 1.2, 'F');
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(COMPANY_NAME, M, 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Petty Cash Analysis${period ? '  |  ' + period : ''}`, PW - M, 6, { align: 'right' });
    doc.setFontSize(7);
    doc.setTextColor(...C.grey);
    doc.text(`Page ${i} of ${n}`, PW - M, PH - 8, { align: 'right' });
  }
}

/**
 * Admin analysis report for one or more petty cash claims.
 * groupLabel 'Employee': items are grouped per employee (uploaded Excel), not saved claims.
 */
export async function generatePettyCashAnalysisPdf(items: PettyCash[], opts: { groupLabel?: 'Claim' | 'Employee' } = {}) {
  const groupLabel = opts.groupLabel || 'Claim';
  if (!items.length) throw new Error('Nothing to export');
  const D = analyse(items);
  if (!D.lines.length) throw new Error('No rows to analyse');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  try {
    await addArabicFont(doc);
  } catch {
    // Arabic font is only needed for Arabic text
  }
  const custodian = D.employees.length === 1 ? D.employees[0] : D.employees.length ? `${D.employees.length} employees` : '';
  doc.setProperties({ title: `Petty Cash Analysis${custodian ? ' - ' + custodian : ''}${D.period ? ' - ' + D.period : ''}`, author: COMPANY_NAME });

  // ── Title + KPIs ───────────────────────────────────────────
  let y = 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.black);
  doc.text('Petty Cash Analysis', M, y);
  const sub = [custodian ? 'Custodian: ' + custodian : '', D.dateText ? 'Invoice dates ' + D.dateText : '', 'Amounts in AED'].filter(Boolean).join('  ·  ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.grey);
  doc.text(doc.splitTextToSize(sub, CW) as string[], M, y + 6);

  y += 12;
  const kpis: [string, string][] = [
    [fmt(D.total), 'Total Expenses (AED)'],
    [String(D.lines.length), 'Expense Lines'],
    [String(D.claims.length), D.claims.length === 1 ? groupLabel : `${groupLabel}s`],
    [String(D.acc.length), 'Expense Accounts'],
    [String(D.per.length), 'Beneficiaries'],
  ];
  const kw = CW / 5;
  const kh = 17;
  doc.setFillColor(...C.panel);
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.3);
  doc.rect(M, y, CW, kh, 'FD');
  kpis.forEach(([v, l], i) => {
    const cx = M + kw * i + kw / 2;
    if (i) {
      doc.setDrawColor(...C.line);
      doc.setLineWidth(0.2);
      doc.line(M + kw * i, y, M + kw * i, y + kh);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...C.black);
    doc.text(v, cx, y + 8.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grey);
    doc.text(l, cx, y + 13.5, { align: 'center' });
  });
  y += kh + 6;

  const unassigned = D.acc.find((a) => a.name === UNASSIGNED);
  if (unassigned) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28);
    doc.text(`${unassigned.count} line(s) · AED ${fmt(unassigned.sum)} have no account yet and are grouped under "${UNASSIGNED}".`, M, y);
    y += 4;
  }
  y += 4;

  // ── By Account ─────────────────────────────────────────────
  y = heading(doc, y, 'Expenses by Account');
  y = simpleTable(doc, y, D.acc, 'Account', D.total, [62, 30, 18, 26, 38]) + 8;
  const hiAcc = new Set(D.acc.filter((a) => a.name !== UNASSIGNED).slice(0, 2).map((a) => a.name));
  D.acc.forEach((a) => {
    if (/SUSPENSE|ADVANCE|RENT/i.test(a.name)) hiAcc.add(a.name);
  });
  if (y + 14 + chartHeight(D.acc.length) > PH - 17) {
    doc.addPage();
    y = 22;
  }
  y = heading(doc, y, 'Chart: Expenses by Account');
  chart(doc, y + 2, D.acc, D.total, (r) => hiAcc.has(r.name));

  // ── Account × Beneficiary ─────────────────────────────────
  doc.addPage();
  y = heading(doc, 22, 'Expenses by Account and Beneficiary');
  breakdownTable(doc, y, D);

  // ── By Beneficiary ─────────────────────────────────────────
  doc.addPage();
  y = heading(doc, 22, 'Expenses by Beneficiary');
  y = simpleTable(doc, y, D.per, 'Beneficiary', D.total, [50, 32, 20, 30, 42]) + 8;
  if (y + 14 + chartHeight(D.per.length) > PH - 17) {
    doc.addPage();
    y = 22;
  }
  y = heading(doc, y, 'Chart: Expenses by Beneficiary');
  const cust = custodian.toLowerCase();
  chart(doc, y + 2, D.per, D.total, (r, i) => (cust ? r.name.toLowerCase() === cust : i < 2) || i === 0);

  // ── Line details ───────────────────────────────────────────
  doc.addPage();
  y = heading(doc, 22, 'Line Details');
  detailsTable(doc, y, D, D.claims.length > 1, groupLabel);
  decorate(doc, D.period);

  const safe = (s: string) => (s || '').replace(/[^\w؀-ۿ -]+/g, '').replace(/\s+/g, '').slice(0, 40);
  const fileName = `PettyCashAnalysis${D.claims.length === 1 && groupLabel === 'Claim' ? '_' + D.claims[0] : ''}${D.employees.length === 1 ? '_' + safe(D.employees[0]) : ''}${D.period ? '_' + safe(D.period) : ''}.pdf`;
  saveTrackedPdf(doc, fileName);
  return fileName;
}
