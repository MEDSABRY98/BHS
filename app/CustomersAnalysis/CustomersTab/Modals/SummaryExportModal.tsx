'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Tag, Tags } from 'lucide-react';
import { CustomerAnalysis } from '@/types';

interface SummaryExportModalProps {
  open: boolean;
  onClose: () => void;
  filteredData: CustomerAnalysis[];
  onExport: (dataToExport: CustomerAnalysis[], filename: string, groupBy: 'Rep' | 'Tag') => Promise<void>;
}

export default function SummaryExportModal({ open, onClose, filteredData, onExport }: SummaryExportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [exportOption, setExportOption] = useState<'normal' | 'without_tag' | 'with_tag'>('normal');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      // Remove customers whose netDebt is exactly zero (or extremely close due to floating point)
      let dataToExport = filteredData.filter(c => Math.abs(c.netDebt) > 0.001);
      let suffix = '';

      let groupBy: 'Rep' | 'Tag' = 'Rep';

      if (exportOption === 'without_tag') {
        dataToExport = dataToExport.filter(c => !c.customerTags || c.customerTags.size === 0);
        suffix = '_No_Tags';
      } else if (exportOption === 'with_tag') {
        dataToExport = dataToExport.filter(c => c.customerTags && c.customerTags.size > 0);
        suffix = '_Tags_Only';
        groupBy = 'Tag';
      }

      await onExport(dataToExport, `Customers_PDF_Report${suffix}`, groupBy);
      onClose();
    } catch (error) {
      console.error('Error in SummaryExportModal:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <FileText size={20} />
            </div>
            <h3 className="font-bold text-gray-900">Export PDF Options</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${exportOption === 'normal' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'}`}>
            <div className="flex items-center gap-3">
              <FileText className={exportOption === 'normal' ? 'text-red-500' : 'text-gray-400'} size={24} />
              <span className="block font-bold text-gray-900">Normal Export</span>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${exportOption === 'normal' ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
              {exportOption === 'normal' && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
            <input type="radio" name="exportOption" className="hidden" checked={exportOption === 'normal'} onChange={() => setExportOption('normal')} />
          </label>

          <label className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${exportOption === 'without_tag' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'}`}>
            <div className="flex items-center gap-3">
              <Tag className={exportOption === 'without_tag' ? 'text-red-500' : 'text-gray-400'} size={24} />
              <span className="block font-bold text-gray-900">Without Tags Only</span>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${exportOption === 'without_tag' ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
              {exportOption === 'without_tag' && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
            <input type="radio" name="exportOption" className="hidden" checked={exportOption === 'without_tag'} onChange={() => setExportOption('without_tag')} />
          </label>

          <label className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${exportOption === 'with_tag' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'}`}>
            <div className="flex items-center gap-3">
              <Tags className={exportOption === 'with_tag' ? 'text-red-500' : 'text-gray-400'} size={24} />
              <span className="block font-bold text-gray-900">With Tags Only</span>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${exportOption === 'with_tag' ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
              {exportOption === 'with_tag' && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
            <input type="radio" name="exportOption" className="hidden" checked={exportOption === 'with_tag'} onChange={() => setExportOption('with_tag')} />
          </label>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FileText size={18} />
            )}
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
