'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, FileText, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { generateStatementPDF } from './Pdf/SummaryUtils';


export interface UploadedRow {
  DATE: string;
  NUMBER: string;
  'CUSTOMER NAME': string;
  DEBIT: number;
  CREDIT: number;
  'RESIDUAL AMOUNT': number;
  MATCHING: string;
}

interface CustomerGroup {
  customerName: string;
  rows: UploadedRow[];
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export default function MakeStatementTab() {
  const [isUploading, setIsUploading] = useState(false);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      const templateData = [{
        "DATE": "01/01/2026",
        "NUMBER": "OB",
        "CUSTOMER NAME": "Example Customer",
        "DEBIT": 1000,
        "CREDIT": 0,
        "RESIDUAL AMOUNT": 1000,
        "MATCHING": ""
      }];
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "Make_Statement_Template.xlsx");
      toast.success('Template downloaded successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to download template.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];

        // Validate and Group
        const groupsMap = new Map<string, CustomerGroup>();

        rawData.forEach(row => {
          const custName = row["CUSTOMER NAME"]?.toString().trim();
          if (!custName) return; // skip rows without customer name

          // Convert Excel serial date to JS Date if necessary
          let dateStr = row["DATE"]?.toString() || '';
          if (typeof row["DATE"] === 'number') {
            const date = new Date((row["DATE"] - (25567 + 2)) * 86400 * 1000); // Excel date to JS Date
            dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
          }

          const rowData: UploadedRow = {
            DATE: dateStr,
            NUMBER: row["NUMBER"]?.toString() || '',
            'CUSTOMER NAME': custName,
            DEBIT: Number(row["DEBIT"]) || 0,
            CREDIT: Number(row["CREDIT"]) || 0,
            'RESIDUAL AMOUNT': Number(row["RESIDUAL AMOUNT"]) || 0,
            MATCHING: row["MATCHING"]?.toString() || ''
          };

          if (!groupsMap.has(custName)) {
            groupsMap.set(custName, {
              customerName: custName,
              rows: [],
              totalDebit: 0,
              totalCredit: 0,
              balance: 0
            });
          }
          
          const group = groupsMap.get(custName)!;
          group.rows.push(rowData);
          group.totalDebit += rowData.DEBIT;
          group.totalCredit += rowData.CREDIT;
          group.balance += (rowData.DEBIT - rowData.CREDIT);
        });

        setCustomerGroups(Array.from(groupsMap.values()));
        toast.success(`Parsed ${groupsMap.size} customers successfully!`);
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse Excel file.');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read file.');
      setIsUploading(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleClear = () => {
    setCustomerGroups([]);
  };

  const handleDownloadPDF = async (group: CustomerGroup) => {
    try {
      const blob = await generateStatementPDF(group.customerName, group.rows);
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SOA_${group.customerName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-black">Make Manual Statement</h2>

        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center justify-center w-10 h-10 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl transition-all border border-gray-200"
            title="Download Template"
          >
            <Download className="w-5 h-5" />
          </button>
          
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center justify-center w-10 h-10 bg-[#D4AF37] hover:bg-[#C5A030] text-white rounded-xl transition-all disabled:opacity-50 shadow-md"
            title="Upload Excel"
          >
            <Upload className="w-5 h-5" />
          </button>
        </div>
      </div>

      {customerGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm min-h-[400px]">
          <div className="relative flex h-8 w-8 mb-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-8 w-8 bg-blue-500"></span>
          </div>
          <p className="text-gray-500 font-bold text-lg">Waiting for uploaded data...</p>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-black text-gray-600 uppercase tracking-widest">
              Found {customerGroups.length} Customers
            </div>
            <button
              onClick={handleClear}
              className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <X className="w-3 h-3" />
              Clear Data
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customerGroups.map((group, idx) => (
              <div key={idx} className="border border-gray-100 rounded-2xl p-5 hover:border-[#D4AF37] hover:shadow-md transition-all group flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-lg text-black truncate" title={group.customerName}>
                    {group.customerName}
                  </h3>
                  <div className="text-xs text-gray-500 font-bold mt-1">
                    {group.rows.length} Transactions
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-bold">Total Debit</span>
                      <span className="font-bold text-red-500">{group.totalDebit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} AED</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-bold">Total Credit</span>
                      <span className="font-bold text-emerald-500">{group.totalCredit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} AED</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-50 mt-2">
                      <span className="text-gray-600 font-black">Net Balance</span>
                      <span className={`font-black ${group.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {group.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} AED
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-50">
                  <button
                    onClick={() => handleDownloadPDF(group)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-xl font-bold text-xs transition-all"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
