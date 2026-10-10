'use client';

// Payments Analysis — every Excel export of the module lives here:
//  • ExportExcelButton  — the green icon-only Export button used by the tabs
//  • exportCitiesExcel / exportCollectionsExcel / exportExpectedCollectionsExcel — the sheets

import React, { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
const round2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const today = () => new Date().toISOString().split('T')[0];

async function writeSheet(
  rows: Record<string, unknown>[],
  fileName: string,
  sheetName: string,
  numericColumns: string[],
) {
  if (rows.length === 0) return;
  await exportStyledExcel(rows, `${fileName}_${today()}`, {
    sheetName,
    columnWidth: 20,
    numericColumns,
  });
}

// ─────────────────────────────────────────────────────────────
//  Cities tab
// ─────────────────────────────────────────────────────────────
export type CityExportRow = {
  city: string;
  netCollection: number;
  monthlyAverage: number;
  averagePayment: number;
  avgCustomersPerMonth: number;
};

export async function exportCitiesExcel(data: CityExportRow[]) {
  const sorted = [...data].sort((a, b) => b.netCollection - a.netCollection);
  const rows: Record<string, unknown>[] = sorted.map((r, i) => ({
    '#': i + 1,
    City: r.city,
    'Net Collection': round2(r.netCollection),
    'Monthly Average': round2(r.monthlyAverage),
    'Average Payment': round2(r.averagePayment),
    'Avg Customers / Month': round2(r.avgCustomersPerMonth),
  }));
  if (rows.length > 0) {
    rows.push({
      '#': '',
      City: 'TOTAL',
      'Net Collection': round2(sorted.reduce((s, r) => s + r.netCollection, 0)),
      'Monthly Average': '',
      'Average Payment': '',
      'Avg Customers / Month': '',
    });
  }
  await writeSheet(rows, 'Cities_Collections', 'Cities', [
    'Net Collection',
    'Monthly Average',
    'Average Payment',
    'Avg Customers / Month',
  ]);
}

// ─────────────────────────────────────────────────────────────
//  Collections tab (per customer)
// ─────────────────────────────────────────────────────────────
export type CollectionExportRow = {
  customerId: string;
  customerName: string;
  city: string;
  collected: number;
  refunded: number;
  netCollection: number;
  tags: string[];
  paymentFrequencyDays: number | null;
};

export async function exportCollectionsExcel(data: CollectionExportRow[]) {
  const sorted = [...data].sort((a, b) => b.netCollection - a.netCollection);
  const rows: Record<string, unknown>[] = sorted.map((r, i) => ({
    '#': i + 1,
    'Customer ID': r.customerId,
    'Customer Name': r.customerName,
    City: r.city,
    Tags: (r.tags || []).join(', '),
    Collected: round2(r.collected),
    'Refunded / Bounced': round2(r.refunded),
    'Net Collection': round2(r.netCollection),
    'Pays Every (Days)': r.paymentFrequencyDays == null ? '' : Math.round(r.paymentFrequencyDays),
  }));
  if (rows.length > 0) {
    rows.push({
      '#': '',
      'Customer ID': '',
      'Customer Name': 'TOTAL',
      City: '',
      Tags: '',
      Collected: round2(sorted.reduce((s, r) => s + r.collected, 0)),
      'Refunded / Bounced': round2(sorted.reduce((s, r) => s + r.refunded, 0)),
      'Net Collection': round2(sorted.reduce((s, r) => s + r.netCollection, 0)),
      'Pays Every (Days)': '',
    });
  }
  await writeSheet(rows, 'Customer_Collections', 'Collections', [
    'Collected',
    'Refunded / Bounced',
    'Net Collection',
    'Pays Every (Days)',
  ]);
}

// ─────────────────────────────────────────────────────────────
//  Expected Collections tab
// ─────────────────────────────────────────────────────────────
export type ExpectedMonthExport = {
  monthName: string;
  totalAmount: number;
  customers: {
    customer: Record<string, unknown>;
    amount: number;
    sourceMonths?: string;
  }[];
};

export async function exportExpectedCollectionsExcel(months: ExpectedMonthExport[]) {
  const rows: Record<string, unknown>[] = [];
  months.forEach((month) => {
    month.customers.forEach((c) => {
      rows.push({
        Month: month.monthName,
        'Customer ID': c.customer['CUSTOMER ID'],
        'Customer Name': c.customer['CUSTOMER NAME'],
        City: c.customer['CITY'],
        Tag: c.customer['TAG'],
        'Payment Term': `${Number(c.customer['PAYMENT TERM']) || 0} Days`,
        'Invoices From': c.sourceMonths || '',
        'Expected Amount': round2(c.amount),
      });
    });
  });
  if (rows.length > 0) {
    rows.push({
      Month: 'TOTAL',
      'Customer ID': '',
      'Customer Name': '',
      City: '',
      Tag: '',
      'Payment Term': '',
      'Invoices From': '',
      'Expected Amount': round2(months.reduce((s, m) => s + m.totalAmount, 0)),
    });
  }
  await writeSheet(rows, 'Expected_Collections', 'Expected Collections', ['Expected Amount']);
}

// ─────────────────────────────────────────────────────────────
//  Button
// ─────────────────────────────────────────────────────────────
interface ExportExcelButtonProps {
  onExport: () => Promise<void> | void;
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function ExportExcelButton({
  onExport,
  disabled = false,
  className = '',
  title = 'Export to Excel',
}: ExportExcelButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await onExport();
    } catch (error) {
      console.error('Excel export failed:', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      className={`
        flex items-center justify-center w-10 h-10 shrink-0 text-[#166534] bg-[#dcfce7]
        hover:bg-[#bbf7d0] border border-[#86efac] rounded-xl transition-all duration-200
        shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title={title}
      aria-label={title}
    >
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
    </button>
  );
}

export default ExportExcelButton;
