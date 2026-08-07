'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Filter, Home, Loader2, User, X } from 'lucide-react';
import {
  canCloseInventoryCountSession,
  useInventoryCountingArchive,
} from '../InventoryCountingArchiveContext';
import { useInventoryCountingFilters } from '../InventoryCountingFiltersContext';
import CloseSessionButton from './CloseSessionButton';

function CheckboxFilterDropdown({
  items,
  selectedItems,
  toggleItem,
  setSelectedItems,
  disabled,
  allLabel,
  emptyLabel,
  icon,
  label,
}: {
  items: string[];
  selectedItems: string[];
  toggleItem: (item: string) => void;
  setSelectedItems: (items: string[]) => void;
  disabled?: boolean;
  allLabel: string;
  emptyLabel: string;
  icon: React.ReactNode;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const buttonLabel = useMemo(() => {
    if (selectedItems.length === 0) return allLabel;
    if (selectedItems.length === 1) return selectedItems[0];
    const unit = allLabel.replace(/^All /, '');
    return `${selectedItems.length} ${unit}`;
  }, [selectedItems, allLabel]);

  const allSelected = items.length > 0 && selectedItems.length === items.length;

  const updateMenuPosition = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuMaxHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const openUpward = spaceBelow < 180 && rect.top > spaceBelow;

    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 140,
      maxHeight: Math.min(menuMaxHeight, openUpward ? rect.top - 12 : spaceBelow),
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 8 }
        : { top: rect.bottom + 8 }),
    });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [isOpen]);

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-4 flex items-center justify-between hover:bg-slate-50 transition-all outline-none shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {icon}
            <span className="truncate">{buttonLabel}</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen &&
          !disabled &&
          typeof document !== 'undefined' &&
          createPortal(
            <>
              <div className="fixed inset-0 z-[135]" onClick={() => setIsOpen(false)} />
              <div
                style={menuStyle}
                className="bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-300/50 py-2 overflow-y-auto"
              >
                <label className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelectedItems(allSelected ? [] : [...items])}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                  />
                  <span>{allLabel}</span>
                </label>

                {items.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400 italic">{emptyLabel}</div>
                ) : (
                  items.map((item) => {
                    const checked = selectedItems.includes(item);
                    return (
                      <label
                        key={item}
                        className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold cursor-pointer transition-colors ${
                          checked ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(item)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                        />
                        <span className="truncate">{item}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </>,
            document.body
          )}
      </div>
    </div>
  );
}

interface FiltersModalProps {
  open: boolean;
  onClose: () => void;
}

export default function FiltersModal({ open, onClose }: FiltersModalProps) {
  const {
    selectedUsers,
    selectedWarehouses,
    toggleUser,
    toggleWarehouse,
    setSelectedUsers,
    setSelectedWarehouses,
    clearFilters,
    users,
    warehouses,
    loadingOptions,
    activeFilterCount,
  } = useInventoryCountingFilters();
  const { isReadOnly } = useInventoryCountingArchive();
  const showCloseSession = !isReadOnly && canCloseInventoryCountSession();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl bg-white rounded-[2rem] border border-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-visible">
        <div className="flex items-center justify-between gap-3 px-6 md:px-8 py-5 md:py-6 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200/50 shrink-0">
              <Filter className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black text-slate-900">Filters</h3>
              <p className="text-xs font-bold text-slate-400">
                {activeFilterCount > 0
                  ? `${activeFilterCount} active · applies to all tabs`
                  : 'Applies to all counting tabs'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 md:p-8 min-h-[280px]">
          {loadingOptions ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
              <p className="text-sm font-bold">Loading filters...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <CheckboxFilterDropdown
                label="Users"
                items={users}
                selectedItems={selectedUsers}
                toggleItem={toggleUser}
                setSelectedItems={setSelectedUsers}
                allLabel="All Users"
                emptyLabel="No counted users yet"
                icon={<User className="w-4 h-4 text-slate-400 shrink-0" />}
              />
              <CheckboxFilterDropdown
                label="Warehouses"
                items={warehouses}
                selectedItems={selectedWarehouses}
                toggleItem={toggleWarehouse}
                setSelectedItems={setSelectedWarehouses}
                allLabel="All Warehouses"
                emptyLabel="No counted warehouses yet"
                icon={<Home className="w-4 h-4 text-slate-400 shrink-0" />}
              />
            </div>
          )}

          {showCloseSession && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                Session
              </p>
              <CloseSessionButton className="w-full sm:w-auto justify-center" />
            </div>
          )}
        </div>

        <div className="px-6 md:px-8 py-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 rounded-b-[2rem]">
          <button
            type="button"
            onClick={clearFilters}
            disabled={activeFilterCount === 0 || loadingOptions}
            className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-200/50 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
