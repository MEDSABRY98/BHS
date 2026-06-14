'use client';

import { useState, useEffect } from 'react';
import { Trash2, Calendar, Loader2, Database, FileSpreadsheet, Download, Upload, X } from 'lucide-react';
import { usePermissions } from '../../LPOs/Hooks/usePermissions';
import { ConfirmModal } from '../../LPOs/Components/ConfirmModal';
import NoData from '@/app/Components/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { bhs_supabas } from '@/lib/Supabase';
import * as XLSX from 'xlsx';

const englishMonths: Record<number, string> = {
  1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
  7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December"
};

interface SalesMonth {
  year: number;
  month: number;
  count: number;
}

export default function SalesDBPage() {
  const { canDelete, canEdit, isLoaded } = usePermissions();
  const [salesMonths, setSalesMonths] = useState<SalesMonth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [targetMonth, setTargetMonth] = useState<{ year: number; month: number } | null>(null);

  // Excel Modal States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchSalesMonths();
  }, []);

  async function fetchSalesMonths(forceRefresh = false) {
    setIsLoading(true);
    try {
      const response = await fetch('/api/Sales?action=months');
      const resData = await response.json();
      if (resData.error) throw new Error(resData.error);
      setSalesMonths(resData.data || []);
    } catch (err: any) {
      console.error(err);
      triggerMessage('error', err.message || 'Failed to load sales months');
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
      const response = await fetch(`/api/Sales?year=${targetMonth.year}&month=${targetMonth.month}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

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

  const downloadSalesTemplate = () => {
    const headers = [
      'INVOICE DATE',
      'INVOICE NUMBER',
      'CUSTOMER ID',
      'PRODUCT ID',
      'PRODUCT COST',
      'PRODUCT PRICE',
      'AMOUNT',
      'QTY'
    ];

    // Create a worksheet with headers and a sample row
    const sampleRow = {
      'INVOICE DATE': '2026-06-12',
      'INVOICE NUMBER': 'INV-001',
      'CUSTOMER ID': '85527',
      'PRODUCT ID': 'PROD-789',
      'PRODUCT COST': 10.50,
      'PRODUCT PRICE': 15.00,
      'AMOUNT': 15.00,
      'QTY': 1
    };

    const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Template');
    XLSX.writeFile(wb, 'Sales_Import_Template.xlsx');
    toast.success('Template downloaded successfully!');
  };

  const handleSalesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. Read and parse Excel file
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error('The uploaded Excel file is empty.');
        setIsUploading(false);
        return;
      }

      // Validate required columns
      const requiredColumns = ['INVOICE DATE', 'INVOICE NUMBER', 'CUSTOMER ID', 'PRODUCT ID', 'PRODUCT COST', 'PRODUCT PRICE', 'QTY'];
      const firstRow = jsonData[0];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      if (missingColumns.length > 0) {
        toast.error(`Missing required columns: ${missingColumns.join(', ')}`);
        setIsUploading(false);
        return;
      }

      // 2. Fetch latest 200 rows by CREATED_AT desc to find the max ID suffix.
      const { data: latestRows, error: latestErr } = await bhs_supabas
        .from('web_Sales_DB')
        .select('ID')
        .order('CREATED_AT', { ascending: false })
        .limit(200);

      if (latestErr) throw latestErr;

      let maxNum = 0;
      if (latestRows && latestRows.length > 0) {
        latestRows.forEach(row => {
          if (row.ID && row.ID.startsWith('R-')) {
            const num = parseInt(row.ID.substring(2));
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        });
      }

      // Helper function to format Excel date serials or strings to YYYY-MM-DD
      const formatExcelDate = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'number') {
          // Excel serial number
          const date = new Date(Math.round((val - 25569) * 86400 * 1000));
          return date.toISOString().split('T')[0];
        }
        const strVal = String(val).trim();
        if (!strVal) return '';

        // Try standard parsing
        let d = new Date(strVal);
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

        // Try parsing DD/MM/YYYY manually if constructor failed
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

      // 3. Format rows and generate IDs
      let nextNum = maxNum + 1;
      const formattedRows = jsonData.map((row) => {
        const cost = Number(row['PRODUCT COST']) || 0;
        const price = Number(row['PRODUCT PRICE']) || 0;
        const qty = Number(row['QTY']) || 0;
        const amount = row['AMOUNT'] !== undefined ? (Number(row['AMOUNT']) || 0) : (qty * price);

        const recordId = `R-${String(nextNum).padStart(5, '0')}`;
        nextNum++;

        return {
          ID: recordId,
          'INVOICE DATE': formatExcelDate(row['INVOICE DATE']),
          'INVOICE NUMBER': String(row['INVOICE NUMBER'] ?? '').trim(),
          'CUSTOMER ID': String(row['CUSTOMER ID'] ?? '').trim(),
          'PRODUCT ID': String(row['PRODUCT ID'] ?? '').trim(),
          'PRODUCT COST': cost,
          'PRODUCT PRICE': price,
          'AMOUNT': amount,
          'QTY': qty
        };
      }).filter(row => row['INVOICE DATE'] && row['INVOICE NUMBER'] && row['CUSTOMER ID'] && row['PRODUCT ID']);

      if (formattedRows.length === 0) {
        toast.error('No valid rows found to upload. Check dates, invoice numbers, product IDs, and customer IDs.');
        setIsUploading(false);
        return;
      }

      // 4. Batch insert into the database (500 records at a time)
      const chunkSize = 500;
      for (let i = 0; i < formattedRows.length; i += chunkSize) {
        const chunk = formattedRows.slice(i, i + chunkSize);
        const { error: insertErr } = await bhs_supabas
          .from('web_Sales_DB')
          .insert(chunk);

        if (insertErr) throw insertErr;
      }

      // 5. Invalidate caches
      await bhs_supabas
        .from('web_Sales_DB_Cache')
        .update({ DATA: null })
        .in('KEY', ['sales_data', 'months_data']);

      toast.success(`Successfully uploaded ${formattedRows.length} sales rows!`);
      setIsUploadModalOpen(false);

      // 6. Rebuild cache in background & refresh UI
      fetch('/api/Sales/Build', { method: 'POST' })
        .then(r => r.json())
        .catch(err => console.warn('Background build warning:', err));

      await fetchSalesMonths();
    } catch (err: any) {
      console.error(err);
      toast.error('Upload failed: ' + (err.message || err.details || 'Unknown error'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const triggerMessage = (type: 'success' | 'error', text: string) => {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-4xl font-normal text-black tracking-tighter">Sales DB</h1>
        {canEdit && (
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="p-3 bg-white border border-gray-200 text-green-600 rounded-2xl shadow-sm hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center justify-center shrink-0 cursor-pointer"
            title="Import Sales Excel"
          >
            <FileSpreadsheet className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Grid of Months */}
      {isLoading && salesMonths.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-3xl p-6 border border-gray-100 h-[180px] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                <div className="h-6 bg-gray-100 rounded w-3/4"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
              </div>
              <div className="h-10 bg-gray-100 rounded-xl w-full"></div>
            </div>
          ))}
        </div>
      ) : salesMonths.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-12 border border-gray-100 shadow-sm flex items-center justify-center">
          <NoData title="NO SALES DATA FOUND" />
        </div>
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

      {/* Excel Upload Modal */}
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

    </div>
  );
}
