'use client';

import { useState, useEffect } from 'react';
import { Trash2, Calendar, Loader2, FileSpreadsheet, Download, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePermissions } from '@/app/LPOs/Hooks/usePermissions';
import { ConfirmModal } from '@/app/LPOs/Components/ConfirmModal';
import NoData from '@/app/Components/NoDataTab';
import { toast } from '@/app/Components/Notification';

const englishMonths: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
};

interface InvoiceMonth {
  year: number;
  month: number;
  count: number;
}

const EXCEL_HEADERS = ['DATE', 'TYPE', 'INVOICE NUMBER', 'SUPPLIER NAME', 'AMOUNT'];

export default function SuppliersRefundPage() {
  const { canDelete, canEdit } = usePermissions();
  const [months, setMonths] = useState<InvoiceMonth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [targetMonth, setTargetMonth] = useState<{ year: number; month: number } | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const pageTitle = "Suppliers Refund DB";
  const invoiceType = "Refund";
  const templateFilename = "Suppliers_Refund_Template.xlsx";
  const cardLabel = "Refund Invoices";

  useEffect(() => {
    fetchMonths();
  }, []);

  async function fetchMonths() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/SuppliersInvoices?action=months&type=${encodeURIComponent(invoiceType)}`
      );
      const resData = await response.json();
      if (resData.error) {
        throw new Error(resData.details ? `${resData.error}: ${resData.details}` : resData.error);
      }
      setMonths(resData.data || []);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to load months');
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
      const response = await fetch(
        `/api/SuppliersInvoices?year=${targetMonth.year}&month=${targetMonth.month}&type=${encodeURIComponent(invoiceType)}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      toast.success(
        `Deleted ${invoiceType.toLowerCase()} data for ${englishMonths[targetMonth.month]} ${targetMonth.year}`
      );
      await fetchMonths();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete month data');
    } finally {
      setIsDeleting(false);
      setIsConfirmOpen(false);
      setTargetMonth(null);
    }
  };

  const downloadTemplate = () => {
    const sampleRow = {
      DATE: '2026-06-12',
      TYPE: invoiceType,
      'INVOICE NUMBER': 'INV-001',
      'SUPPLIER NAME': 'Sample Supplier',
      AMOUNT: 1500.0,
    };

    const ws = XLSX.utils.json_to_sheet([sampleRow], { header: EXCEL_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, templateFilename);
    toast.success('Template downloaded successfully!');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error('The uploaded Excel file is empty.');
        return;
      }

      const missingColumns = EXCEL_HEADERS.filter((col) => !(col in jsonData[0]));
      if (missingColumns.length > 0) {
        toast.error(`Missing required columns: ${missingColumns.join(', ')}`);
        return;
      }

      const rows = jsonData.map((row) => ({
        DATE: row.DATE,
        TYPE: row.TYPE ?? invoiceType,
        'INVOICE NUMBER': row['INVOICE NUMBER'],
        'SUPPLIER NAME': row['SUPPLIER NAME'],
        AMOUNT: row.AMOUNT,
      }));

      const response = await fetch('/api/SuppliersInvoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: invoiceType, rows }),
      });

      const result = await response.json();
      if (!response.ok) {
        const details = Array.isArray(result.details) ? result.details.join('; ') : result.details;
        throw new Error(details || result.error || 'Upload failed');
      }

      toast.success(`Successfully uploaded ${result.inserted || rows.length} rows!`);
      setIsUploadModalOpen(false);
      await fetchMonths();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-4xl font-normal text-black tracking-tighter">{pageTitle}</h1>
        {canEdit && (
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="p-3 bg-white border border-gray-200 text-green-600 rounded-2xl shadow-sm hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center justify-center shrink-0 cursor-pointer"
            title="Import Excel"
          >
            <FileSpreadsheet className="w-5 h-5" />
          </button>
        )}
      </div>

      {isLoading && months.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array(8)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-white rounded-3xl p-6 border border-gray-100 h-[180px] flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-4 bg-gray-100 rounded w-1/4" />
                  <div className="h-6 bg-gray-100 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="h-10 bg-gray-100 rounded-xl w-full" />
              </div>
            ))}
        </div>
      ) : months.length === 0 ? (
        <NoData title={`NO ${invoiceType.toUpperCase()} DATA FOUND`} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {months.map((m) => (
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
                  <span>{cardLabel}</span>
                </div>
                {canDelete && (
                  <button
                    onClick={() => handleDeleteClick(m.year, m.month)}
                    className="p-2.5 bg-red-50 hover:bg-red-500 rounded-xl text-red-500 hover:text-white transition-all border border-transparent hover:border-red-100"
                    title="Delete Month Data"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
          message={`Are you sure you want to delete all ${invoiceType.toLowerCase()} data for ${englishMonths[targetMonth.month]} ${targetMonth.year}? This cannot be undone.`}
        />
      )}

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500 overflow-hidden">
            <div className="p-8 flex items-center justify-between border-b border-gray-50">
              <h2 className="text-2xl font-bold text-black">{invoiceType} Data Import</h2>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                disabled={isUploading}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <p className="text-xs text-gray-500 leading-relaxed">
                Columns: DATE, TYPE, INVOICE NUMBER, SUPPLIER NAME, AMOUNT. TYPE must be{' '}
                <strong>{invoiceType}</strong> for this tab.
              </p>

              <div className="space-y-4">
                <button
                  onClick={downloadTemplate}
                  disabled={isUploading}
                  className="w-full py-4 px-6 bg-gray-50 border border-gray-100 hover:border-black/10 text-gray-800 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.01]"
                >
                  <Download className="w-5 h-5 text-[#D4AF37]" />
                  <span>Download Blank Template</span>
                </button>

                <label
                  className={`w-full py-4 px-6 bg-black text-[#D4AF37] rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-black/10 transition-all hover:scale-[1.01] cursor-pointer ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  <span>{isUploading ? 'Uploading...' : 'Upload Excel File'}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={isUploading}
                    onChange={handleUpload}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
