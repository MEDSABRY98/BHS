'use client';

import React, { useState, useEffect } from 'react';
import { Download, Upload, Trash2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from '@/app/Components/Notification';
import { deleteSuppliersTransactionsData, uploadSuppliersTransactionsData } from '@/app/SuppliersAnalysis/Service/UploadService';
import { bhs_supabas } from '@/lib/supabase';
import { exportDatabaseExcelTable } from '@/app/DataBase/Utils/ExcelExport';
import { downloadUploadIssuesReport } from '@/app/DataBase/Utils/ExcelUploadUtils';

export default function SuppliersAnalysisDBPage() {
  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    fetchCount();
  }, []);

  const fetchCount = async () => {
    try {
      const { count, error } = await bhs_supabas
        .from('web_SUPPLIERS_ANALYSIS')
        .select('*', { count: 'exact', head: true });
      if (!error && count !== null) {
        setTotalCount(count);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const COLUMNS = ['DATE', 'NUMBER', 'SUPPLIER NAME', 'DEBIT', 'CREDIT', 'RESIDUAL AMOUNT', 'MATCHING'];

  const handleDownloadTemplate = async () => {
    const sampleRow = ['2026-06-12', 'INV-001', 'Sample Supplier', 1000, 0, 1000, 'Matched'];
    await exportDatabaseExcelTable(COLUMNS, [sampleRow], 'Suppliers_Transactions_Template.xlsx');
  };

  const handleDeleteAll = async () => {
    setLoading(true);
    try {
      const result = await deleteSuppliersTransactionsData();
      if (result.success) {
        toast.success(result.message || 'Data deleted successfully');
        setIsDeleteModalOpen(false);
        fetchCount();
      } else {
        toast.error(result.error || 'Failed to delete data');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        let data = XLSX.utils.sheet_to_json(ws, { defval: null });
        
        data = data.filter((row: any) => {
          return row['SUPPLIER ID'] || row['SUPPLIER NAME'] || row['NUMBER'] || row['DEBIT'] || row['CREDIT'] || row['RESIDUAL AMOUNT'];
        });

        data = data.map((row: any) => {
          ['DATE'].forEach(dateCol => {
             if (row[dateCol]) {
               if (typeof row[dateCol] === 'string') {
                 const match = row[dateCol].match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                 if (match) {
                   const day = match[1].padStart(2, '0');
                   const month = match[2].padStart(2, '0');
                   const year = match[3];
                   row[dateCol] = `${year}-${month}-${day}`;
                 }
               } else if (row[dateCol] instanceof Date) {
                 const d = row[dateCol];
                 const year = d.getFullYear();
                 const month = String(d.getMonth() + 1).padStart(2, '0');
                 const day = String(d.getDate()).padStart(2, '0');
                 row[dateCol] = `${year}-${month}-${day}`;
               }
             }
          });
          return row;
        });
        
        if (data.length === 0) {
          toast.error('The uploaded file is empty.');
          setLoading(false);
          return;
        }

        const payloadString = JSON.stringify(data);
        const result = await uploadSuppliersTransactionsData(payloadString);
        
        if (result.success) {
          toast.success(result.message || 'Data uploaded successfully');
          fetchCount();
        } else {
          toast.error('Upload failed. Downloading error report...');
          const lines = [result.error || 'Failed to upload data'];
          if (result.details) {
            lines.push(...result.details.split('\n'));
          }
          downloadUploadIssuesReport('Suppliers_Upload_Issues.txt', 'Suppliers Upload Error', [
            { heading: 'Error Details:', lines }
          ]);
        }
      } catch (error: any) {
        toast.error('Error parsing file: ' + error.message);
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter flex items-center gap-3">
            Suppliers Analysis DB 
            <span className="text-lg font-black text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">
              {totalCount.toLocaleString()}
            </span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        <div className="group bg-white border border-slate-200/60 rounded-[2.5rem] p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-black/5 flex flex-col items-center text-center relative overflow-hidden">
          <div className="w-20 h-20 bg-slate-50 text-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-inner relative z-10 transition-transform group-hover:-translate-y-1">
            <Download className="w-10 h-10" />
          </div>
          <div className="flex-1 relative z-10">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Download Template</h3>
            <p className="text-sm font-medium text-slate-400 mt-3 leading-relaxed">
              Get an empty Excel file structured for Suppliers Transactions.
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            disabled={loading}
            className="mt-8 w-full py-4 bg-slate-100 text-slate-900 hover:bg-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 relative z-10"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>

        <div className="group bg-white border border-slate-200/60 rounded-[2.5rem] p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-[#D4AF37]/10 flex flex-col items-center text-center relative overflow-hidden">
          <div className="w-20 h-20 bg-[#D4AF37]/10 text-[#D4AF37] rounded-3xl flex items-center justify-center mb-6 shadow-inner relative z-10 transition-transform group-hover:-translate-y-1">
            <Upload className="w-10 h-10" />
          </div>
          <div className="flex-1 relative z-10">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Upload Data</h3>
            <p className="text-sm font-medium text-slate-400 mt-3 leading-relaxed">
              Upload the populated template. Data will be appended to the DB.
            </p>
          </div>
          <div className="relative w-full mt-8 z-10">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              disabled={loading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
            />
            <div className="w-full py-4 bg-black text-[#D4AF37] hover:bg-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 pointer-events-none">
              <Upload className="w-4 h-4" />
              Select File
            </div>
          </div>
        </div>

        <div className="group bg-white border border-slate-200/60 rounded-[2.5rem] p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/10 flex flex-col items-center text-center relative overflow-hidden">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6 shadow-inner relative z-10 transition-transform group-hover:-translate-y-1">
            <Trash2 className="w-10 h-10" />
          </div>
          <div className="flex-1 relative z-10">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Wipe Database</h3>
            <p className="text-sm font-medium text-slate-400 mt-3 leading-relaxed">
              Permanently delete all records in the Transactions table.
            </p>
          </div>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={loading}
            className="mt-8 w-full py-4 bg-white text-red-500 border-2 border-red-50 hover:bg-red-50 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 relative z-10"
          >
            <AlertTriangle className="w-4 h-4" />
            Wipe Data
          </button>
        </div>
      </div>

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Wipe Database</h3>
              <p className="text-slate-500 text-sm">
                Are you sure you want to delete ALL data in the Transactions database? This action is permanent.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-center w-full">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Wipe Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
