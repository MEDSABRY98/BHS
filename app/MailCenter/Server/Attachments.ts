// Mail Center — makes the attachments on the server (same files as the download buttons in the modules).
//   customer-statement: Customers Analysis → customer statement (PDF: StatementCore, Excel: CustomersExcelEmails)
//   supplier-statement: Suppliers Analysis → supplier statement (PDF: StatementPdfCore, Excel below)
// The customer data is limited to what the user may see (debit scope), like Customers Analysis.

import ExcelJS from 'exceljs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSheetData } from '@/lib/supabase';
import type { SessionUserRecord } from '@/lib/session';
import type { InvoiceRow } from '@/types';
import { applyDebitScope, buildDebitScope, hasFullDebitAccess } from '@/app/CustomersAnalysis/Service/debit_scope';
import { buildAccountStatementDoc } from '@/app/CustomersAnalysis/CustomerDetailsTab/Pdf/StatementCore';
import { buildGroupStatementDoc } from '@/app/CustomersAnalysis/CustomersGroupTab/Pdf/GroupStatementCore';
import { sortInvoicesByDateThenNumber } from '@/app/CustomersAnalysis/CustomerDetailsTab/Utils';
import { getInvoiceType } from '@/app/CustomersAnalysis/CustomersTab/ExportInvoiceType';
import { generateSingleCustomerExcelBlob } from '@/app/CustomersAnalysis/CustomersTab/CustomersExcelEmails';
import { buildSupplierStatement, formatStatementDate, safeFileName, type SupplierStatementRow } from '@/app/SuppliersAnalysis/SuppliersTab/Statement/StatementData';
import { buildSupplierStatementDoc } from '@/app/SuppliersAnalysis/SuppliersTab/Statement/StatementPdfCore';
import type { SupplierTransaction } from '@/app/SuppliersAnalysis/Service/suppliers_service';
import { addArabicFontServer } from '@/app/ScheduledReports/Server/ServerFont';
import { formatAmount, formatDate, uaeToday, type AttachmentSpec } from '../Utils/MailTypes';

export type MailFile = { filename: string; content: Buffer; contentType: string };
export type BuiltAttachment = { files: MailFile[]; party: string; vars: Record<string, string> };

const PDF = 'application/pdf';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const fileSafe = (s: string) => String(s || 'Statement').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

// ── customer data (the whole ledger, kept for one minute: a bulk send reads it once) ──
let ledgerCache: { at: number; rows: InvoiceRow[] } | null = null;
async function ledger(): Promise<InvoiceRow[]> {
  if (ledgerCache && Date.now() - ledgerCache.at < 60_000) return ledgerCache.rows;
  const rows = (await getSheetData()) as InvoiceRow[];
  ledgerCache = { at: Date.now(), rows };
  return rows;
}

/** the ledger rows this user may see */
export async function ledgerFor(user: SessionUserRecord): Promise<InvoiceRow[]> {
  const all = await ledger();
  return hasFullDebitAccess(user) ? all : applyDebitScope(all, await buildDebitScope(user));
}

/** same date reading as Customers Analysis (dd/mm/yyyy or yyyy-mm-dd) */
function parseDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    const [p1, p2, p3] = parts.map((p) => parseInt(p, 10));
    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      if (p3 > 1000) return new Date(p3, p2 - 1, p1);
      if (p1 > 1000) return new Date(p1, p2 - 1, parseInt(parts[2], 10));
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/** same as buildInvoicesWithNetDebtForExport + toNetOnlyOpenInvoicesForExport (CustomersTab/CstomersUtils.ts) */
function withNetDebt(rows: InvoiceRow[]) {
  return rows.map((inv) => {
    const residual = inv.matching && inv.residualAmount !== undefined && Math.abs(inv.residualAmount) > 0.01 ? inv.residualAmount : undefined;
    return { ...inv, netDebt: inv.debit - inv.credit, residual };
  });
}
function openOnly(rows: ReturnType<typeof withNetDebt>) {
  return rows
    .filter((inv) => (!inv.matching ? Math.abs(inv.netDebt) > 0.01 : inv.residual !== undefined && Math.abs(inv.residual) > 0.01))
    .map((inv) => (inv.matching && inv.residual !== undefined ? { ...inv, credit: inv.debit - inv.residual, netDebt: inv.residual } : inv));
}

async function customerStatement(spec: Extract<AttachmentSpec, { kind: 'customer-statement' }>, user: SessionUserRecord): Promise<BuiltAttachment> {
  const rows = (await ledgerFor(user)).filter((r) => r.customerName === spec.customerName);
  if (!rows.length) throw new Error(`No transactions for ${spec.customerName}`);

  const list = statementRows(rows, spec.scope, spec.dateTo);
  if (!list.length) throw new Error(`${spec.customerName}: nothing to send for this choice`);

  const balance = round2(list.reduce((s, inv) => s + (inv.netDebt || 0), 0));
  const base = `${fileSafe(spec.customerName)}_Statement`;
  const files: MailFile[] = [];
  if (spec.format !== 'excel') {
    const doc = await buildAccountStatementDoc(spec.customerName, list, true, addArabicFontServer);
    files.push({ filename: `${base}.pdf`, content: Buffer.from(doc.output('arraybuffer')), contentType: PDF });
  }
  if (spec.format !== 'pdf') {
    const blob = await generateSingleCustomerExcelBlob(spec.customerName, list as InvoiceRow[], true);
    files.push({ filename: `${base}.xlsx`, content: Buffer.from(await blob.arrayBuffer()), contentType: XLSX });
  }
  return {
    files,
    party: spec.customerName,
    vars: { Name: spec.customerName, Balance: formatAmount(balance), AsOfDate: formatDate(spec.dateTo || uaeToday()), Today: formatDate(uaeToday()) },
  };
}

/** a customer's rows for the statement: net debt per row, open only and the date limit applied */
function statementRows(rows: InvoiceRow[], scope: 'all' | 'open', dateTo: string | null) {
  let list = withNetDebt(rows);
  if (scope === 'open') list = openOnly(list);
  if (dateTo) {
    const limit = new Date(`${dateTo}T23:59:59`);
    list = list.filter((inv) => {
      const d = parseDate(inv.date);
      return !d || d <= limit;
    });
  }
  return list;
}

async function groupExcel(tag: string, rows: { customerName: string; date: string; number: string; debit: number; credit: number; difference: number }[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BHS Analysis';
  const ws = wb.addWorksheet('Group Statement', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  ws.columns = [
    { header: 'Customer Name', key: 'customer', width: 40 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Type', key: 'type', width: 16 },
    { header: 'Number', key: 'number', width: 26 },
    { header: 'Debit', key: 'debit', width: 16 },
    { header: 'Credit', key: 'credit', width: 16 },
    { header: 'Net Debt', key: 'net', width: 16 },
  ];
  rows.forEach((r) => {
    const d = parseDate(r.date);
    ws.addRow({
      customer: r.customerName,
      date: d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : r.date,
      type: getInvoiceType(r),
      number: String(r.number || '').split(' ')[0],
      debit: r.debit,
      credit: r.credit,
      net: r.difference,
    });
  });
  const total = ws.addRow({
    customer: `TOTAL · ${tag}`,
    debit: round2(rows.reduce((s, r) => s + r.debit, 0)),
    credit: round2(rows.reduce((s, r) => s + r.credit, 0)),
    net: round2(rows.reduce((s, r) => s + r.difference, 0)),
  });
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = { bottom: { style: 'medium', color: { argb: 'FFC9A84C' } } };
  });
  ws.eachRow((row, i) => {
    if (i === 1) return;
    row.eachCell((c, col) => {
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      if (col >= 5) c.numFmt = '#,##0.00;-#,##0.00;"-"';
    });
  });
  total.font = { bold: true };
  total.eachCell((c) => (c.border = { top: { style: 'medium', color: { argb: 'FFC9A84C' } } }));
  ws.autoFilter = { from: 'A1', to: 'G1' };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** every customer of a tag in one statement; one customer only = the normal customer statement */
async function groupStatement(spec: Extract<AttachmentSpec, { kind: 'group-statement' }>, user: SessionUserRecord): Promise<BuiltAttachment> {
  const rows = (await ledgerFor(user)).filter((r) => String(r.customerTag || '').trim() === spec.tag);
  if (!rows.length) throw new Error(`No transactions for the tag ${spec.tag}`);
  const names = Array.from(new Set(rows.map((r) => r.customerName))).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  if (names.length === 1) {
    const one = await customerStatement({ kind: 'customer-statement', customerName: names[0], customerId: rows[0].customerId || null, format: spec.format, scope: spec.scope, dateTo: spec.dateTo }, user);
    return { ...one, party: spec.tag, vars: { ...one.vars, Name: spec.tag } };
  }

  const list = names.flatMap((name) =>
    statementRows(rows.filter((r) => r.customerName === name), spec.scope, spec.dateTo).map((inv) => ({
      customerName: name,
      date: inv.date,
      number: inv.number,
      debit: inv.debit,
      credit: inv.credit,
      difference: inv.netDebt,
    })),
  );
  if (!list.length) throw new Error(`${spec.tag}: nothing to send for this choice`);
  const sorted = sortInvoicesByDateThenNumber(list);
  const used = names.filter((n) => sorted.some((r) => r.customerName === n));

  const balance = round2(sorted.reduce((s, r) => s + (r.difference || 0), 0));
  const base = `${fileSafe(spec.tag)}_Group_Statement`;
  const files: MailFile[] = [];
  if (spec.format !== 'excel') {
    const doc = await buildGroupStatementDoc('Group Account Statement', used, sorted, addArabicFontServer);
    files.push({ filename: `${base}.pdf`, content: Buffer.from(doc.output('arraybuffer')), contentType: PDF });
  }
  if (spec.format !== 'pdf') files.push({ filename: `${base}.xlsx`, content: await groupExcel(spec.tag, sorted), contentType: XLSX });
  return {
    files,
    party: spec.tag,
    vars: { Name: spec.tag, Balance: formatAmount(balance), AsOfDate: formatDate(spec.dateTo || uaeToday()), Today: formatDate(uaeToday()) },
  };
}

async function supplierTransactions(supplierId: string): Promise<SupplierTransaction[]> {
  const out: SupplierTransaction[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await getSupabaseAdmin()
      .from('web_SUPPLIERS_ANALYSIS')
      .select('*')
      .eq('SUPPLIER ID', supplierId)
      .order('DATE', { ascending: true })
      .order('ID', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    (data || []).forEach((r: any) =>
      out.push({ ...r, 'SUPPLIER ID': String(r['SUPPLIER ID'] ?? '').trim(), 'RESIDUAL AMOUNT': Number(String(r['RESIDUAL AMOUNT'] ?? 0).replace(/,/g, '')) || 0 }),
    );
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function supplierExcel(name: string, rows: SupplierStatementRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BHS Analysis';
  const ws = wb.addWorksheet('Statement', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  ws.columns = [
    { header: 'Date', key: 'date', width: 16 },
    { header: 'Number', key: 'number', width: 24 },
    { header: 'Reference', key: 'reference', width: 26 },
    { header: 'Debit', key: 'debit', width: 16 },
    { header: 'Credit', key: 'credit', width: 16 },
    { header: 'Net Balance', key: 'net', width: 18 },
  ];
  rows.forEach((r) => ws.addRow({ date: formatStatementDate(r.date), number: r.number, reference: r.reference, debit: r.debit, credit: r.credit, net: r.net }));
  const total = ws.addRow({
    date: '',
    number: 'TOTAL',
    reference: '',
    debit: round2(rows.reduce((s, r) => s + r.debit, 0)),
    credit: round2(rows.reduce((s, r) => s + r.credit, 0)),
    net: round2(rows.reduce((s, r) => s + r.net, 0)),
  });
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = { bottom: { style: 'medium', color: { argb: 'FFC9A84C' } } };
  });
  ws.eachRow((row, i) => {
    if (i === 1) return;
    row.eachCell((c, col) => {
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      if (col >= 4) c.numFmt = '#,##0.00;-#,##0.00;"-"';
    });
  });
  total.font = { bold: true };
  total.eachCell((c) => (c.border = { top: { style: 'medium', color: { argb: 'FFC9A84C' } } }));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function supplierStatement(spec: Extract<AttachmentSpec, { kind: 'supplier-statement' }>): Promise<BuiltAttachment> {
  const tx = await supplierTransactions(spec.supplierId);
  let rows = buildSupplierStatement(spec.supplierId, tx, spec.scope);
  if (spec.dateTo) rows = rows.filter((r) => !r.date || r.date <= spec.dateTo!);
  if (!rows.length) throw new Error(`${spec.supplierName}: nothing to send for this choice`);

  const balance = round2(rows.reduce((s, r) => s + r.net, 0));
  const base = `${safeFileName(spec.supplierName)}_Statement`;
  const files: MailFile[] = [];
  if (spec.format !== 'excel') {
    const doc = await buildSupplierStatementDoc(spec.supplierName, rows, addArabicFontServer);
    files.push({ filename: `${base}.pdf`, content: Buffer.from(doc.output('arraybuffer')), contentType: PDF });
  }
  if (spec.format !== 'pdf') files.push({ filename: `${base}.xlsx`, content: await supplierExcel(spec.supplierName, rows), contentType: XLSX });
  return {
    files,
    party: spec.supplierName,
    vars: { Name: spec.supplierName, Balance: formatAmount(balance), AsOfDate: formatDate(spec.dateTo || uaeToday()), Today: formatDate(uaeToday()) },
  };
}

export async function buildAttachment(spec: AttachmentSpec, user: SessionUserRecord): Promise<BuiltAttachment> {
  if (spec?.kind === 'customer-statement') return customerStatement(spec, user);
  if (spec?.kind === 'group-statement') return groupStatement(spec, user);
  if (spec?.kind === 'supplier-statement') return supplierStatement(spec);
  throw new Error('Unknown attachment');
}
