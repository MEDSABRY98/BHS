'use client';

import React, { useState } from 'react';
import { Download, Upload, Trash2, AlertTriangle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function DebitDatabasePage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const COLUMNS = ['DATE', 'DUE DATE', 'NUMBER', 'CUSTOMER ID', 'CITY', 'DEBIT', 'CREDIT', 'RESIDUAL AMOUNT', 'MATCHING'];

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([COLUMNS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DebitTemplate');
    XLSX.writeFile(wb, 'mix_DEBIT_Template.xlsx');
  };

  const handleDeleteAll = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('/DataBase/Debit/api', { method: 'DELETE' });
      const result = await res.json();
      if (res.ok) {
        showMessage('success', result.message);
      } else {
        showMessage('error', result.error || 'Failed to delete data');
      }
    } catch (error: any) {
      showMessage('error', error.message);
    } finally {
      setLoading(false);
      setConfirmDelete(false);
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
        const data = XLSX.utils.sheet_to_json(ws, { defval: null });
        
        // Ensure data is not empty
        if (data.length === 0) {
          showMessage('error', 'The uploaded file is empty.');
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
          showMessage('success', result.message);
        } else {
          showMessage('error', result.error || 'Failed to upload data');
        }
      } catch (error: any) {
        showMessage('error', 'Error parsing file: ' + error.message);
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

      {message.text && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 \${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <p className="font-medium">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
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
            onClick={handleDeleteAll}
            disabled={loading}
            className={`mt-auto w-full py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 \${confirmDelete ? 'bg-red-700 hover:bg-red-800 text-white ring-2 ring-red-300 ring-offset-2' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}
          >
            {confirmDelete ? 'Click to Confirm Wipe' : 'Delete Data'}
          </button>
        </div>

      </div>
    </div>
  );
}
