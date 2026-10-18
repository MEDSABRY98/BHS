'use client';

import { useMemo, useState } from 'react';
import { Lock, Pencil, Trash2, User } from 'lucide-react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import NoData from '@/app/Components/DataState/NoDataTab';
import { exportInventoryCountingExcelTable } from '../Export/ExcelExport';
import { useICSession, useICTabRefresh } from '../Sessions/ICSessionContext';
import type { ICEntryRow, ICLotRow } from '../Sessions/ICSessionsService';
import { DeleteCountEntryModal, EditCountEntryModal } from './EditCountEntryModal';
import SessionBar, { ExcelIconButton, ModernSelect, formatICDate, formatQty } from '../Sessions/SessionBar';

/** Every count saved in the session (newest first). */
export default function RecordTab() {
  useICTabRefresh('record');
  const { data, loading, error, refresh } = useICSession();
  const [search, setSearch] = useState('');
  const [user, setUser] = useState('');
  const [editing, setEditing] = useState<ICEntryRow | null>(null);
  const [deleting, setDeleting] = useState<ICEntryRow | null>(null);
  const isClosed = data?.session.status === 'CLOSED';

  const lotById = useMemo(
    () => new Map<number, ICLotRow>((data?.lots ?? []).map((l): [number, ICLotRow] => [l.lotId, l])),
    [data],
  );
  const entries = data?.entries ?? [];
  const users = useMemo(() => Array.from(new Set(entries.map((e) => e.userName))).sort(), [entries]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => !user || e.userName === user)
      .map((e) => ({ e, lot: lotById.get(e.lotId) }))
      .filter(({ e, lot }) => {
        if (!q) return true;
        return [lot?.productName, lot?.barcode, lot?.productId, lot?.lotNumber, e.details, e.userName].some((v) =>
          String(v ?? '').toLowerCase().includes(q),
        );
      });
  }, [entries, lotById, search, user]);

  const totalQty = useMemo(() => rows.reduce((sum, { e }) => sum + e.qty, 0), [rows]);

  const exportExcel = () =>
    exportInventoryCountingExcelTable(
      ['Date', 'User', 'Product ID', 'Barcode', 'Product Name', 'Lot Number', 'Expiry Date', 'Count Details', 'Counted Qty'],
      rows.map(({ e, lot }) => [
        formatICDate(e.createdAt),
        e.userName,
        lot?.productId ?? '',
        lot?.barcode ?? '',
        lot?.productName ?? '',
        lot?.lotNumber ?? '',
        lot?.expiryDate ?? '',
        e.details,
        e.qty,
      ]),
      `Count_Records_${data?.session.name || 'Session'}.xlsx`,
      { sheetName: 'Records', numericColumns: ['Counted Qty'], numericDecimalPlaces: 0 },
    );

  return (
    <div className="space-y-5">
      <SessionBar
        search={search}
        onSearch={setSearch}
        beforeSearch={
          <ModernSelect
            className="w-full xl:w-52 shrink-0"
            icon={User}
            value={user}
            onChange={setUser}
            options={[{ value: '', label: 'All users' }, ...users.map((u) => ({ value: u, label: u }))]}
          />
        }
      >
        <ExcelIconButton onClick={() => void exportExcel()} disabled={!rows.length} />
      </SessionBar>

      {loading && !data ? (
        <TabLoader />
      ) : error ? (
        <TabFetchError message={error} onRetry={() => void refresh()} />
      ) : !data ? (
        <NoData title="No open count" message="Start a count from the BHS mobile app. Closed counts are in the Archive tab." />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead>
                <tr className="text-xs font-bold text-white uppercase tracking-[0.1em] bg-slate-900">
                  <th className="text-center px-5 py-4">Date</th>
                  <th className="text-center px-4 py-4">User</th>
                  <th className="text-center px-4 py-4 whitespace-nowrap">Product ID</th>
                  <th className="text-center px-4 py-4">Barcode</th>
                  <th className="text-center px-4 py-4">Product Name</th>
                  <th className="text-center px-4 py-4">Lot</th>
                  <th className="text-center px-4 py-4">Details</th>
                  <th className="text-center px-4 py-4">Qty</th>
                  <th className="text-center px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <NoData isTable colSpan={9} title="No records" message="Nothing was counted yet." />
                ) : (
                  rows.map(({ e, lot }) => (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-3 text-slate-500 font-semibold whitespace-nowrap">{formatICDate(e.createdAt)}</td>
                      <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{e.userName}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-500 whitespace-nowrap">{lot?.productId || '-'}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-500 whitespace-nowrap">{lot?.barcode || '-'}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{lot?.productName ?? `Lot #${e.lotId}`}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-700">{lot?.lotNumber}</div>
                        {lot?.expiryDate && <div className="text-xs text-slate-400 font-semibold">{lot.expiryDate}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-semibold">{e.details || '-'}</td>
                      <td className="px-4 py-3 text-center font-black text-[#B8860B]">{formatQty(e.qty)}</td>
                      <td className="px-5 py-3">
                        {isClosed ? (
                          <span title="Session is closed" className="inline-flex text-slate-300">
                            <Lock className="w-4 h-4" />
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditing(e)}
                              title="Edit record"
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 border border-slate-200 hover:text-[#B8860B] hover:border-[#D4AF37] hover:bg-amber-50 transition-all"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(e)}
                              title="Delete record"
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 border border-slate-200 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-black text-sm">
                  <tr>
                    <td colSpan={7} className="px-5 py-3.5"></td>
                    <td className="px-4 py-3.5 text-center font-black text-[#B8860B] text-base">{formatQty(totalQty)}</td>
                    <td className="px-5 py-3.5"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {editing && data && (
        <EditCountEntryModal entry={editing} lots={data.lots} onClose={() => setEditing(null)} onSaved={() => void refresh()} />
      )}
      {deleting && (
        <DeleteCountEntryModal
          entry={deleting}
          lot={lotById.get(deleting.lotId)}
          onClose={() => setDeleting(null)}
          onDeleted={() => void refresh()}
        />
      )}
    </div>
  );
}
