'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, X } from 'lucide-react';
import { exportToExcel } from './CstomersUtils';
import { CustomerAnalysis, InvoiceRow } from '@/types';

interface CustomersExcelButtonProps {
  filteredData: CustomerAnalysis[];
  data: InvoiceRow[];
  yearlyPivotData: any;
}

export default function CustomersExcelButton({
  filteredData,
  data,
  yearlyPivotData
}: CustomersExcelButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState({
    includeNetOnly: true,
    includeDashboard: true,
    includeSummary: true,
    includeYearly: true,
    includeMonthly: true,
    includeAges: true,
    groupByRegion: false,
    includeNegativeBalances: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportToExcel(filteredData, 'Customers_Report', data, yearlyPivotData, options);
      setIsOpen(false);
    } catch (error) {
      console.error('Error exporting excel:', error);
      alert('Failed to export Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleOption = (key: keyof typeof options) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2.5 bg-white border border-gray-200 rounded-xl hover:border-green-400 text-green-600 transition-all shadow-sm shrink-0"
        title="Export Excel Options"
      >
        <FileSpreadsheet size={20} />
      </button>

      {isOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <FileSpreadsheet size={20} />
                </div>
                <h3 className="font-bold text-gray-900">Export Excel Options</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="pb-4 border-b border-gray-100">
                <label className="flex items-center justify-between p-3 bg-green-50/50 border border-green-100 rounded-xl cursor-pointer hover:bg-green-50 transition-colors">
                  <div>
                    <span className="block font-bold text-green-900">Include Negative Balances</span>
                    <span className="block text-xs text-green-700 mt-0.5">Includes customers whose balance is negative.</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={options.includeNegativeBalances}
                      onChange={() => toggleOption('includeNegativeBalances')}
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${options.includeNegativeBalances ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${options.includeNegativeBalances ? 'translate-x-4' : 'translate-x-0'}`}></div>
                  </div>
                </label>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={options.includeNetOnly}
                    onChange={() => toggleOption('includeNetOnly')}
                    className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <span className="font-medium text-gray-700">Net Only Details</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={options.includeDashboard}
                    onChange={() => toggleOption('includeDashboard')}
                    className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <span className="font-medium text-gray-700">Customers Dashboard</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={options.includeSummary}
                    onChange={() => toggleOption('includeSummary')}
                    className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <span className="font-medium text-gray-700">Summary View</span>
                </label>
                {yearlyPivotData?.rows?.length > 0 && (
                  <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={options.includeYearly}
                      onChange={() => toggleOption('includeYearly')}
                      className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                    />
                    <span className="font-medium text-gray-700">Yearly View</span>
                  </label>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={options.includeMonthly}
                    onChange={() => toggleOption('includeMonthly')}
                    className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <span className="font-medium text-gray-700">Monthly View</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={options.includeAges}
                    onChange={() => toggleOption('includeAges')}
                    className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <span className="font-medium text-gray-700">Ages View</span>
                </label>
              </div>

              <div className="pt-4 border-t border-gray-100 mt-2">
                <label className="flex items-start gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={options.groupByRegion}
                    onChange={() => toggleOption('groupByRegion')}
                    className="w-5 h-5 text-blue-600 rounded border-blue-300 focus:ring-blue-500 mt-0.5"
                  />
                  <div>
                    <span className="block font-bold text-blue-900">Group by Region</span>
                    <span className="block text-xs text-blue-700 mt-0.5">Creates separate sheets for each region.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={handleExport}
                disabled={isExporting || (!options.includeNetOnly && !options.includeDashboard && !options.includeSummary && !options.includeYearly && !options.includeMonthly && !options.includeAges)}
                className="px-6 py-2 font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={18} />
                    Download Excel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
