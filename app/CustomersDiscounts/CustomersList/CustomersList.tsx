import React, { useState } from "react";
import { Search, User, ChevronRight, FileSpreadsheet, Loader2, Mail, CheckCircle2, Archive, ChevronDown, Filter } from "lucide-react";
import { exportCustomersExcel } from "./ExportExcel";
import ExportExcelModal, { type ExportExcelOptions } from "./ExportExcelModal";
import { hasCustomerEmail } from "@/lib/supabase";
import type { CustomerView } from "../page";

interface CustomersListProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  loading: boolean;
  customers?: CustomerView[];
  filteredCustomers?: CustomerView[];
  handleSelectCustomer: (c: CustomerView) => void;
  customersWithEmails: Map<string, string>;
  downloadTaxRebateEml: (customerId: string, customerName: string) => void;
  downloadAllTaxRebateEmlsZip?: () => void;
  downloadingEmailsZip?: boolean;
  onAutoSettleClearedMonths?: () => void | Promise<void>;
  autoSettling?: boolean;
}

export default function CustomersList({
  searchQuery,
  setSearchQuery,
  loading,
  customers = [],
  filteredCustomers = [],
  handleSelectCustomer,
  customersWithEmails,
  downloadTaxRebateEml,
  downloadAllTaxRebateEmlsZip,
  downloadingEmailsZip = false,
  onAutoSettleClearedMonths,
  autoSettling = false,
}: CustomersListProps) {
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const safeCustomers = customers ?? [];
  const safeFilteredCustomers = filteredCustomers ?? [];

  const finalFilteredCustomers = safeFilteredCustomers;

  const exportCities = Array.from(new Set(safeCustomers.map((c) => c.city || "Unknown"))).filter(Boolean);

  const filterCustomersForExport = (options: ExportExcelOptions) => {
    let filtered = safeCustomers;
    const { settlementTypes } = options;

    if (settlementTypes.length === 1) {
      if (settlementTypes[0] === "monthly") {
        filtered = filtered.filter(
          (c) => !c.discounts.some((d) => d.settlementType === "with_payment")
        );
      } else {
        filtered = filtered.filter((c) =>
          c.discounts.some((d) => d.settlementType === "with_payment")
        );
      }
    }

    if (options.cities && options.cities.length > 0) {
      const citySet = new Set(options.cities);
      filtered = filtered.filter((c) => citySet.has(c.city || "Unknown"));
    }

    return filtered;
  };

  const handleExport = async (options: ExportExcelOptions) => {
    try {
      setExporting(true);
      const customersToExport = filterCustomersForExport(options);

      if (customersToExport.length === 0) {
        alert("No customers match the selected options.");
        return;
      }

      await exportCustomersExcel(customersToExport, options);
      setExportModalOpen(false);
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export Excel.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 animate-in fade-in duration-300">
      <div className="max-w-[1450px] mx-auto">
        <div className="relative z-30 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="bg-[#D4AF37]/10 p-3 rounded-2xl">
              <User className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              Customers List
              <span className="text-gray-400 text-lg">({finalFilteredCustomers.length})</span>
            </h2>
            {downloadAllTaxRebateEmlsZip && (
              <button
                type="button"
                onClick={() => void downloadAllTaxRebateEmlsZip()}
                disabled={downloadingEmailsZip || safeCustomers.length === 0}
                className="inline-flex items-center justify-center w-10 h-10 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all disabled:opacity-50 shadow-sm shrink-0"
                title="Download all tax rebate email drafts (ZIP)"
                aria-label="Download all email drafts as ZIP"
              >
                {downloadingEmailsZip ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Archive className="w-5 h-5" />
                )}
              </button>
            )}
            {onAutoSettleClearedMonths && (
              <button
                type="button"
                onClick={() => void onAutoSettleClearedMonths()}
                disabled={autoSettling || safeCustomers.length === 0}
                className="inline-flex items-center justify-center w-10 h-10 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all disabled:opacity-50 shadow-sm shrink-0"
                title="Auto-settle past months with zero open balance"
                aria-label="Auto-settle cleared months"
              >
                {autoSettling ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="text" 
                placeholder="Search by name or ID..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all font-medium text-gray-900 placeholder-gray-400 shadow-sm"
              />
            </div>
            
            <button
              onClick={() => setExportModalOpen(true)}
              disabled={exporting || safeCustomers.length === 0}
              className="flex items-center justify-center p-3.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-2xl transition-all disabled:opacity-50 shadow-sm shrink-0"
              title="Export to Excel"
            >
              {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm flex flex-col gap-5 animate-pulse min-h-[180px]">
                <div className="flex items-center gap-4">
                  <div className="bg-gray-200 w-14 h-14 rounded-2xl" />
                  <div className="flex-1 space-y-3">
                    <div className="bg-gray-200 w-3/4 h-6 rounded-lg" />
                    <div className="bg-gray-200 w-1/2 h-4 rounded-lg" />
                  </div>
                </div>
                <div className="mt-auto space-y-2">
                  <div className="bg-gray-100 w-full h-12 rounded-xl" />
                  <div className="bg-gray-100 w-full h-12 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : finalFilteredCustomers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
            <User className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-900">No Customers Found</h3>
            <p className="text-gray-500 mt-2">Try a different search query or add a new discount.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {finalFilteredCustomers.map((c) => {
              const hasWithPayment = c.discounts.some(d => d.settlementType === "with_payment");
              const borderClass = c.discounts.length > 0
                ? hasWithPayment
                  ? "border-t-[6px] border-t-cyan-400"
                  : "border-t-[6px] border-t-green-400"
                : "";
                
              return (
              <div
                key={c.customerId}
                onClick={() => handleSelectCustomer(c)}
                className={`bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full ${borderClass}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-[#D4AF37]/10 p-2.5 rounded-2xl group-hover:bg-[#D4AF37]/20 transition-colors">
                    <User className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const tag = (c.customerTag || "").trim();
                      const tagMates = tag
                        ? safeCustomers.filter(
                            (x) => (x.customerTag || "").trim() === tag
                          )
                        : [c];
                      const canMail = tagMates.some((x) =>
                        hasCustomerEmail(customersWithEmails, x.customerId, x.customerName)
                      );
                      if (!canMail) return null;
                      return (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadTaxRebateEml(c.customerId, c.customerName);
                          }}
                          className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2.5 rounded-xl transition-all border border-blue-100 flex items-center justify-center cursor-pointer shadow-sm relative z-20"
                          title={
                            tag
                              ? `Download Tax Rebate EML for tag "${tag}" (all tagged customers)`
                              : "Download Tax Rebate Request EML Draft"
                          }
                        >
                          <Mail className="w-4.5 h-4.5" />
                        </button>
                      );
                    })()}
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                      {c.discounts.length} item(s)
                    </span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1 group-hover:text-[#D4AF37] transition-colors leading-snug">{c.customerName}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-2 mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  {c.city}
                </p>
                
                <div className="mt-auto flex items-center justify-between text-sm font-bold text-gray-900 group-hover:text-[#D4AF37] transition-colors">
                  View Details
                  <ChevronRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      <ExportExcelModal
        isOpen={exportModalOpen}
        onClose={() => !exporting && setExportModalOpen(false)}
        cities={exportCities}
        onExport={handleExport}
        exporting={exporting}
      />
    </div>
  );
}
