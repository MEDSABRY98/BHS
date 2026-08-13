import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileSpreadsheet,
  Loader2,
  MapPin,
  X,
  ChevronDown,
  Search,
  Users,
  Calendar,
  Wallet,
  Globe,
} from "lucide-react";

export type SettlementType = "monthly" | "with_payment";

export type ExportExcelOptions = {
  settlementTypes: SettlementType[];
  cities: string[] | null;
};

interface ExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  cities: string[];
  onExport: (options: ExportExcelOptions) => void;
  exporting: boolean;
}

type SettlementOption = "all" | SettlementType;

const SETTLEMENT_OPTIONS: {
  id: SettlementOption;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "all", label: "All", icon: Users },
  { id: "monthly", label: "Monthly", icon: Calendar },
  { id: "with_payment", label: "With Payment", icon: Wallet },
];

export default function ExportExcelModal({
  isOpen,
  onClose,
  cities = [],
  onExport,
  exporting,
}: ExportExcelModalProps) {
  const [settlementAll, setSettlementAll] = useState(true);
  const [selectedSettlements, setSelectedSettlements] = useState<SettlementType[]>([]);
  const [cityScope, setCityScope] = useState<"all" | "specific">("all");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const cityTriggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    bottom: 0,
    left: 0,
    width: 0,
    maxHeight: 320,
  });

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
    setSettlementAll(true);
    setSelectedSettlements([]);
    setCityScope("all");
    setSelectedCities([]);
    setCitySearch("");
    setCityDropdownOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!cityDropdownOpen) return;

    const updatePosition = () => {
      const trigger = cityTriggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 16;
      const availableAbove = rect.top - gap - viewportPadding;
      const maxHeight = Math.max(180, Math.min(320, availableAbove));

      setDropdownPosition({
        bottom: window.innerHeight - rect.top + gap,
        left: rect.left,
        width: rect.width,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [cityDropdownOpen]);

  useEffect(() => {
    if (!cityDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideTrigger = cityTriggerRef.current?.contains(target);
      const insideDropdown = cityDropdownRef.current?.contains(target);
      if (!insideTrigger && !insideDropdown) {
        setCityDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [cityDropdownOpen]);

  if (!isOpen) return null;

  const handleSettlementClick = (option: SettlementOption) => {
    if (option === "all") {
      setSettlementAll(true);
      setSelectedSettlements([]);
      return;
    }

    setSettlementAll(false);
    setSelectedSettlements((prev) => {
      const next = prev.includes(option)
        ? prev.filter((t) => t !== option)
        : [...prev, option];
      return next;
    });
  };

  const isSettlementActive = (option: SettlementOption) => {
    if (option === "all") return settlementAll;
    return !settlementAll && selectedSettlements.includes(option);
  };

  const toggleCity = (city: string) => {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  const selectAllFilteredCities = () => {
    setSelectedCities((prev) => {
      const next = new Set(prev);
      filteredCities.forEach((city) => next.add(city));
      return Array.from(next);
    });
  };

  const clearSelectedCities = () => setSelectedCities([]);

  const cityLabel =
    selectedCities.length === 0
      ? "Select cities..."
      : selectedCities.length === 1
        ? selectedCities[0]
        : `${selectedCities.length} cities selected`;

  const settlementReady = settlementAll || selectedSettlements.length > 0;
  const canExport = settlementReady && (cityScope === "all" || selectedCities.length > 0);

  const handleExportClick = () => {
    onExport({
      settlementTypes: settlementAll ? ["monthly", "with_payment"] : selectedSettlements,
      cities: cityScope === "all" ? null : selectedCities,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/50 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-[28px] w-full max-w-xl shadow-2xl shadow-gray-900/10 border border-gray-100 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="relative px-7 pt-7 pb-5 border-b border-gray-100 bg-gradient-to-br from-white via-white to-[#D4AF37]/5">
          <button
            onClick={onClose}
            disabled={exporting}
            className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-white/80 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3.5 rounded-2xl shadow-lg shadow-green-500/25">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 tracking-tight">Export to Excel</h3>
            </div>
          </div>
        </div>

        <div className="px-7 py-6 space-y-7 overflow-y-auto custom-scrollbar flex-1">
          {/* Settlement Type */}
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
              Settlement Type
            </p>
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200/60">
              {SETTLEMENT_OPTIONS.map(({ id, label, icon: Icon }) => {
                const active = isSettlementActive(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSettlementClick(id)}
                    className={`relative flex flex-col items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl text-center transition-all duration-200 ${
                      active
                        ? "bg-white text-gray-900 shadow-md shadow-gray-200/60 ring-1 ring-[#D4AF37]/30"
                        : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${active ? (id === "with_payment" ? "text-blue-600" : id === "monthly" ? "text-green-600" : "text-[#D4AF37]") : "text-gray-400"}`}
                    />
                    <span className={`text-xs font-bold leading-tight ${active ? "text-gray-900" : ""}`}>
                      {label}
                    </span>
                    {active && (
                      <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                    )}
                  </button>
                );
              })}
            </div>
            {!settlementAll && selectedSettlements.length === 0 && (
              <p className="text-xs text-amber-600 font-medium mt-2.5 flex items-center gap-1.5">
                Select at least one settlement type, or choose All.
              </p>
            )}
          </section>

          {/* City */}
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
              City
            </p>
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200/60 mb-3">
              <button
                type="button"
                onClick={() => {
                  setCityScope("all");
                  setCityDropdownOpen(false);
                }}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 ${
                  cityScope === "all"
                    ? "bg-white text-gray-900 shadow-md shadow-gray-200/60 ring-1 ring-[#D4AF37]/30"
                    : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                }`}
              >
                <Globe className={`w-4 h-4 ${cityScope === "all" ? "text-[#D4AF37]" : "text-gray-400"}`} />
                <span className="text-sm font-bold">All Cities</span>
              </button>
              <button
                type="button"
                onClick={() => setCityScope("specific")}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 ${
                  cityScope === "specific"
                    ? "bg-white text-gray-900 shadow-md shadow-gray-200/60 ring-1 ring-[#D4AF37]/30"
                    : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                }`}
              >
                <MapPin className={`w-4 h-4 ${cityScope === "specific" ? "text-[#D4AF37]" : "text-gray-400"}`} />
                <span className="text-sm font-bold">Specific</span>
              </button>
            </div>

            {cityScope === "specific" && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div>
                  <button
                    ref={cityTriggerRef}
                    type="button"
                    onClick={() => setCityDropdownOpen((open) => !open)}
                    disabled={sortedCities.length === 0}
                    className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] font-medium text-gray-900 flex items-center justify-between gap-3 transition-all hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-[#D4AF37]/10">
                        <MapPin className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                      </div>
                      <span className="truncate text-sm">{cityLabel}</span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
                        cityDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {cityDropdownOpen &&
                    typeof document !== "undefined" &&
                    createPortal(
                      <div
                        ref={cityDropdownRef}
                        style={{
                          bottom: dropdownPosition.bottom,
                          left: dropdownPosition.left,
                          width: dropdownPosition.width,
                          maxHeight: dropdownPosition.maxHeight,
                        }}
                        className="fixed z-[100] bg-white border border-gray-200 rounded-2xl shadow-xl shadow-gray-900/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col"
                      >
                        <div className="p-3 border-b border-gray-100 bg-gray-50/80 space-y-2 shrink-0">
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              value={citySearch}
                              onChange={(e) => setCitySearch(e.target.value)}
                              placeholder="Search city..."
                              className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 text-sm font-medium text-gray-900"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={selectAllFilteredCities}
                              className="flex-1 px-3 py-1.5 text-xs font-bold text-[#9A7B1A] bg-[#D4AF37]/15 rounded-lg hover:bg-[#D4AF37]/25 transition-colors"
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={clearSelectedCities}
                              className="flex-1 px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
                          {filteredCities.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm font-medium text-gray-400">
                              No cities found
                            </div>
                          ) : (
                            filteredCities.map((city) => {
                              const isSelected = selectedCities.includes(city);
                              return (
                                <label
                                  key={city}
                                  className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors cursor-pointer border-b border-gray-50 last:border-0 ${
                                    isSelected ? "bg-[#D4AF37]/8" : "hover:bg-gray-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleCity(city)}
                                    className="w-4 h-4 rounded border-gray-300 text-[#D4AF37] focus:ring-[#D4AF37] shrink-0"
                                  />
                                  <span className={`text-sm truncate ${isSelected ? "font-bold text-gray-900" : "text-gray-600"}`}>
                                    {city}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>,
                      document.body
                    )}
                </div>

                {selectedCities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCities.map((city) => (
                      <span
                        key={city}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200/80"
                      >
                        {city}
                        <button
                          type="button"
                          onClick={() => toggleCity(city)}
                          className="text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end">
          <button
            onClick={handleExportClick}
            disabled={exporting || !canExport}
            title="Export to Excel"
            className="p-3 rounded-xl transition-all bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-600/25 disabled:opacity-50 disabled:shadow-none flex items-center justify-center"
          >
            {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
