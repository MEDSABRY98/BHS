'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Loader2, Package, Pencil, Save, Trash2, User, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { deleteICEntry, updateICEntry, type ICEntryRow, type ICLotRow } from '../Sessions/ICSessionsService';
import { ModernSelect, formatICDate } from '../Sessions/SessionBar';

const fieldCls =
  'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none transition-all hover:border-slate-300 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15';
const labelCls = 'mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500';

/** Popup to edit one count record (lot, qty, details). */
export function EditCountEntryModal({
  entry,
  lots,
  onClose,
  onSaved,
}: {
  entry: ICEntryRow;
  lots: ICLotRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lotId, setLotId] = useState(String(entry.lotId));
  const [qty, setQty] = useState(String(entry.qty));
  const [details, setDetails] = useState(entry.details);
  const [saving, setSaving] = useState(false);

  const lotOptions = useMemo(
    () =>
      lots.map((l) => ({
        value: String(l.lotId),
        label: `${l.productName}  ·  Lot ${l.lotNumber || '-'}`,
        hint: [l.productId, l.barcode, l.expiryDate && `Exp ${l.expiryDate}`].filter(Boolean).join('  ·  '),
      })),
    [lots],
  );

  const qtyNum = Number(qty);
  const qtyValid = qty.trim() !== '' && Number.isFinite(qtyNum);
  const changed = lotId !== String(entry.lotId) || (qtyValid && qtyNum !== entry.qty) || details.trim() !== entry.details;

  const save = async () => {
    if (!qtyValid || saving) return;
    setSaving(true);
    try {
      await updateICEntry(entry.id, { lotId: Number(lotId), qty: qtyNum, details });
      toast.success('Record updated');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !saving && onClose()}>
      <div
        className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center shrink-0 rounded-t-[2rem]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900">Edit Record</h3>
              <p className="text-xs font-semibold text-slate-400">#{entry.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm font-bold text-slate-700 truncate">{entry.userName}</span>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
              <CalendarClock className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm font-bold text-slate-700 truncate">{formatICDate(entry.createdAt) || '-'}</span>
            </div>
          </div>

          <div>
            <label className={labelCls}>Product / Lot</label>
            <ModernSelect icon={Package} value={lotId} onChange={setLotId} options={lotOptions} searchable />
          </div>

          <div>
            <label className={labelCls}>Counted Qty</label>
            <input
              type="number"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={`${fieldCls} font-mono text-center text-lg ${qtyValid ? '' : '!border-red-400 !ring-red-100'}`}
            />
          </div>

          <div>
            <label className={labelCls}>Count Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="e.g. 2 cartons x 12 + 5"
              className={`${fieldCls} resize-none font-semibold`}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 p-6 bg-slate-50/50 rounded-b-[2rem] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!qtyValid || !changed || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f0f0f] px-6 py-2.5 text-sm font-bold text-[#D4AF37] shadow-lg transition hover:bg-black hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/** Confirmation popup before deleting one count record. */
export function DeleteCountEntryModal({
  entry,
  lot,
  onClose,
  onDeleted,
}: {
  entry: ICEntryRow;
  lot?: ICLotRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteICEntry(entry.id);
      toast.success('Record deleted');
      onDeleted();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the record');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !deleting && onClose()}>
      <div
        className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 mx-auto mb-4 bg-red-50 border border-red-100 text-red-500 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-black tracking-tight text-slate-900">Delete this record?</h3>
        <p className="mt-2 text-sm font-medium text-slate-500">
          <span className="font-bold text-slate-700">{lot?.productName ?? `Lot #${entry.lotId}`}</span>
          {lot?.lotNumber ? ` · Lot ${lot.lotNumber}` : ''}
          <br />
          Qty <span className="font-mono font-black text-[#B8860B]">{entry.qty}</span> counted by{' '}
          <span className="font-bold text-slate-700">{entry.userName}</span>
        </p>
        <p className="mt-3 text-xs font-semibold text-red-500">This cannot be undone.</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-xl px-5 py-3 text-sm font-bold text-slate-600 bg-slate-100 transition hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white bg-red-600 shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
