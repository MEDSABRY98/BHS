'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Calendar, Check, ChevronDown, FileText, Filter, Loader2, MapPin, Users } from 'lucide-react';
import { InsightsFilters, InsightsPeriodPreset, InsightsSalesSource } from '../Utils/InsightsTypes';
import CustomersFilterModal from './CustomersFilterModal';

interface InsightsFiltersBarProps {
  filters: InsightsFilters;
  salesReps: string[];
  customers: string[];
  onChange: (next: InsightsFilters) => void;
  onApply: () => void;
  onExportPdf?: () => void;
  hasPendingChanges: boolean;
  isApplying?: boolean;
  isExportingPdf?: boolean;
  canExportPdf?: boolean;
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

const filterControlWidth = 'w-[220px]';

interface FilterDropdownProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  icon?: ReactNode;
  align?: 'left' | 'right';
}

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
  align = 'left',
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative shrink-0 ${filterControlWidth}`} ref={rootRef}>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
        {label}
      </label>
      <button
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

      {open && (
        <div
          className={`absolute z-30 mt-2 min-w-full w-max max-w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="py-1">
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
        </div>
      )}
    </div>
  );
}

function CitiesFilterDropdown({
  label,
  cities,
  selected,
  onChange,
  align = 'left',
}: {
  label: string;
  cities: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCity = (city: string) => {
    onChange(
      selected.includes(city)
        ? selected.filter((value) => value !== city)
        : [...selected, city]
    );
  };

  const buttonLabel =
    selected.length === 0
      ? 'All Cities'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} cities selected`;

  return (
    <div className={`relative shrink-0 ${filterControlWidth}`} ref={rootRef}>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-white hover:border-slate-300 transition-all shadow-sm"
      >
        <span className="inline-flex items-center gap-2 min-w-0 truncate">
          <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="truncate">{buttonLabel}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute z-30 mt-2 min-w-full w-max max-w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/80">
            <button
              type="button"
              onClick={() => onChange([...cities])}
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

          <div className="max-h-64 overflow-y-auto py-1">
            {cities.length === 0 ? (
              <div className="px-3.5 py-6 text-center text-sm text-slate-400">No cities found</div>
            ) : (
              cities.map((city) => {
                const isSelected = selected.includes(city);
                return (
                  <label
                    key={city}
                    className={`w-full px-3.5 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCity(city)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                    />
                    <span className={`text-sm truncate ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                      {city}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InsightsFiltersBar({
  filters,
  salesReps,
  customers,
  onChange,
  onApply,
  onExportPdf,
  hasPendingChanges,
  isApplying = false,
  isExportingPdf = false,
  canExportPdf = true,
}: InsightsFiltersBarProps) {
  const isApplyActive = hasPendingChanges || isApplying;
  const [customersOpen, setCustomersOpen] = useState(false);
  const update = (patch: Partial<InsightsFilters>) => onChange({ ...filters, ...patch });
  const hasCustomerFilter = filters.customers.length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm w-full">
      <div className="flex flex-wrap items-end justify-center gap-x-5 gap-y-3 w-full">
        <div className={`shrink-0 ${filterControlWidth}`}>
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
          label="Period"
          value={filters.periodPreset}
          options={PERIOD_OPTIONS}
          onChange={(value) => update({ periodPreset: value })}
        />

        <FilterDropdown
          label="Sales Source"
          value={filters.salesSource}
          options={SALES_SOURCE_OPTIONS}
          onChange={(value) => update({ salesSource: value })}
        />

        {filters.periodPreset === 'custom' && (
          <>
            <div className={`shrink-0 ${filterControlWidth}`}>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                From
              </label>
              <input
                type="date"
                value={filters.periodFrom}
                max={filters.asOfDate}
                onChange={(e) => update({ periodFrom: e.target.value })}
                className={fieldClassName}
              />
            </div>
            <div className={`shrink-0 ${filterControlWidth}`}>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                To
              </label>
              <input
                type="date"
                value={filters.periodTo}
                max={filters.asOfDate}
                onChange={(e) => update({ periodTo: e.target.value })}
                className={fieldClassName}
              />
            </div>
          </>
        )}

        <div className="flex items-end gap-2 shrink-0">
          <CitiesFilterDropdown
            label="Cities"
            cities={salesReps}
            selected={filters.salesRep}
            onChange={(value) => update({ salesRep: value })}
            align="right"
          />

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              &nbsp;
            </label>
            <button
              type="button"
              onClick={() => setCustomersOpen(true)}
              title="Filter customers"
              aria-label="Filter customers"
              className={`relative flex items-center justify-center w-[42px] h-[42px] rounded-xl transition-all shadow-sm border ${
                hasCustomerFilter
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              {hasCustomerFilter && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold leading-[18px] text-center">
                  {filters.customers.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <CustomersFilterModal
          open={customersOpen}
          customers={customers}
          selected={filters.customers}
          onChange={(value) => update({ customers: value })}
          onClose={() => setCustomersOpen(false)}
        />

        <div className="shrink-0">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            &nbsp;
          </label>
          <button
            type="button"
            onClick={onApply}
            disabled={!hasPendingChanges || isApplying}
            title="Apply Filter"
            aria-label={isApplying ? 'Applying filters' : 'Apply Filter'}
            className={`flex items-center justify-center w-[42px] h-[42px] rounded-xl transition-all shadow-sm border ${
              isApplyActive
                ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 hover:border-indigo-700'
                : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
            } ${isApplying ? 'pointer-events-none' : ''}`}
          >
            {isApplying ? (
              <div
                className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"
                aria-hidden
              />
            ) : (
              <Filter className="w-4 h-4 shrink-0" />
            )}
          </button>
        </div>

        {onExportPdf && (
          <div className="shrink-0">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              &nbsp;
            </label>
            <button
              type="button"
              onClick={onExportPdf}
              disabled={!canExportPdf || isExportingPdf || isApplying}
              title="Export ZIP (All + each city)"
              aria-label={isExportingPdf ? 'Generating ZIP' : 'Export ZIP'}
              className={`flex items-center justify-center w-[42px] h-[42px] rounded-xl transition-all shadow-sm border ${
                canExportPdf && !isExportingPdf
                  ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300 hover:text-red-700'
                  : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <FileText className="w-4 h-4 shrink-0" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
