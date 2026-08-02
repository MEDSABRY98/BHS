'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Filter,
  X,
  Building2,
  Package,
  Tag,
  Calendar,
  RotateCcw,
  Search,
  ChevronDown,
  Users,
} from 'lucide-react';
import { Product, PurchaseRecord, Supplier } from '../page';
import {
  filterPurchases,
  getAvailableProductSupplierCounts,
  getProductSupplierCountMap,
  ReportFilters,
} from '../Reports/ReportFilters';

interface SearchableSelectProps {
  options: { id: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}

function SearchableSelect({ options, value, onChange, placeholder }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUp: boolean;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updateDropdownPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 16;
    const gap = 8;
    const preferredHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(preferredHeight, openUp ? spaceAbove - gap : spaceBelow - gap);

    setDropdownStyle({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(180, maxHeight),
      openUp,
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedOption = options.find((opt) => opt.id === value);

  const dropdown =
    isOpen &&
    dropdownStyle &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          top: dropdownStyle.top,
          left: dropdownStyle.left,
          width: dropdownStyle.width,
          transform: dropdownStyle.openUp ? 'translateY(-100%)' : undefined,
          zIndex: 10000,
        }}
        className="bg-white border border-slate-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      >
        <div className="p-2 border-b border-slate-100 bg-slate-50/50 sticky top-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37]"
            />
          </div>
        </div>
        <div
          className="overflow-y-auto custom-scrollbar p-1"
          style={{ maxHeight: dropdownStyle.maxHeight - 56 }}
        >
          {filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400">No results found</div>
          ) : (
            filteredOptions.map((opt) => (
              <div
                key={opt.id || '__all__'}
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={`p-3 text-sm rounded-lg cursor-pointer transition-colors ${
                  opt.id === value
                    ? 'bg-[#D4AF37]/10 text-[#b8962e] font-bold'
                    : 'hover:bg-slate-50 text-slate-700 font-medium hover:text-slate-900'
                }`}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="relative" ref={triggerRef}>
      <div
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) setSearch('');
        }}
        className={`w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl cursor-pointer flex justify-between items-center transition-all hover:bg-slate-100 outline-none ${
          isOpen ? 'ring-2 ring-[#D4AF37]/50 border-[#D4AF37]' : ''
        }`}
      >
        <span
          className={
            selectedOption
              ? 'text-slate-900 font-bold truncate pr-2'
              : 'text-slate-400 font-medium truncate pr-2'
          }
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>
      {dropdown}
    </div>
  );
}

function usePurchaseFiltersState() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [productSupplierCount, setProductSupplierCount] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const appliedFilters: ReportFilters = useMemo(
    () => ({
      category: category || undefined,
      productId: productId || undefined,
      supplierId: supplierId || undefined,
      productSupplierCount: productSupplierCount ? Number(productSupplierCount) : undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    [category, productId, supplierId, productSupplierCount, fromDate, toDate],
  );

  const hasAnyFilter = !!(
    category ||
    productId ||
    supplierId ||
    productSupplierCount ||
    fromDate ||
    toDate
  );

  const resetFilters = () => {
    setCategory('');
    setProductId('');
    setSupplierId('');
    setProductSupplierCount('');
    setFromDate('');
    setToDate('');
  };

  return {
    isFilterOpen,
    openFilterModal: () => setIsFilterOpen(true),
    closeFilterModal: () => setIsFilterOpen(false),
    category,
    setCategory,
    productId,
    setProductId,
    supplierId,
    setSupplierId,
    productSupplierCount,
    setProductSupplierCount,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    appliedFilters,
    hasAnyFilter,
    resetFilters,
  };
}

function PurchaseFilterModal({
  isOpen,
  onClose,
  purchases,
  products,
  suppliers,
  category,
  setCategory,
  productId,
  setProductId,
  supplierId,
  setSupplierId,
  productSupplierCount,
  setProductSupplierCount,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  resetFilters,
  hasAnyFilter,
}: {
  isOpen: boolean;
  onClose: () => void;
  purchases: PurchaseRecord[];
  products: Product[];
  suppliers: Supplier[];
  category: string;
  setCategory: (val: string) => void;
  productId: string;
  setProductId: (val: string) => void;
  supplierId: string;
  setSupplierId: (val: string) => void;
  productSupplierCount: string;
  setProductSupplierCount: (val: string) => void;
  fromDate: string;
  setFromDate: (val: string) => void;
  toDate: string;
  setToDate: (val: string) => void;
  resetFilters: () => void;
  hasAnyFilter: boolean;
}) {
  const purchasesForCountOptions = useMemo(() => {
    let result = purchases;
    if (fromDate) {
      result = result.filter((p) => new Date(p.date) >= new Date(fromDate));
    }
    if (toDate) {
      result = result.filter((p) => new Date(p.date) <= new Date(toDate));
    }
    return result;
  }, [purchases, fromDate, toDate]);

  const productSupplierCountOptions = useMemo(() => {
    const counts = getAvailableProductSupplierCounts(purchasesForCountOptions);
    return [
      { id: '', label: 'All Supplier Counts' },
      ...counts.map((count) => ({
        id: String(count),
        label: count === 1 ? '1 Supplier' : `${count} Suppliers`,
      })),
    ];
  }, [purchasesForCountOptions]);

  const filterSelections = useMemo(
    () => ({
      supplierId: supplierId || undefined,
      productId: productId || undefined,
      category: category || undefined,
      productSupplierCount: productSupplierCount ? Number(productSupplierCount) : undefined,
    }),
    [supplierId, productId, category, productSupplierCount],
  );

  const applyCrossFilters = (
    source: PurchaseRecord[],
    selections: typeof filterSelections,
    exclude?: keyof typeof filterSelections,
  ) => {
    let result = source;

    if (exclude !== 'supplierId' && selections.supplierId) {
      result = result.filter((p) => p.supplierId === selections.supplierId);
    }
    if (exclude !== 'productId' && selections.productId) {
      result = result.filter((p) => p.productId === selections.productId);
    }
    if (exclude !== 'category' && selections.category) {
      const categoryProductIds = new Set(
        products
          .filter((p) => (p.category || '') === selections.category)
          .map((p) => p.id),
      );
      result = result.filter((p) => categoryProductIds.has(p.productId));
    }
    if (exclude !== 'productSupplierCount' && selections.productSupplierCount) {
      const countMap = getProductSupplierCountMap(source);
      const allowedProductIds = new Set(
        Array.from(countMap.entries())
          .filter(([, count]) => count === selections.productSupplierCount)
          .map(([productId]) => productId),
      );
      result = result.filter((p) => allowedProductIds.has(p.productId));
    }

    return result;
  };

  const purchasesForSupplierOptions = useMemo(
    () => applyCrossFilters(purchasesForCountOptions, filterSelections, 'supplierId'),
    [purchasesForCountOptions, filterSelections, products],
  );

  const purchasesForCategoryOptions = useMemo(
    () => applyCrossFilters(purchasesForCountOptions, filterSelections, 'category'),
    [purchasesForCountOptions, filterSelections, products],
  );

  const purchasesForProductOptions = useMemo(
    () => applyCrossFilters(purchasesForCountOptions, filterSelections, 'productId'),
    [purchasesForCountOptions, filterSelections, products],
  );

  const activeSuppliers = useMemo(() => {
    const supplierIds = new Set(purchasesForSupplierOptions.map((p) => p.supplierId));
    return suppliers
      .filter((s) => supplierIds.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ id: s.id, label: s.name }));
  }, [purchasesForSupplierOptions, suppliers]);

  const supplierOptions = useMemo(
    () => [{ id: '', label: 'All Suppliers' }, ...activeSuppliers],
    [activeSuppliers],
  );

  const categoryOptions = useMemo(() => {
    const productIdsWithPurchases = new Set(purchasesForCategoryOptions.map((p) => p.productId));
    const categories = new Set<string>();
    products
      .filter((p) => productIdsWithPurchases.has(p.id) && p.category)
      .forEach((p) => categories.add(p.category!));
    return [
      { id: '', label: 'All Categories' },
      ...Array.from(categories)
        .sort((a, b) => a.localeCompare(b))
        .map((c) => ({ id: c, label: c })),
    ];
  }, [products, purchasesForCategoryOptions]);

  const activeProducts = useMemo(() => {
    const productIdsWithPurchases = new Set(purchasesForProductOptions.map((p) => p.productId));
    return products
      .filter((p) => productIdsWithPurchases.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({
        id: p.id,
        label: p.barcode ? `[${p.barcode}] ${p.name}` : p.name,
      }));
  }, [products, purchasesForProductOptions]);

  const productOptions = useMemo(
    () => [{ id: '', label: 'All Products' }, ...activeProducts],
    [activeProducts],
  );

  useEffect(() => {
    if (!supplierId) return;
    const validSupplierIds = new Set(purchasesForSupplierOptions.map((p) => p.supplierId));
    if (!validSupplierIds.has(supplierId)) {
      setSupplierId('');
    }
  }, [supplierId, purchasesForSupplierOptions, setSupplierId]);

  useEffect(() => {
    if (!category) return;
    const validCategories = new Set(categoryOptions.map((option) => option.id).filter(Boolean));
    if (!validCategories.has(category)) {
      setCategory('');
    }
  }, [category, categoryOptions, setCategory]);

  useEffect(() => {
    if (!productId) return;
    const validProductIds = new Set(activeProducts.map((product) => product.id));
    if (!validProductIds.has(productId)) {
      setProductId('');
    }
  }, [productId, activeProducts, setProductId]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      supplierId
        ? suppliers.find((s) => s.id === supplierId)?.name || 'Supplier'
        : 'All Suppliers',
    );
    parts.push(
      productSupplierCount
        ? productSupplierCount === '1'
          ? '1 Supplier / Product'
          : `${productSupplierCount} Suppliers / Product`
        : 'All Supplier Counts',
    );
    parts.push(category || 'All Categories');
    parts.push(
      productId
        ? products.find((p) => p.id === productId)?.name || 'Product'
        : 'All Products',
    );
    return parts.join(' · ');
  }, [supplierId, productSupplierCount, category, productId, suppliers, products]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full max-w-5xl min-h-[620px] max-h-[92vh] bg-white rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-300 flex flex-col">
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-black text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#D4AF37] flex items-center justify-center">
              <Filter className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="font-black text-xl tracking-tight">Filters</h3>
              <p className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-[0.2em]">
                Purchase Price Tracking
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-visible p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="min-h-[92px]">
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
                <Tag className="w-4 h-4 text-teal-500" />
                Category
              </label>
              <SearchableSelect
                options={categoryOptions}
                value={category}
                onChange={setCategory}
                placeholder="All Categories"
              />
            </div>

            <div className="min-h-[92px]">
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
                <Package className="w-4 h-4 text-emerald-500" />
                Product
              </label>
              <SearchableSelect
                options={productOptions}
                value={productId}
                onChange={setProductId}
                placeholder="All Products"
              />
            </div>

            <div className="min-h-[92px]">
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
                <Building2 className="w-4 h-4 text-blue-500" />
                Supplier
              </label>
              <SearchableSelect
                options={supplierOptions}
                value={supplierId}
                onChange={setSupplierId}
                placeholder="All Suppliers"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="min-h-[92px]">
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
                <Users className="w-4 h-4 text-purple-500" />
                Suppliers per Product
              </label>
              <SearchableSelect
                options={productSupplierCountOptions}
                value={productSupplierCount}
                onChange={setProductSupplierCount}
                placeholder="All Supplier Counts"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
                <Calendar className="w-4 h-4 text-[#D4AF37]" />
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-4 py-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] font-medium transition-all"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
                <Calendar className="w-4 h-4 text-[#D4AF37]" />
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-4 py-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] font-medium transition-all"
              />
            </div>
          </div>

          <p className="text-sm font-medium text-slate-500 bg-slate-50 rounded-xl px-5 py-4 border border-slate-100">
            Active scope: <span className="font-bold text-slate-700">{filterSummary}</span>
            {(fromDate || toDate) && (
              <span className="text-slate-500">
                {' '}
                · {fromDate || '…'} → {toDate || '…'}
              </span>
            )}
          </p>
        </div>

        <div className="px-8 py-6 border-t border-slate-100 flex gap-4 shrink-0 bg-slate-50/50">
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasAnyFilter}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-[#D4AF37] text-black font-black text-sm hover:bg-[#c9a432] transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export type PurchaseModuleFiltersContextValue = ReturnType<typeof usePurchaseFiltersState> & {
  filteredPurchases: PurchaseRecord[];
  purchases: PurchaseRecord[];
  products: Product[];
  suppliers: Supplier[];
};

const PurchaseFiltersContext = createContext<PurchaseModuleFiltersContextValue | null>(null);

export function usePurchaseModuleFilters(): PurchaseModuleFiltersContextValue {
  const context = useContext(PurchaseFiltersContext);
  if (!context) {
    throw new Error('usePurchaseModuleFilters must be used within PurchaseFiltersProvider');
  }
  return context;
}

export function PurchaseFilterButton({
  inSidebar = false,
  isCollapsed = false,
}: {
  inSidebar?: boolean;
  isCollapsed?: boolean;
}) {
  const { hasAnyFilter, openFilterModal } = usePurchaseModuleFilters();

  if (inSidebar) {
    return (
      <button
        type="button"
        onClick={openFilterModal}
        className={`flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 group relative ${
          hasAnyFilter ? 'text-[#D4AF37] bg-white/5 border border-[#D4AF37]/30' : 'text-[#D4AF37]'
        }`}
        title="Open Filters"
      >
        <Filter
          className={`w-5 h-5 transition-transform group-hover:scale-110 ${hasAnyFilter ? 'animate-pulse' : ''}`}
        />
        {hasAnyFilter && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        )}
        {isCollapsed && (
          <span className="absolute left-14 opacity-0 group-hover:opacity-100 whitespace-nowrap bg-black/80 px-2 py-1 rounded text-xs pointer-events-none transition-opacity z-50">
            Filters
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openFilterModal}
      className={`group relative p-3 rounded-xl transition-all duration-300 border shadow-sm ${
        !hasAnyFilter
          ? 'bg-white border-slate-200 text-slate-400 hover:border-[#D4AF37]/50 hover:text-[#b8962e] hover:bg-[#D4AF37]/5'
          : 'bg-[#D4AF37] border-[#c9a432] text-black shadow-lg'
      }`}
      title="Open Filters"
    >
      <Filter className="w-5 h-5" />
      {hasAnyFilter && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white shadow-sm" />
      )}
    </button>
  );
}

export function PurchaseFiltersProvider({
  children,
  purchases,
  products,
  suppliers,
}: {
  children: React.ReactNode;
  purchases: PurchaseRecord[];
  products: Product[];
  suppliers: Supplier[];
}) {
  const filterState = usePurchaseFiltersState();

  const filteredPurchases = useMemo(
    () => filterPurchases(purchases, filterState.appliedFilters, products),
    [purchases, filterState.appliedFilters, products],
  );

  const value = useMemo(
    () => ({
      ...filterState,
      filteredPurchases,
      purchases,
      products,
      suppliers,
    }),
    [filterState, filteredPurchases, purchases, products, suppliers],
  );

  return (
    <PurchaseFiltersContext.Provider value={value}>
      {children}
      <PurchaseFilterModal
        isOpen={filterState.isFilterOpen}
        onClose={filterState.closeFilterModal}
        purchases={purchases}
        products={products}
        suppliers={suppliers}
        category={filterState.category}
        setCategory={filterState.setCategory}
        productId={filterState.productId}
        setProductId={filterState.setProductId}
        supplierId={filterState.supplierId}
        setSupplierId={filterState.setSupplierId}
        productSupplierCount={filterState.productSupplierCount}
        setProductSupplierCount={filterState.setProductSupplierCount}
        fromDate={filterState.fromDate}
        setFromDate={filterState.setFromDate}
        toDate={filterState.toDate}
        setToDate={filterState.setToDate}
        resetFilters={filterState.resetFilters}
        hasAnyFilter={filterState.hasAnyFilter}
      />
    </PurchaseFiltersContext.Provider>
  );
}
