'use client';

import { useState, useEffect } from 'react';
import { bhs_supabas } from '@/lib/supabase';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { ConfirmModal } from '@/app/LPOs/Components/ConfirmModal';
import { usePermissions } from '@/app/LPOs/Hooks/usePermissions';
import { toast } from '@/app/Components/Notification';
import { getNextInventoryRecordId } from '@/app/DataBase/Utils/InventoryRecordIds';
import InventoryItemCodeTable, { InventoryItemCodeRow } from './Components/InventoryItemCodeTable';
import InventoryItemCodeModal, { InventoryItemCodeFormValues } from './Components/InventoryItemCodeModal';

const emptyForm = (): InventoryItemCodeFormValues => ({
  tags: '',
  itemCode: '',
  barcode: '',
});

export default function InventoryItemCodePage() {
  const { canEdit, canDelete } = usePermissions();
  const [rows, setRows] = useState<InventoryItemCodeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 100;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItemCodeRow | null>(null);
  const [formValues, setFormValues] = useState<InventoryItemCodeFormValues>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    const t = setTimeout(() => fetchRows(searchTerm, currentPage), 300);
    return () => clearTimeout(t);
  }, [searchTerm, currentPage]);

  async function fetchRows(search: string, page: number) {
    try {
      setIsLoading(true);
      const start = (page - 1) * itemsPerPage;
      const end = start + itemsPerPage - 1;

      let query = bhs_supabas.from('web_INVENTORY_ITEM_CODE').select('*', { count: 'exact' });
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`TAGS.ilike.${term},"ITEM CODE".ilike.${term},BARCODE.ilike.${term}`);
      }

      const { data, error, count } = await query.order('ITEM CODE').range(start, end);
      if (error) throw error;
      setRows((data || []) as InventoryItemCodeRow[]);
      setTotalCount(count || 0);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load item codes');
    } finally {
      setIsLoading(false);
    }
  }

  const openModal = (row: InventoryItemCodeRow | null = null) => {
    setEditing(row);
    if (row) {
      setFormValues({
        tags: row.TAGS || '',
        itemCode: row['ITEM CODE'] || '',
        barcode: row.BARCODE || '',
      });
    } else {
      setFormValues(emptyForm());
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.itemCode.trim() && !formValues.barcode.trim()) {
      toast.warning('Item Code or Barcode is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        TAGS: formValues.tags.trim(),
        'ITEM CODE': formValues.itemCode.trim(),
        BARCODE: formValues.barcode.trim(),
      };

      if (editing) {
        const { error } = await bhs_supabas
          .from('web_INVENTORY_ITEM_CODE')
          .update(payload)
          .eq('ID', editing.ID);
        if (error) throw error;
        toast.success('Item code updated successfully');
      } else {
        const nextId = await getNextInventoryRecordId('web_INVENTORY_ITEM_CODE');
        const { error } = await bhs_supabas
          .from('web_INVENTORY_ITEM_CODE')
          .insert({ ID: nextId, ...payload });
        if (error) throw error;
        toast.success('Item code added successfully');
      }

      setIsModalOpen(false);
      fetchRows(searchTerm, currentPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save item code');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    setIsSaving(true);
    try {
      const { error } = await bhs_supabas
        .from('web_INVENTORY_ITEM_CODE')
        .delete()
        .eq('ID', itemToDelete);
      if (error) throw error;
      toast.success('Item code deleted successfully');
      fetchRows(searchTerm, currentPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete item code');
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-4xl font-normal text-black tracking-tighter">Inventory Item Code</h1>
        {canEdit && (
          <button type="button" onClick={() => openModal()} className="p-4 bg-black text-[#D4AF37] rounded-2xl shadow-xl hover:scale-[1.02] transition-all">
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by tags, item code, or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>
      </div>

      <InventoryItemCodeTable
        rows={rows}
        isLoading={isLoading}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={openModal}
        onDelete={handleDelete}
      />

      {totalCount > itemsPerPage && (
        <div className="flex items-center justify-between px-2">
          <span className="text-sm font-bold text-gray-500">
            {startIndex + 1}–{Math.min(startIndex + itemsPerPage, totalCount)} of {totalCount.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="p-2 rounded-xl border border-gray-100 bg-white disabled:opacity-40">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 text-sm font-black bg-white rounded-xl border border-gray-100">{currentPage} / {totalPages}</span>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="p-2 rounded-xl border border-gray-100 bg-white disabled:opacity-40">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <InventoryItemCodeModal
        isOpen={isModalOpen}
        editing={editing}
        values={formValues}
        isSaving={isSaving}
        onChange={setFormValues}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSave}
      />

      <ConfirmModal
        isOpen={isConfirmOpen}
        onConfirm={executeDelete}
        onCancel={() => { setIsConfirmOpen(false); setItemToDelete(null); }}
        isLoading={isSaving}
        title="Delete Item Code"
        message="Are you sure you want to delete this item code record?"
      />
    </div>
  );
}
