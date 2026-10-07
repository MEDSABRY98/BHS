'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Check, ChevronDown, Filter, MapPin, Users, X } from 'lucide-react';
import { InsightsFilters, InsightsPeriodPreset, InsightsSalesSource } from '../Utils/InsightsTypes';
import CustomersFilterModal from './CustomersFilterModal';

interface InsightsFiltersPanelProps {
  open: boolean;
  onClose: () => void;
  filters: InsightsFilters;
  cities: string[];
  customers: string[];
  customerTags: string[];
  customerClassifications: string[];
  onChange: (next: InsightsFilters) => void;
  onApply: () => void;
  hasPendingChanges: boolean;
  isApplying?: boolean;
}

const PERIOD_OPTIONS: { value: InsightsPeriodPreset; label: string }[] = [
  { value: 'trailing12m', label: 'Trailing 12M' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'trailing6m', label: 'Last 6 Months' },
  { value: 'trailing3m', label: 'Last 3 Months' },
  { value: 'custom', label: 'Custom Range' },
];

const SALES_SOURCE_OPTIONS: { value: InsightsSalesSource; label: string }[] = [
  { value: 'debit', label: 'Debit Ledger' },
  { value: 'sales', label: 'Sales DB' },
];

const fieldClassName =
  'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:bg-white transition-all shadow-sm';

interface FilterDropdownProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  icon?: ReactNode;
}

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const selected = options.find((opt) => opt.value === value);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleReposition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open]);

  return (
    <div className="relative w-full" ref={rootRef}>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
        {label}
      </label>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-white hover:border-slate-300 transition-all shadow-sm"
      >
        <span className="inline-flex items-center gap-2 min-w-0 truncate">
          {icon}
          <span className="truncate">{selected?.label ?? value}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        menuPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
            className="fixed z-[110] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="py-1 max-h-64 overflow-y-auto">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 text-sm transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function MultiSelectFilterDropdown({
  label,
  options,
  selected,
  onChange,
  emptyLabel = 'All Options',
  icon = <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleReposition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open]);

  const toggleOption = (opt: string) => {
    onChange(
      selected.includes(opt)
        ? selected.filter((value) => value !== opt)
        : [...selected, opt]
    );
  };

  const buttonLabel =
    selected.length === 0
      ? emptyLabel
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

  return (
    <div className="relative w-full" ref={rootRef}>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
        {label}
      </label>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-white hover:border-slate-300 transition-all shadow-sm"
      >
        <span className="inline-flex items-center gap-2 min-w-0 truncate">
          {icon}
          <span className="truncate">{buttonLabel}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        menuPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
            className="fixed z-[110] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/80">
              <button
                type="button"
                onClick={() => onChange([...options])}
                className="flex-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="py-1 max-h-56 overflow-y-auto">
              {options.length === 0 ? (
                <div className="px-3.5 py-3 text-sm text-slate-500 italic text-center">No options available</div>
              ) : (
                options.map((opt) => {
                  const isSelected = selected.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleOption(opt)}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors group"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-indigo-500 border-indigo-500 text-white'
                            : 'border-slate-300 group-hover:border-indigo-400 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <span className={`text-sm truncate ${isSelected ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
                        {opt}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function InsightsFiltersPanel({
  open,
  onClose,
  filters,
  cities,
  customers,
  customerTags,
  customerClassifications,
  onChange,
  onApply,
  hasPendingChanges,
  isApplying = false,
}: InsightsFiltersPanelProps) {
  const isApplyActive = hasPendingChanges || isApplying;
  const [customersOpen, setCustomersOpen] = useState(false);
  const update = (patch: Partial<InsightsFilters>) => onChange({ ...filters, ...patch });
  const hasCustomerFilter = filters.customers.length > 0 || (filters.customerTags?.length || 0) > 0;
  const customerFilterLabel = (() => {
    const parts: string[] = [];
    if (filters.customers.length > 0) {
      parts.push(
        `${filters.customers.length} customer${filters.customers.length === 1 ? '' : 's'}`
      );
    }
    if ((filters.customerTags?.length || 0) > 0) {
      parts.push(
        `${filters.customerTags.length} tag${filters.customerTags.length === 1 ? '' : 's'}`
      );
    }
    return parts.length > 0 ? parts.join(' · ') : 'All Customers';
  })();
  const customerFilterCount =
    filters.customers.length + (filters.customerTags?.length || 0);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          className="pointer-events-auto w-full max-w-lg my-auto bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[min(90vh,900px)] animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Filters</h3>
              <p className="text-xs text-slate-500 mt-0.5">Adjust Insights scope and period</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
              title="Close filters"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                As-of Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={filters.asOfDate}
                  onChange={(e) => update({ asOfDate: e.target.value })}
                  className={`${fieldClassName} pl-9`}
                />
              </div>
            </div>

            <FilterDropdown
              label="Sales Source"
              value={filters.salesSource}
              options={SALES_SOURCE_OPTIONS}
              onChange={(value) => update({ salesSource: value })}
            />

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Customers
              </label>
              <button
                type="button"
                onClick={() => setCustomersOpen(true)}
                className={`relative w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl transition-all shadow-sm border ${
                  hasCustomerFilter
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                }`}
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-semibold truncate">{customerFilterLabel}</span>
                </span>
                {hasCustomerFilter && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold leading-[18px] text-center">
                    {customerFilterCount}
                  </span>
                )}
              </button>
            </div>

            <MultiSelectFilterDropdown
              label="City"
              options={cities}
              selected={filters.salesRep}
              onChange={(salesRep) => onChange({ ...filters, salesRep })}
              emptyLabel="All Cities"
              icon={<MapPin className="w-4 h-4 text-indigo-500 shrink-0" />}
            />
            <MultiSelectFilterDropdown
              label="Customer Tags"
              options={customerTags}
              selected={filters.customerTags || []}
              onChange={(tags) => onChange({ ...filters, customerTags: tags })}
              emptyLabel="All Tags"
              icon={<Filter className="w-4 h-4 text-indigo-500 shrink-0" />}
            />
            <MultiSelectFilterDropdown
              label="Customer Classes"
              options={customerClassifications}
              selected={filters.customerClassifications || []}
              onChange={(classes) => onChange({ ...filters, customerClassifications: classes })}
              emptyLabel="All Classes"
              icon={<Filter className="w-4 h-4 text-indigo-500 shrink-0" />}
            />



            <CustomersFilterModal
              open={customersOpen}
              customers={customers}
              customerTags={customerTags}
              selectedCustomers={filters.customers}
              selectedTags={filters.customerTags || []}
              onChangeCustomers={(value) => update({ customers: value })}
              onChangeTags={(value) => update({ customerTags: value })}
              onClose={() => setCustomersOpen(false)}
            />
          </div>

          <div className="px-5 py-4 border-t border-slate-200 shrink-0 bg-slate-50/80 rounded-b-2xl">
            <button
              type="button"
              onClick={() => {
                onApply();
                onClose();
              }}
              disabled={!hasPendingChanges || isApplying}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all shadow-sm border ${
                isApplyActive
                  ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-white border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isApplying ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <Filter className="w-4 h-4" />
              )}
              {isApplying ? 'Applying...' : 'Apply Filters'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
