'use client';

import { useState, useEffect } from 'react';
import { Trash2, Calendar, Loader2, Database, FileSpreadsheet, Download, Upload, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { usePermissions } from '../../InvoicesTracking/Hooks/usePermissions';
import { ConfirmModal } from '../../InvoicesTracking/Components/ConfirmModal';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { bhs_supabas } from '@/lib/secureDb';
import * as XLSX from 'xlsx';
import { getSalesMonthsCache, deleteSalesMonth, buildSalesCache, deleteAllSalesData } from '@/app/Sales/Service/sales_core_service';
import { exportDatabaseExcelTable } from '../Utils/ExcelExport';
import { downloadUploadIssuesReport, normalizeExcelId } from '../Utils/ExcelUploadUtils';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';

const englishMonths: Record<number, string> = {
  1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
  7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December"
};

interface SalesMonth {
  year: number;
  month: number;
  count: number;
}

type LineChange = {
  id: string;
  invoice: string;
  productId: string;
  fields: { col: 'QTY' | 'PRODUCT PRICE' | 'PRODUCT COST' | 'AMOUNT'; before: number; after: number }[];
};

export default function SalesDBPage() {
  const { canDelete, canEdit, isLoaded } = usePermissions();
  const [salesMonths, setSalesMonths] = useState<SalesMonth[]>([]);
  const totalCount = salesMonths.reduce((sum, m) => sum + m.count, 0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [targetMonth, setTargetMonth] = useState<{ year: number; month: number } | null>(null);

  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Excel Modal States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdateUploadModalOpen, setIsUpdateUploadModalOpen] = useState(false);
  const [exportingMonth, setExportingMonth] = useState<string | null>(null);
  // "invoices in the database but not in the file" dialog (upload waits for the answer)
  const [removedPrompt, setRemovedPrompt] = useState<{
    from: string;
    to: string;
    rows: number;
    list: { invoice: string; date: string; customer: string; amount: number; rows: number }[];
    resolve: (ok: boolean) => void;
  } | null>(null);
  // "lines of uploaded invoices whose qty / price / cost / amount changed" dialog
  const [changesPrompt, setChangesPrompt] = useState<{
    changes: LineChange[];
    unmatched: number;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const askChanges = (info: Omit<NonNullable<typeof changesPrompt>, 'resolve'>) =>
    new Promise<boolean>((resolve) => setChangesPrompt({ ...info, resolve }));
  const answerChanges = (ok: boolean) => {
    changesPrompt?.resolve(ok);
    setChangesPrompt(null);
  };
  const askRemoved = (info: Omit<NonNullable<typeof removedPrompt>, 'resolve'>) =>
    new Promise<boolean>((resolve) => setRemovedPrompt({ ...info, resolve }));
  const answerRemoved = (ok: boolean) => {
    removedPrompt?.resolve(ok);
    setRemovedPrompt(null);
  };

  useEffect(() => {
    fetchSalesMonths();
  }, []);

  async function fetchSalesMonths(forceRefresh = false) {
    setIsLoading(true);
    setLoadError(null);
    try {
      const monthsData = await getSalesMonthsCache(forceRefresh);
      setSalesMonths(monthsData || []);
    } catch (err: any) {
      console.error(err);
      setLoadError(err?.message || 'Failed to load sales months');
    } finally {
      setIsLoading(false);
    }
  }

  const handleDeleteClick = (year: number, month: number) => {
    setTargetMonth({ year, month });
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!targetMonth) return;
    setIsDeleting(true);
    try {
      await deleteSalesMonth(targetMonth.year, targetMonth.month);

      triggerMessage('success', `Deleted sales data for ${englishMonths[targetMonth.month]} ${targetMonth.year} successfully!`);
      // Refetch the sales months (this will regenerate the cache on GET)
      await fetchSalesMonths();
    } catch (err: any) {
      console.error(err);
      triggerMessage('error', err.message || 'Failed to delete sales data');
    } finally {
      setIsDeleting(false);
      setIsConfirmOpen(false);
      setTargetMonth(null);
    }
  };

  const executeDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      await deleteAllSalesData();
      triggerMessage('success', `Deleted all sales data successfully!`);
      await fetchSalesMonths(true);
    } catch (err: any) {
      console.error(err);
      triggerMessage('error', err.message || 'Failed to delete all sales data');
    } finally {
      setIsDeletingAll(false);
      setIsDeleteAllConfirmOpen(false);
    }
  };

  const downloadSalesTemplate = async () => {
    const headers = [
      'INVOICE DATE',
      'INVOICE NUMBER',
      'CUSTOMER ID',
      'PRODUCT ID',
      'PRICE COST',
      'PRICE SALES',
      'AMOUNT',
      'QTY'
    ];

    const sampleRow = [
      '2026-06-12',
      'INV-001',
      '85527',
      'PROD-789',
      10.00,
      15.00,
      15.00,
      1
    ];

    await exportDatabaseExcelTable(headers, [sampleRow], 'Sales_Import_Template.xlsx');
    toast.success('Template downloaded successfully!');
  };



  const fetchAllColumnValues = async (table: string, column: string): Promise<Set<string>> => {
    const pageSize = 1000;
    let from = 0;
    const values = new Set<string>();

    while (true) {
      const { data, error } = await bhs_supabas
        .from(table)
        .select(`"${column}"`)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach((row: Record<string, unknown>) => {
        const val = normalizeExcelId(row[column]);
        if (val) values.add(val);
      });

      if (data.length < pageSize) break;
      from += pageSize;
    }

    return values;
  };

  /** Invoice numbers from the file that are already in web_Sales_DB. */
  const findExistingInvoices = async (invoiceNumbers: string[]): Promise<Set<string>> => {
    const existing = new Set<string>();
    const unique = Array.from(new Set(invoiceNumbers.filter(Boolean)));
    for (let i = 0; i < unique.length; i += 200) {
      const chunk = unique.slice(i, i + 200);
      const { data, error } = await bhs_supabas
        .from('web_Sales_DB')
        .select('"INVOICE NUMBER"')
        .in('INVOICE NUMBER', chunk)
        .limit(1000);
      if (error) throw error;
      (data || []).forEach((row: Record<string, unknown>) => {
        const num = String(row['INVOICE NUMBER'] ?? '').trim();
        if (num) existing.add(num);
      });
    }
    return existing;
  };

  /**
   * Rows in web_Sales_DB dated inside [from, to] whose invoice number is NOT in the file:
   * invoices that were removed from the accounting system after they were uploaded.
   */
  const findRemovedInvoiceRows = async (
    from: string,
    to: string,
    fileInvoices: Set<string>,
  ): Promise<{ ID: string; invoice: string; date: string; customer: string; amount: number }[]> => {
    const out: { ID: string; invoice: string; date: string; customer: string; amount: number }[] = [];
    const [ty, tm, td] = to.split('-').map(Number);
    const nd = new Date(Date.UTC(ty, tm - 1, td + 1));
    const dayAfter = `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, '0')}-${String(nd.getUTCDate()).padStart(2, '0')}`;
    const pageSize = 1000;
    let start = 0;
    while (true) {
      const { data, error } = await bhs_supabas
        .from('web_Sales_DB')
        .select('ID, "INVOICE DATE", "INVOICE NUMBER", "CUSTOMER ID", "AMOUNT"')
        .gte('INVOICE DATE', from)
        .lt('INVOICE DATE', dayAfter) // exclusive end: works for date and timestamp columns
        .order('ID', { ascending: true })
        .range(start, start + pageSize - 1);
      if (error) throw error;
      const rows = (data || []) as Record<string, unknown>[];
      for (const row of rows) {
        const invoice = String(row['INVOICE NUMBER'] ?? '').trim();
        if (fileInvoices.has(invoice)) continue;
        out.push({
          ID: String(row.ID),
          invoice,
          date: String(row['INVOICE DATE'] ?? '').split('T')[0],
          customer: String(row['CUSTOMER ID'] ?? ''),
          amount: Number(row['AMOUNT']) || 0,
        });
      }
      if (rows.length < pageSize) break;
      start += pageSize;
    }
    return out;
  };

  /** All web_Sales_DB lines of these invoice numbers. */
  const fetchInvoiceLines = async (invoiceNumbers: string[]): Promise<Record<string, unknown>[]> => {
    const out: Record<string, unknown>[] = [];
    const unique = Array.from(new Set(invoiceNumbers.filter(Boolean)));
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100);
      let start = 0;
      while (true) {
        const { data, error } = await bhs_supabas
          .from('web_Sales_DB')
          .select('ID, "INVOICE NUMBER", "PRODUCT ID", "QTY", "PRODUCT PRICE", "PRODUCT COST", "AMOUNT"')
          .in('INVOICE NUMBER', chunk)
          .order('ID', { ascending: true })
          .range(start, start + 999);
        if (error) throw error;
        out.push(...((data || []) as Record<string, unknown>[]));
        if (!data || data.length < 1000) break;
        start += 1000;
      }
    }
    return out;
  };

  const getNextSalesRecordNum = async (): Promise<number> => {
    const pageSize = 1000;
    let from = 0;
    let maxNum = 0;

    while (true) {
      const { data, error } = await bhs_supabas
        .from('web_Sales_DB')
        .select('ID')
        .order('ID')
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach((row) => {
        if (row.ID && row.ID.startsWith('R-')) {
          const num = parseInt(row.ID.substring(2), 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });

      if (data.length < pageSize) break;
      from += pageSize;
    }

    return maxNum + 1;
  };


  /** Full DB export, or one month only when `target` is given (month card button). */
  const downloadSalesExcel = async (target?: { year: number; month: number }) => {
    const monthKey = target ? `${target.year}-${target.month}` : null;
    if (monthKey) setExportingMonth(monthKey);
    else setIsUploading(true);
    try {
      const range = target
        ? {
            from: `${target.year}-${String(target.month).padStart(2, '0')}-01`,
            to: target.month === 12 ? `${target.year + 1}-01-01` : `${target.year}-${String(target.month + 1).padStart(2, '0')}-01`,
          }
        : null;
      let allSales: any[] = [];
      let fetchMore = true;
      let pageIndex = 0;
      const limit = 1000;

      while (fetchMore) {
        let q = bhs_supabas
          .from('web_Sales_DB')
          .select('ID, "INVOICE DATE", "INVOICE NUMBER", "CUSTOMER ID", "PRODUCT ID", "PRODUCT PRICE", "PRODUCT COST", "AMOUNT", "QTY"');
        if (range) q = q.gte('INVOICE DATE', range.from).lt('INVOICE DATE', range.to);
        const { data, error } = await q.order('ID').range(pageIndex * limit, (pageIndex + 1) * limit - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allSales = [...allSales, ...data];
          if (data.length < limit) fetchMore = false;
          else pageIndex++;
        } else {
          fetchMore = false;
        }
      }

      if (allSales.length === 0) {
        toast.error(target ? 'No sales found for this month' : 'No sales found in database to export');
        return;
      }

      // Fetch Customers
      let allCustomers: any[] = [];
      let fetchMoreCust = true;
      let pageCust = 0;
      while (fetchMoreCust) {
        const { data, error } = await bhs_supabas
          .from('bhs_CUSTOMERS')
          .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME"')
          .range(pageCust * limit, (pageCust + 1) * limit - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allCustomers = [...allCustomers, ...data];
          if (data.length < limit) fetchMoreCust = false;
          else pageCust++;
        } else fetchMoreCust = false;
      }
      const custMap = new Map<string, { main: string; sub: string }>();
      allCustomers.forEach(c =>
        custMap.set(normalizeExcelId(c['CUSTOMER ID']) || '', {
          main: c['CUSTOMER MAIN NAME'] || '',
          sub: c['CUSTOMER SUB NAME'] || '',
        })
      );

      // Fetch Products
      let allProducts: any[] = [];
      let fetchMoreProd = true;
      let pageProd = 0;
      while (fetchMoreProd) {
        const { data, error } = await bhs_supabas
          .from('bhs_PRODUCTS')
          .select('"PRODUCT ID", "PRODUCT BARCODE", "PRODUCT NAME"')
          .range(pageProd * limit, (pageProd + 1) * limit - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allProducts = [...allProducts, ...data];
          if (data.length < limit) fetchMoreProd = false;
          else pageProd++;
        } else fetchMoreProd = false;
      }
      const prodMap = new Map<string, { barcode: string; name: string }>();
      allProducts.forEach(p =>
        prodMap.set(normalizeExcelId(p['PRODUCT ID']) || '', {
          barcode: p['PRODUCT BARCODE'] != null ? String(p['PRODUCT BARCODE']) : '',
          name: p['PRODUCT NAME'] || '',
        })
      );

      const headers = [
        '#', 'INVOICE DATE', 'INVOICE NUMBER',
        'CUSTOMER ID', 'CUSTOMER MAIN NAME', 'CUSTOMER SUB NAME',
        'PRODUCT ID', 'PRODUCT BARCODE', 'PRODUCT NAME',
        'PRICE COST', 'PRICE SALES', 'QTY', 'AMOUNT',
      ];
      const rows = allSales.map((s, i) => [
        i + 1,
        s['INVOICE DATE'] || '',
        s['INVOICE NUMBER'] || '',
        s['CUSTOMER ID'] || '',
        custMap.get(normalizeExcelId(s['CUSTOMER ID']) || '')?.main || '',
        custMap.get(normalizeExcelId(s['CUSTOMER ID']) || '')?.sub || '',
        s['PRODUCT ID'] || '',
        prodMap.get(normalizeExcelId(s['PRODUCT ID']) || '')?.barcode || '',
        prodMap.get(normalizeExcelId(s['PRODUCT ID']) || '')?.name || '',
        s['PRODUCT COST'] || 0,
        s['PRODUCT PRICE'] || 0,
        s['QTY'] || 0,
        s['AMOUNT'] || 0
      ]);

      const fileName = target ? `Sales_${target.year}_${String(target.month).padStart(2, '0')}_${englishMonths[target.month]}.xlsx` : 'Sales_Data_Full.xlsx';
      await exportDatabaseExcelTable(headers, rows, fileName);
      toast.success('Excel file exported successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to export Excel file');
    } finally {
      if (monthKey) setExportingMonth(null);
      else setIsUploading(false);
    }
  };


  const handleSalesUpdateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

      if (jsonData.length === 0) {
        toast.error('The uploaded Excel file is empty.');
        return;
      }

      if (!('ID' in jsonData[0])) {
        toast.error('The Excel file must contain an "ID" column for updating.');
        return;
      }

      const rowsToUpdate = jsonData.map(row => {
        const out: any = { ...row };
        if (out['AMOUNT'] !== undefined) out['AMOUNT'] = Number(out['AMOUNT']) || 0;
        if (out['QTY'] !== undefined) out['QTY'] = Number(out['QTY']) || 0;
        
        if (out['PRICE SALES'] !== undefined) {
          out['PRODUCT PRICE'] = Number(out['PRICE SALES']) || 0;
          delete out['PRICE SALES'];
        } else if (out['PRODUCT PRICE'] !== undefined) {
          out['PRODUCT PRICE'] = Number(out['PRODUCT PRICE']) || 0;
        }

        if (out['PRICE COST'] !== undefined) {
          out['PRODUCT COST'] = Number(out['PRICE COST']) || 0;
          delete out['PRICE COST'];
        } else if (out['PRODUCT COST'] !== undefined && out['PRODUCT COST'] !== '') {
          out['PRODUCT COST'] = Number(out['PRODUCT COST']) || 0;
        }

        return out;
      }).filter(r => r.ID); 

      if (rowsToUpdate.length === 0) {
        toast.error('No valid rows with IDs found.');
        return;
      }

      const chunkSize = 500;
      for (let i = 0; i < rowsToUpdate.length; i += chunkSize) {
        const chunk = rowsToUpdate.slice(i, i + chunkSize);
        const { error: upsertErr } = await bhs_supabas
          .from('web_Sales_DB')
          .upsert(chunk, { onConflict: 'ID' });

        if (upsertErr) throw upsertErr;
      }

      await bhs_supabas
        .from('web_Sales_DB_Cache')
        .update({ DATA: null })
        .in('KEY', ['sales_data', 'months_data']);

      toast.success(`Successfully updated ${rowsToUpdate.length} sales rows!`);
      
      buildSalesCache().catch(err => console.warn('Background build warning:', err));
      await fetchSalesMonths(true);
    } catch (err: any) {
      console.error(err);
      toast.error('Update failed: ' + (err.message || err.details || 'Unknown error'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSalesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error('The uploaded Excel file is empty.');
        return;
      }

      const requiredColumns = ['INVOICE DATE', 'INVOICE NUMBER', 'CUSTOMER ID', 'PRODUCT ID', 'QTY'];
      const firstRow = jsonData[0];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      
      if (!('PRICE SALES' in firstRow) && !('PRODUCT PRICE' in firstRow)) {
        missingColumns.push('PRICE SALES');
      }

      if (missingColumns.length > 0) {
        toast.error(`Missing required columns: ${missingColumns.join(', ')}`);
        return;
      }

      const [productIds, customerIds, nextNumStart] = await Promise.all([
        fetchAllColumnValues('bhs_PRODUCTS', 'PRODUCT ID'),
        fetchAllColumnValues('bhs_CUSTOMERS', 'CUSTOMER ID'),
        getNextSalesRecordNum(),
      ]);

      let nextNum = nextNumStart;

      const formatExcelDate = (val: unknown): string => {
        if (!val) return '';
        if (typeof val === 'number') {
          const date = new Date(Math.round((val - 25569) * 86400 * 1000));
          return date.toISOString().split('T')[0];
        }
        const strVal = String(val).trim();
        if (!strVal) return '';

        const d = new Date(strVal);
        if (!isNaN(d.getTime())) {
          const parts = strVal.split(/[-/.]/);
          if (parts.length === 3) {
            const part0 = parseInt(parts[0], 10);
            const part1 = parseInt(parts[1], 10);
            const part2 = parseInt(parts[2], 10);
            if (parts[0].length === 4) {
              return `${parts[0]}-${String(part1).padStart(2, '0')}-${String(part2).padStart(2, '0')}`;
            }
            if (parts[2].length === 4) {
              if (part1 <= 12 && part0 <= 31) {
                return `${parts[2]}-${String(part1).padStart(2, '0')}-${String(part0).padStart(2, '0')}`;
              }
            }
          }
          return d.toISOString().split('T')[0];
        }

        const parts = strVal.split(/[-/.]/);
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);
          if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            if (year > 1000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
          }
        }
        return strVal;
      };

      const allFormattedRows = jsonData.map((row) => {
        const price = Number(row['PRICE SALES'] !== undefined ? row['PRICE SALES'] : row['PRODUCT PRICE']) || 0;
        const cost = Number(row['PRICE COST'] !== undefined ? row['PRICE COST'] : row['PRODUCT COST']) || 0;
        const qty = Number(row['QTY']) || 0;
        const amount = row['AMOUNT'] !== undefined ? (Number(row['AMOUNT']) || 0) : (qty * price);

        const recordId = `R-${String(nextNum).padStart(5, '0')}`;
        nextNum++;

        return {
          ID: recordId,
          'INVOICE DATE': formatExcelDate(row['INVOICE DATE']),
          'INVOICE NUMBER': String(row['INVOICE NUMBER'] ?? '').trim(),
          'CUSTOMER ID': normalizeExcelId(row['CUSTOMER ID']),
          'PRODUCT ID': normalizeExcelId(row['PRODUCT ID']),
          'PRODUCT PRICE': price,
          'PRODUCT COST': cost,
          'AMOUNT': amount,
          'QTY': qty
        };
      });
      const isComplete = (row: (typeof allFormattedRows)[number]) =>
        Boolean(row['INVOICE DATE'] && row['INVOICE NUMBER'] && row['CUSTOMER ID'] && row['PRODUCT ID']);
      const formattedRows = allFormattedRows.filter(isComplete);
      const skippedRows = allFormattedRows
        .map((row, index) => ({ row, excelRow: index + 2 }))
        .filter(({ row }) => !isComplete(row));

      if (formattedRows.length === 0) {
        toast.error('No valid rows found to upload. Check dates, invoice numbers, product IDs, and customer IDs.');
        return;
      }

      const missingProducts = new Set<string>();
      const missingCustomers = new Set<string>();

      formattedRows.forEach((row) => {
        if (!productIds.has(row['PRODUCT ID'])) missingProducts.add(row['PRODUCT ID']);
        if (!customerIds.has(row['CUSTOMER ID'])) missingCustomers.add(row['CUSTOMER ID']);
      });

      if (missingProducts.size > 0 || missingCustomers.size > 0) {
        const issueSections = [];
        if (missingCustomers.size > 0) {
          issueSections.push({
            heading: `=== MISSING CUSTOMER IDs (${missingCustomers.size}) — add in Customers DB ===`,
            lines: [...missingCustomers].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          });
        }
        if (missingProducts.size > 0) {
          issueSections.push({
            heading: `=== MISSING PRODUCT IDs (${missingProducts.size}) — add in Products DB ===`,
            lines: [...missingProducts].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          });
        }
        
        downloadUploadIssuesReport(
          `Sales_Missing_IDs_${new Date().toISOString().split('T')[0]}.txt`,
          'Sales Upload - Missing References',
          issueSections
        );

        const parts: string[] = [];
        if (missingCustomers.size > 0) parts.push(`${missingCustomers.size} customer ID(s)`);
        if (missingProducts.size > 0) parts.push(`${missingProducts.size} product ID(s)`);

        toast.error(
          `Upload blocked: ${parts.join(' and ')} not found in the database. A text file with the full list has been downloaded — add them in Customers DB / Products DB, then upload again.`
        );
        return;
      }

      // Rows that will be skipped (missing date / invoice / customer / product)
      if (skippedRows.length > 0) {
        const proceed = window.confirm(
          `${skippedRows.length} row(s) are missing the invoice date, invoice number, customer ID or product ID and will NOT be uploaded. ` +
          `A list will be downloaded.\n\nUpload the other ${formattedRows.length} row(s)?`
        );
        downloadUploadIssuesReport(
          `Sales_Skipped_Rows_${new Date().toISOString().split('T')[0]}.txt`,
          'Sales Upload - Skipped Rows',
          [{
            heading: `=== ROWS SKIPPED (${skippedRows.length}) — missing date / invoice / customer / product ===`,
            lines: skippedRows.map(({ row, excelRow }) =>
              `Excel row ${excelRow}: date="${row['INVOICE DATE']}" invoice="${row['INVOICE NUMBER']}" customer="${row['CUSTOMER ID']}" product="${row['PRODUCT ID']}"`
            ),
          }]
        );
        if (!proceed) return;
      }

      // Works by invoice number: invoices already in the database are skipped (all their rows),
      // everything else in the file is uploaded. So a full month can be uploaded again to pick up
      // invoices that were added later with an old date (sales or returns) — nothing is counted twice.
      const existingInvoices = await findExistingInvoices(formattedRows.map((r) => r['INVOICE NUMBER']));

      // Invoices already in the database: same invoice + product → update QTY / PRICE / COST / AMOUNT if they changed.
      let lineChanges: LineChange[] = [];
      if (existingInvoices.size) {
        const dbLines = await fetchInvoiceLines([...existingInvoices]);
        const keyOf = (inv: unknown, pid: unknown) => `${String(inv ?? '').trim()}|${normalizeExcelId(pid)}`;
        const fileByKey = new Map<string, (typeof formattedRows)[number][]>();
        for (const fr of formattedRows) {
          if (!existingInvoices.has(fr['INVOICE NUMBER'])) continue;
          const k = keyOf(fr['INVOICE NUMBER'], fr['PRODUCT ID']);
          (fileByKey.get(k) || fileByKey.set(k, []).get(k)!).push(fr);
        }
        const dbByKey = new Map<string, Record<string, unknown>[]>();
        for (const dr of dbLines) {
          const k = keyOf(dr['INVOICE NUMBER'], dr['PRODUCT ID']);
          (dbByKey.get(k) || dbByKey.set(k, []).get(k)!).push(dr);
        }
        const num = (v: unknown) => Number(v) || 0;
        const sortKey = (q: number, a: number) => q * 1e9 + a;
        let unmatched = 0;
        for (const [k, fileRows] of fileByKey) {
          const dbRows = dbByKey.get(k) || [];
          if (dbRows.length !== fileRows.length) {
            unmatched += Math.abs(dbRows.length - fileRows.length) || 1;
            continue;
          }
          const f = [...fileRows].sort((a, b) => sortKey(a.QTY, a.AMOUNT) - sortKey(b.QTY, b.AMOUNT));
          const d = [...dbRows].sort((a, b) => sortKey(num(a.QTY), num(a.AMOUNT)) - sortKey(num(b.QTY), num(b.AMOUNT)));
          f.forEach((fr, i) => {
            const dr = d[i];
            const fields: LineChange['fields'] = [];
            const cmp = (col: 'QTY' | 'PRODUCT PRICE' | 'PRODUCT COST' | 'AMOUNT', next: number) => {
              const before = num(dr[col]);
              if (Math.abs(before - next) > 0.005) fields.push({ col, before, after: next });
            };
            cmp('QTY', fr.QTY);
            cmp('PRODUCT PRICE', fr['PRODUCT PRICE']);
            if (fr['PRODUCT COST']) cmp('PRODUCT COST', fr['PRODUCT COST']); // empty cost in the file = keep the saved cost
            cmp('AMOUNT', fr.AMOUNT);
            if (fields.length) lineChanges.push({ id: String(dr.ID), invoice: fr['INVOICE NUMBER'], productId: fr['PRODUCT ID'], fields });
          });
        }
        for (const [k, dbRows] of dbByKey) if (!fileByKey.has(k)) unmatched += dbRows.length;
        if (lineChanges.length) {
          const ok = await askChanges({ changes: lineChanges, unmatched });
          if (!ok) lineChanges = [];
        }
      }
      const firstNum = parseInt(String(allFormattedRows[0]?.ID || '').replace(/\D/g, ''), 10) || 1;
      const uploadRows = formattedRows
        .filter((r) => !existingInvoices.has(r['INVOICE NUMBER']))
        .map((r, i) => ({ ...r, ID: `R-${String(firstNum + i).padStart(5, '0')}` })); // keep the row numbers continuous

      // Invoices in the database inside the file's period (first → last invoice date) that are no longer
      // in the file = removed from the accounting system after they were uploaded → delete them (after asking).
      const fileDates = formattedRows.map((r) => r['INVOICE DATE']).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
      const fileInvoices = new Set(formattedRows.map((r) => r['INVOICE NUMBER']));
      let removedRows: Awaited<ReturnType<typeof findRemovedInvoiceRows>> = [];
      if (fileDates.length) {
        const periodFrom = fileDates[0];
        const periodTo = fileDates[fileDates.length - 1];
        const found = await findRemovedInvoiceRows(periodFrom, periodTo, fileInvoices);
        if (found.length) {
          const byInvoice = new Map<string, { date: string; customer: string; amount: number; rows: number }>();
          for (const r of found) {
            const g = byInvoice.get(r.invoice) || { date: r.date, customer: r.customer, amount: 0, rows: 0 };
            g.amount += r.amount;
            g.rows += 1;
            byInvoice.set(r.invoice, g);
          }
          const list = [...byInvoice].sort((x, y) => x[1].date.localeCompare(y[1].date) || x[0].localeCompare(y[0], undefined, { numeric: true }));
          const ok = await askRemoved({
            from: periodFrom,
            to: periodTo,
            rows: found.length,
            list: list.map(([invoice, g]) => ({ invoice, date: g.date, customer: g.customer, amount: g.amount, rows: g.rows })),
          });
          if (ok) removedRows = found;
        }
      }

      if (uploadRows.length === 0 && removedRows.length === 0 && lineChanges.length === 0) {
        toast.info(`Nothing new — all ${existingInvoices.size} invoice(s) in this file are already in the database.`);
        return;
      }
      if (existingInvoices.size > 0 && uploadRows.length > 0) {
        const list = [...existingInvoices].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        downloadUploadIssuesReport(
          `Sales_Skipped_Existing_Invoices_${new Date().toISOString().split('T')[0]}.txt`,
          'Sales Upload - Invoices Already In Database (skipped)',
          [{ heading: `=== SKIPPED: ALREADY UPLOADED (${list.length}) ===`, lines: list }]
        );
      }

      // Insert in chunks; if any chunk fails, remove what this upload already added
      const chunkSize = 500;
      const insertedIds: string[] = [];
      try {
        for (let i = 0; i < uploadRows.length; i += chunkSize) {
          const chunk = uploadRows.slice(i, i + chunkSize);
          const { error: insertErr } = await bhs_supabas
            .from('web_Sales_DB')
            .insert(chunk);

          if (insertErr) throw insertErr;
          insertedIds.push(...chunk.map((r) => r.ID));
        }
      } catch (insertError) {
        for (let i = 0; i < insertedIds.length; i += 500) {
          await bhs_supabas.from('web_Sales_DB').delete().in('ID', insertedIds.slice(i, i + 500));
        }
        throw insertError;
      }

      // Then update the changed lines of invoices already in the database
      let updatedLines = 0;
      let updateError = '';
      for (let i = 0; i < lineChanges.length && !updateError; i += 10) {
        const batch = lineChanges.slice(i, i + 10);
        const results = await Promise.all(
          batch.map((c) =>
            bhs_supabas
              .from('web_Sales_DB')
              .update(Object.fromEntries(c.fields.map((f) => [f.col, f.after])))
              .eq('ID', c.id),
          ),
        );
        for (const res of results) {
          if (res.error) updateError = res.error.message || 'update failed';
          else updatedLines++;
        }
      }

      // Then delete the removed invoices (only after the new rows are in)
      let deletedRows = 0;
      let deleteError = '';
      for (let i = 0; i < removedRows.length; i += 500) {
        const ids = removedRows.slice(i, i + 500).map((r) => r.ID);
        const { error: delErr } = await bhs_supabas.from('web_Sales_DB').delete().in('ID', ids);
        if (delErr) {
          deleteError = delErr.message || 'delete failed';
          break;
        }
        deletedRows += ids.length;
      }
      const deletedInvoices = new Set(removedRows.slice(0, deletedRows).map((r) => r.invoice)).size;

      await bhs_supabas
        .from('web_Sales_DB_Cache')
        .update({ DATA: null })
        .in('KEY', ['sales_data', 'months_data']);

      const newInvoices = new Set(uploadRows.map((r) => r['INVOICE NUMBER'])).size;
      const parts: string[] = [];
      if (uploadRows.length) parts.push(`Uploaded ${uploadRows.length} row(s) from ${newInvoices} new invoice(s)`);
      if (updatedLines) parts.push(`${updatedLines} changed line(s) updated`);
      if (existingInvoices.size) parts.push(`${existingInvoices.size} invoice(s) already in the database were skipped`);
      if (deletedRows) parts.push(`${deletedInvoices} removed invoice(s) deleted (${deletedRows} row(s))`);
      toast.success(parts.join(' — ') + '.');
      if (deleteError) toast.error(`Some removed invoices could not be deleted: ${deleteError}`);
      if (updateError) toast.error(`Some changed lines could not be updated: ${updateError}`);
      setIsUploadModalOpen(false);

      buildSalesCache().catch(err => console.warn('Background build warning:', err));

      await fetchSalesMonths(true);
    } catch (err: any) {
      console.error(err);
      toast.error('Upload failed — nothing was added: ' + (err.message || err.details || 'Unknown error'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const triggerMessage = (type: 'success' | 'error', text: string) => {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  };

  // Loader only (no header / search) until the first load finishes
  const [firstLoad, setFirstLoad] = useState(true);
  useEffect(() => {
    if (!isLoading) setFirstLoad(false);
  }, [isLoading]);
  if (firstLoad) return <TabLoader />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-4xl font-normal text-black tracking-tighter flex items-center gap-3">Sales DB <span className="text-lg font-black text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">{totalCount.toLocaleString()}</span></h1>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => void downloadSalesExcel()}
              disabled={isUploading}
              className="p-3 bg-white border border-gray-200 text-blue-600 rounded-2xl shadow-sm hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
              title="Download Full Sales DB"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsUpdateUploadModalOpen(true)}
              className="p-3 bg-white border border-gray-200 text-purple-600 rounded-2xl shadow-sm hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center justify-center shrink-0 cursor-pointer"
              title="Update Existing Sales DB by ID"
            >
              <Upload className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="p-3 bg-white border border-gray-200 text-green-600 rounded-2xl shadow-sm hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center justify-center shrink-0 cursor-pointer"
              title="Import New Sales Excel"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
          </div>
        )}
        {canDelete && (
          <button
            onClick={() => setIsDeleteAllConfirmOpen(true)}
            className="p-3 bg-white border border-red-200 text-red-600 rounded-2xl shadow-sm hover:scale-[1.05] active:scale-[0.95] hover:bg-red-50 transition-all flex items-center justify-center shrink-0 cursor-pointer"
            title="Delete All Sales Data"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Grid of Months */}
      {isLoading && salesMonths.length === 0 ? (
        <TabLoader className="!min-h-[60vh]" />
      ) : loadError ? (
        <TabFetchError message={loadError} onRetry={() => void fetchSalesMonths(true)} className="min-h-[60vh]" />
      ) : salesMonths.length === 0 ? (
        <NoData title="NO SALES DATA FOUND" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {salesMonths.map((m) => (
            <div
              key={`${m.year}-${m.month}`}
              className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-black/5 transition-all duration-300 flex flex-col justify-between h-[180px]"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-gray-400 tracking-wider font-mono">{m.year}</span>
                  <h3 className="text-xl font-black text-black mt-1 leading-none">{englishMonths[m.month]}</h3>
                </div>
                <div className="bg-gray-50 border border-gray-100/50 px-3 py-1.5 rounded-2xl text-center shrink-0">
                  <span className="text-sm font-black text-black">{m.count.toLocaleString()}</span>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider mt-0.5">Rows</p>
                </div>
              </div>

              <div className="flex justify-between items-center mt-6">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <Calendar className="w-3.5 h-3.5 text-gray-300" />
                  <span>Sales Invoices</span>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      onClick={() => void downloadSalesExcel({ year: m.year, month: m.month })}
                      disabled={exportingMonth === `${m.year}-${m.month}`}
                      className="p-2.5 bg-green-50 hover:bg-green-600 rounded-xl text-green-600 hover:text-white transition-all border border-transparent hover:border-green-100 disabled:opacity-60"
                      title="Download Month Excel"
                    >
                      {exportingMonth === `${m.year}-${m.month}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteClick(m.year, m.month)}
                      className="p-2.5 bg-red-50 hover:bg-red-500 rounded-xl text-red-500 hover:text-white transition-all border border-transparent hover:border-red-100"
                      title="Delete Month Sales Data"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {targetMonth && (
        <ConfirmModal
          isOpen={isConfirmOpen}
          onConfirm={executeDelete}
          onCancel={() => {
            setIsConfirmOpen(false);
            setTargetMonth(null);
          }}
          isLoading={isDeleting}
          title="Confirm Month Deletion"
          message={`Are you sure you want to delete all sales data for ${englishMonths[targetMonth.month]} ${targetMonth.year}? This will remove all transactions for this month and cannot be undone.`}
        />
      )}

      {/* Wipe All Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteAllConfirmOpen}
        onConfirm={executeDeleteAll}
        onCancel={() => setIsDeleteAllConfirmOpen(false)}
        isLoading={isDeletingAll}
        title="Confirm Wipe Database"
        message="Are you sure you want to delete ALL sales data? This action is permanent and cannot be undone."
      />

      {/* Excel Upload Modal */}
      {changesPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/60 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 flex items-center gap-4 border-b border-slate-100">
              <span className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <RefreshCw className="w-6 h-6" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900">Changed lines in uploaded invoices</h2>
                {changesPrompt.unmatched > 0 && (
                  <p className="text-xs font-semibold text-amber-700 mt-2">
                    {changesPrompt.unmatched} line(s) could not be matched (product added / removed or repeated in the invoice) — they are left as they are.
                  </p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-4 text-center">Invoice</th>
                    <th className="py-2.5 px-3 text-center">Product</th>
                    <th className="py-2.5 px-3 text-center">Field</th>
                    <th className="py-2.5 px-4 text-center">Now → New</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {changesPrompt.changes.flatMap((c) =>
                    c.fields.map((f, j) => (
                      <tr key={`${c.id}-${f.col}`} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 text-center font-bold text-slate-900 break-all">{j === 0 ? c.invoice : ''}</td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-500">{j === 0 ? c.productId : ''}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-black text-slate-600">
                            {f.col === 'PRODUCT PRICE' ? 'PRICE' : f.col === 'PRODUCT COST' ? 'COST' : f.col}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center whitespace-nowrap">
                          <span className="font-semibold text-slate-400 line-through">{f.before.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                          <span className="mx-1.5 text-slate-300">→</span>
                          <span className="font-black text-slate-900">{f.after.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => answerChanges(false)}
                className="h-12 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Keep the saved values
              </button>
              <button
                type="button"
                onClick={() => answerChanges(true)}
                className="h-12 rounded-2xl bg-[#0a0f1d] hover:bg-slate-800 text-sm font-black text-white inline-flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Update {changesPrompt.changes.length} line{changesPrompt.changes.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}

      {removedPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/60 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 flex items-start gap-4 border-b border-slate-100">
              <span className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900">Invoices not in this file</h2>
                <p className="text-sm font-semibold text-slate-500 mt-1">
                  {removedPrompt.list.length} invoice{removedPrompt.list.length === 1 ? '' : 's'} in the database are dated inside this file&apos;s period but are not in the file — probably removed from the system.
                </p>
                <span className="inline-flex items-center gap-1.5 mt-3 px-3 h-8 rounded-lg bg-slate-100 text-xs font-black text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {removedPrompt.from === removedPrompt.to ? removedPrompt.from : `${removedPrompt.from} → ${removedPrompt.to}`}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-4 text-center">Invoice</th>
                    <th className="py-2.5 px-3 text-center">Date</th>
                    <th className="py-2.5 px-3 text-center">Customer</th>
                    <th className="py-2.5 px-4 text-center">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {removedPrompt.list.map((r) => (
                    <tr key={r.invoice} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 text-center font-bold text-slate-900 whitespace-nowrap">{r.invoice}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-500 whitespace-nowrap">{r.date}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-500">{r.customer}</td>
                      <td className={`py-2.5 px-4 text-center font-black whitespace-nowrap ${r.amount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {r.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => answerRemoved(false)}
                className="h-12 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Keep them
              </button>
              <button
                type="button"
                onClick={() => answerRemoved(true)}
                className="h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-sm font-black text-white inline-flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete {removedPrompt.list.length} invoice{removedPrompt.list.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500 overflow-hidden">
            <div className="p-8 flex items-center justify-between border-b border-gray-50">
              <h2 className="text-2xl font-bold text-black">Sales Data Import</h2>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                disabled={isUploading}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">

              <div className="space-y-4">
                {/* Download Button */}
                <button
                  onClick={downloadSalesTemplate}
                  disabled={isUploading}
                  className="w-full py-4 px-6 bg-gray-50 border border-gray-100 hover:border-black/10 text-gray-800 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.01]"
                >
                  <Download className="w-5 h-5 text-[#D4AF37]" />
                  <span>Download Blank Template</span>
                </button>

                {/* Upload Label Button */}
                <label
                  className={`w-full py-4 px-6 bg-black text-[#D4AF37] rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-black/10 transition-all hover:scale-[1.01] cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  <span>{isUploading ? 'Uploading...' : 'Upload Excel File'}</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleSalesUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="text-xs font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest"
                  disabled={isUploading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal (Update Existing) */}
      {isUpdateUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setIsUpdateUploadModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-black bg-gray-50 hover:bg-gray-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Update Sales Records</h2>
              <p className="text-gray-600 mb-6 text-sm">
                Upload a modified Excel file to update existing records. The file must contain the <span className="font-bold">ID</span> column.
              </p>

              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-gray-50 hover:bg-gray-100 transition-colors relative cursor-pointer group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => {
                    handleSalesUpdateUpload(e);
                    setIsUpdateUploadModalOpen(false);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <Upload className="w-10 h-10 text-purple-400 mb-3 group-hover:scale-110 transition-transform duration-300" />
                <p className="font-bold text-gray-700">Click or drag file to update</p>
                <p className="text-xs text-gray-400 mt-2">Only .xlsx or .xls files</p>
              </div>

              {isUploading && (
                <div className="mt-4 flex items-center justify-center gap-3 text-purple-600 font-semibold bg-purple-50 p-4 rounded-xl">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Updating Database...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
