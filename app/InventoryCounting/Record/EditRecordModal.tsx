'use client';

import React, { useState, useEffect, useRef } from 'react';
import { History, Save, X, Search, Loader2, ChevronDown, Check, User as UserIcon, MapPin, Tag } from 'lucide-react';
import { searchICProducts, type CountType, type ICRecord, type ICProductSearchResult } from '../Service/InventoryCountingService';

function formatCountType(countType: CountType): string {
  return countType === 'Normal' ? 'Normal' : 'Damage & Expire';
}

interface DropdownSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  icon?: React.ReactNode;
  searchPlaceholder?: string;
}

function DropdownSelect({ label, value, options, onChange, icon, searchPlaceholder }: DropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div className="relative space-y-1.5" ref={dropdownRef}>
      <label className="block text-xs font-black text-slate-400 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between h-12 bg-slate-50 hover:bg-slate-100/60 border-2 border-transparent rounded-2xl px-4 transition-all shadow-sm text-sm font-bold text-slate-800 cursor-pointer ${
            isOpen ? 'bg-white border-blue-500 ring-2 ring-blue-500/10' : ''
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {icon}
            <span className="truncate">{value}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 mt-1.5 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2.5 space-y-2 animate-in fade-in duration-100 max-h-56 flex flex-col">
            {searchPlaceholder && (
              <div className="relative flex items-center h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 shrink-0">
                <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <div className="overflow-y-auto space-y-0.5 pr-1 text-xs grow no-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="p-3 text-center text-xs font-semibold text-slate-400">
                  No options found
                </div>
              ) : (
                filteredOptions.map(opt => {
                  const isSelected = value === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        onChange(opt);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="truncate">{opt}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface EditRecordModalProps {
  record: ICRecord;
  users: string[];
  warehouses: string[];
  onSave: (values: {
    qtyInBox: number;
    countedQty: number;
    countDetails: string;
    countType: CountType;
    productId: string;
    productName: string;
    barcodeName: string;
    user: string;
    warehouse: string;
  }) => Promise<void>;
  onClose: () => void;
}

export default function EditRecordModal({
  record,
  users,
  warehouses,
  onSave,
  onClose,
}: EditRecordModalProps) {
  const [qtyInBox, setQtyInBox] = useState(record.qtyInBox);
  const [countedQty, setCountedQty] = useState(record.countedQty);
  const [countType, setCountType] = useState<CountType>(record.countType);
  const [user, setUser] = useState(record.user);
  const [warehouse, setWarehouse] = useState(record.warehouse);

  // Product Selection Autocomplete
  const [productSearchQuery, setProductSearchQuery] = useState(record.productName);
  const [selectedProduct, setSelectedProduct] = useState<ICProductSearchResult>({
    productId: record.productId,
    productName: record.productName,
    barcodeName: record.barcodeName,
  });
  const [searchResults, setSearchResults] = useState<ICProductSearchResult[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Fetch search options if query is modified and is not matching selected product
  useEffect(() => {
    if (productSearchQuery.trim() === selectedProduct.productName.trim()) {
      setSearchResults([]);
      return;
    }
    if (productSearchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingProducts(true);
      try {
        const res = await searchICProducts(productSearchQuery);
        if (res.success && res.data) {
          setSearchResults(res.data);
        }
      } catch (err) {
        console.error('Failed to search products:', err);
      } finally {
        setIsSearchingProducts(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearchQuery, selectedProduct]);

  // Click outside listener for product autocomplete dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const qty = Number(countedQty);
      await onSave({
        qtyInBox: Number(qtyInBox),
        countedQty: qty,
        countDetails: `Manual: ${qty} pcs`,
        countType,
        productId: selectedProduct.productId,
        productName: selectedProduct.productName,
        barcodeName: selectedProduct.barcodeName,
        user,
        warehouse,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save record:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const finalUsers = users.includes(record.user) ? users : [record.user, ...users];
  const finalWarehouses = warehouses.includes(record.warehouse) ? warehouses : [record.warehouse, ...warehouses];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      dir="ltr"
    >
      <div
        className="bg-white rounded-[2rem] p-6 md:p-8 max-w-xl w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center shadow-sm">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">Edit Record</h3>
              <p className="text-sm font-bold text-gray-400 mt-1">ID: {record.rowId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-slate-50 rounded-2xl text-xs font-bold text-slate-500">
          Date Created: <span className="text-slate-900 font-mono font-bold text-sm">{record.date}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Search */}
          <div ref={productSearchRef} className="relative">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
              Product Search & Select
            </label>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => {
                  setProductSearchQuery(e.target.value);
                  setIsSearchFocused(true);
                }}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Search by product name, barcode, or ID..."
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none font-bold text-slate-800 transition-all shadow-sm text-sm"
              />
              {isSearchingProducts && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                </div>
              )}
            </div>
            {isSearchFocused && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl z-50 divide-y divide-slate-100">
                {searchResults.map((p) => (
                  <button
                    key={p.productId}
                    type="button"
                    onClick={() => {
                      setSelectedProduct(p);
                      setProductSearchQuery(p.productName);
                      setIsSearchFocused(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex flex-col"
                  >
                    <span className="text-sm font-bold text-slate-800">{p.productName}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      ID: {p.productId} | Barcode: {p.barcodeName}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedProduct && (
              <div className="mt-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs font-bold text-blue-800">
                Selected Product: {selectedProduct.productName} ({selectedProduct.productId})
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Type Selector */}
            <DropdownSelect
              label="Count Type"
              value={formatCountType(countType)}
              options={['Normal', 'Damage & Expire']}
              onChange={(val) => setCountType(val === 'Normal' ? 'Normal' : 'DamageExpire')}
              icon={<Tag className="w-4 h-4 text-blue-500 shrink-0" />}
            />

            {/* Warehouse Selector */}
            <DropdownSelect
              label="Warehouse"
              value={warehouse}
              options={finalWarehouses}
              onChange={setWarehouse}
              icon={<MapPin className="w-4 h-4 text-blue-500 shrink-0" />}
              searchPlaceholder="Search warehouse..."
            />
          </div>

          {/* User Selector */}
          <DropdownSelect
            label="User"
            value={user}
            options={finalUsers}
            onChange={setUser}
            icon={<UserIcon className="w-4 h-4 text-blue-500 shrink-0" />}
            searchPlaceholder="Search user..."
          />

          <div className="grid grid-cols-2 gap-4">
            {/* Qty in Box */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                Qty in Box
              </label>
              <input
                type="number"
                step="any"
                value={qtyInBox}
                onChange={(e) => setQtyInBox(Number(e.target.value))}
                required
                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none font-bold text-slate-800 transition-all shadow-sm text-center text-sm"
              />
            </div>

            {/* Counted Qty */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                Counted Qty
              </label>
              <input
                type="number"
                step="any"
                value={countedQty}
                onChange={(e) => setCountedQty(Number(e.target.value))}
                required
                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none font-bold text-slate-800 transition-all shadow-sm text-center text-sm"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-[0.4] py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all text-sm"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </span>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
