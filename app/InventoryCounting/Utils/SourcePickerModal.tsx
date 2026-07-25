'use client';

import React from 'react';
import { Check, PenLine, User, X } from 'lucide-react';

type ResultSource = { type: 'none' } | { type: 'user'; user: string } | { type: 'manual' };

export interface SourcePickerRow {
  productName: string;
  barcodeName: string;
  userQtys: Record<string, number>;
  source: ResultSource;
}

function isSelected(source: ResultSource, user: string) {
  return source.type === 'user' && source.user === user;
}

interface SourcePickerModalProps {
  row: SourcePickerRow;
  userOptions: string[];
  onSelect: (rawValue: string) => void;
  onClose: () => void;
}

export default function SourcePickerModal({ row, userOptions, onSelect, onClose }: SourcePickerModalProps) {
  const handlePick = (rawValue: string) => {
    onSelect(rawValue);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2rem] p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-black text-gray-900">Choose Source</h3>
            <p className="text-sm font-bold text-gray-500 mt-1 line-clamp-2">{row.productName}</p>
            {row.barcodeName && (
              <p className="text-[11px] font-black uppercase tracking-wider text-indigo-500 mt-1">
                Barcode: {row.barcodeName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-xl transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {userOptions.length === 0 ? (
            <p className="text-sm font-bold text-slate-400 text-center py-4">No user counts for this product</p>
          ) : (
            userOptions.map((user) => {
              const qty = row.userQtys[user] ?? 0;
              const selected = isSelected(row.source, user);
              return (
                <button
                  key={user}
                  type="button"
                  onClick={() => handlePick(`user:${user}`)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border transition-all text-left ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm shadow-indigo-100'
                      : 'border-slate-100 bg-slate-50/80 hover:border-indigo-200 hover:bg-indigo-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        selected ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-100'
                      }`}
                    >
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{user}</p>
                      <p className="text-[11px] font-bold text-slate-400">User count</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-lg font-black text-indigo-700 tabular-nums">{qty.toLocaleString()}</span>
                    {selected && <Check className="w-5 h-5 text-indigo-600" />}
                  </div>
                </button>
              );
            })
          )}

          <button
            type="button"
            onClick={() => handlePick('manual')}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border transition-all text-left ${
              row.source.type === 'manual'
                ? 'border-amber-500 bg-amber-50 shadow-sm shadow-amber-100'
                : 'border-slate-100 bg-slate-50/80 hover:border-amber-200 hover:bg-amber-50/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  row.source.type === 'manual'
                    ? 'bg-amber-500 text-white'
                    : 'bg-white text-amber-600 border border-amber-100'
                }`}
              >
                <PenLine className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">Manual Entry</p>
                <p className="text-[11px] font-bold text-slate-400">Type your own result qty</p>
              </div>
            </div>
            {row.source.type === 'manual' && <Check className="w-5 h-5 text-amber-600 shrink-0" />}
          </button>
        </div>

        {row.source.type !== 'none' && (
          <button
            type="button"
            onClick={() => handlePick('')}
            className="w-full mt-4 py-3 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-red-600 transition-colors"
          >
            Clear selection
          </button>
        )}
      </div>
    </div>
  );
}
