'use client';

// Edit a saved scrap report: change quantity / reason, remove items, add products.

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Loader2, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { fetchAllProductsForScrap, updateScrapReport } from '../Service/InventoryScrapService';

export interface EditableReportItem {
  rowId?: string;
  productId: string;
  barcode: string;
  name: string;
  qty: number;
  cost: number;
  reason: string;
  unit: string;
}

interface Product {
  ID: string;
  'PRODUCT ID': string;
  'PRODUCT NAME': string;
  'PRODUCT BARCODE': string;
  'PRODUCT COST'?: number | null;
  'ITEM CODE'?: number | null;
}

type Row = EditableReportItem & { key: string; qtyText: string };

let keySeq = 1;

interface EditReportModalProps {
  reportId: string;
  items: EditableReportItem[];
  onClose: () => void;
  onSaved: (items: EditableReportItem[]) => void;
}

export default function EditReportModal({ reportId, items, onClose, onSaved }: EditReportModalProps) {
  const [rows, setRows] = useState<Row[]>(() => items.map((it) => ({ ...it, key: `k${keySeq++}`, qtyText: String(it.qty) })));
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    fetchAllProductsForScrap()
      .then((p) => setProducts(p as Product[]))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !products) return [];
    return products
      .filter((p) =>
        [p['PRODUCT NAME'], p['PRODUCT BARCODE'], p['PRODUCT ID'], p['ITEM CODE'] != null ? String(p['ITEM CODE']) : '']
          .some((v) => String(v || '').toLowerCase().includes(q)),
      )
      .slice(0, 10);
  }, [search, products]);

  const update = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addProduct = (p: Product) => {
    setRows((prev) => [
      ...prev,
      {
        key: `k${keySeq++}`,
        productId: p['PRODUCT ID'],
        barcode: p['PRODUCT BARCODE'] || '—',
        name: p['PRODUCT NAME'] || 'Unknown Product',
        qty: 0,
        qtyText: '',
        cost: Number(p['PRODUCT COST'] || 0),
        reason: 'EXPIRED',
        unit: 'PCS',
      },
    ]);
    setSearch('');
    setShowList(false);
  };

  const save = async () => {
    if (!rows.length) return toast.error('Keep at least one item — delete the report instead.');
    const bad = rows.findIndex((r) => !(Number(r.qtyText) > 0));
    if (bad >= 0) return toast.error(`Item ${bad + 1}: enter a quantity greater than zero`);

    const list: EditableReportItem[] = rows.map(({ key: _k, qtyText, ...r }) => ({ ...r, qty: Number(qtyText) }));
    setSaving(true);
    try {
      await updateScrapReport(
        reportId,
        list.map((r) => ({ rowId: r.rowId || null, productId: r.productId, qty: r.qty, reason: r.reason, unit: r.unit })),
      );
      toast.success(`${reportId} updated`);
      onSaved(list);
    } catch (err: any) {
      toast.error(err?.message || 'Could not update the report');
    } finally {
      setSaving(false);
    }
  };

  const totalQty = rows.reduce((s, r) => s + (Number(r.qtyText) || 0), 0);

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="bg-white rounded-[2.5rem] border border-slate-100/60 shadow-2xl relative w-full max-w-4xl z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-8 pt-7 pb-5 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-[#D4AF37] shrink-0">
            <Pencil className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xl font-black text-black">Edit {reportId}</h4>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              {rows.length} item{rows.length === 1 ? '' : 's'} · Total qty {totalQty.toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} disabled={saving} className="w-10 h-10 rounded-xl text-slate-400 hover:text-black hover:bg-slate-100 flex items-center justify-center disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add product */}
        <div className="px-8 pt-5 relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowList(true);
              }}
              onFocus={() => setShowList(true)}
              placeholder={products ? 'Add a product — search by name, barcode or code…' : 'Loading products…'}
              disabled={!products}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-black focus:outline-none focus:ring-4 focus:ring-black/5 focus:bg-white disabled:opacity-60"
            />
          </div>
          {showList && search.trim() && products && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowList(false)} />
              <div className="absolute left-8 right-8 top-[calc(100%+6px)] bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 max-h-64 overflow-y-auto p-2">
                {matches.length === 0 ? (
                  <p className="p-5 text-center text-xs font-bold text-slate-400">No matching products</p>
                ) : (
                  matches.map((p) => (
                    <button
                      key={p.ID}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-slate-50 flex items-center gap-3"
                    >
                      <Plus className="w-4 h-4 text-[#D4AF37] shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-black truncate">{p['PRODUCT NAME']}</span>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Barcode: {p['PRODUCT BARCODE'] || 'N/A'}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-8 py-5">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center border-b border-slate-100">
                <th className="pb-3 w-10">#</th>
                <th className="pb-3 w-32">Barcode</th>
                <th className="pb-3">Product</th>
                <th className="pb-3 w-28">Qty</th>
                <th className="pb-3 w-56">Reason</th>
                <th className="pb-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r, i) => (
                <tr key={r.key} className="text-center">
                  <td className="py-2.5 text-xs font-black text-slate-400">{i + 1}</td>
                  <td className="py-2.5 text-[11px] font-bold text-slate-500 [overflow-wrap:anywhere]">{r.barcode}</td>
                  <td className="py-2.5 px-2 font-bold text-black text-sm [overflow-wrap:anywhere]">{r.name}</td>
                  <td className="py-2.5 px-1">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={r.qtyText}
                      onChange={(e) => update(r.key, { qtyText: e.target.value })}
                      className={`w-full h-10 px-2 text-center rounded-xl border text-sm font-black focus:outline-none focus:ring-2 focus:ring-black/5 ${
                        Number(r.qtyText) > 0 ? 'border-slate-200 bg-white' : 'border-red-300 bg-red-50/40'
                      }`}
                    />
                  </td>
                  <td className="py-2.5 px-1">
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-50 rounded-xl border border-slate-100">
                      {(['EXPIRED', 'DAMAGED'] as const).map((rs) => {
                        const on = r.reason === rs;
                        return (
                          <button
                            key={rs}
                            type="button"
                            onClick={() => update(r.key, { reason: rs })}
                            className={`h-8 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 ${
                              on ? (rs === 'EXPIRED' ? 'bg-white text-black shadow-sm' : 'bg-black text-[#D4AF37]') : 'text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            {rs === 'EXPIRED' ? <Calendar className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                            {rs === 'EXPIRED' ? 'Expired' : 'Damaged'}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                      className="w-9 h-9 rounded-xl text-slate-300 hover:text-red-600 hover:bg-red-50 flex items-center justify-center mx-auto"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-10 text-center text-sm font-bold text-slate-400">No items — add a product above.</p>}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 flex gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || rows.length === 0}
            className="flex-1 py-3 bg-black text-[#D4AF37] hover:bg-zinc-800 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
