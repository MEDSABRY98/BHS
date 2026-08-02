'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Check,
  Download,
  FilePlus2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  ChevronDown,
} from 'lucide-react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { toast } from '@/app/Components/Notification';
import { normalizeExcelId } from '@/app/DataBase/Utils/ExcelUploadUtils';
import { exportDatabaseExcelTable } from '@/app/DataBase/Utils/ExcelExport';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';
import { getProductsBalanceReportData, getProductNamesByIds } from '@/app/InventoryAnalysis/Service/inventory_service';
import type { ProductBalanceRow } from '@/app/InventoryAnalysis/Service/inventory_types';
import {
  fetchICUserComparisonData,
  fetchArchivedICUserComparisonData,
  fetchReconciliationSession,
  fetchICProductsByCategory,
  getICProductBarcodesByIds,
  searchICProducts,
  type ICProductSearchResult,
  type ICReconciliationLoadedRow,
  type ICReconciliationSaveLine,
  type ICReconciliationSessionSummary,
} from './Service/InventoryCountingService';
import { useInventoryCountingArchive } from './InventoryCountingArchiveContext';
import SourcePickerModal from './Utils/SourcePickerModal';
import RemoveManualRowModal from './Utils/RemoveManualRowModal';
import SaveReconciliationModal from './Utils/SaveReconciliationModal';
import ReconciliationSessionPicker from './Utils/ReconciliationSessionPicker';
import AddCategoryProductsPicker from './Utils/AddCategoryProductsPicker';

const REQUIRED_COLUMNS = ['Product ID', 'Product Name', 'Counted Quantity'] as const;

type MatchStatus = 'Matched' | 'Not Found';
type ResultSource = { type: 'none' } | { type: 'user'; user: string } | { type: 'manual' };

export interface ReconciliationRow {
  productId: string;
  barcodeName: string;
  productName: string;
  userQtys: Record<string, number>;
  source: ResultSource;
  resultQty: number | null;
  endingBalance: number | null;
  difference: number | null;
  matchStatus: MatchStatus;
  isManuallyAdded?: boolean;
}

function sortRowsAlphabetically(rows: ReconciliationRow[]): ReconciliationRow[] {
  return [...rows].sort((a, b) =>
    a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' }),
  );
}

function todayInputValue(): string {
  return new Date().toISOString().split('T')[0];
}

function getSourceLabel(source: ResultSource): string {
  if (source.type === 'user') return source.user;
  if (source.type === 'manual') return 'Manual Entry';
  return 'Select source...';
}

function sourceButtonClass(source: ResultSource): string {
  if (source.type === 'user') {
    return 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-300';
  }
  if (source.type === 'manual') {
    return 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300';
  }
  return 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700';
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

function mapRowToSaveLine(row: ReconciliationRow): ICReconciliationSaveLine | null {
  if (row.resultQty === null) return null;

  return {
    productId: row.productId,
    sourceType: row.source.type,
    sourceUser: row.source.type === 'user' ? row.source.user : null,
    resultQty: row.resultQty,
    endingBalance: row.endingBalance,
    difference: row.difference,
    matchStatus: row.matchStatus,
    isManuallyAdded: Boolean(row.isManuallyAdded),
  };
}

function mapLoadedRowToReconciliationRow(row: ICReconciliationLoadedRow): ReconciliationRow {
  let source: ResultSource = { type: 'none' };
  if (row.sourceType === 'user' && row.sourceUser) {
    source = { type: 'user', user: row.sourceUser };
  } else if (row.sourceType === 'manual') {
    source = { type: 'manual' };
  }

  return {
    productId: row.productId,
    barcodeName: row.barcodeName,
    productName: row.productName,
    userQtys: {},
    source,
    resultQty: row.resultQty,
    endingBalance: row.endingBalance,
    difference: row.difference,
    matchStatus: row.matchStatus,
    isManuallyAdded: row.isManuallyAdded,
  };
}

function buildManualReconciliationRow(
  product: ICProductSearchResult,
  balance: ProductBalanceRow | undefined,
  icRow: { barcodeName?: string; userQtys?: Record<string, number> } | undefined,
): ReconciliationRow {
  const endingBalance = balance?.endingStock ?? null;
  return {
    productId: product.productId,
    barcodeName: product.barcodeName || icRow?.barcodeName || balance?.barcode || '',
    productName: product.productName,
    userQtys: icRow?.userQtys || {},
    source: { type: 'manual' },
    resultQty: 0,
    endingBalance,
    difference: endingBalance !== null ? 0 - endingBalance : null,
    matchStatus: balance ? 'Matched' : 'Not Found',
    isManuallyAdded: true,
  };
}

function buildReconciliationRows(
  countedProducts: {
    productId: string;
    barcodeName: string;
    productName: string;
    userQtys: Record<string, number>;
  }[],
  balanceRows: ProductBalanceRow[],
): ReconciliationRow[] {
  const balanceMap = new Map(balanceRows.map((row) => [row.productId.trim(), row]));

  return sortRowsAlphabetically(
    countedProducts.map((product) => {
    const balance = balanceMap.get(product.productId);
    if (!balance) {
      return {
        productId: product.productId,
        barcodeName: product.barcodeName,
        productName: product.productName || '-',
        userQtys: product.userQtys,
        source: { type: 'none' },
        resultQty: null,
        endingBalance: null,
        difference: null,
        matchStatus: 'Not Found',
      };
    }

    return {
      productId: product.productId,
      barcodeName: product.barcodeName || balance.barcode || '',
      productName: product.productName || balance.productName || '-',
      userQtys: product.userQtys,
      source: { type: 'none' },
      resultQty: null,
      endingBalance: balance.endingStock,
      difference: null,
      matchStatus: 'Matched',
    };
  }),
  );
}

function ResultQtyInput({
  value,
  disabled,
  onCommit,
}: {
  value: number | null;
  disabled: boolean;
  onCommit: (raw: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const displayValue = disabled
    ? value !== null
      ? value.toLocaleString()
      : ''
    : isEditing
      ? draft
      : value !== null
        ? value.toLocaleString()
        : '';

  return (
    <div className="flex justify-center">
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        disabled={disabled}
        placeholder="—"
        onFocus={() => {
          if (disabled) return;
          setIsEditing(true);
          setDraft(value !== null ? String(value) : '');
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (disabled) return;
          onCommit(draft);
          setIsEditing(false);
        }}
        className="w-28 px-2 py-1.5 text-sm border border-slate-300 rounded-lg text-center font-black text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed placeholder:text-slate-300"
      />
    </div>
  );
}

export default function CountReconciliationTab() {
  const { archiveId, isReadOnly, archiveMeta, sessionVersion } = useInventoryCountingArchive();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [countDate, setCountDate] = useState(todayInputValue());
  const [appliedCountDate, setAppliedCountDate] = useState('');
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<ICProductSearchResult[]>([]);
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [sourcePickerRow, setSourcePickerRow] = useState<ReconciliationRow | null>(null);
  const [rowToRemove, setRowToRemove] = useState<{ productId: string; productName: string } | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const productSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = productSearchQuery.trim();
    if (q.length < 2 || !appliedCountDate) {
      setProductSearchResults([]);
      setSearchingProducts(false);
      return;
    }

    setSearchingProducts(true);
    const timer = window.setTimeout(async () => {
      const res = await searchICProducts(q);
      if (res.success) {
        setProductSearchResults(res.data);
      } else {
        setProductSearchResults([]);
      }
      setSearchingProducts(false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [productSearchQuery, appliedCountDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setIsProductSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleSearchResults = useMemo(() => {
    const existingIds = new Set(rows.map((row) => row.productId));
    return productSearchResults.filter((item) => !existingIds.has(item.productId));
  }, [productSearchResults, rows]);

  const metrics = useMemo(() => {
    const withResult = rows.filter((row) => row.resultQty !== null);
    const matched = withResult.filter((row) => row.matchStatus === 'Matched');
    return {
      totalProducts: rows.length,
      filledCount: withResult.length,
      matchedCount: matched.length,
      notFoundCount: withResult.filter((row) => row.matchStatus === 'Not Found').length,
      totalResult: withResult.reduce((sum, row) => sum + (row.resultQty ?? 0), 0),
      totalEndingBalance: matched.reduce((sum, row) => sum + (row.endingBalance ?? 0), 0),
      totalDifference: matched.reduce((sum, row) => sum + (row.difference ?? 0), 0),
    };
  }, [rows]);

  const loadCountedProducts = async (
    dateTo: string,
    preserveSelections = false,
    viewArchiveId?: string | null,
    autoFillOfficialTotal = false
  ) => {
    setLoading(true);
    setError(null);

    try {
      const [icRes, balanceRes] = await Promise.all([
        viewArchiveId
          ? fetchArchivedICUserComparisonData(viewArchiveId)
          : fetchICUserComparisonData(),
        getProductsBalanceReportData({ dateTo }),
      ]);

      if (!icRes.success || !icRes.data) {
        throw new Error(icRes.error || 'Failed to fetch counted products');
      }
      if (!balanceRes.success) {
        throw new Error(balanceRes.error || 'Failed to fetch ending balances');
      }

      const balanceBarcodeMap = new Map<string, string>(
        (balanceRes.data || []).map((row: ProductBalanceRow) => [row.productId.trim(), row.barcode || '']),
      );

      const grandTotalByProduct = new Map(
        icRes.data.map((row) => [row.productId, row.grandTotal])
      );

      const countedProducts = icRes.data
        .filter((row) => row.grandTotal > 0)
        .map((row) => ({
          productId: row.productId,
          barcodeName: row.barcodeName || balanceBarcodeMap.get(row.productId) || '',
          productName: row.productName,
          userQtys: row.userQtys,
        }));

      if (countedProducts.length === 0) {
        const manualOnly = !viewArchiveId && preserveSelections ? rows.filter((row) => row.isManuallyAdded) : [];
        setRows(sortRowsAlphabetically(manualOnly));
        setUsers(icRes.users || []);
        if (manualOnly.length === 0) {
          toast.info('No counted products found yet');
        }
        return;
      }

      const manualRows = !viewArchiveId && preserveSelections ? rows.filter((row) => row.isManuallyAdded) : [];
      const previousByProduct = preserveSelections
        ? new Map(rows.map((row) => [row.productId, row]))
        : new Map<string, ReconciliationRow>();

      const reconciled = buildReconciliationRows(countedProducts, balanceRes.data || []).map((row) => {
        const previous = previousByProduct.get(row.productId);
        let nextRow = row;

        if (autoFillOfficialTotal) {
          const grandTotal = grandTotalByProduct.get(row.productId) ?? 0;
          if (grandTotal > 0) {
            nextRow = {
              ...row,
              source: { type: 'manual' as const },
              resultQty: grandTotal,
              difference:
                row.endingBalance !== null ? grandTotal - row.endingBalance : null,
            };
          }
        } else if (previous && previous.source.type !== 'none') {
          const resultQty =
            previous.source.type === 'user'
              ? row.userQtys[previous.source.user] ?? null
              : previous.resultQty;

          nextRow = {
            ...row,
            barcodeName: row.barcodeName || previous.barcodeName || balanceBarcodeMap.get(row.productId) || '',
            source: previous.source,
            resultQty,
            difference:
              resultQty !== null && row.endingBalance !== null ? resultQty - row.endingBalance : null,
          };
        }

        return nextRow;
      });

      const manualOnly = manualRows
        .filter((manualRow) => !reconciled.some((row) => row.productId === manualRow.productId))
        .map((manualRow) => ({
          ...manualRow,
          barcodeName:
            manualRow.barcodeName ||
            balanceBarcodeMap.get(manualRow.productId) ||
            countedProducts.find((p) => p.productId === manualRow.productId)?.barcodeName ||
            '',
        }));

      setRows(sortRowsAlphabetically([...reconciled, ...manualOnly]));
      setUsers(icRes.users || []);
      setUploadFileName(null);

      const notFound = reconciled.filter((row) => row.matchStatus === 'Not Found').length;
      if (notFound > 0) {
        toast.warning(`Loaded ${reconciled.length} counted product(s). ${notFound} not found in inventory balance.`);
      } else {
        toast.success(`Loaded ${reconciled.length} counted product(s).`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load counted products';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReadOnly && archiveId && archiveMeta?.countDate) {
      const date = archiveMeta.countDate;
      setCountDate(date);
      setAppliedCountDate(date);
      void loadCountedProducts(date, false, archiveId, true);
      return;
    }

    if (!isReadOnly) {
      setRows([]);
      setAppliedCountDate('');
      setUploadFileName(null);
    }
  }, [archiveId, isReadOnly, archiveMeta?.countDate, sessionVersion]);

  const handleApplyCountDate = async () => {
    if (isReadOnly) return;
    if (!countDate) {
      toast.warning('Please select a count date');
      return;
    }
    setAppliedCountDate(countDate);
    await loadCountedProducts(countDate);
  };

  const handleRefresh = async () => {
    if (isReadOnly) return;
    if (!appliedCountDate) {
      toast.warning('Select a count date and click Apply Date first');
      return;
    }
    await loadCountedProducts(appliedCountDate, true);
  };

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

  const reconcileUpload = async (file: File) => {
    if (isReadOnly) return;
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
        !countedQtyKey ? 'Counted Quantity' : null,
      ].filter(Boolean);

      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      const parsedRows: { productId: string; productName: string; countedQty: number }[] = [];
      const invalidRows: string[] = [];

      jsonData.forEach((row, index) => {
        const productId = normalizeExcelId(row[productIdKey!]);
        const productName = productNameKey ? String(row[productNameKey] ?? '').trim() : '';
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

      setLoading(true);
      const [balanceRes, icRes] = await Promise.all([
        getProductsBalanceReportData({ dateTo: appliedCountDate }),
        fetchICUserComparisonData(),
      ]);

      if (!balanceRes.success) {
        throw new Error(balanceRes.error || 'Failed to fetch ending balances');
      }

      const userQtyByProduct = new Map<string, Record<string, number>>();
      const barcodeByProduct = new Map<string, string>();
      (icRes.data || []).forEach((row) => {
        userQtyByProduct.set(row.productId, row.userQtys);
        barcodeByProduct.set(row.productId, row.barcodeName);
      });

      const balanceMap = new Map<string, ProductBalanceRow>(
        (balanceRes.data || []).map((row: ProductBalanceRow) => [row.productId.trim(), row]),
      );
      const uploadedRows: ReconciliationRow[] = parsedRows.map((row) => {
        const balance = balanceMap.get(row.productId);
        return {
          productId: row.productId,
          barcodeName: barcodeByProduct.get(row.productId) || balance?.barcode || '',
          productName: row.productName || balance?.productName || '-',
          userQtys: userQtyByProduct.get(row.productId) || {},
          source: { type: 'manual' as const },
          resultQty: row.countedQty,
          endingBalance: balance ? balance.endingStock : null,
          difference: balance ? row.countedQty - balance.endingStock : null,
          matchStatus: balance ? ('Matched' as const) : ('Not Found' as const),
        };
      });

      setRows(sortRowsAlphabetically(uploadedRows));
      setUsers(icRes.users || []);
      setUploadFileName(file.name);
      toast.success(`Imported ${uploadedRows.length} product(s) from Excel`);
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

  const handleSourceChange = (productId: string, rawValue: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.productId !== productId) return row;

        if (!rawValue) {
          return {
            ...row,
            source: { type: 'none' },
            resultQty: null,
            difference: null,
          };
        }

        if (rawValue === 'manual') {
          return {
            ...row,
            source: { type: 'manual' },
            resultQty: 0,
            difference: row.endingBalance !== null ? 0 - row.endingBalance : null,
          };
        }

        if (rawValue.startsWith('user:')) {
          const user = rawValue.slice(5);
          const resultQty = row.userQtys[user] ?? null;
          return {
            ...row,
            source: { type: 'user', user },
            resultQty,
            difference:
              resultQty !== null && row.endingBalance !== null ? resultQty - row.endingBalance : null,
          };
        }

        return row;
      }),
    );
  };

  const handleResultQtyChange = (productId: string, raw: string) => {
    const parsed = parseQuantity(raw);
    if (parsed === null) return;

    setRows((prev) =>
      prev.map((row) => {
        if (row.productId !== productId || row.source.type !== 'manual') return row;
        return {
          ...row,
          resultQty: parsed,
          difference: row.endingBalance !== null ? parsed - row.endingBalance : null,
        };
      }),
    );
  };

  const handleRemoveManualRow = (productId: string, productName: string) => {
    setRowToRemove({ productId, productName });
  };

  const confirmRemoveManualRow = () => {
    if (!rowToRemove) return;

    setRows((prev) =>
      prev.filter(
        (row) => !(row.productId === rowToRemove.productId && row.isManuallyAdded)
      )
    );
    toast.success('Product removed');
    setRowToRemove(null);
  };

  const handleAddProduct = async (productId: string, barcodeName = '') => {
    if (!appliedCountDate) {
      toast.warning('Select a count date and click Apply Date first');
      return;
    }

    const trimmedId = productId.trim();
    if (!trimmedId) return;

    if (rows.some((row) => row.productId === trimmedId)) {
      toast.warning('This product is already in the list');
      return;
    }

    setAddingProduct(true);
    setError(null);

    try {
      const icFetch = archiveId
        ? fetchArchivedICUserComparisonData(archiveId)
        : fetchICUserComparisonData();

      const [namesRes, balanceRes, icRes] = await Promise.all([
        getProductNamesByIds([trimmedId]),
        getProductsBalanceReportData({ dateTo: appliedCountDate }),
        icFetch,
      ]);

      if (!namesRes.success) {
        throw new Error(namesRes.error || 'Failed to fetch product');
      }

      const productName = namesRes.data?.[trimmedId]?.trim() || '';
      if (!productName) {
        toast.error('Product not found');
        return;
      }

      const balanceMap = new Map<string, ProductBalanceRow>(
        (balanceRes.data || []).map((row: ProductBalanceRow) => [row.productId.trim(), row]),
      );
      const balance = balanceMap.get(trimmedId);
      const icRow = (icRes.data || []).find((row) => row.productId === trimmedId);

      const newRow = buildManualReconciliationRow(
        { productId: trimmedId, barcodeName, productName },
        balance,
        icRow,
      );

      setRows((prev) => sortRowsAlphabetically([...prev, newRow]));
      setProductSearchQuery('');
      setProductSearchResults([]);
      setIsProductSearchOpen(false);
      toast.success(`Added "${productName}"`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add product';
      setError(message);
      toast.error(message);
    } finally {
      setAddingProduct(false);
    }
  };

  const handleSelectSearchProduct = async (product: ICProductSearchResult) => {
    await handleAddProduct(product.productId, product.barcodeName);
  };

  const handleAddCategoryProducts = async (categoryName: string) => {
    if (!appliedCountDate) {
      toast.warning('Select a count date and click Apply Date first');
      return;
    }

    setAddingCategory(true);
    setError(null);

    try {
      const productsRes = await fetchICProductsByCategory(categoryName);
      if (!productsRes.success) {
        throw new Error(productsRes.error || 'Failed to fetch category products');
      }

      const existingIds = new Set(rows.map((row) => row.productId));
      const toAdd = productsRes.data.filter((product) => !existingIds.has(product.productId));

      if (toAdd.length === 0) {
        toast.info('All products in this category are already in the list');
        return;
      }

      const icFetch = archiveId
        ? fetchArchivedICUserComparisonData(archiveId)
        : fetchICUserComparisonData();

      const [balanceRes, icRes] = await Promise.all([
        getProductsBalanceReportData({ dateTo: appliedCountDate }),
        icFetch,
      ]);

      if (!balanceRes.success) {
        throw new Error(balanceRes.error || 'Failed to fetch ending balances');
      }

      const balanceMap = new Map<string, ProductBalanceRow>(
        (balanceRes.data || []).map((row: ProductBalanceRow) => [row.productId.trim(), row]),
      );
      const icByProduct = new Map(
        (icRes.data || []).map((row) => [row.productId, row]),
      );

      const newRows = toAdd.map((product) =>
        buildManualReconciliationRow(
          product,
          balanceMap.get(product.productId),
          icByProduct.get(product.productId),
        ),
      );

      setRows((prev) => sortRowsAlphabetically([...prev, ...newRows]));
      toast.success(`Added ${newRows.length} product(s) from "${categoryName}"`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add category products';
      setError(message);
      toast.error(message);
    } finally {
      setAddingCategory(false);
    }
  };

  const saveLines = useMemo(
    () =>
      rows
        .map(mapRowToSaveLine)
        .filter((line): line is ICReconciliationSaveLine => line !== null),
    [rows],
  );

  const handleOpenSaveModal = () => {
    if (!appliedCountDate) {
      toast.warning('Select a count date and click Apply Date first');
      return;
    }
    if (saveLines.length === 0) {
      toast.warning('Fill at least one result before saving');
      return;
    }
    setShowSaveModal(true);
  };

  const handleSaveSuccess = (reconciliationId: string) => {
    setLoadedSessionId(reconciliationId);
    setSessionsRefreshKey((key) => key + 1);
  };

  const handleLoadSavedSession = async (session: ICReconciliationSessionSummary) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetchReconciliationSession(session.reconciliationId);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to load saved session');
      }

      const loadedRows = sortRowsAlphabetically(res.data.map(mapLoadedRowToReconciliationRow));
      const nextCountDate = res.countDate || todayInputValue();

      setRows(loadedRows);
      setCountDate(nextCountDate);
      setAppliedCountDate(nextCountDate);
      setLoadedSessionId(res.reconciliationId);
      setUsers([]);
      setUploadFileName(null);
      toast.success(`Loaded ${loadedRows.length} row(s) from ${res.reconciliationId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load saved session';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = () => {
    setRows([]);
    setUsers([]);
    setAppliedCountDate('');
    setCountDate(todayInputValue());
    setUploadFileName(null);
    setLoadedSessionId(null);
    setError(null);
    setProductSearchQuery('');
    setProductSearchResults([]);
    toast.info('Started a new reconciliation session');
  };

  const handleExportExcel = async () => {
    const exportable = rows.filter((row) => row.resultQty !== null);
    if (exportable.length === 0) {
      toast.warning('Fill at least one result before exporting');
      return;
    }

    const missingBarcodeIds = exportable
      .filter((row) => !row.barcodeName?.trim())
      .map((row) => row.productId);

    let barcodeLookup: Record<string, string> = {};
    if (missingBarcodeIds.length > 0) {
      const barcodeRes = await getICProductBarcodesByIds(missingBarcodeIds);
      if (barcodeRes.success) {
        barcodeLookup = barcodeRes.data;
      }
    }

    const headers = [
      '#',
      'Product ID',
      'Barcode',
      'Product Name',
      'Source',
      'Result Quantity',
      'Ending Balance',
      'Difference',
    ];

    const exportRows = exportable.map((row, index) => [
      index + 1,
      row.productId,
      row.barcodeName?.trim() || barcodeLookup[row.productId] || '',
      row.productName,
      row.source.type === 'user' ? row.source.user : row.source.type === 'manual' ? 'Manual' : '',
      row.resultQty,
      row.endingBalance ?? '',
      row.difference ?? '',
    ]);

    exportRows.push([
      '',
      '',
      '',
      'TOTALS (Filled & Matched)',
      '',
      metrics.totalResult,
      metrics.totalEndingBalance,
      metrics.totalDifference,
    ]);

    const filename = `inventory_count_reconciliation_${appliedCountDate || todayInputValue()}.xlsx`;
    await exportSalesExcelTable(headers, exportRows, filename, {
      sheetName: 'Count Reconciliation',
      numericColumns: ['Result Quantity', 'Ending Balance', 'Difference'],
      highlightNegativeInColumns: ['Difference'],
    });
    toast.success('Reconciliation exported successfully');
  };

  const isBusy = loading || uploading;
  const isAddingProducts = addingProduct || addingCategory;
  const hasResults = rows.length > 0;

  const getUserOptions = (row: ReconciliationRow) => {
    const activeUsers = users.filter((user) => (row.userQtys[user] || 0) > 0);
    if (activeUsers.length === 0) {
      return Object.entries(row.userQtys)
        .filter(([, qty]) => qty > 0)
        .map(([user]) => user)
        .sort((a, b) => a.localeCompare(b));
    }
    return activeUsers;
  };

  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setToolbarHost(document.getElementById('ic-reconciliation-toolbar-host'));
  }, []);

  const toolbar = (
    <>
      <div className="relative shrink-0">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="date"
          value={countDate}
          onChange={(e) => setCountDate(e.target.value)}
          disabled={isReadOnly}
          className="pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
        />
      </div>

      {appliedCountDate && (
        <div className="flex items-stretch gap-2 flex-1 min-w-[240px] max-w-2xl">
          <div ref={productSearchRef} className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={productSearchQuery}
              onChange={(e) => {
                setProductSearchQuery(e.target.value);
                setIsProductSearchOpen(true);
              }}
              onFocus={() => setIsProductSearchOpen(true)}
              placeholder="Search product name or barcode..."
              disabled={isAddingProducts}
              className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
            />
            {isAddingProducts && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
            )}

            {isProductSearchOpen && productSearchQuery.trim().length >= 2 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/60 py-2 z-30 max-h-72 overflow-y-auto">
                {searchingProducts ? (
                  <p className="px-4 py-3 text-xs font-bold text-slate-400">Searching...</p>
                ) : visibleSearchResults.length === 0 ? (
                  <p className="px-4 py-3 text-xs font-bold text-slate-400">No products found</p>
                ) : (
                  visibleSearchResults.map((product) => (
                    <button
                      key={product.productId}
                      type="button"
                      onClick={() => handleSelectSearchProduct(product)}
                      disabled={isAddingProducts}
                      className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors disabled:opacity-50"
                    >
                      <p className="text-sm font-black text-slate-800 truncate">{product.productName}</p>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        {product.barcodeName ? `Barcode: ${product.barcodeName}` : 'No barcode'} · ID: {product.productId}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <AddCategoryProductsPicker
            disabled={isAddingProducts || isReadOnly}
            onSelectCategory={handleAddCategoryProducts}
          />
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleApplyCountDate}
          disabled={isBusy || isReadOnly}
          title="Apply Date & Load Counted Products"
          className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-40"
        >
          {loading && !uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isBusy || !appliedCountDate || isReadOnly}
          title="Refresh Counted Products"
          className="p-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:border-indigo-200 hover:text-indigo-700 transition-all disabled:opacity-40"
        >
          <RefreshCw className={`w-5 h-5 ${loading && !uploading ? 'animate-spin' : ''}`} />
        </button>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          title="Download Template"
          className="p-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:border-indigo-200 hover:text-indigo-700 transition-all"
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
          disabled={isBusy || !appliedCountDate || isReadOnly}
          title="Import Excel (optional)"
          className="p-3 bg-slate-900 text-white rounded-xl hover:bg-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={handleExportExcel}
          disabled={!hasResults || isBusy || metrics.filledCount === 0}
          title="Export Results"
          className="p-3 bg-black text-[#D4AF37] rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <FileSpreadsheet className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={handleOpenSaveModal}
          disabled={isBusy || saveLines.length === 0}
          title="Save Reconciliation"
          className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
        </button>

        <ReconciliationSessionPicker
          selectedId={loadedSessionId}
          refreshKey={sessionsRefreshKey}
          onSelect={handleLoadSavedSession}
          onClear={() => setLoadedSessionId(null)}
        />

        <button
          type="button"
          onClick={handleNewSession}
          disabled={isBusy}
          title="New Session"
          className="p-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:border-indigo-200 hover:text-indigo-700 transition-all disabled:opacity-40"
        >
          <FilePlus2 className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {toolbarHost ? createPortal(toolbar, toolbarHost) : null}

      {(appliedCountDate || uploadFileName || loadedSessionId) && (
        <p className="text-[11px] font-bold text-slate-400">
          {appliedCountDate && `Count date: ${appliedCountDate}`}
          {loadedSessionId && ` · Loaded: ${loadedSessionId}`}
          {appliedCountDate && uploadFileName && ' · '}
          {uploadFileName && `File: ${uploadFileName}`}
          {appliedCountDate && !uploadFileName && hasResults && ` · ${rows.length} product(s)`}
        </p>
      )}
      {error && (
        <TabFetchError message={error} className="py-4" />
      )}

      {hasResults && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <MetricCard label="Counted Products" value={metrics.totalProducts.toLocaleString()} />
          <MetricCard label="Results Filled" value={metrics.filledCount.toLocaleString()} />
          <MetricCard label="Total Result" value={metrics.totalResult.toLocaleString()} />
          <MetricCard label="Total Ending Balance" value={metrics.totalEndingBalance.toLocaleString()} />
          <MetricCard
            label="Net Difference"
            value={metrics.totalDifference.toLocaleString()}
            highlight={metrics.totalDifference !== 0}
          />
        </div>
      )}

      {hasResults && (
        <div className="text-xs font-bold text-slate-500">
          Filled: {metrics.filledCount.toLocaleString()} | Matched: {metrics.matchedCount.toLocaleString()} | Not Found:{' '}
          {metrics.notFoundCount.toLocaleString()}
        </div>
      )}

      {isBusy && !hasResults ? (
        <TabLoader />
      ) : !hasResults ? (
        <NoData title={appliedCountDate ? 'NO COUNTED PRODUCTS — ADD ONE MANUALLY OR REFRESH' : 'SELECT COUNT DATE AND APPLY TO LOAD COUNTED PRODUCTS'} />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-center min-w-[980px]">
              <thead className="bg-black text-white sticky top-0 z-10">
                <tr className="text-[10px] font-black uppercase tracking-wider">
                  <th className="px-4 py-4 text-center">#</th>
                  <th className="px-4 py-4 text-center">Barcode</th>
                  <th className="px-4 py-4 text-center">Product Name</th>
                  <th className="px-4 py-4 text-center">Source</th>
                  <th className="px-4 py-4 text-center">Result Qty</th>
                  <th className="px-4 py-4 text-center">Ending Balance</th>
                  <th className="px-4 py-4 text-center">Difference</th>
                  <th className="px-4 py-4 text-center">Status</th>
                  <th className="px-2 py-4 text-center w-[52px]" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const isManual = row.source.type === 'manual';
                  const isUserSource = row.source.type === 'user';

                  return (
                    <tr
                      key={`${row.productId}-${index}`}
                      className={`border-b border-slate-50 transition-colors ${
                        row.isManuallyAdded
                          ? 'bg-amber-50/90 hover:bg-amber-100/80 ring-1 ring-inset ring-amber-200'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-4 py-4 text-xs font-bold text-slate-400 text-center">{index + 1}</td>
                      <td className="px-4 py-4 text-sm font-black text-slate-800 text-center">
                        {row.barcodeName || '-'}
                        {row.isManuallyAdded && (
                          <span className="block text-[10px] font-black uppercase tracking-wider text-amber-700 mt-1">
                            Added manually
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-slate-700 text-center">{row.productName || '-'}</td>
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSourcePickerRow(row)}
                          className={`inline-flex items-center justify-center gap-2 min-w-[160px] max-w-[220px] px-3 py-2.5 text-xs font-black border rounded-xl transition-all ${sourceButtonClass(row.source)}`}
                        >
                          <span className="truncate">{getSourceLabel(row.source)}</span>
                          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        </button>
                      </td>
                      <td className="px-4 py-4 text-sm font-black text-slate-800 text-center">
                        <ResultQtyInput
                          value={row.resultQty}
                          disabled={!isManual}
                          onCommit={(raw) => handleResultQtyChange(row.productId, raw)}
                        />
                        {isUserSource && row.resultQty === null && (
                          <span className="block text-[10px] font-bold text-amber-600 mt-1">No qty for this user</span>
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
                      <td className="px-2 py-4 text-center">
                        {row.isManuallyAdded && (
                          <button
                            type="button"
                            onClick={() => handleRemoveManualRow(row.productId, row.productName)}
                            title="Remove manually added product"
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sourcePickerRow && (
        <SourcePickerModal
          row={sourcePickerRow}
          userOptions={getUserOptions(sourcePickerRow)}
          onSelect={(rawValue) => handleSourceChange(sourcePickerRow.productId, rawValue)}
          onClose={() => setSourcePickerRow(null)}
        />
      )}

      {rowToRemove && (
        <RemoveManualRowModal
          productId={rowToRemove.productId}
          productName={rowToRemove.productName}
          onClose={() => setRowToRemove(null)}
          onConfirm={confirmRemoveManualRow}
        />
      )}

      {showSaveModal && appliedCountDate && (
        <SaveReconciliationModal
          countDate={appliedCountDate}
          lines={saveLines}
          reconciliationId={loadedSessionId}
          onClose={() => setShowSaveModal(false)}
          onSuccess={handleSaveSuccess}
        />
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
