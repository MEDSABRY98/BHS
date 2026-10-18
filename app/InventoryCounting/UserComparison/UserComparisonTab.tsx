'use client';

import { useMemo, useState } from 'react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import NoData from '@/app/Components/DataState/NoDataTab';
import { exportInventoryCountingExcelTable } from '../Export/ExcelExport';
import { useICSession, useICTabRefresh } from '../Sessions/ICSessionContext';
import SessionBar, { ExcelIconButton, formatQty } from '../Sessions/SessionBar';

/** What each user counted per lot, side by side, with the total and the expected qty. */
export default function UserComparisonTab() {
  useICTabRefresh('user_comparison');
  const { data, loading, error, refresh } = useICSession();
  const [search, setSearch] = useState('');

  const { users, matrix } = useMemo(() => {
    const entries = data?.entries ?? [];
    const users = Array.from(new Set(entries.map((e) => e.userName))).sort((a, b) => a.localeCompare(b));
    const byLot = new Map<number, Map<string, number>>();
    for (const e of entries) {
      const m = byLot.get(e.lotId) ?? new Map<string, number>();
      m.set(e.userName, (m.get(e.userName) ?? 0) + e.qty);
      byLot.set(e.lotId, m);
    }
    const matrix = (data?.lots ?? [])
      .filter((l) => byLot.has(l.lotId))
      .map((l) => ({ lot: l, perUser: byLot.get(l.lotId)! }));
    return { users, matrix };
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return matrix;
    return matrix.filter(({ lot }) =>
      [lot.productName, lot.barcode, lot.productId, lot.lotNumber].some((v) => v.toLowerCase().includes(q)),
    );
  }, [matrix, search]);

  const exportExcel = () =>
    exportInventoryCountingExcelTable(
      ['Product ID', 'Barcode', 'Product Name', 'Lot Number', 'Expiry Date', ...users, 'Total Counted', 'Expected', 'Variance'],
      rows.map(({ lot, perUser }) => [
        lot.productId,
        lot.barcode,
        lot.productName,
        lot.lotNumber,
        lot.expiryDate,
        ...users.map((u) => perUser.get(u) ?? 0),
        lot.counted,
        lot.expected,
        lot.variance,
      ]),
      `User_Comparison_${data?.session.name || 'Session'}.xlsx`,
      {
        sheetName: 'User Comparison',
        numericColumns: [...users, 'Total Counted', 'Expected', 'Variance'],
        numericDecimalPlaces: 0,
        highlightNegativeInColumns: ['Variance'],
      },
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
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead>
                <tr className="text-xs font-bold text-white uppercase tracking-[0.1em] bg-slate-900">
                  <th className="text-center px-5 py-4 whitespace-nowrap">Product ID</th>
                  <th className="text-center px-4 py-4">Barcode</th>
                  <th className="text-center px-4 py-4">Product Name</th>
                  <th className="text-center px-4 py-4">Lot</th>
                  {users.map((u) => (
                    <th key={u} className="text-center px-4 py-4 whitespace-nowrap">{u}</th>
                  ))}
                  <th className="text-center px-4 py-4">Total</th>
                  <th className="text-center px-4 py-4">Expected</th>
                  <th className="text-center px-5 py-4">Variance</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <NoData isTable colSpan={users.length + 7} title="No counts yet" message="Nobody counted in this session yet." />
                ) : (
                  rows.map(({ lot, perUser }) => (
                    <tr key={lot.lotId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-mono font-semibold text-slate-500 whitespace-nowrap">{lot.productId || '-'}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-500 whitespace-nowrap">{lot.barcode || '-'}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{lot.productName}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-700">{lot.lotNumber}</div>
                        {lot.expiryDate && <div className="text-xs text-slate-400 font-semibold">{lot.expiryDate}</div>}
                      </td>
                      {users.map((u) => {
                        const q = perUser.get(u);
                        return (
                          <td key={u} className={`px-4 py-3 text-center font-bold ${q ? 'text-slate-800' : 'text-slate-300'}`}>
                            {q ? formatQty(q) : '-'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center font-black text-[#B8860B]">{formatQty(lot.counted)}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">{formatQty(lot.expected)}</td>
                      <td
                        className={`px-5 py-3 text-center font-black ${
                          lot.variance === 0 ? 'text-emerald-600' : lot.variance < 0 ? 'text-red-600' : 'text-amber-600'
                        }`}
                      >
                        {lot.variance > 0 ? '+' : ''}
                        {formatQty(lot.variance)}
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
