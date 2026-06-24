'use client';

import React, { useState } from 'react';
import { Download, Upload, Trash2, AlertTriangle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from '@/app/Components/Notification';

export default function DebitDatabasePage() {
  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const COLUMNS = ['DATE', 'DUE DATE', 'NUMBER', 'CUSTOMER ID', 'DEBIT', 'CREDIT', 'RESIDUAL AMOUNT', 'MATCHING'];

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([COLUMNS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DebitTemplate');
    XLSX.writeFile(wb, 'mix_DEBIT_Template.xlsx');
  };

  const handleDeleteAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/DataBase/Debit/api', { method: 'DELETE' });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
        setIsDeleteModalOpen(false);
      } else {
        toast.error(result.details || result.error || 'Failed to delete data');
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
          return row['CUSTOMER ID'] || row['NUMBER'] || row['DEBIT'] || row['CREDIT'] || row['RESIDUAL AMOUNT'];
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
        const res = await fetch('/DataBase/Debit/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        });
        
        const result = await res.json();
        if (res.ok) {
          toast.success(result.message);
        } else {
          // Just show the high-level error, omitting the detailed list of IDs
          toast.error(result.error || 'Failed to upload data');
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#D4AF37]" />
            Debit Database
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        
        {/* Download Template Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Download className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Download Template</h3>
            <p className="text-xs text-gray-500 mt-1">Get an empty excel file with correct headers.</p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            disabled={loading}
            className="mt-auto w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            Download
          </button>
        </div>

        {/* Upload Excel Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Upload Data</h3>
            <p className="text-xs text-gray-500 mt-1">Upload the populated template. Data will be appended.</p>
          </div>
          <div className="relative w-full mt-auto">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              disabled={loading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors text-center pointer-events-none">
              Select Excel File
            </div>
          </div>
        </div>

        {/* Delete Data Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
            <Trash2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-red-900">Delete All Data</h3>
            <p className="text-xs text-red-500 mt-1">Wipe the entire table. This action cannot be undone.</p>
          </div>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={loading}
            className="mt-auto w-full py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 bg-red-100 hover:bg-red-200 text-red-700"
          >
            Delete Data
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
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2"
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
