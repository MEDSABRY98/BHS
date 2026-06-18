'use client';

import { ArrowLeftRight, Edit2, Trash2 } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';

export interface InventoryMoveRow {
  ID: string;
  DATE: string | null;
  REFERENCE: string | null;
  'LOCATION FROM': string | null;
  'LOCATION TO': string | null;
  'PRODUCT ID': string;
  QTY: number | null;
}

interface Props {
  rows: InventoryMoveRow[];
  isLoading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (row: InventoryMoveRow) => void;
  onDelete: (id: string) => void;
}

function formatDate(val: string | null) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleDateString('en-GB');
  } catch {
    return val;
  }
}

function getYear(val: string | null) {
  if (!val) return '—';
  try {
    return new Date(val).getFullYear();
  } catch {
    return '—';
  }
}

export default function InventoryMovesTable({
  rows,
  isLoading,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Array(8).fill(0).map((_, i) => (
          <div key={i} className="animate-pulse bg-white rounded-3xl p-6 border border-gray-100 h-[180px] flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 rounded w-1/4" />
              <div className="h-6 bg-gray-100 rounded w-3/4" />
            </div>
            <div className="h-10 bg-gray-100 rounded-xl w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-[2.5rem] p-12 border border-gray-100 shadow-sm flex items-center justify-center">
        <NoData title="NO INVENTORY MOVES FOUND" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {rows.map((row) => (
        <div
          key={row.ID}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-black/5 transition-all duration-300 flex flex-col justify-between min-h-[180px]"
        >
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-gray-400 tracking-wider font-mono">{getYear(row.DATE)}</span>
              <h3 className="text-lg font-black text-black mt-1 leading-tight truncate" title={row.REFERENCE || row['PRODUCT ID']}>
                {row.REFERENCE || row['PRODUCT ID']}
              </h3>
              <p className="text-[10px] font-bold text-gray-400 mt-1 truncate">
                {formatDate(row.DATE)} · {row['PRODUCT ID']}
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-100/50 px-3 py-1.5 rounded-2xl text-center shrink-0">
              <span className="text-sm font-black text-black">{(row.QTY ?? 0).toLocaleString()}</span>
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider mt-0.5">Qty</p>
            </div>
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-400 min-w-0">
              <ArrowLeftRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
              <span className="truncate" title={`${row['LOCATION FROM'] || '—'} → ${row['LOCATION TO'] || '—'}`}>
                {row['LOCATION FROM'] || '—'} → {row['LOCATION TO'] || '—'}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(row)}
                  className="p-2.5 bg-gray-50 hover:bg-black rounded-xl text-gray-500 hover:text-[#D4AF37] transition-all border border-transparent hover:border-black/10"
                  title="Edit Move"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(row.ID)}
                  className="p-2.5 bg-red-50 hover:bg-red-500 rounded-xl text-red-500 hover:text-white transition-all border border-transparent hover:border-red-100"
                  title="Delete Move"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
