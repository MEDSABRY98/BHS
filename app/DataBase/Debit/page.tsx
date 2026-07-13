'use client';

import React, { useState, useEffect } from 'react';
import { Download, Upload, Trash2, AlertTriangle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from '@/app/Components/Notification';
import { deleteDebitData, uploadDebitData } from '../Service/database_service';
import { bhs_supabas } from '@/lib/supabase';
import { exportDatabaseExcelTable } from '../Utils/ExcelExport';
import { downloadUploadIssuesReport } from '../Utils/ExcelUploadUtils';

export default function DebitDatabasePage() {
  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    fetchCount();
  }, []);

  const fetchCount = async () => {
    try {
      const { count, error } = await bhs_supabas
        .from('mix_DEBIT')
        .select('*', { count: 'exact', head: true });
      if (!error && count !== null) {
        setTotalCount(count);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const COLUMNS = ['DATE', 'DUE DATE', 'NUMBER', 'CUSTOMER NAME', 'DEBIT', 'CREDIT', 'RESIDUAL AMOUNT', 'MATCHING'];

  const handleDownloadTemplate = async () => {
    const sampleRow = ['2026-06-12', '2026-07-12', 'INV-001', 'Sample Customer', 1000, 0, 1000, 'Matched'];
    await exportDatabaseExcelTable(COLUMNS, [sampleRow], 'mix_DEBIT_Template.xlsx');
  };

  const handleDeleteAll = async () => {
    setLoading(true);
    try {
      const result = await deleteDebitData();
      if (result.success) {
        toast.success(result.message || 'Data deleted successfully');
        setIsDeleteModalOpen(false);
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
        
        // Parse excel to JSON
        let data = XLSX.utils.sheet_to_json(ws, { defval: null });
        
        // Filter out completely empty rows
        data = data.filter((row: any) => {
          return row['CUSTOMER ID'] || row['CUSTOMER NAME'] || row['NUMBER'] || row['DEBIT'] || row['CREDIT'] || row['RESIDUAL AMOUNT'];
        });

        // Format dates correctly (DD/MM/YYYY -> YYYY-MM-DD)
        data = data.map((row: any) => {
          ['DATE', 'DUE DATE'].forEach(dateCol => {
             if (row[dateCol]) {
               if (typeof row[dateCol] === 'string') {
                 // Match DD/MM/YYYY or DD-MM-YYYY
                 const match = row[dateCol].match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                 if (match) {
                   const day = match[1].padStart(2, '0');
                   const month = match[2].padStart(2, '0');
                   const year = match[3];
                   row[dateCol] = `${year}-${month}-${day}`;
                 }
               } else if (row[dateCol] instanceof Date) {
                 // Convert JS Date object to YYYY-MM-DD string to avoid timezone offset issues
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
        
        // Ensure data is not empty
        if (data.length === 0) {
          toast.error('The uploaded file is empty.');
          setLoading(false);
          return;
        }

        // Send to API
        const payloadString = JSON.stringify(data);
        const result = await uploadDebitData(payloadString);
        
        if (result.success) {
          toast.success(result.message || 'Data uploaded successfully');
        } else {
          toast.error('Upload failed. Downloading error report...');
          downloadUploadIssuesReport('Debit_Upload_Issues.txt', 'Debit Upload Error', [
            { heading: 'Error Details:', lines: [result.error || 'Failed to upload data'] }
          ]);
        }
      } catch (error: any) {
        toast.error('Error parsing file: ' + error.message);
      } finally {
        setLoading(false);
        e.target.value = ''; // Reset file input
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter flex items-center gap-3">Debit DB <span className="text-lg font-black text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">{totalCount.toLocaleString()}</span></h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        
        {/* Download Template Card */}
        <div className="group bg-white border border-gray-100 rounded-[2.5rem] p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-black/5 hover:border-black/5 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-100 to-transparent rounded-bl-full -z-0 transition-transform group-hover:scale-110 opacity-50" />
          <div className="w-20 h-20 bg-gray-50 text-gray-800 rounded-3xl flex items-center justify-center mb-6 shadow-inner relative z-10 transition-transform group-hover:-translate-y-1">
            <Download className="w-10 h-10" />
          </div>
          <div className="flex-1 relative z-10">
            <h3 className="text-xl font-black text-gray-900 tracking-tight">Download Template</h3>
            <p className="text-sm font-medium text-gray-400 mt-3 leading-relaxed">
              Get an empty Excel file with the exact headers structured for the Debit Database.
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            disabled={loading}
            className="mt-8 w-full py-4 bg-gray-100 text-gray-900 hover:bg-gray-200 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 relative z-10"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>

        {/* Upload Excel Card */}
        <div className="group bg-white border border-gray-100 rounded-[2.5rem] p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-[#D4AF37]/10 hover:border-[#D4AF37]/30 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#D4AF37]/10 to-transparent rounded-bl-full -z-0 transition-transform group-hover:scale-110" />
          <div className="w-20 h-20 bg-[#D4AF37]/10 text-[#D4AF37] rounded-3xl flex items-center justify-center mb-6 shadow-inner relative z-10 transition-transform group-hover:-translate-y-1">
            <Upload className="w-10 h-10" />
          </div>
          <div className="flex-1 relative z-10">
            <h3 className="text-xl font-black text-gray-900 tracking-tight">Upload Data</h3>
            <p className="text-sm font-medium text-gray-400 mt-3 leading-relaxed">
              Upload the populated template. Your data will be validated and appended to the database.
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
            <div className="w-full py-4 bg-black text-[#D4AF37] hover:bg-gray-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-black/20 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 pointer-events-none">
              <Upload className="w-4 h-4" />
              Select File
            </div>
          </div>
        </div>

        {/* Delete Data Card */}
        <div className="group bg-white border border-gray-100 rounded-[2.5rem] p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/10 hover:border-red-100 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-50 to-transparent rounded-bl-full -z-0 transition-transform group-hover:scale-110" />
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6 shadow-inner relative z-10 transition-transform group-hover:-translate-y-1">
            <Trash2 className="w-10 h-10" />
          </div>
          <div className="flex-1 relative z-10">
            <h3 className="text-xl font-black text-gray-900 tracking-tight">Wipe Database</h3>
            <p className="text-sm font-medium text-gray-400 mt-3 leading-relaxed">
              Permanently delete all records in the Debit table. This action cannot be undone.
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

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Wipe Database</h3>
              <p className="text-gray-500 text-sm">
                Are you sure you want to delete ALL data in the Debit database? This action is permanent and cannot be undone.
              </p>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-center w-full">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
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
