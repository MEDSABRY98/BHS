'use client';

import React, { useMemo, useState } from 'react';
import { User, Home, ChevronDown } from 'lucide-react';
import { useInventoryCountingFilters } from '../InventoryCountingFiltersContext';
import ArchiveSelector from './ArchiveSelector';
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
  widthClass = 'w-[220px]',
}: {
  items: string[];
  selectedItems: string[];
  toggleItem: (item: string) => void;
  setSelectedItems: (items: string[]) => void;
  disabled?: boolean;
  allLabel: string;
  emptyLabel: string;
  icon: React.ReactNode;
  widthClass?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const buttonLabel = useMemo(() => {
    if (selectedItems.length === 0) return allLabel;
    if (selectedItems.length === 1) return selectedItems[0];
    const unit = allLabel.replace(/^All /, '');
    return `${selectedItems.length} ${unit}`;
  }, [selectedItems, allLabel]);

  const allSelected = items.length > 0 && selectedItems.length === items.length;

  return (
    <div className={`relative ${widthClass}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-black rounded-xl px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-all outline-none shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="truncate">{buttonLabel}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-3 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/60 py-2 z-20 overflow-hidden max-h-[320px] overflow-y-auto">
            <label className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelectedItems(allSelected ? [] : [...items])}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
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
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                    <span className="truncate">{item}</span>
                  </label>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function UserWarehouseDropdowns({
  showFilters = true,
  showReconciliationToolbar = false,
}: {
  showFilters?: boolean;
  showReconciliationToolbar?: boolean;
}) {
  const {
    selectedUsers,
    selectedWarehouses,
    toggleUser,
    toggleWarehouse,
    setSelectedUsers,
    setSelectedWarehouses,
    users,
    warehouses,
    loadingOptions,
  } = useInventoryCountingFilters();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showFilters && (
        <>
          <CheckboxFilterDropdown
            items={users}
            selectedItems={selectedUsers}
            toggleItem={toggleUser}
            setSelectedItems={setSelectedUsers}
            disabled={loadingOptions}
            allLabel="All Users"
            emptyLabel="No counted users yet"
            icon={<User className="w-4 h-4 text-slate-400 shrink-0" />}
          />
          <CheckboxFilterDropdown
            items={warehouses}
            selectedItems={selectedWarehouses}
            toggleItem={toggleWarehouse}
            setSelectedItems={setSelectedWarehouses}
            disabled={loadingOptions}
            allLabel="All Warehouses"
            emptyLabel="No counted warehouses yet"
            icon={<Home className="w-4 h-4 text-slate-400 shrink-0" />}
          />
        </>
      )}
      <ArchiveSelector />
      <CloseSessionButton />
      <div
        id="ic-reconciliation-toolbar-host"
        className={`flex flex-wrap items-center gap-3 flex-1 min-w-0 ${showReconciliationToolbar ? '' : 'hidden'}`}
      />
    </div>
  );
}
