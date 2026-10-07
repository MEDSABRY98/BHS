'use client';

import React, { useState } from 'react';
import { CalendarRange, Download, Loader2, TrendingDown, TrendingUp, Minus, X } from 'lucide-react';
import {
  generatePriceChangePeriodReport,
  type PriceChangeDirection,
} from './PriceChangePeriodReport';
import type { Product, PurchaseRecord } from '../page';

interface PriceChangePeriodModalProps {
  open: boolean;
  onClose: () => void;
  purchases: PurchaseRecord[];
  products: Product[];
}

const DIRECTION_OPTIONS: {
  id: PriceChangeDirection;
  label: string;
  description: string;
  icon: typeof TrendingUp;
  activeClass: string;
}[] = [
  {
    id: 'increased',
    label: 'Increased',
    description: 'Price went up in the period',
    icon: TrendingUp,
    activeClass: 'border-rose-400 bg-rose-50 text-rose-800 ring-rose-200',
  },
  {
    id: 'decreased',
    label: 'Decreased',
    description: 'Price went down in the period',
    icon: TrendingDown,
    activeClass: 'border-emerald-400 bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
  {
    id: 'unchanged',
    label: 'Unchanged',
    description: 'Price stayed the same',
    icon: Minus,
    activeClass: 'border-slate-400 bg-slate-50 text-slate-800 ring-slate-200',
  },
];

export default function PriceChangePeriodModal({
  open,
  onClose,
  purchases,
  products,
}: PriceChangePeriodModalProps) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [direction, setDirection] = useState<PriceChangeDirection>('increased');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleDownload = async () => {
    try {
      setLoading(true);
      await generatePriceChangePeriodReport(purchases, products, {
        fromDate,
        toDate,
        direction,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900">Price Change Period</h3>
              <p className="text-xs font-medium text-slate-500">From / To dates + change type</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
              Price change
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {DIRECTION_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = direction === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDirection(opt.id)}
                    className={`text-left rounded-2xl border px-3 py-3 transition-all ${
                      active
                        ? `${opt.activeClass} ring-2`
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-bold">{opt.label}</span>
                    </div>
                    <p className="text-[11px] font-medium opacity-80 leading-snug">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={loading || !fromDate || !toDate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download Excel
          </button>
        </div>
      </div>
    </div>
  );
}
