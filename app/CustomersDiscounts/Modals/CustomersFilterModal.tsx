import React from 'react';
import { X, Filter, MapPin, Tag } from 'lucide-react';

interface CustomersFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  availableCities: string[];
  selectedDiscountType: "All" | "Monthly" | "WithPayment";
  setSelectedDiscountType: (type: "All" | "Monthly" | "WithPayment") => void;
}

export default function CustomersFilterModal({
  isOpen,
  onClose,
  selectedCity,
  setSelectedCity,
  availableCities,
  selectedDiscountType,
  setSelectedDiscountType,
}: CustomersFilterModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
              <Filter className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Filter Customers</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* City Filter */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <MapPin className="w-4 h-4 text-gray-400" />
              City
            </label>
            <div className="relative">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all font-medium appearance-none cursor-pointer shadow-sm"
              >
                <option value="All">All Cities</option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          {/* Discount Type Filter */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <Tag className="w-4 h-4 text-gray-400" />
              Discount Type
            </label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { value: "All", label: "All Types" },
                { value: "Monthly", label: "Monthly Only" },
                { value: "WithPayment", label: "With Payment" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedDiscountType(opt.value as any)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all font-medium text-sm ${
                    selectedDiscountType === opt.value
                      ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#b3912a]'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button
            onClick={() => {
              setSelectedCity("All");
              setSelectedDiscountType("All");
            }}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#b3912a] text-white rounded-xl font-bold text-sm shadow-sm transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
