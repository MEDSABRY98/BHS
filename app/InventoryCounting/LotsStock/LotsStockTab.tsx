'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Trash2, Upload, X } from 'lucide-react';
import {
  clearLotStock,
  fetchLotStockSummary,
  fetchLotStockTemplateRows,
  uploadLotStock,
  type LotStockSummary,
} from './LotsStockService';
import { downloadLotStockTemplate, parseLotStockExcel } from './LotsStockExcel';
import { useICTabInitialLoading } from '../Utils/ICPageLoading';

type Busy = '' | 'template' | 'upload' | 'delete';

const MAX_ERRORS_SHOWN = 30;

export default function LotsStockTab({ active = true }: { active?: boolean }) {
  const [summary, setSummary] = useState<LotStockSummary | null>(null);
  const [busy, setBusy] = useState<Busy>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useICTabInitialLoading('lots_stock', summary === null && errors.length === 0);

  const loadSummary = useCallback(async () => {
    window.dispatchEvent(
      new CustomEvent('inventory-counting-refresh-state', { detail: { activeTab: 'lots_stock', isRefreshing: true } }),
    );
    try {
      setSummary(await fetchLotStockSummary());
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Could not load the lots stock.']);
    } finally {
      window.dispatchEvent(
        new CustomEvent('inventory-counting-refresh-state', { detail: { activeTab: 'lots_stock', isRefreshing: false } }),
      );
    }
  }, []);

  useEffect(() => {
    if (active) void loadSummary();
  }, [active, loadSummary]);

  // sidebar refresh button
  useEffect(() => {
    const onRefresh = (e: Event) => {
      if ((e as CustomEvent).detail?.activeTab === 'lots_stock') void loadSummary();
    };
    window.addEventListener('inventory-counting-trigger-refresh', onRefresh);
    return () => window.removeEventListener('inventory-counting-trigger-refresh', onRefresh);
  }, [loadSummary]);

  const reset = () => {
    setErrors([]);
    setMessage('');
  };

  const onTemplate = async () => {
    reset();
    setBusy('template');
    try {
      await downloadLotStockTemplate(await fetchLotStockTemplateRows());
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Could not build the template.']);
    } finally {
      setBusy('');
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setBusy('upload');
    try {
      const rows = await parseLotStockExcel(file);
      const result = await uploadLotStock(rows);
      if (result.ok) {
        setMessage(`${result.saved.toLocaleString()} lots saved from ${file.name}.`);
        await loadSummary();
      } else {
        setErrors(result.errors);
      }
    } catch (e) {
      setErrors((e instanceof Error ? e.message : 'Could not read the file.').split('\n'));
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onDelete = async () => {
    setConfirmDelete(false);
    reset();
    setBusy('delete');
    try {
      const result = await clearLotStock();
      setMessage(
        result.zeroed > 0
          ? `${result.deleted.toLocaleString()} lots deleted. ${result.zeroed.toLocaleString()} lots used in counts were kept with qty 0.`
          : `${result.deleted.toLocaleString()} lots deleted.`,
      );
      await loadSummary();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Could not delete the data.']);
    } finally {
      setBusy('');
    }
  };

  const btnCls =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-6">
      {errors.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 rounded-2xl px-5 py-4 text-sm font-bold max-w-4xl mx-auto">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            {errors.length > 1 && <p>Nothing was saved. Fix these rows and upload again:</p>}
            <ul className="space-y-0.5 font-semibold">
              {errors.slice(0, MAX_ERRORS_SHOWN).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
            {errors.length > MAX_ERRORS_SHOWN && (
              <p className="text-red-500">… and {(errors.length - MAX_ERRORS_SHOWN).toLocaleString()} more</p>
            )}
          </div>
          <button type="button" onClick={() => setErrors([])} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {message && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl px-5 py-4 text-sm font-bold max-w-4xl mx-auto">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="flex-1">{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 max-w-4xl mx-auto text-center space-y-8">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <div>
          <h2 className="text-lg font-black text-slate-900">Lots Stock</h2>
          <p className="text-xs font-bold text-slate-400 mt-1">
            Stock per lot used as the expected quantity when a count starts in the mobile app
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto">
          {[
            ['Lots', summary?.lots],
            ['Products', summary?.products],
            ['Total Qty', summary?.totalQty],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-slate-50 rounded-2xl px-4 py-3">
              <div className="text-xl font-black text-slate-900">
                {value === undefined ? '…' : Number(value).toLocaleString()}
              </div>
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label as string}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void onTemplate()}
            disabled={busy !== ''}
            className={`${btnCls} w-44 justify-center bg-slate-100 text-slate-700 hover:bg-slate-200`}
          >
            <Download className="w-4 h-4" /> {busy === 'template' ? 'Building...' : 'Template'}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== ''}
            className={`${btnCls} w-44 justify-center bg-[#0f0f0f] text-[#D4AF37] hover:bg-black shadow-lg hover:shadow-xl`}
          >
            <Upload className="w-4 h-4" /> {busy === 'upload' ? 'Uploading...' : 'Upload Excel'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy !== '' || !summary?.lots}
            className={`${btnCls} w-44 justify-center bg-red-600 text-white hover:bg-red-700`}
          >
            <Trash2 className="w-4 h-4" /> {busy === 'delete' ? 'Deleting...' : 'Delete Data'}
          </button>
        </div>

        <p className="text-xs font-semibold text-slate-400 max-w-xl mx-auto">
          The template has every countable product with its current lots. Fill Lot Number, Expiry Date (yyyy-mm-dd) and Qty,
          then upload: existing lots are updated, new lots are added, and empty rows are ignored.
        </p>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center text-red-500">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Delete all lots stock?</h3>
            <p className="text-sm font-semibold text-slate-500">
              All lots will be removed. Lots already used in count sessions are kept for their history, with qty set to 0.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className={`${btnCls} flex-1 justify-center bg-slate-100 text-slate-700 hover:bg-slate-200`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onDelete()}
                className={`${btnCls} flex-1 justify-center bg-red-600 text-white hover:bg-red-700`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
