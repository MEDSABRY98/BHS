'use client';

import { useState, useEffect } from 'react';
import { bhs_supabas } from '@/lib/supabase';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { ConfirmModal } from '@/app/LPOs/Components/ConfirmModal';
import { usePermissions } from '@/app/LPOs/Hooks/usePermissions';
import { toast } from '@/app/Components/Notification';
import { getNextInventoryRecordId } from '@/app/DataBase/Utils/InventoryRecordIds';
import InventoryProductsTable, { InventoryProductRow } from './Components/InventoryProductsTable';
import InventoryProductsModal, { InventoryProductFormValues } from './Components/InventoryProductsModal';

const emptyForm = (): InventoryProductFormValues => ({
  productId: '',
  productBarcode: '',
  productName: '',
  tags: '',
  minQ: '0',
  maxQ: '0',
  qinc: '0',
  qtyOnHand: '0',
  qtyFreeToUse: '0',
});

function parseNum(val: string): number {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
}

export default function InventoryProductsPage() {
  const { canEdit, canDelete } = usePermissions();
  const [rows, setRows] = useState<InventoryProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 100;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryProductRow | null>(null);
  const [formValues, setFormValues] = useState<InventoryProductFormValues>(emptyForm());
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

      let query = bhs_supabas.from('web_INVENTORY_PRODUCTS').select('*', { count: 'exact' });
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`"PRODUCT NAME".ilike.${term},"PRODUCT BARCODE".ilike.${term},"PRODUCT ID".ilike.${term},TAGS.ilike.${term}`);
      }

      const { data, error, count } = await query.order('PRODUCT NAME').range(start, end);
      if (error) throw error;
      setRows((data || []) as InventoryProductRow[]);
      setTotalCount(count || 0);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }

  const openModal = (row: InventoryProductRow | null = null) => {
    setEditing(row);
    if (row) {
      setFormValues({
        productId: row['PRODUCT ID'] || '',
        productBarcode: row['PRODUCT BARCODE'] || '',
        productName: row['PRODUCT NAME'] || '',
        tags: row.TAGS || '',
        minQ: String(row['MIN Q BY CTN'] ?? 0),
        maxQ: String(row['MAX Q BY CTN'] ?? 0),
        qinc: String(row.QINC ?? 0),
        qtyOnHand: String(row['QTY ON HAND'] ?? 0),
        qtyFreeToUse: String(row['QTY FREE TO USE'] ?? 0),
      });
    } else {
      setFormValues(emptyForm());
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.productId.trim() || !formValues.productName.trim()) {
      toast.warning('Product ID and Name are required');
      return;
    }

    setIsSaving(true);
    try {
      const { data: existing, error: checkError } = await bhs_supabas
        .from('web_INVENTORY_PRODUCTS')
        .select('ID')
        .eq('PRODUCT ID', formValues.productId.trim())
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing && (!editing || existing.ID !== editing.ID)) {
        toast.error(`Product ID "${formValues.productId}" is already in use`);
        return;
      }

      const payload = {
        'PRODUCT ID': formValues.productId.trim(),
        'PRODUCT BARCODE': formValues.productBarcode.trim(),
        'PRODUCT NAME': formValues.productName.trim(),
        TAGS: formValues.tags.trim(),
        'MIN Q BY CTN': parseNum(formValues.minQ),
        'MAX Q BY CTN': parseNum(formValues.maxQ),
        QINC: parseNum(formValues.qinc),
        'QTY ON HAND': parseNum(formValues.qtyOnHand),
        'QTY FREE TO USE': parseNum(formValues.qtyFreeToUse),
      };

      if (editing) {
        const { error } = await bhs_supabas
          .from('web_INVENTORY_PRODUCTS')
          .update(payload)
          .eq('ID', editing.ID);
        if (error) throw error;
        toast.success('Product updated successfully');
      } else {
        const nextId = await getNextInventoryRecordId('web_INVENTORY_PRODUCTS');
        const { error } = await bhs_supabas
          .from('web_INVENTORY_PRODUCTS')
          .insert({ ID: nextId, ...payload });
        if (error) throw error;
        toast.success('Product added successfully');
      }

      setIsModalOpen(false);
      fetchRows(searchTerm, currentPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save product');
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
      const row = rows.find((r) => r.ID === itemToDelete);
      if (row) {
        const { count, error: moveError } = await bhs_supabas
          .from('web_INVENTORY_MOVES')
          .select('ID', { count: 'exact', head: true })
          .eq('PRODUCT ID', row['PRODUCT ID']);

        if (moveError) throw moveError;
        if (count && count > 0) {
          toast.error('Cannot delete: this product has inventory moves linked to it');
          return;
        }
      }

      const { error } = await bhs_supabas
        .from('web_INVENTORY_PRODUCTS')
        .delete()
        .eq('ID', itemToDelete);
      if (error) throw error;
      toast.success('Product deleted successfully');
      fetchRows(searchTerm, currentPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete product');
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
        <h1 className="text-4xl font-normal text-black tracking-tighter">Inventory Products</h1>
        {canEdit && (
          <button
            type="button"
            onClick={() => openModal()}
            className="p-4 bg-black text-[#D4AF37] rounded-2xl shadow-xl hover:scale-[1.02] transition-all"
            title="New Product"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, barcode, product ID, or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>
      </div>

      <InventoryProductsTable
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

      <InventoryProductsModal
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
        title="Delete Product"
        message="Are you sure you want to delete this inventory product?"
      />
    </div>
  );
}
