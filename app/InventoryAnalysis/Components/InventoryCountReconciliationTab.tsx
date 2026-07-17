'use client';

import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Check,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  Search,
  Upload,
  AlertCircle,
} from 'lucide-react';
import TabLoader from '@/app/Components/TabLoader';
import NoData from '@/app/Components/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { normalizeExcelId } from '@/app/DataBase/Utils/ExcelUploadUtils';
import { exportDatabaseExcelTable } from '@/app/DataBase/Utils/ExcelExport';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';
import { getProductsBalanceReportData, ProductBalanceRow } from '../Service/inventory_service';

const REQUIRED_COLUMNS = ['Product ID', 'Product Name', 'Counted Quantity'] as const;

type MatchStatus = 'Matched' | 'Not Found';

export interface ReconciliationRow {
  productId: string;
  productName: string;
  countedQty: number;
  endingBalance: number | null;
  difference: number | null;
  matchStatus: MatchStatus;
  mergedRows: number;
}

function todayInputValue(): string {
  return new Date().toISOString().split('T')[0];
}

function resolveColumnKey(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const found = keys.find((key) => key.trim().toLowerCase() === candidate.toLowerCase());
    if (found) return found;
  }
  return null;
}

function parseQuantity(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function aggregateUploadRows(rows: { productId: string; productName: string; countedQty: number }[]) {
  const map = new Map<string, { productId: string; productName: string; countedQty: number; mergedRows: number }>();

  for (const row of rows) {
    const existing = map.get(row.productId);
    if (existing) {
      existing.countedQty += row.countedQty;
      existing.mergedRows += 1;
      if (!existing.productName && row.productName) {
        existing.productName = row.productName;
      }
    } else {
      map.set(row.productId, { ...row, mergedRows: 1 });
    }
  }

  return Array.from(map.values());
}

function buildReconciliationRows(
  uploaded: { productId: string; productName: string; countedQty: number; mergedRows: number }[],
  balanceRows: ProductBalanceRow[],
): ReconciliationRow[] {
  const balanceMap = new Map(balanceRows.map((row) => [row.productId.trim(), row]));

  return uploaded.map((row) => {
    const balance = balanceMap.get(row.productId);
    if (!balance) {
      return {
        productId: row.productId,
        productName: row.productName,
        countedQty: row.countedQty,
        endingBalance: null,
        difference: null,
        matchStatus: 'Not Found',
        mergedRows: row.mergedRows,
      };
    }

    const endingBalance = balance.endingStock;
    return {
      productId: row.productId,
      productName: row.productName || balance.productName,
      countedQty: row.countedQty,
      endingBalance,
      difference: row.countedQty - endingBalance,
      matchStatus: 'Matched',
      mergedRows: row.mergedRows,
    };
  });
}

export default function InventoryCountReconciliationTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [countDate, setCountDate] = useState(todayInputValue());
  const [appliedCountDate, setAppliedCountDate] = useState('');
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter(
      (row) =>
        row.productId.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q) ||
        row.matchStatus.toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const metrics = useMemo(() => {
    const matched = rows.filter((row) => row.matchStatus === 'Matched');
    return {
      totalProducts: rows.length,
      matchedCount: matched.length,
      notFoundCount: rows.length - matched.length,
      totalCounted: rows.reduce((sum, row) => sum + row.countedQty, 0),
      totalEndingBalance: matched.reduce((sum, row) => sum + (row.endingBalance ?? 0), 0),
      totalDifference: matched.reduce((sum, row) => sum + (row.difference ?? 0), 0),
    };
  }, [rows]);

  const handleDownloadTemplate = async () => {
    const headers = [...REQUIRED_COLUMNS];
    const sampleRows = [
      ['PROD-001', 'Sample Product A', 120],
      ['PROD-002', 'Sample Product B', 45],
    ];
    await exportDatabaseExcelTable(headers, sampleRows, 'Inventory_Count_Template.xlsx', {
      sheetName: 'Count Upload',
    });
    toast.success('Template downloaded successfully');
  };

  const handleApplyCountDate = () => {
    if (!countDate) {
      toast.warning('Please select a count date');
      return;
    }
    setAppliedCountDate(countDate);
    if (rows.length > 0) {
      toast.info('Re-upload the file to refresh balances for the new date');
    }
  };

  const reconcileUpload = async (file: File) => {
    if (!appliedCountDate) {
      toast.warning('Select a count date and click Apply Date before uploading');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      if (jsonData.length === 0) {
        throw new Error('The uploaded Excel file is empty');
      }

      const firstRow = jsonData[0];
      const productIdKey = resolveColumnKey(firstRow, ['Product ID', 'PRODUCT ID']);
      const productNameKey = resolveColumnKey(firstRow, ['Product Name', 'PRODUCT NAME']);
      const countedQtyKey = resolveColumnKey(firstRow, [
        'Counted Quantity',
        'COUNTED QUANTITY',
        'Counted Qty',
        'COUNTED QTY',
      ]);

      const missingColumns = [
        !productIdKey ? 'Product ID' : null,
        !productNameKey ? 'Product Name' : null,
        !countedQtyKey ? 'Counted Quantity' : null,
      ].filter(Boolean);

      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      const parsedRows: { productId: string; productName: string; countedQty: number }[] = [];
      const invalidRows: string[] = [];

      jsonData.forEach((row, index) => {
        const productId = normalizeExcelId(row[productIdKey!]);
        const productName = String(row[productNameKey!] ?? '').trim();
        const countedQty = parseQuantity(row[countedQtyKey!]);

        if (!productId) return;

        if (countedQty === null) {
          invalidRows.push(`Row ${index + 2}: invalid quantity for Product ID "${productId}"`);
          return;
        }

        parsedRows.push({ productId, productName, countedQty });
      });

      if (invalidRows.length > 0) {
        throw new Error(invalidRows.slice(0, 5).join('\n'));
      }

      if (parsedRows.length === 0) {
        throw new Error('No valid rows found. Check Product ID and Counted Quantity columns.');
      }

      const aggregated = aggregateUploadRows(parsedRows);

      setLoading(true);
      const balanceRes = await getProductsBalanceReportData({ dateTo: appliedCountDate });
      if (!balanceRes.success) {
        throw new Error(balanceRes.error || 'Failed to fetch ending balances');
      }

      const reconciled = buildReconciliationRows(aggregated, balanceRes.data || []);
      setRows(reconciled);
      setUploadFileName(file.name);

      const notFound = reconciled.filter((row) => row.matchStatus === 'Not Found').length;
      if (notFound > 0) {
        toast.warning(`Reconciliation complete. ${notFound} product(s) were not found in inventory.`);
      } else {
        toast.success(`Reconciliation complete for ${reconciled.length} product(s).`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process upload';
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      setLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await reconcileUpload(file);
  };

  const handleExportExcel = async () => {
    if (rows.length === 0) return;

    const headers = [
      '#',
      'Product ID',
      'Product Name',
      'Counted Quantity',
      'Ending Balance',
      'Difference',
      'Count Date',
    ];

    const exportRows = rows.map((row, index) => [
      index + 1,
      row.productId,
      row.productName,
      row.countedQty,
      row.endingBalance ?? '',
      row.difference ?? '',
      appliedCountDate,
    ]);

    exportRows.push([
      '',
      '',
      'TOTALS (Matched)',
      metrics.totalCounted,
      metrics.totalEndingBalance,
      metrics.totalDifference,
      appliedCountDate,
    ]);

    const filename = `inventory_count_reconciliation_${appliedCountDate || todayInputValue()}.xlsx`;
    await exportSalesExcelTable(headers, exportRows, filename, {
      sheetName: 'Count Reconciliation',
      numericColumns: ['Counted Quantity', 'Ending Balance', 'Difference'],
      highlightNegativeInColumns: ['Difference'],
    });
    toast.success('Reconciliation exported successfully');
  };

  const isBusy = loading || uploading;
  const hasResults = rows.length > 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
        <ClipboardCheck className="w-7 h-7 text-indigo-600" />
        Inventory Count Reconciliation
      </h2>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={countDate}
              onChange={(e) => setCountDate(e.target.value)}
              className="pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyCountDate}
              title="Apply Date"
              className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
            >
              <Check className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              title="Download Template"
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:border-indigo-200 hover:text-indigo-700 transition-all"
            >
              <Download className="w-5 h-5" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
              disabled={isBusy}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy || !appliedCountDate}
              title="Upload Excel"
              className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!hasResults || isBusy}
              title="Export Results"
              className="p-2.5 bg-black text-[#D4AF37] rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
          </div>
        </div>

        {(appliedCountDate || uploadFileName) && (
          <p className="text-[11px] font-bold text-slate-400 mt-2">
            {appliedCountDate && `Count date: ${appliedCountDate}`}
            {appliedCountDate && uploadFileName && ' · '}
            {uploadFileName && `File: ${uploadFileName}`}
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 rounded-2xl p-4">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-bold whitespace-pre-line">{error}</p>
        </div>
      )}

      {hasResults && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard label="Products" value={metrics.totalProducts.toLocaleString()} />
          <MetricCard label="Total Counted" value={metrics.totalCounted.toLocaleString()} />
          <MetricCard label="Total Ending Balance" value={metrics.totalEndingBalance.toLocaleString()} />
          <MetricCard
            label="Net Difference"
            value={metrics.totalDifference.toLocaleString()}
            highlight={metrics.totalDifference !== 0}
          />
        </div>
      )}

      {hasResults && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-slate-500">
          <span>
            Matched: {metrics.matchedCount.toLocaleString()} | Not Found: {metrics.notFoundCount.toLocaleString()}
          </span>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product ID or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      )}

      {isBusy && !hasResults ? (
        <TabLoader />
      ) : !hasResults ? (
        <NoData title="UPLOAD A COUNT FILE TO START RECONCILIATION" />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                  <th className="px-4 py-4 text-center">#</th>
                  <th className="px-4 py-4 text-center">Product ID</th>
                  <th className="px-4 py-4 text-center">Product Name</th>
                  <th className="px-4 py-4 text-center">Counted Qty</th>
                  <th className="px-4 py-4 text-center">Ending Balance</th>
                  <th className="px-4 py-4 text-center">Difference</th>
                  <th className="px-4 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={`${row.productId}-${index}`} className="border-b border-slate-50 hover:bg-slate-50/70">
                    <td className="px-4 py-4 text-xs font-bold text-slate-400 text-center">{index + 1}</td>
                    <td className="px-4 py-4 text-sm font-black text-slate-800 text-center">{row.productId}</td>
                    <td className="px-4 py-4 text-sm font-bold text-slate-700 text-center">{row.productName || '-'}</td>
                    <td className="px-4 py-4 text-sm font-black text-slate-800 text-center">
                      {row.countedQty.toLocaleString()}
                      {row.mergedRows > 1 && (
                        <span className="block text-[10px] font-bold text-indigo-500">
                          merged {row.mergedRows} rows
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm font-black text-slate-800 text-center">
                      {row.endingBalance !== null ? row.endingBalance.toLocaleString() : '-'}
                    </td>
                    <td
                      className={`px-4 py-4 text-sm font-black text-center ${
                        row.difference === null
                          ? 'text-slate-400'
                          : row.difference < 0
                            ? 'text-red-600'
                            : row.difference > 0
                              ? 'text-emerald-600'
                              : 'text-slate-700'
                      }`}
                    >
                      {row.difference !== null ? row.difference.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          row.matchStatus === 'Matched'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {row.matchStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-2xl font-black mt-2 ${highlight ? 'text-indigo-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
