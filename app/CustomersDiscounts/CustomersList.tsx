import React, { useState } from "react";
import { Search, User, ChevronRight, FileSpreadsheet, Loader2 } from "lucide-react";
import { exportCustomersExcel } from "./CD_ExportExcel";

type Discount = {
  id: string;
  customerId: string;
  name: string;
  type: string;
  value: number;
};

type CustomerView = {
  customerId: string;
  customerName: string;
  city: string;
  discounts: Discount[];
};

interface CustomersListProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  loading: boolean;
  filteredCustomers: CustomerView[];
  handleSelectCustomer: (c: CustomerView) => void;
}

export default function CustomersList({
  searchQuery,
  setSearchQuery,
  loading,
  filteredCustomers,
  handleSelectCustomer
}: CustomersListProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportCustomersExcel(filteredCustomers);
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export Excel.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 animate-in fade-in duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Customers List</h2>
          </div>
          <div className="flex items-center gap-4 relative w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by name or ID..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] shadow-sm transition-all"
              />
            </div>
            
            <button
              onClick={handleExport}
              disabled={exporting || filteredCustomers.length === 0}
              className="flex items-center justify-center p-3 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-2xl transition-all disabled:opacity-50 shadow-sm"
              title="Export to Excel"
            >
              {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-[#D4AF37]"></div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
            <User className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-900">No Customers Found</h3>
            <p className="text-gray-500 mt-2">Try a different search query or add a new discount.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredCustomers.map((c) => (
              <div
                key={c.customerId}
                onClick={() => handleSelectCustomer(c)}
                className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:border-[#D4AF37]/40 transition-all cursor-pointer group flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="bg-[#D4AF37]/10 p-3 rounded-2xl group-hover:bg-[#D4AF37]/20 transition-colors">
                    <User className="w-7 h-7 text-[#D4AF37]" />
                  </div>
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                    {c.discounts.length} item(s)
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-[#D4AF37] transition-colors leading-snug">{c.customerName}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-2 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  {c.city}
                </p>
                
                <div className="mt-auto flex items-center justify-between text-sm font-bold text-gray-900 group-hover:text-[#D4AF37] transition-colors">
                  View Details
                  <ChevronRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
