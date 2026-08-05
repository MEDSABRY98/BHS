'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, FileText, Loader2, X } from 'lucide-react';

export type InsightsExportSelection = {
  includeAll: boolean;
  cities: string[];
};

interface InsightsExportScopeModalProps {
  open: boolean;
  onClose: () => void;
  cities: string[];
  isExporting?: boolean;
  onConfirm: (selection: InsightsExportSelection) => void;
}

export default function InsightsExportScopeModal({
  open,
  onClose,
  cities,
  isExporting = false,
  onConfirm,
}: InsightsExportScopeModalProps) {
  const sortedCities = useMemo(
    () => [...cities].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [cities]
  );

  const [includeAll, setIncludeAll] = useState(true);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setIncludeAll(true);
    setSelectedCities([...sortedCities]);
  }, [open, sortedCities]);

  const allCitiesSelected =
    sortedCities.length > 0 && selectedCities.length === sortedCities.length;

  const selectedCount = (includeAll ? 1 : 0) + selectedCities.length;
  const canExport = selectedCount > 0 && !isExporting;

  const toggleCity = (city: string) => {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((value) => value !== city) : [...prev, city]
    );
  };

  const selectAll = () => {
    setIncludeAll(true);
    setSelectedCities([...sortedCities]);
  };

  const clearAll = () => {
    setIncludeAll(false);
    setSelectedCities([]);
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]"
        onClick={isExporting ? undefined : onClose}
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Export ZIP scope"
          className="pointer-events-auto w-full max-w-lg my-auto bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[min(90vh,720px)] animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900">Export ZIP</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose which PDFs to include · {selectedCount} selected
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all disabled:opacity-40"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={selectAll}
              disabled={isExporting}
              className="flex-1 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-40"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={isExporting}
              className="flex-1 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            <label
              className={`w-full px-3.5 py-3 flex items-center gap-3 cursor-pointer rounded-xl transition-colors ${
                includeAll ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={includeAll}
                disabled={isExporting}
                onChange={(e) => setIncludeAll(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
              />
              <span className={`text-sm ${includeAll ? 'font-bold' : 'font-semibold'}`}>All</span>
              {includeAll && <Check className="w-4 h-4 text-indigo-500 ml-auto shrink-0" />}
            </label>

            <div className="px-3.5 pt-3 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Cities
              </p>
            </div>

            {sortedCities.length === 0 ? (
              <div className="px-3.5 py-8 text-center text-sm text-slate-400">No cities available</div>
            ) : (
              sortedCities.map((city) => {
                const isSelected = selectedCities.includes(city);
                return (
                  <label
                    key={city}
                    className={`w-full px-3.5 py-2.5 flex items-center gap-3 cursor-pointer rounded-xl transition-colors ${
                      isSelected ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isExporting}
                      onChange={() => toggleCity(city)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                    />
                    <span className={`text-sm truncate ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                      {city}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          <div className="px-5 py-4 border-t border-slate-200 shrink-0 bg-slate-50/80 rounded-b-2xl space-y-2">
            {allCitiesSelected && includeAll && sortedCities.length > 0 && (
              <p className="text-[11px] text-slate-500 text-center">
                All overview + every city PDF will be generated
              </p>
            )}
            <button
              type="button"
              disabled={!canExport}
              onClick={() =>
                onConfirm({
                  includeAll,
                  cities: [...selectedCities].sort((a, b) =>
                    a.localeCompare(b, undefined, { sensitivity: 'base' })
                  ),
                })
              }
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all shadow-sm border ${
                canExport
                  ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                  : 'bg-white border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Export Selected
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
