'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Edit2 } from 'lucide-react';
import { bhs_supabas } from '@/lib/supabase';
import { usePermissions } from '@/app/LPOs/Hooks/usePermissions';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import {
  createInventoryLocation,
  updateInventoryLocationName,
  type InventoryLocationRow,
} from '@/app/InventoryAnalysis/Service/location_service';
import InventoryLocationModal, {
  TYPE_LABELS,
  type InventoryLocationFormValues,
} from './Components/InventoryLocationModal';

const emptyForm = (): InventoryLocationFormValues => ({
  locationName: '',
  locationType: 'external',
});

function isMissingTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /does not exist|42P01|Could not find the table|schema cache/i.test(message);
}

export default function InventoryLocationsPage() {
  const { canEdit } = usePermissions();
  const [rows, setRows] = useState<InventoryLocationRow[]>([]);
  const [tableReady, setTableReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryLocationRow | null>(null);
  const [formValues, setFormValues] = useState<InventoryLocationFormValues>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data, error } = await bhs_supabas
        .from('web_INVENTORY_LOCATIONS')
        .select('ID, "LOCATION NAME", "LOCATION TYPE"')
        .order('ID', { ascending: true });
      if (error) throw error;
      setRows((data || []) as InventoryLocationRow[]);
      setTableReady(true);
    } catch (err) {
      if (isMissingTableError(err)) {
        setTableReady(false);
        setRows([]);
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to load locations');
      }
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = rows.filter((row) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      String(row.ID || '').toLowerCase().includes(term) ||
      String(row['LOCATION NAME'] || '').toLowerCase().includes(term) ||
      String(row['LOCATION TYPE'] || '').toLowerCase().includes(term) ||
      String(TYPE_LABELS[row['LOCATION TYPE']] || '').toLowerCase().includes(term)
    );
  });

  function openModal(row: InventoryLocationRow | null = null) {
    setEditing(row);
    if (row) {
      setFormValues({
        locationName: row['LOCATION NAME'] || '',
        locationType: row['LOCATION TYPE'],
      });
    } else {
      setFormValues(emptyForm());
    }
    setIsModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const name = formValues.locationName.trim();
    if (!name) {
      toast.warning('Location name is required');
      return;
    }

    setIsSaving(true);
    try {
      if (editing) {
        const result = await updateInventoryLocationName(editing.ID, name);
        if (!result.success) {
          toast.error(result.error || 'Failed to update location');
          return;
        }
        toast.success(`Updated ${editing.ID}`);
      } else {
        const result = await createInventoryLocation({
          locationName: name,
          locationType: formValues.locationType,
        });
        if (!result.success) {
          toast.error(result.error || 'Failed to add location');
          return;
        }
        toast.success(`Added ${result.row?.ID}: ${result.row?.['LOCATION NAME']}`);
      }
      setIsModalOpen(false);
      await loadData();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter flex items-center gap-3">
            Inventory Locations
            <span className="text-lg font-black text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">
              {rows.length.toLocaleString()}
            </span>
          </h1>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => openModal()}
            disabled={!tableReady}
            className="p-4 bg-black text-[#D4AF37] rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50"
            title="Add location"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      {!tableReady && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-900 font-medium">
          <strong>Table missing:</strong> Create{' '}
          <code className="bg-white/80 px-2 py-0.5 rounded-lg text-xs">web_INVENTORY_LOCATIONS</code> in Supabase
          using{' '}
          <code className="bg-white/80 px-2 py-0.5 rounded-lg text-xs">
            app/DataBase/docs/inventory_locations_table.sql
          </code>
          , then refresh.
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by ID, name, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-center border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-4 font-medium border-b border-gray-100 text-center w-[120px]">ID</th>
                <th className="px-6 py-4 font-medium border-b border-gray-100 text-center">Location Name</th>
                <th className="px-4 py-4 font-medium border-b border-gray-100 text-center w-[160px]">Type</th>
                {canEdit && (
                  <th className="px-4 py-4 font-medium border-b border-gray-100 text-center w-[100px]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={canEdit ? 4 : 3} className="px-6 py-6">
                        <div className="h-6 bg-gray-50 rounded-xl w-full" />
                      </td>
                    </tr>
                  ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 4 : 3} className="p-0">
                    <NoData title={rows.length === 0 ? 'NO LOCATIONS FOUND' : 'NO MATCHING LOCATIONS'} />
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.ID} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-4 text-sm font-bold text-black font-mono text-center whitespace-nowrap">
                      {row.ID}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-center max-w-0">
                      <span className="block truncate" title={row['LOCATION NAME']}>
                        {row['LOCATION NAME']}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <span className="inline-flex px-3 py-1 rounded-xl bg-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-600">
                        {TYPE_LABELS[row['LOCATION TYPE']] || row['LOCATION TYPE']}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => openModal(row)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit location name"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <InventoryLocationModal
        isOpen={isModalOpen}
        editing={editing}
        values={formValues}
        isSaving={isSaving}
        onChange={setFormValues}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSave}
      />
    </div>
  );
}
