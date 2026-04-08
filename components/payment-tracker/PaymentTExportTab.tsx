'use client';

import React from 'react';
import { InvoiceRow } from '@/types';

import { PdfExportSections } from './PaymentTTypesTab';

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
  generatePaymentAnalysisPDF: (data: InvoiceRow[], options: any) => void;
  data: InvoiceRow[];
  startDate?: Date;
  endDate?: Date;
  salesRep?: string;
  searchQuery?: string;
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
  generatePaymentAnalysisPDF,
  data,
  startDate,
  endDate,
  salesRep,
  searchQuery
}: PaymentTExportTabProps) {

  if (!isPdfExportOpen) return null;

  const toggleSection = (section: keyof PdfExportSections) => {
    setPdfExportSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleCustomer = (customer: string) => {
    setPdfSelectedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customer)) {
        next.delete(customer);
      } else {
        next.add(customer);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (pdfSelectedCustomers.size === allCustomers.length) {
      setPdfSelectedCustomers(new Set());
    } else {
      setPdfSelectedCustomers(new Set(allCustomers));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-500"
        onClick={() => setIsPdfExportOpen(false)}
      ></div>

      <div className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden border border-white transform transition-all duration-300 scale-100">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-50">
          <h3 className="text-xl font-black text-gray-800 tracking-tight">Export Payment Analysis</h3>
          <button
            onClick={() => setIsPdfExportOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div className="p-8 space-y-10">
          {/* Top Section: Sections selection */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Reports to Include</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
              {(Object.keys(pdfExportSections) as Array<keyof PdfExportSections>).map((section) => (
                <label key={section} className="group flex items-center gap-3.5 cursor-pointer p-1.5 rounded-xl transition-all duration-200">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={pdfExportSections[section]}
                      onChange={() => toggleSection(section)}
                      className="peer h-5.5 w-5.5 appearance-none rounded-lg border-2 border-gray-200 bg-white checked:bg-indigo-600 checked:border-indigo-600 transition-all duration-300"
                    />
                    <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-gray-600 group-hover:text-indigo-600 transition-colors capitalize">
                    {section.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-50"></div>

          {/* Bottom Section: Customer Selection */}
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Audience Selection</p>
            {!isCustomerSelectionOpen ? (
              <button
                onClick={() => setIsCustomerSelectionOpen(true)}
                className="flex items-center gap-6 w-full max-w-lg p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[24px] text-sm font-black text-gray-500 hover:border-indigo-600 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all duration-300 group"
              >
                <span className="text-3xl grayscale group-hover:grayscale-0 transition-all bg-white p-4 rounded-2xl shadow-sm">👥</span>
                <div className="flex flex-col items-start gap-1 flex-1">
                  <span className="text-gray-800 text-lg">Customer Selection</span>
                </div>
                {pdfSelectedCustomers.size > 0 && (
                  <span className="bg-indigo-600 text-white text-xs px-4 py-2 rounded-full shadow-lg shadow-indigo-100">
                    {pdfSelectedCustomers.size} Selected
                  </span>
                )}
              </button>
            ) : (
              <div
                onClick={() => setIsCustomerSelectionOpen(true)}
                className="flex items-center gap-4 w-full max-w-lg p-4 bg-indigo-50/30 border-2 border-indigo-100 rounded-[24px] cursor-pointer hover:bg-indigo-50 transition-all group"
              >
                <span className="text-2xl">✅</span>
                <div className="flex flex-col flex-1">
                  <span className="text-xs font-black text-indigo-600">
                    {pdfSelectedCustomers.size === allCustomers.length ? 'All Customers Selected' : `${pdfSelectedCustomers.size} Selected`}
                  </span>
                  <span className="text-[10px] font-bold text-indigo-400">Click to change selection</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex gap-4 p-8 bg-gray-50/50 border-t border-gray-50">
          <button
            onClick={() => setIsPdfExportOpen(false)}
            className="flex-1 py-4 bg-white border border-gray-200 rounded-2xl text-sm font-black text-gray-600 hover:bg-gray-100 transition-all duration-300"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              generatePaymentAnalysisPDF(data, {
                sections: pdfExportSections,
                selectedCustomers: pdfSelectedCustomers.size > 0
                  ? new Set(Array.from(pdfSelectedCustomers).map(c => c.trim().toLowerCase()))
                  : null,
                startDate,
                endDate,
                salesRep,
                searchQuery
              });
              setIsPdfExportOpen(false);
            }}
            className="flex-1 py-4 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.02] active:scale-95 transition-all duration-300"
          >
            Generate PDF Report
          </button>
        </div>
      </div>

      {/* Customer Selection Popup Modal */}
      {isCustomerSelectionOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity duration-500"
            onClick={() => setIsCustomerSelectionOpen(false)}
          ></div>

          <div className="relative bg-white w-full max-w-lg rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">Select Customers</h3>
              <button
                onClick={() => setIsCustomerSelectionOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            {/* Selection Status & Bulk Actions */}
            <div className="px-6 py-3 flex items-center justify-between bg-white border-b border-gray-50">
              <span className="text-sm font-medium text-gray-500">
                {pdfSelectedCustomers.size === allCustomers.length
                  ? 'All customers selected'
                  : pdfSelectedCustomers.size === 0
                    ? 'No customers selected'
                    : `${pdfSelectedCustomers.size} customers selected`}
              </span>
              <div className="flex gap-4">
                <button
                  onClick={() => setPdfSelectedCustomers(new Set(allCustomers))}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => setPdfSelectedCustomers(new Set())}
                  className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="px-6 py-4">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={checklistSearch}
                  onChange={(e) => setChecklistSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all group-hover:border-gray-300"
                />
                <svg className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 custom-scrollbar">
              <div className="space-y-1">
                {filteredCustomerChecklist.map(cust => (
                  <label
                    key={cust}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-all group border border-transparent hover:border-gray-100"
                  >
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={pdfSelectedCustomers.has(cust)}
                        onChange={() => toggleCustomer(cust)}
                        className="peer h-5 w-5 appearance-none rounded-md border-2 border-gray-200 bg-white checked:bg-blue-600 checked:border-blue-600 transition-all duration-200"
                      />
                      <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition-colors truncate">
                      {cust}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/30 flex justify-end">
              <button
                onClick={() => setIsCustomerSelectionOpen(false)}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all duration-200"
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
