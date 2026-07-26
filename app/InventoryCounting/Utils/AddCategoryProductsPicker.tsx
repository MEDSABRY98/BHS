'use client';

import React, { useEffect, useState } from 'react';
import { Layers, Loader2, Search, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import {
  fetchICProductCategories,
  type ICProductCategory,
} from '../Service/inventory_counting_service';

interface AddCategoryProductsPickerProps {
  disabled?: boolean;
  onSelectCategory: (categoryName: string) => void | Promise<void>;
}

export default function AddCategoryProductsPicker({
  disabled = false,
  onSelectCategory,
}: AddCategoryProductsPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<ICProductCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingCategory, setSelectingCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await fetchICProductCategories();
      if (!res.success) {
        throw new Error(res.error || 'Failed to load categories');
      }
      setCategories(res.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load categories';
      toast.error(message);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    void loadCategories();
  }, [isOpen]);

  const handleOpen = () => {
    if (disabled || selectingCategory) return;
    setIsOpen(true);
  };

  const handleClose = () => {
    if (selectingCategory) return;
    setIsOpen(false);
  };

  const handleSelect = async (categoryName: string) => {
    setSelectingCategory(categoryName);
    try {
      await onSelectCategory(categoryName);
      setIsOpen(false);
    } finally {
      setSelectingCategory(null);
    }
  };

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled || selectingCategory !== null}
        title="Add products by category"
        className="flex items-center gap-2 h-full px-3 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {selectingCategory ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Layers className="w-5 h-5" />
        )}
        <span className="text-xs font-black uppercase tracking-wide hidden sm:inline">Add</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden
          />
          <div
            className="relative w-full max-w-lg bg-white rounded-[2rem] border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-category-modal-title"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 id="add-category-modal-title" className="text-lg font-black text-slate-900">
                    Add by Category
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Choose a category to add all its products
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={selectingCategory !== null}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search categories..."
                  disabled={loading || selectingCategory !== null}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="max-h-[min(60vh,420px)] overflow-y-auto py-2">
              {loading && categories.length === 0 && (
                <p className="px-6 py-8 text-sm font-bold text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading categories...
                </p>
              )}

              {!loading && filteredCategories.length === 0 && (
                <p className="px-6 py-8 text-sm font-bold text-slate-400 text-center">
                  {searchQuery.trim() ? 'No matching categories' : 'No categories found'}
                </p>
              )}

              {filteredCategories.map((category) => {
                const isSelecting = selectingCategory === category.name;
                return (
                  <button
                    key={category.name}
                    type="button"
                    onClick={() => handleSelect(category.name)}
                    disabled={selectingCategory !== null}
                    className="w-full text-left px-6 py-4 hover:bg-amber-50 transition-colors disabled:opacity-50 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{category.name}</p>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        {category.count.toLocaleString()} product{category.count === 1 ? '' : 's'}
                      </p>
                    </div>
                    {isSelecting && <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={handleClose}
                disabled={selectingCategory !== null}
                className="w-full py-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
