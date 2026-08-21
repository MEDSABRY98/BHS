'use client';

import React, { useState } from 'react';
import {
  Check,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Loader2,
  Users,
  X,
} from 'lucide-react';
import { InvoiceRow } from '@/types';
import { PdfExportSections } from './PaymentTTypesTab';
import { generatePaymentAnalysisPDFZip, type PaymentPdfFilterContext } from '@/app/Debit/PaymentTrackerTab/Pdf/PaymentUtils';
import { generatePaymentAnalysisExcel } from '@/app/Debit/PaymentTrackerTab/Pdf/PaymentExcelUtils';

type ExportFormat = 'pdf' | 'excel';

const EXPORT_SECTION_LABELS: Record<keyof PdfExportSections, string> = {
  summary: 'Summary',
  summaryPrevious: 'Summary Previous',
  summaryLastYear: 'Summary Last Year',
  monthly: 'Monthly',
  customerList: 'Customers Who Paid',
  nonPayerList: 'Customers Who Did Not Pay',
  gapAnalysis: 'Gap Analysis',
  salesRep: 'City',
};

interface PaymentTExportTabProps {
  isPdfExportOpen: boolean;
  setIsPdfExportOpen: (open: boolean) => void;
  pdfExportSections: PdfExportSections;
  setPdfExportSections: React.Dispatch<React.SetStateAction<PdfExportSections>>;
  isCustomerSelectionOpen: boolean;
  setIsCustomerSelectionOpen: (open: boolean) => void;
  checklistSearch: string;
  setChecklistSearch: (search: string) => void;
  filteredCustomerChecklist: string[];
  pdfSelectedCustomers: Set<string>;
  setPdfSelectedCustomers: React.Dispatch<React.SetStateAction<Set<string>>>;
  allCustomers: string[];
  data: InvoiceRow[];
  startDate?: Date;
  endDate?: Date;
  salesRep?: string;
  searchQuery?: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-3">
      {children}
    </p>
  );
}

export default function PaymentTExportTab({
  isPdfExportOpen,
  setIsPdfExportOpen,
  pdfExportSections,
  setPdfExportSections,
  isCustomerSelectionOpen,
  setIsCustomerSelectionOpen,
  checklistSearch,
  setChecklistSearch,
  filteredCustomerChecklist,
  pdfSelectedCustomers,
  setPdfSelectedCustomers,
  allCustomers,
  data,
  startDate,
  endDate,
  salesRep,
  searchQuery,
}: PaymentTExportTabProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');

  if (!isPdfExportOpen) return null;

  const toggleSection = (section: keyof PdfExportSections) => {
    setPdfExportSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleCustomer = (customer: string) => {
    setPdfSelectedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customer)) next.delete(customer);
      else next.add(customer);
      return next;
    });
  };

  const selectedReportsCount = Object.values(pdfExportSections).filter(Boolean).length;
  const totalCustomers = allCustomers.length;
  const selectedCustomerCount = pdfSelectedCustomers.size;
  const customerLabel =
    selectedCustomerCount === 0
      ? `All customers · 0 of ${totalCustomers}`
      : selectedCustomerCount === totalCustomers
        ? `All customers · ${totalCustomers} of ${totalCustomers}`
        : `${selectedCustomerCount} of ${totalCustomers} customers`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close export dialog"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        onClick={() => setIsPdfExportOpen(false)}
      />

      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="relative px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Export Payment Analysis</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsPdfExportOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[calc(100vh-220px)] overflow-y-auto">
          <div>
            <SectionLabel>Export Format</SectionLabel>
            <div className="grid grid-cols-2 gap-2 w-full p-1.5 rounded-xl bg-slate-100/90 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setExportFormat('pdf')}
                className={`flex items-center justify-center gap-2.5 w-full py-3 rounded-lg text-sm font-semibold transition-all ${
                  exportFormat === 'pdf'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                }`}
              >
                <FileText className={`w-4 h-4 ${exportFormat === 'pdf' ? 'text-slate-800' : 'text-slate-400'}`} />
                PDF
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('excel')}
                className={`flex items-center justify-center gap-2.5 w-full py-3 rounded-lg text-sm font-semibold transition-all ${
                  exportFormat === 'excel'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                }`}
              >
                <FileSpreadsheet className={`w-4 h-4 ${exportFormat === 'excel' ? 'text-emerald-600' : 'text-slate-400'}`} />
                Excel
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Reports to Include</SectionLabel>
              <span className="text-[11px] font-medium text-slate-400 -mt-3">
                {selectedReportsCount} selected
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(pdfExportSections) as Array<keyof PdfExportSections>).map((section) => {
                const isSelected = pdfExportSections[section];
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => toggleSection(section)}
                    className={`flex items-center gap-3 w-full px-3.5 py-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-slate-800 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center w-5 h-5 rounded-md shrink-0 transition-colors ${
                        isSelected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </span>
                    <span className="text-sm font-medium leading-snug">{EXPORT_SECTION_LABELS[section]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <SectionLabel>Customers</SectionLabel>
            <button
              type="button"
              onClick={() => setIsCustomerSelectionOpen(true)}
              className="group flex items-center justify-between w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 transition-all text-left"
            >
              <span className="inline-flex items-center gap-3 min-w-0">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-600 group-hover:border-slate-300 shrink-0">
                  <Users className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800 truncate">{customerLabel}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">Tap to filter by customer</span>
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
            </button>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <button
            type="button"
            onClick={() => setIsPdfExportOpen(false)}
            className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              if (isGenerating) return;
              setIsGenerating(true);
              try {
                const exportFilters: PaymentPdfFilterContext = {
                  sections: pdfExportSections,
                  selectedCustomers:
                    pdfSelectedCustomers.size > 0
                      ? new Set(Array.from(pdfSelectedCustomers).map((c) => c.trim().toLowerCase()))
                      : null,
                  startDate,
                  endDate,
                  salesRep,
                  searchQuery,
                };
                if (exportFormat === 'pdf') {
                  await generatePaymentAnalysisPDFZip(data, exportFilters);
                } else {
                  await generatePaymentAnalysisExcel(data, exportFilters);
                }
                setIsPdfExportOpen(false);
              } catch (error) {
                console.error('Payment analysis export failed:', error);
                alert(`Failed to generate ${exportFormat.toUpperCase()} export. Please try again.`);
              } finally {
                setIsGenerating(false);
              }
            }}
            disabled={isGenerating || selectedReportsCount === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
            {isGenerating
              ? exportFormat === 'pdf'
                ? 'Generating ZIP...'
                : 'Generating Excel...'
              : exportFormat === 'pdf'
                ? 'Generate PDF'
                : 'Generate Excel'}
          </button>
        </div>
      </div>

      {isCustomerSelectionOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="Close customer selection"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            onClick={() => setIsCustomerSelectionOpen(false)}
          />

          <div className="relative bg-white w-full max-w-lg rounded-2xl border border-slate-200/80 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Select Customers</h3>
                <p className="text-xs text-slate-500 mt-0.5">Leave empty to use current dashboard filters</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerSelectionOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 space-y-3">
              <span className="block text-sm text-slate-600 font-medium">
                {pdfSelectedCustomers.size === allCustomers.length
                  ? 'All selected'
                  : pdfSelectedCustomers.size === 0
                    ? 'None selected'
                    : `${pdfSelectedCustomers.size} selected`}
              </span>
              <div className="grid grid-cols-2 gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setPdfSelectedCustomers(new Set(allCustomers))}
                  className="w-full py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setPdfSelectedCustomers(new Set())}
                  className="w-full py-2.5 text-sm font-semibold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  None
                </button>
              </div>
            </div>

            <div className="px-5 py-3 border-b border-slate-100">
              <input
                type="text"
                placeholder="Search customers..."
                value={checklistSearch}
                onChange={(e) => setChecklistSearch(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2">
              {filteredCustomerChecklist.map((cust) => {
                const isSelected = pdfSelectedCustomers.has(cust);
                return (
                  <label
                    key={cust}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCustomer(cust)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 shrink-0"
                    />
                    <span className={`text-sm truncate ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                      {cust}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/80 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCustomerSelectionOpen(false)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
