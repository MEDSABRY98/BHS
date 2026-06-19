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
    setPdfExportSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleCustomer = (customer: string) => {
    setPdfSelectedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customer)) next.delete(customer);
      else next.add(customer);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40" onClick={() => setIsPdfExportOpen(false)} />

      <div className="relative bg-white w-full max-w-2xl rounded-xl border border-gray-200 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Export Payment Analysis</h3>
          <button onClick={() => setIsPdfExportOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-3">Reports to Include</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {(Object.keys(pdfExportSections) as Array<keyof PdfExportSections>).map((section) => (
                <label key={section} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={pdfExportSections[section]}
                    onChange={() => toggleSection(section)}
                    className="h-4 w-4 rounded border-gray-300 text-gray-800 focus:ring-gray-400"
                  />
                  <span className="capitalize">{section.replace(/([A-Z])/g, ' $1').trim()}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-3">Customers</p>
            {!isCustomerSelectionOpen ? (
              <button
                onClick={() => setIsCustomerSelectionOpen(true)}
                className="w-full p-4 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 text-left"
              >
                Select customers
                {pdfSelectedCustomers.size > 0 && (
                  <span className="ml-2 text-xs bg-gray-800 text-white px-2 py-0.5 rounded-full">
                    {pdfSelectedCustomers.size}
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={() => setIsCustomerSelectionOpen(true)}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"
              >
                {pdfSelectedCustomers.size === allCustomers.length
                  ? 'All customers selected'
                  : `${pdfSelectedCustomers.size} selected — click to change`}
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => setIsPdfExportOpen(false)}
            className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-white"
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
            className="flex-1 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
          >
            Generate PDF
          </button>
        </div>
      </div>

      {isCustomerSelectionOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/50" onClick={() => setIsCustomerSelectionOpen(false)} />

          <div className="relative bg-white w-full max-w-lg rounded-xl border border-gray-200 shadow-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Select Customers</h3>
              <button onClick={() => setIsCustomerSelectionOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 text-sm text-gray-500">
              <span>
                {pdfSelectedCustomers.size === allCustomers.length
                  ? 'All selected'
                  : pdfSelectedCustomers.size === 0
                    ? 'None selected'
                    : `${pdfSelectedCustomers.size} selected`}
              </span>
              <div className="flex gap-3">
                <button onClick={() => setPdfSelectedCustomers(new Set(allCustomers))} className="text-gray-800 font-medium hover:underline">All</button>
                <button onClick={() => setPdfSelectedCustomers(new Set())} className="text-gray-500 hover:underline">None</button>
              </div>
            </div>

            <div className="px-5 py-3">
              <input
                type="text"
                placeholder="Search customers..."
                value={checklistSearch}
                onChange={(e) => setChecklistSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {filteredCustomerChecklist.map(cust => (
                <label key={cust} className="flex items-center gap-2 py-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  <input
                    type="checkbox"
                    checked={pdfSelectedCustomers.has(cust)}
                    onChange={() => toggleCustomer(cust)}
                    className="h-4 w-4 rounded border-gray-300 text-gray-800"
                  />
                  <span className="truncate">{cust}</span>
                </label>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setIsCustomerSelectionOpen(false)}
                className="px-5 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
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
