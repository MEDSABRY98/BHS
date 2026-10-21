// Scheduled Reports — how each report type is made (server only).
// Add a new report: put its id in Utils/Types.ts → REPORT_TYPES and a builder here.

import { buildDailySalesReportData } from '@/app/SalespersonAnalysis/Service/DailyReportData';
import { buildDailySalesReportPdf } from '@/app/SalespersonAnalysis/Pdf/DailySalesReportBuilder';
import { addArabicFontServer } from './ServerFont';
import { listAllSalespersons } from '@/app/SalespersonAnalysis/Service/DailyReportData';
import { BuildSalespersonData, LoadSalespersonInputs } from '@/app/SalespersonAnalysis/Service/SalespersonData';
import {
  BuildDebitCollectionsReportPdf,
  DebitCollectionsTotals,
  MergeSalespersonData,
} from '@/app/SalespersonAnalysis/Pdf/DebitCollectionsReportBuilder';
import type { SalespersonData } from '@/app/SalespersonAnalysis/Utils/Types';

async function salespersonNames(): Promise<Map<string, string>> {
  const list = await listAllSalespersons();
  return new Map(list.map((s) => [s.id.trim().toUpperCase(), s.name]));
}

/** scope: what this copy covers ("All salespersons" or the salesperson's name) — shown in the log. */
export type BuiltReport =
  | { scope: string; skip: string }
  | {
      scope: string;
      fileName: string;
      pdf: Buffer;
      /** more PDFs after the first one (same email) */
      extraPdfs?: { fileName: string; pdf: Buffer }[];
      subject: string;
      html: string;
      text: string;
    };

/** salespersonId null = every salesperson; otherwise only that salesperson's sales. */
type Builder = (range: { start: string; end: string }, reportName: string, salespersonId: string | null) => Promise<BuiltReport>;

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

const salespersonDaily: Builder = async (range, reportName, salespersonId) => {
  // a salesperson's own copy: his sales only, without the profit cards / columns (the product Margin columns still show)
  const data = await buildDailySalesReportData({ start: range.start, end: range.end, onlySalespersonId: salespersonId, showCosts: !salespersonId });
  let scope = 'All salespersons';
  if (salespersonId) {
    const names = await salespersonNames();
    scope = names.get(salespersonId.trim().toUpperCase()) || salespersonId;
  }
  if (!data.lines.length) return { scope, skip: 'No sales in this period' };

  // all salespersons: first PDF = the company part, then one PDF per salesperson (A-Z), all in the same email
  const toPdf = (d: any) => Buffer.from(d.output('arraybuffer') as ArrayBuffer);
  const { doc, fileName } = await buildDailySalesReportPdf(data, addArabicFontServer, { includeSalespersonSections: !!salespersonId });
  const pdf = toPdf(doc);
  const extraPdfs: { fileName: string; pdf: Buffer }[] = [];
  if (!salespersonId) {
    const spIds = [...new Set(data.lines.map((l) => l.salespersonId))].sort((a, b) =>
      (data.salespersons[a] || a).localeCompare(data.salespersons[b] || b, undefined, { sensitivity: 'base' }),
    );
    const baseName = fileName.replace(/\.pdf$/i, '');
    for (const id of spIds) {
      const spName = data.salespersons[id] || id;
      const one = await buildDailySalesReportPdf(
        {
          ...data,
          allSalespersons: false,
          lines: data.lines.filter((l) => l.salespersonId === id),
          prevTotals: data.prevTotalsBySalesperson?.[id] || { gross: 0, returns: 0, net: data.prevNetBySalesperson[id] || 0, invoices: 0, customers: 0, qty: 0, profit: 0, costedSales: 0 },
        },
        addArabicFontServer,
      );
      const safeName = spName.replace(/[\\/:*?"<>|]+/g, ' ').trim().replace(/\s+/g, '_') || id;
      extraPdfs.push({ fileName: `${baseName}_${safeName}.pdf`, pdf: toPdf(one.doc) });
    }
  }

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
  const title = salespersonId ? `${reportName} — ${scope}` : reportName;

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
    <table style="width:100%;border-collapse:collapse">
      ${row('Net sales', `AED ${money(net)}`, change(net, data.prevTotals.net))}
      ${row('Gross sales', `AED ${money(gross)}`)}
      ${row('Returns', `AED ${money(returns)}`)}
      ${row('Invoices', String(invoices.size), change(invoices.size, data.prevTotals.invoices))}
      ${row('Active customers', String(customers.size), change(customers.size, data.prevTotals.customers))}
    </table>
    ${salespersonId ? '' : `<div style="margin:14px 12px 6px;font-size:12px;font-weight:700;color:#64748b;letter-spacing:1px">TOP SALESPERSONS (NET)</div>
    <table style="width:100%;border-collapse:collapse">
      ${top.map(([id, v], i) => row(`${i + 1}. ${esc(data.salespersons[id] || id)}`, `AED ${money(v)}`)).join('')}
    </table>`}
    <p style="margin:16px 12px 4px;font-size:12px;color:#94a3b8">${extraPdfs.length ? `Attached: the company PDF and one PDF per salesperson (${extraPdfs.length}).` : 'The full report is attached (PDF).'} Compared with ${esc(periodText(data.prevPeriod))}.</p>
  </div>
</div>`;
  const text = [
    `${title} — ${when}`,
    `Net sales: AED ${money(net)}`,
    `Gross sales: AED ${money(gross)}`,
    `Returns: AED ${money(returns)}`,
    `Invoices: ${invoices.size}`,
    `Active customers: ${customers.size}`,
    '',
    extraPdfs.length ? `Attached: the company PDF and one PDF per salesperson (${extraPdfs.length}).` : 'The full report is attached (PDF).',
  ].join('\n');

  return { scope, fileName, pdf, extraPdfs, subject: `${title} — ${when}`, html, text };
};

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

const salespersonDebitCollections: Builder = async (range, reportName, salespersonId) => {
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
  const { doc, fileName } = await BuildDebitCollectionsReportPdf(
    { period, sections, allSalespersons: !salespersonId, agingMode: DEBIT_AGING_MODE, includeSections: !!salespersonId },
    addArabicFontServer,
  );
  const pdf = toPdf(doc);
  const extraPdfs: { fileName: string; pdf: Buffer }[] = [];
  if (!salespersonId) {
    const az = [...sections].sort((a, b) => a.salesperson.name.localeCompare(b.salesperson.name, undefined, { sensitivity: 'base' }));
    for (const d of az) {
      const one = await BuildDebitCollectionsReportPdf({ period, sections: [d], allSalespersons: false, agingMode: DEBIT_AGING_MODE }, addArabicFontServer);
      extraPdfs.push({ fileName: one.fileName, pdf: toPdf(one.doc) });
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
      ${row('Open debit', `AED ${money(t.openDebit)}`, `${t.debitCustomers} customers`)}
      ${row('Overdue', `AED ${money(t.overdue)}`, `${t.overduePct.toFixed(1)}%`)}
      ${row('Over 120 days', `AED ${money(t.over120)}`, `${t.over120Pct.toFixed(1)}%`)}
    </table>
    <div style="margin:14px 12px 6px;font-size:12px;font-weight:700;color:#64748b;letter-spacing:1px">COLLECTIONS (${esc(when.toUpperCase())})</div>
    <table style="width:100%;border-collapse:collapse">
      ${row('Net collected', `AED ${money(t.netCollected)}`, change(t.netCollected, t.prevNetCollected))}
      ${row('Payments', String(t.payments), `${t.payingCustomers} customers`)}
      ${row('Collection rate', rate)}
    </table>
    ${top.length ? `<div style="margin:14px 12px 6px;font-size:12px;font-weight:700;color:#64748b;letter-spacing:1px">TOP SALESPERSONS (OPEN DEBIT)</div>
    <table style="width:100%;border-collapse:collapse">
      ${top.map((r, i) => row(`${i + 1}. ${esc(r.name)}`, `AED ${money(r.t.openDebit)}`, `Collected ${money(r.t.netCollected)}`)).join('')}
    </table>` : ''}
    <p style="margin:16px 12px 4px;font-size:12px;color:#94a3b8">${extraPdfs.length ? `Attached: the summary PDF and one PDF per salesperson (${extraPdfs.length}).` : 'The full report is attached (PDF).'} Collections are compared with the same period last year.</p>
  </div>
</div>`;
  const text = [
    `${title} — ${when}`,
    `Open debit: AED ${money(t.openDebit)}`,
    `Overdue: AED ${money(t.overdue)} (${t.overduePct.toFixed(1)}%)`,
    `Over 120 days: AED ${money(t.over120)}`,
    `Net collected: AED ${money(t.netCollected)}`,
    `Payments: ${t.payments}`,
    `Collection rate: ${rate}`,
    '',
    extraPdfs.length ? `Attached: the summary PDF and one PDF per salesperson (${extraPdfs.length}).` : 'The full report is attached (PDF).',
  ].join('\n');

  return { scope, fileName, pdf, extraPdfs, subject: `${title} — ${when}`, html, text };
};

export const REPORT_BUILDERS: Record<string, Builder> = {
  'salesperson-daily': salespersonDaily,
  'salesperson-debit-collections': salespersonDebitCollections,
};
