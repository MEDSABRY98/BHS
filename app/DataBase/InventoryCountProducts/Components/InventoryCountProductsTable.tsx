'use client';

import { Edit2, Trash2 } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';

export interface InventoryCountProductRow {
  ID: string;
  'PRODUCT ID': string;
  'BARCODE NAME': string | null;
  'PRODUCT NAME': string;
  'AVAILABLE QTY': number | null;
  'QTY IN BOX': number | null;
}

interface Props {
  rows: InventoryCountProductRow[];
  isLoading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (row: InventoryCountProductRow) => void;
  onDelete: (id: string) => void;
}

export default function InventoryCountProductsTable({
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
          <div key={i} className="animate-pulse bg-white rounded-3xl p-6 border border-gray-100 h-[160px] flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-6 bg-gray-100 rounded w-3/4 mx-auto" />
              <div className="h-4 bg-gray-100 rounded w-full" />
            </div>
            <div className="h-10 bg-gray-100 rounded-xl w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <NoData title="NO INVENTORY COUNT PRODUCTS FOUND" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {rows.map((row) => (
        <div
          key={row.ID}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-black/5 transition-all duration-300 flex flex-col justify-between min-h-[160px]"
        >
          <div className="text-center py-2 min-w-0">
            <p
              className="text-lg font-black text-black font-mono truncate w-full"
              title={row['BARCODE NAME'] || ''}
            >
              {row['BARCODE NAME'] || '—'}
            </p>
            <p
              className="text-xs font-bold text-gray-400 mt-2 truncate w-full leading-snug"
              title={row['PRODUCT NAME']}
            >
              {row['PRODUCT NAME']}
            </p>
            <p className="text-[10px] font-bold text-gray-300 mt-2 font-mono truncate" title={row['PRODUCT ID']}>
              {row['PRODUCT ID']}
            </p>
            <div className="flex justify-center gap-3 mt-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
              <span>Avail: {row['AVAILABLE QTY'] ?? 0}</span>
              <span>Box: {row['QTY IN BOX'] ?? 0}</span>
            </div>
          </div>

          <div className="flex justify-end items-center gap-1 mt-4">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(row)}
                className="p-2.5 bg-gray-50 hover:bg-black rounded-xl text-gray-500 hover:text-[#D4AF37] transition-all border border-transparent hover:border-black/10"
                title={`Edit ${row['PRODUCT NAME']}`}
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(row.ID)}
                className="p-2.5 bg-red-50 hover:bg-red-500 rounded-xl text-red-500 hover:text-white transition-all border border-transparent hover:border-red-100"
                title={`Delete ${row['PRODUCT NAME']}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
