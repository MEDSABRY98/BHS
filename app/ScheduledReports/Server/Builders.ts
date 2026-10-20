// Scheduled Reports — how each report type is made (server only).
// Add a new report: put its id in Utils/Types.ts → REPORT_TYPES and a builder here.

import { buildDailySalesReportData } from '@/app/SalespersonAnalysis/Service/DailyReportData';
import { buildDailySalesReportPdf } from '@/app/SalespersonAnalysis/Pdf/DailySalesReportBuilder';
import { addArabicFontServer } from './ServerFont';

export type BuiltReport =
  | { skip: string }
  | { fileName: string; pdf: Buffer; subject: string; html: string; text: string };

type Builder = (range: { start: string; end: string }, reportName: string) => Promise<BuiltReport>;

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const periodText = (r: { start: string; end: string }) => (r.start === r.end ? fmtDay(r.start) : `${fmtDay(r.start)} – ${fmtDay(r.end)}`);
const change = (now: number, before: number) => {
  if (!before) return '';
  const pct = ((now - before) / Math.abs(before)) * 100;
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`;
};

const salespersonDaily: Builder = async (range, reportName) => {
  const data = await buildDailySalesReportData({ start: range.start, end: range.end, onlySalespersonId: null, showCosts: true });
  if (!data.lines.length) return { skip: 'No sales in this period' };

  const { doc, fileName } = await buildDailySalesReportPdf(data, addArabicFontServer);
  const pdf = Buffer.from(doc.output('arraybuffer') as ArrayBuffer);

  // short summary in the email body
  let gross = 0;
  let returns = 0;
  const invoices = new Set<string>();
  const customers = new Set<string>();
  const bySp = new Map<string, number>();
  for (const l of data.lines) {
    if (l.amount > 0) {
      gross += l.amount;
      if (l.invoice) invoices.add(l.invoice);
      if (l.customerId) customers.add(l.customerId);
    } else returns += -l.amount;
    bySp.set(l.salespersonId, (bySp.get(l.salespersonId) || 0) + l.amount);
  }
  const net = gross - returns;
  const top = [...bySp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const when = periodText(range);

  const row = (label: string, value: string, extra = '') =>
    `<tr><td style="padding:6px 12px;color:#64748b;font-size:13px">${label}</td><td style="padding:6px 12px;font-weight:700;font-size:14px;color:#0f172a;text-align:right">${value}</td><td style="padding:6px 12px;font-size:12px;color:#64748b;text-align:right">${extra}</td></tr>`;
  const html = `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a">
  <div style="background:#0a0f1d;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0">
    <div style="font-size:12px;letter-spacing:2px;color:#D4AF37;font-weight:700">BHS · SCHEDULED REPORT</div>
    <div style="font-size:20px;font-weight:700;margin-top:4px">${esc(reportName)}</div>
    <div style="font-size:13px;color:#cbd5e1;margin-top:2px">${esc(when)}</div>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:16px 10px">
    <table style="width:100%;border-collapse:collapse">
      ${row('Net sales', `AED ${money(net)}`, change(net, data.prevTotals.net))}
      ${row('Gross sales', `AED ${money(gross)}`)}
      ${row('Returns', `AED ${money(returns)}`)}
      ${row('Invoices', String(invoices.size), change(invoices.size, data.prevTotals.invoices))}
      ${row('Active customers', String(customers.size), change(customers.size, data.prevTotals.customers))}
    </table>
    <div style="margin:14px 12px 6px;font-size:12px;font-weight:700;color:#64748b;letter-spacing:1px">TOP SALESPERSONS (NET)</div>
    <table style="width:100%;border-collapse:collapse">
      ${top.map(([id, v], i) => row(`${i + 1}. ${esc(data.salespersons[id] || id)}`, `AED ${money(v)}`)).join('')}
    </table>
    <p style="margin:16px 12px 4px;font-size:12px;color:#94a3b8">The full report is attached (PDF). Compared with ${esc(periodText(data.prevPeriod))}.</p>
  </div>
</div>`;
  const text = [
    `${reportName} — ${when}`,
    `Net sales: AED ${money(net)}`,
    `Gross sales: AED ${money(gross)}`,
    `Returns: AED ${money(returns)}`,
    `Invoices: ${invoices.size}`,
    `Active customers: ${customers.size}`,
    '',
    'The full report is attached (PDF).',
  ].join('\n');

  return { fileName, pdf, subject: `${reportName} — ${when}`, html, text };
};

export const REPORT_BUILDERS: Record<string, Builder> = {
  'salesperson-daily': salespersonDaily,
};
