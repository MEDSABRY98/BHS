import React from 'react';
import { X, FileSpreadsheet, ListTree } from 'lucide-react';

interface ExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (type: 'summary' | 'detailed') => void;
}

export default function ExportExcelModal({ isOpen, onClose, onExport }: ExportExcelModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900">Export Options</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <button
            onClick={() => {
              onExport('summary');
              onClose();
            }}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
          >
            <div className="p-3 bg-gray-100 text-gray-600 rounded-lg group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-gray-900">Summary Format</h4>
          </button>

          <button
            onClick={() => {
              onExport('detailed');
              onClose();
            }}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
          >
            <div className="p-3 bg-gray-100 text-gray-600 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
              <ListTree className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-gray-900">Detailed Format</h4>
          </button>
        </div>
      </div>
    </div>
  );
}
