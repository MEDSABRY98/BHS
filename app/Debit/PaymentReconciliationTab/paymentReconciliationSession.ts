import { InvoiceRow } from '@/types';
import type {
  PaymentReconciliationLoadedLine,
  PaymentReconciliationSaveLine,
} from '../Service/debit_service';
import { OpenInvoiceRow } from '../Utils/openInvoiceRows';

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

export function buildCustomerIdByName(data: InvoiceRow[]): Map<string, string> {
  const map = new Map<string, string>();
  data.forEach((row) => {
    const name = row.customerName?.trim();
    const id = row.customerId?.trim();
    if (!name || !id) return;
    const key = normalize(name);
    if (!map.has(key)) map.set(key, id);
  });
  return map;
}

export function buildCustomerNameById(data: InvoiceRow[]): Map<string, string> {
  const map = new Map<string, string>();
  data.forEach((row) => {
    const name = row.customerName?.trim();
    const id = row.customerId?.trim();
    if (!name || !id) return;
    const key = normalize(id);
    if (!map.has(key)) map.set(key, name);
  });
  return map;
}

export function resolveCustomerIdsForNames(
  data: InvoiceRow[],
  customerNames: string[],
): string[] {
  const idByName = buildCustomerIdByName(data);
  const ids = customerNames
    .map((name) => idByName.get(normalize(name)) || '')
    .filter(Boolean);
  return [...new Set(ids)];
}

export function resolveCustomerNamesFromIds(data: InvoiceRow[], customerIds: string[]): string[] {
  const nameById = buildCustomerNameById(data);
  const names = customerIds
    .map((id) => nameById.get(normalize(id)) || '')
    .filter(Boolean);
  return [...new Set(names)];
}

export function buildPaymentReconciliationSaveLines(
  openRows: OpenInvoiceRow[],
  appliedByRow: Map<string, number>,
  customerIdByName: Map<string, string>,
): PaymentReconciliationSaveLine[] {
  const lines: PaymentReconciliationSaveLine[] = [];

  openRows.forEach((row) => {
    if (!appliedByRow.has(row.rowKey)) return;
    const appliedAmount = appliedByRow.get(row.rowKey) || 0;
    if (appliedAmount <= 0.009) return;

    const customerId = customerIdByName.get(normalize(row.customerName)) || '';
    if (!customerId || !row.number.trim()) return;

    const openAmount = row.openAmount;
    lines.push({
      customerId,
      invoiceNumber: row.number.trim(),
      openAmount,
      appliedAmount,
      remainingAmount: Math.round((openAmount - appliedAmount) * 100) / 100,
    });
  });

  return lines;
}

export interface AppliedSessionRestoreResult {
  appliedByRow: Map<string, number>;
  staleLineCount: number;
  openAmountMismatchCount: number;
}

export function restoreAppliedByRowFromLoadedLines(
  openRows: OpenInvoiceRow[],
  customerIdByName: Map<string, string>,
  loadedLines: PaymentReconciliationLoadedLine[],
): AppliedSessionRestoreResult {
  const appliedByRow = new Map<string, number>();
  let staleLineCount = 0;
  let openAmountMismatchCount = 0;

  loadedLines.forEach((line) => {
    if (line.appliedAmount <= 0.009) return;

    const candidates = openRows.filter((row) => {
      const rowCustomerId = customerIdByName.get(normalize(row.customerName)) || '';
      return (
        normalize(rowCustomerId) === normalize(line.customerId) &&
        row.number.trim() === line.invoiceNumber.trim()
      );
    });

    if (candidates.length === 0) {
      staleLineCount += 1;
      return;
    }

    let match = candidates[0];
    if (candidates.length > 1) {
      match =
        candidates.find((row) => Math.abs(row.openAmount - line.openAmount) <= 0.01) ||
        candidates[0];
    }

    if (Math.abs(match.openAmount - line.openAmount) > 0.01) {
      openAmountMismatchCount += 1;
    }

    appliedByRow.set(match.rowKey, line.appliedAmount);
  });

  return { appliedByRow, staleLineCount, openAmountMismatchCount };
}

export function buildExportLinesFromSavedSession(
  data: InvoiceRow[],
  loadedLines: PaymentReconciliationLoadedLine[],
  appliedByRow: Map<string, number>,
  openRows: OpenInvoiceRow[],
) {
  const nameById = buildCustomerNameById(data);
  const idByName = buildCustomerIdByName(data);
  const exportLines: Array<{
    customerName: string;
    date: string;
    number: string;
    totalAmount: number;
    appliedAmount: number;
    openAmount: number;
    matching: string;
  }> = [];

  openRows.forEach((row) => {
    if (!appliedByRow.has(row.rowKey)) return;
    const appliedAmount = appliedByRow.get(row.rowKey) || 0;
    exportLines.push({
      customerName: row.customerName,
      date: row.date,
      number: row.number,
      totalAmount: row.openAmount,
      appliedAmount,
      openAmount: row.openAmount - appliedAmount,
      matching: row.matching,
    });
  });

  loadedLines.forEach((line) => {
    const alreadyMatched = openRows.some(
      (row) =>
        appliedByRow.has(row.rowKey) &&
        normalize(idByName.get(normalize(row.customerName)) || '') === normalize(line.customerId) &&
        row.number.trim() === line.invoiceNumber.trim(),
    );
    if (alreadyMatched) return;

    const customerName = nameById.get(normalize(line.customerId)) || line.customerId;
    exportLines.push({
      customerName,
      date: '',
      number: line.invoiceNumber,
      totalAmount: line.openAmount,
      appliedAmount: line.appliedAmount,
      openAmount: line.remainingAmount,
      matching: '',
    });
  });

  return exportLines;
}
