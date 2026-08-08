'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Tag, X } from 'lucide-react';

interface CustomerTagsPickerModalProps {
  open: boolean;
  tags: string[];
  selectedTags: string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
}

export default function CustomerTagsPickerModal({
  open,
  tags,
  selectedTags,
  onChange,
  onClose,
}: CustomerTagsPickerModalProps) {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<string[]>(selectedTags);

  useEffect(() => {
    if (open) {
      setDraft(selectedTags);
      setSearch('');
    }
  }, [open, selectedTags]);

  const filteredTags = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tags;
    return tags.filter((tag) => tag.toLowerCase().includes(query));
  }, [tags, search]);

  const toggleTag = (tag: string) => {
    setDraft((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const apply = () => {
    onChange(draft);
    onClose();
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close customer tags picker"
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <Tag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">Customer Tags</h3>
              <p className="text-xs text-slate-500 truncate">
                {draft.length === 0
                  ? 'No tags selected'
                  : `${draft.length} tag${draft.length === 1 ? '' : 's'} selected`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 border-b border-slate-100 bg-slate-50/60">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tag..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDraft([...tags])}
              className="w-full py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-700 bg-transparent border-2 border-emerald-500 rounded-xl hover:bg-emerald-50 transition-all"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => setDraft([])}
              className="w-full py-2.5 text-xs font-bold uppercase tracking-wide text-red-600 bg-transparent border-2 border-red-500 rounded-xl hover:bg-red-50 transition-all"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-1">
          {tags.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">No customer tags found</div>
          ) : filteredTags.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">No tags match your search</div>
          ) : (
            filteredTags.map((tag) => {
              const isSelected = draft.includes(tag);
              return (
                <label
                  key={tag}
                  className={`w-full px-5 py-2.5 flex items-center gap-3 cursor-pointer transition-colors border-b border-slate-50 last:border-0 ${
                    isSelected ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTag(tag)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                  />
                  <span className={`text-sm truncate ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                    {tag}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/80">
          <button
            type="button"
            onClick={apply}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm"
          >
            Apply Tags
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
