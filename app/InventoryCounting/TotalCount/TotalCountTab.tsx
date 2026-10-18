'use client';

import { useMemo, useState } from 'react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import NoData from '@/app/Components/DataState/NoDataTab';
import { exportInventoryCountingExcelTable } from '../Export/ExcelExport';
import { useICSession, useICTabRefresh } from '../Sessions/ICSessionContext';
import SessionBar, { ExcelIconButton, btnCls, formatQty } from '../Sessions/SessionBar';

type Filter = 'all' | 'diff' | 'not_counted';

/** Expected (stock when the count opened) vs counted, per lot. */
export default function TotalCountTab() {
  useICTabRefresh('total_count');
  const { data, loading, error, refresh } = useICSession();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const lots = data?.lots ?? [];
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lots.filter((r) => {
      if (filter === 'diff' && r.variance === 0) return false;
      if (filter === 'not_counted' && !(r.counted === 0 && r.expected !== 0)) return false;
      if (!q) return true;
      return [r.productName, r.barcode, r.productId, r.lotNumber].some((v) => v.toLowerCase().includes(q));
    });
  }, [lots, search, filter]);

  const totals = useMemo(
    () => ({
      diffs: lots.filter((r) => r.variance !== 0).length,
      notCounted: lots.filter((r) => r.counted === 0 && r.expected !== 0).length,
    }),
    [lots],
  );

  const exportExcel = () =>
    exportInventoryCountingExcelTable(
      ['Product ID', 'Barcode', 'Product Name', 'Lot Number', 'Expiry Date', 'Expected', 'Counted', 'Variance'],
      rows.map((r) => [r.productId, r.barcode, r.productName, r.lotNumber, r.expiryDate, r.expected, r.counted, r.variance]),
      `Total_Count_${data?.session.name || 'Session'}.xlsx`,
      { sheetName: 'Total Count', numericColumns: ['Expected', 'Counted', 'Variance'], numericDecimalPlaces: 0, highlightNegativeInColumns: ['Variance'] },
    );

  const filterBtn = (id: Filter, label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      className={`${btnCls} ${filter === id ? 'bg-[#0f0f0f] text-[#D4AF37] shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="space-y-5">
      <SessionBar search={search} onSearch={setSearch}>
        <ExcelIconButton onClick={() => void exportExcel()} disabled={!rows.length} />
      </SessionBar>

      {loading && !data ? (
        <TabLoader />
      ) : error ? (
        <TabFetchError message={error} onRetry={() => void refresh()} />
      ) : !data ? (
        <NoData title="No count sessions" message="Start a count from the BHS mobile app." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {filterBtn('all', 'All', lots.length)}
            {filterBtn('diff', 'Differences', totals.diffs)}
            {filterBtn('not_counted', 'Not Counted', totals.notCounted)}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead>
                <tr className="text-xs font-bold text-white uppercase tracking-[0.1em] bg-slate-900">
                  <th className="text-center px-5 py-4 whitespace-nowrap">Product ID</th>
                  <th className="text-center px-4 py-4">Barcode</th>
                  <th className="text-center px-4 py-4">Product Name</th>
                  <th className="text-center px-4 py-4">Lot</th>
                  <th className="text-center px-4 py-4">Expiry</th>
                  <th className="text-center px-4 py-4">Expected</th>
                  <th className="text-center px-4 py-4">Counted</th>
                  <th className="text-center px-5 py-4">Variance</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <NoData isTable colSpan={8} title="Nothing to show" message="No lots match this filter." />
                ) : (
                  rows.map((r) => (
                    <tr key={r.lotId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-mono font-semibold text-slate-500 whitespace-nowrap">{r.productId || '-'}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-500 whitespace-nowrap">{r.barcode || '-'}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{r.productName}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{r.lotNumber}</td>
                      <td className="px-4 py-3 text-slate-500 font-semibold">{r.expiryDate || '-'}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">{formatQty(r.expected)}</td>
                      <td className="px-4 py-3 text-center font-bold text-[#B8860B]">{formatQty(r.counted)}</td>
                      <td
                        className={`px-5 py-3 text-center font-black ${
                          r.variance === 0 ? 'text-emerald-600' : r.variance < 0 ? 'text-red-600' : 'text-amber-600'
                        }`}
                      >
                        {r.variance > 0 ? '+' : ''}
                        {formatQty(r.variance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
