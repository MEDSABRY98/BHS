import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FileSpreadsheet,
  Loader2,
  MapPin,
  X,
  ChevronDown,
  CheckCircle,
  Search,
} from "lucide-react";

interface ExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  cities: string[];
  onExport: (city: string | null) => void;
  exporting: boolean;
}

export default function ExportExcelModal({
  isOpen,
  onClose,
  cities = [],
  onExport,
  exporting,
}: ExportExcelModalProps) {
  const [scope, setScope] = useState<"all" | "city">("all");
  const [selectedCity, setSelectedCity] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  const sortedCities = useMemo(
    () => [...cities].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [cities]
  );

  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return sortedCities;
    return sortedCities.filter((city) => city.toLowerCase().includes(q));
  }, [sortedCities, citySearch]);

  useEffect(() => {
    if (!isOpen) return;
    setScope("all");
    setSelectedCity(sortedCities[0] || "");
    setCitySearch("");
    setCityDropdownOpen(false);
  }, [isOpen, sortedCities]);

  useEffect(() => {
    if (!cityDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setCityDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [cityDropdownOpen]);

  if (!isOpen) return null;

  const canExport = scope === "all" || !!selectedCity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-green-50 p-3 rounded-2xl border border-green-100">
              <FileSpreadsheet className="w-6 h-6 text-green-700" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Export to Excel</h3>
              <p className="text-sm text-gray-500 mt-1">Choose which customers to include.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={exporting}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 mb-8">
          <button
            type="button"
            onClick={() => {
              setScope("all");
              setCityDropdownOpen(false);
            }}
            className={`w-full text-left p-4 rounded-2xl border transition-all ${
              scope === "all"
                ? "border-[#D4AF37] bg-[#D4AF37]/10 shadow-sm"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <p className="font-bold text-gray-900">All Cities</p>
            <p className="text-sm text-gray-500 mt-1">Export every customer in the system.</p>
          </button>

          <button
            type="button"
            onClick={() => setScope("city")}
            className={`w-full text-left p-4 rounded-2xl border transition-all ${
              scope === "city"
                ? "border-[#D4AF37] bg-[#D4AF37]/10 shadow-sm"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <p className="font-bold text-gray-900">Specific City</p>
            <p className="text-sm text-gray-500 mt-1">Export customers from one city only.</p>
          </button>

          {scope === "city" && (
            <div className="pt-1" ref={cityDropdownRef}>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#D4AF37]" />
                  Select City
                </span>
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCityDropdownOpen((open) => !open)}
                  disabled={sortedCities.length === 0}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] font-medium text-gray-900 flex items-center justify-between gap-3 transition-all hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span className="truncate">
                      {selectedCity || "No cities available"}
                    </span>
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${
                      cityDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {cityDropdownOpen && (
                  <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-gray-100 bg-gray-50">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={citySearch}
                          onChange={(e) => setCitySearch(e.target.value)}
                          placeholder="Search city..."
                          className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-sm font-medium text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-gray-100">
                      {filteredCities.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm font-medium text-gray-500">
                          No cities found
                        </div>
                      ) : (
                        filteredCities.map((city) => {
                          const isSelected = city === selectedCity;
                          return (
                            <button
                              key={city}
                              type="button"
                              onClick={() => {
                                setSelectedCity(city);
                                setCityDropdownOpen(false);
                                setCitySearch("");
                              }}
                              className={`w-full px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                                isSelected
                                  ? "bg-[#D4AF37]/10 text-gray-900 font-bold"
                                  : "hover:bg-gray-50 text-gray-700"
                              }`}
                            >
                              <span className="inline-flex items-center gap-2 min-w-0">
                                <MapPin className={`w-4 h-4 shrink-0 ${isSelected ? "text-[#D4AF37]" : "text-gray-400"}`} />
                                <span className="truncate">{city}</span>
                              </span>
                              {isSelected && <CheckCircle className="w-4 h-4 text-[#D4AF37] shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={exporting}
            className="px-6 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onExport(scope === "all" ? null : selectedCity)}
            disabled={exporting || !canExport}
            className="px-6 py-3 font-bold rounded-xl transition-colors bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center gap-2"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
