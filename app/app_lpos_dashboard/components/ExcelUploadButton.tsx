'use client';

import { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Download,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';

interface ExcelUploadButtonProps {
  type: 'customers' | 'products';
  onSuccess: () => void;
}

export function ExcelUploadButton({ type, onSuccess }: ExcelUploadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string }>({
    type: 'idle',
    message: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    let headers: string[] = [];
    let fileName = '';

    if (type === 'customers') {
      headers = ['CUSTOMER ID', 'CUSTOMER NAME', 'CUSTOMER CITY'];
      fileName = 'Customers_Update_Template.xlsx';
    } else {
      headers = ['PRODUCT ID', 'PRODUCT NAME', 'BARCODE'];
      fileName = 'Products_Update_Template.xlsx';
    }

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, fileName);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatus({ type: 'idle', message: '' });

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            throw new Error('The uploaded file is empty.');
          }

          let successCount = 0;
          let errorCount = 0;

          for (const row of jsonData as any[]) {
            if (type === 'customers') {
              const customerId = row['CUSTOMER ID'];
              const customerName = row['CUSTOMER NAME'];
              const customerCity = row['CUSTOMER CITY'];

              if (customerId && (customerName || customerCity)) {
                const updateData: any = {};
                if (customerName) updateData['CUSTOMER NAME'] = customerName;
                if (customerCity) updateData['CUSTOMER CITY'] = customerCity;

                const { error } = await app_lpos_supabase
                  .from('app_lpos_CUSTOMERS')
                  .update(updateData)
                  .eq('CUSTOMER ID', customerId);

                if (error) errorCount++;
                else successCount++;
              }
            } else {
              const productId = row['PRODUCT ID'];
              const productName = row['PRODUCT NAME'];
              const productBarcode = row['BARCODE'];

              if (productId && (productName || productBarcode)) {
                const updateData: any = {};
                if (productName) updateData['PRODUCT NAME'] = productName;
                if (productBarcode) updateData['PRODUCT BARCODE'] = productBarcode;

                const { error } = await app_lpos_supabase
                  .from('app_lpos_PRODUCTS')
                  .update(updateData)
                  .eq('PRODUCT ID', productId);

                if (error) errorCount++;
                else successCount++;
              }
            }
          }

          if (successCount > 0) {
            setStatus({
              type: 'success',
              message: `Successfully updated ${successCount} records.${errorCount > 0 ? ` Failed to update ${errorCount} records.` : ''}`
            });
            onSuccess();
            // Optional: Close modal after a delay
            setTimeout(() => {
              if (status.type === 'success') setIsOpen(false);
            }, 2000);
          } else {
            setStatus({
              type: 'error',
              message: 'No records were updated. Please check the Excel column names.'
            });
          }
        } catch (err: any) {
          setStatus({ type: 'error', message: err.message });
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
      setIsUploading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          setStatus({ type: 'idle', message: '' });
        }}
        className="p-4 bg-white border border-gray-100 text-[#D4AF37] rounded-2xl shadow-sm hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center group"
        title={`Bulk Update ${type}`}
      >
        <FileSpreadsheet className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-300 p-6">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="p-8 flex items-center justify-between border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#D4AF37]/10 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-black">Bulk Update</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{type} Management</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                {/* 1. Download Template */}
                <button
                  onClick={downloadTemplate}
                  className="flex flex-col items-center justify-center p-8 bg-gray-50 border-2 border-dashed border-gray-100 rounded-[2rem] hover:bg-gray-100 hover:border-[#D4AF37]/30 transition-all group"
                >
                  <Download className="w-8 h-8 text-[#D4AF37] mb-3 group-hover:-translate-y-1 transition-transform" />
                  <span className="text-sm font-black text-black uppercase tracking-widest">Download Template</span>
                </button>

                {/* 2. Upload File */}
                <div className="relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full flex flex-col items-center justify-center p-8 bg-black text-white rounded-[2rem] hover:bg-gray-900 shadow-xl shadow-black/10 transition-all group disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin mb-3" />
                    ) : (
                      <Upload className="w-8 h-8 text-[#D4AF37] mb-3 group-hover:translate-y-[-2px] transition-transform" />
                    )}
                    <span className="text-sm font-black text-[#D4AF37] uppercase tracking-widest">
                      {isUploading ? 'Updating...' : 'Upload Excel'}
                    </span>
                  </button>
                </div>
              </div>

              {status.type !== 'idle' && (
                <div className={`flex items-start gap-3 p-4 rounded-2xl animate-in slide-in-from-top-2 ${
                  status.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}>
                  {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                  <p className="text-xs font-bold leading-tight">{status.message}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
