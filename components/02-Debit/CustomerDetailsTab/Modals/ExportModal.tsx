import React from 'react';
import { FileText, FileSpreadsheet, ListFilter, CheckSquare, Calendar, Settings2 } from 'lucide-react';

interface InvoiceDetailModalProps {
  selectedInvoice: any;
  onClose: () => void;
}

export function InvoiceDetailModal({ selectedInvoice, onClose }: InvoiceDetailModalProps) {
  if (!selectedInvoice) return null;

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-100 transform transition-all scale-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-bold text-gray-800">Invoice Number</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="py-6">
          <p className="text-lg font-bold text-gray-900 text-center break-all">
            {selectedInvoice.number || 'N/A'}
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface ExportModalProps {
  show: boolean;
  onClose: () => void;
  exportFormat: 'pdf' | 'excel';
  setExportFormat: (s: 'pdf' | 'excel') => void;
  exportScope: 'custom' | 'view' | 'selection';
  setExportScope: (s: 'custom' | 'view' | 'selection') => void;
  pdfExportType: 'all' | 'net';
  setPdfExportType: (s: 'all' | 'net') => void;
  shortenInvoiceNumbers: boolean;
  setShortenInvoiceNumbers: (s: boolean) => void;
  availableYears: string[];
  availableMonths: string[];
  selectedMonths: string[];
  setSelectedMonths: React.Dispatch<React.SetStateAction<string[]>>;
  filteredInvoices: any[];
  handleExport: () => void;
  toggleAllMonths: () => void;
  toggleMonthSelection: (month: string) => void;
  toggleYearSelection: (year: string) => void;
}

export function ExportModal({
  show, onClose, exportFormat, setExportFormat, exportScope, setExportScope,
  pdfExportType, setPdfExportType, shortenInvoiceNumbers, setShortenInvoiceNumbers,
  availableYears, availableMonths, selectedMonths, setSelectedMonths,
  filteredInvoices, handleExport, toggleAllMonths, toggleMonthSelection, toggleYearSelection
}: ExportModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Export Options</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Panel: Configuration */}
          <div className="w-full md:w-1/3 p-6 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/30 overflow-y-auto">
            <div className="space-y-8">

              {/* Export Format */}
              <section>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" /> Format
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setExportFormat('pdf')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${exportFormat === 'pdf'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'border-transparent bg-white text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <FileText className="w-6 h-6 mb-2" />
                    <span className="font-semibold text-sm">PDF</span>
                  </button>
                  <button
                    onClick={() => setExportFormat('excel')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${exportFormat === 'excel'
                      ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                      : 'border-transparent bg-white text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <FileSpreadsheet className="w-6 h-6 mb-2" />
                    <span className="font-semibold text-sm">Excel</span>
                  </button>
                </div>
              </section>

              {/* Export Scope */}
              <section>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ListFilter className="w-4 h-4 text-indigo-500" /> Scope
                </h4>
                <div className="space-y-2">
                  {(['custom', 'view', 'selection'] as const).map(scope => (
                    <button
                      key={scope}
                      onClick={() => setExportScope(scope)}
                      className={`w-full flex items-center p-3 rounded-xl border-2 text-left transition-all duration-200 ${exportScope === scope
                        ? 'border-indigo-500 bg-white shadow-sm ring-1 ring-indigo-500'
                        : 'border-transparent bg-white hover:bg-gray-50'
                        }`}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${exportScope === scope ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
                        {exportScope === scope && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div>
                        <span className="block font-semibold text-gray-700">
                          {scope === 'custom' ? 'Custom Selection' : scope === 'view' ? 'Current View' : 'Current Selection'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Export Type (Conditional) */}
              {(exportScope === 'custom' || exportScope === 'view') && (
                <section className="animate-in slide-in-from-left-5 duration-300">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-indigo-500" /> Content Type
                  </h4>
                  <div className="space-y-2">
                    {(['all', 'net'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setPdfExportType(type)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all ${pdfExportType === type
                          ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        <span>{type === 'all' ? 'Full Transactions' : 'Net Only (Unmatched)'}</span>
                        {pdfExportType === type && <span className="text-blue-500">●</span>}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Additional Options */}
              <section className="animate-in slide-in-from-left-5 duration-300">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-indigo-500" /> Options
                </h4>
                <div className="space-y-2">
                  <label className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${shortenInvoiceNumbers
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={shortenInvoiceNumbers}
                        onChange={(e) => setShortenInvoiceNumbers(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span>Shorten Numbers</span>
                    </div>
                  </label>
                </div>
              </section>
            </div>
          </div>

          {/* Right Panel: Selection */}
          <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-white relative">
            {exportScope === 'custom' ? (
              <div className="space-y-8 animate-in fade-in duration-300">

                {/* Section: Select by Year */}
                {availableYears.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center justify-between">
                      <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-500" /> Select by Year</span>
                      <button
                        onClick={toggleAllMonths}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-3 py-1 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"
                      >
                        {selectedMonths.length === availableMonths.length ? 'Deselect All' : 'Select All Months'}
                      </button>
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {availableYears.map(year => {
                        const monthsInYear = availableMonths.filter(m => m.endsWith(year));
                        const isYearSelected = monthsInYear.length > 0 && monthsInYear.every(m => selectedMonths.includes(m));
                        const isYearPartiallySelected = !isYearSelected && monthsInYear.some(m => selectedMonths.includes(m));

                        return (
                          <button
                            key={year}
                            onClick={() => toggleYearSelection(year)}
                            className={`group relative px-5 py-2.5 rounded-xl border transition-all duration-200 flex items-center gap-2 ${isYearSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md hover:bg-indigo-700'
                              : isYearPartiallySelected
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                          >
                            <span className="text-base font-bold">{year}</span>
                            {isYearSelected && <span className="text-white/80 text-xs ml-1">✓</span>}
                            {isYearPartiallySelected && <span className="text-indigo-500 text-xs ml-1">•</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section: Months Grid */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Detailed Selection</h4>
                  {availableMonths.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      No months available for selection
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {availableMonths.map((month) => {
                        const isSelected = selectedMonths.includes(month);
                        return (
                          <button
                            key={month}
                            onClick={() => toggleMonthSelection(month)}
                            className={`relative px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 flex items-center justify-between group ${isSelected
                              ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm ring-1 ring-blue-200 z-10'
                              : 'bg-white border-gray-100 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                          >
                            <span>{month}</span>
                            {isSelected && (
                              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                  <ListFilter className="w-10 h-10 text-indigo-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Export Current View</h3>
                <p className="text-gray-500 max-w-sm mb-8">
                  This will export exactly what you see on the screen, including current search results and active filters.
                </p>
                <div className="bg-gray-50 rounded-xl p-4 w-full max-w-sm border border-gray-100 text-left">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Summary</p>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Format:</span>
                      <span className="font-semibold text-gray-900">{exportFormat.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Filter matches:</span>
                      <span className="font-semibold text-gray-900">{filteredInvoices.length} invoices</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 z-10">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className={`px-8 py-2.5 rounded-xl text-white font-bold shadow-lg shadow-green-200 transition-all transform active:scale-95 flex items-center gap-2 ${selectedMonths.length === 0 && exportScope === 'custom'
              ? 'bg-gray-300 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
              }`}
            disabled={selectedMonths.length === 0 && exportScope === 'custom'}
          >
            Export {exportFormat === 'pdf' ? 'PDF' : 'Excel'}
            {(exportScope === 'custom' && selectedMonths.length > 0) && (
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                {selectedMonths.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
