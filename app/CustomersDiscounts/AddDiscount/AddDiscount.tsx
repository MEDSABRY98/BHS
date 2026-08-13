import React from "react";
import { Info, Loader2, Search, CheckCircle, PlusCircle } from "lucide-react";

type AllCustomerItem = {
  id: string;
  name: string;
};

interface AddDiscountProps {
  handleAddSubmit: (e: React.FormEvent) => void;
  addError: string;
  loadingAllCustomers: boolean;
  addSearch: string;
  setAddSearch: (s: string) => void;
  filteredAllCustomers: AllCustomerItem[];
  selectedAddCustomerId: string;
  setSelectedAddCustomerId: (id: string) => void;
  discountName: string;
  setDiscountName: (n: string) => void;
  discountType: "percentage" | "fixed_amount";
  setDiscountType: (t: "percentage" | "fixed_amount") => void;
  discountValue: string;
  setDiscountValue: (v: string) => void;
  isSubmitting: boolean;
}

export default function AddDiscount({
  handleAddSubmit,
  addError,
  loadingAllCustomers,
  addSearch,
  setAddSearch,
  filteredAllCustomers,
  selectedAddCustomerId,
  setSelectedAddCustomerId,
  discountName,
  setDiscountName,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  isSubmitting
}: AddDiscountProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8 animate-in fade-in duration-300 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Add New Discount</h2>
        </div>

        <form onSubmit={handleAddSubmit} className="bg-white border border-gray-100 rounded-3xl shadow-sm p-8 space-y-8">
          
          {addError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-2xl font-medium border border-red-100 flex items-center gap-3">
              <Info className="w-5 h-5 text-red-500" />
              {addError}
            </div>
          )}

          {/* Customer Selection */}
          <div className="space-y-3 mb-8">
            <label className="block text-base font-bold text-gray-900">Select Customer</label>
            {loadingAllCustomers ? (
              <div className="flex items-center gap-3 text-gray-500 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" />
                Loading customers directory...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search customer name..."
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white transition-all text-gray-900"
                  />
                </div>
                
                <div className="h-[400px] overflow-y-auto bg-gray-50 border border-gray-200 rounded-2xl divide-y divide-gray-100 custom-scrollbar shadow-inner">
                  {filteredAllCustomers.length === 0 ? (
                    <div className="p-6 text-gray-500 text-center font-medium flex items-center justify-center h-full">No customers found</div>
                  ) : (
                    filteredAllCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedAddCustomerId(c.id)}
                        className={`p-4 cursor-pointer transition-all flex items-center justify-between ${
                          selectedAddCustomerId === c.id 
                            ? "bg-[#D4AF37]/10 text-gray-900 font-bold" 
                            : "hover:bg-white text-gray-700"
                        }`}
                      >
                        {c.name}
                        {selectedAddCustomerId === c.id && (
                          <CheckCircle className="w-5 h-5 text-[#D4AF37]" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Name */}
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">Name / Description</label>
              <input
                type="text"
                placeholder="e.g. Shop Rent"
                value={discountName}
                onChange={(e) => setDiscountName(e.target.value)}
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white transition-all text-gray-900 font-medium text-sm"
                required
              />
            </div>

            {/* Type */}
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">Type</label>
              <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-200 h-[52px]">
                <button
                  type="button"
                  onClick={() => setDiscountType("fixed_amount")}
                  className={`flex-1 py-2 text-center rounded-xl font-bold transition-all text-sm ${
                    discountType === "fixed_amount" 
                      ? "bg-white text-gray-900 shadow-sm border border-gray-100" 
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Fixed
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("percentage")}
                  className={`flex-1 py-2 text-center rounded-xl font-bold transition-all text-sm ${
                    discountType === "percentage" 
                      ? "bg-white text-gray-900 shadow-sm border border-gray-100" 
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Percent
                </button>
              </div>
            </div>

            {/* Value */}
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">Value</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white transition-all text-gray-900 font-bold text-sm"
                  required
                  min="0"
                  step="0.01"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                  {discountType === "percentage" ? "%" : "AED"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !selectedAddCustomerId || loadingAllCustomers}
              className="bg-[#D4AF37] hover:bg-[#C5A030] text-gray-900 font-bold px-8 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-lg w-full md:w-auto"
            >
              {isSubmitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <PlusCircle className="w-6 h-6" />
              )}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
