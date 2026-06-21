'use client';

import { useState, useEffect } from 'react';
import { bhs_supabas } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { Search, Plus, ChevronLeft, ChevronRight, Download, Upload, Loader2 } from 'lucide-react';
import { ConfirmModal } from '@/app/LPOs/Components/ConfirmModal';
import { usePermissions } from '@/app/LPOs/Hooks/usePermissions';
import { toast } from '@/app/Components/Notification';
import {
  formatInventoryRecordId,
  getNextInventoryRecordId,
  parseRecordNum,
} from '@/app/DataBase/Utils/InventoryRecordIds';
import InventoryCountProductsTable, { InventoryCountProductRow } from './Components/InventoryCountProductsTable';
import InventoryCountProductsModal, { InventoryCountProductFormValues } from './Components/InventoryCountProductsModal';

const emptyForm = (): InventoryCountProductFormValues => ({
  productId: '',
  barcodeName: '',
  productName: '',
  availableQty: '0',
  qtyInBox: '0',
});

function parseNum(val: unknown): number {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function hasLinkedCountRecords(productId: string): Promise<boolean> {
  const [detailsResult, totalsResult] = await Promise.all([
    bhs_supabas
      .from('mix_INVENTORY_COUNT_DETAILS')
      .select('ID', { count: 'exact', head: true })
      .eq('PRODUCT ID', productId),
    bhs_supabas
      .from('mix_INVENTORY_COUNT_TOTALS')
      .select('ID', { count: 'exact', head: true })
      .eq('PRODUCT ID', productId),
  ]);

  if (detailsResult.error) throw detailsResult.error;
  if (totalsResult.error) throw totalsResult.error;

  return (detailsResult.count ?? 0) > 0 || (totalsResult.count ?? 0) > 0;
}

export default function InventoryCountProductsPage() {
  const { canEdit, canDelete } = usePermissions();
  const [rows, setRows] = useState<InventoryCountProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 100;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryCountProductRow | null>(null);
  const [formValues, setFormValues] = useState<InventoryCountProductFormValues>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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

      let query = bhs_supabas.from('mix_INVENTORY_COUNT_PRODUCTS').select('*', { count: 'exact' });
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`"PRODUCT NAME".ilike.${term},"BARCODE NAME".ilike.${term},"PRODUCT ID".ilike.${term}`);
      }

      const { data, error, count } = await query.order('PRODUCT NAME').range(start, end);
      if (error) throw error;
      setRows((data || []) as InventoryCountProductRow[]);
      setTotalCount(count || 0);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }

  const openModal = (row: InventoryCountProductRow | null = null) => {
    setEditing(row);
    if (row) {
      setFormValues({
        productId: row['PRODUCT ID'] || '',
        barcodeName: row['BARCODE NAME'] || '',
        productName: row['PRODUCT NAME'] || '',
        availableQty: String(row['AVAILABLE QTY'] ?? 0),
        qtyInBox: String(row['QTY IN BOX'] ?? 0),
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
      const trimmedProductId = formValues.productId.trim();

      const { data: existing, error: checkError } = await bhs_supabas
        .from('mix_INVENTORY_COUNT_PRODUCTS')
        .select('ID')
        .eq('PRODUCT ID', trimmedProductId)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing && (!editing || existing.ID !== editing.ID)) {
        toast.error(`Product ID "${trimmedProductId}" is already in use`);
        return;
      }

      if (editing && trimmedProductId !== editing['PRODUCT ID']) {
        const linked = await hasLinkedCountRecords(editing['PRODUCT ID']);
        if (linked) {
          toast.error('Cannot change Product ID: this product has count records linked to it');
          return;
        }
      }

      const payload = {
        'PRODUCT ID': trimmedProductId,
        'BARCODE NAME': formValues.barcodeName.trim(),
        'PRODUCT NAME': formValues.productName.trim(),
        'AVAILABLE QTY': parseNum(formValues.availableQty),
        'QTY IN BOX': parseNum(formValues.qtyInBox),
      };

      if (editing) {
        const { error } = await bhs_supabas
          .from('mix_INVENTORY_COUNT_PRODUCTS')
          .update(payload)
          .eq('ID', editing.ID);
        if (error) throw error;
        toast.success('Product updated successfully');
      } else {
        const nextId = await getNextInventoryRecordId('mix_INVENTORY_COUNT_PRODUCTS');
        const { error } = await bhs_supabas
          .from('mix_INVENTORY_COUNT_PRODUCTS')
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
        const linked = await hasLinkedCountRecords(row['PRODUCT ID']);
        if (linked) {
          toast.error('Cannot delete: this product has inventory count records linked to it');
          return;
        }
      }

      const { error } = await bhs_supabas
        .from('mix_INVENTORY_COUNT_PRODUCTS')
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

  const handleExportExcel = async () => {
    setIsSaving(true);
    try {
      let allData: InventoryCountProductRow[] = [];
      let start = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await bhs_supabas
          .from('mix_INVENTORY_COUNT_PRODUCTS')
          .select('*')
          .order('PRODUCT NAME')
          .range(start, start + step - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...(data as InventoryCountProductRow[])];
          start += step;
        } else {
          hasMore = false;
        }

        if (data && data.length < step) {
          hasMore = false;
        }
      }

      const exportData = allData.map((row) => ({
        ID: row.ID,
        'PRODUCT ID': row['PRODUCT ID'],
        'BARCODE NAME': row['BARCODE NAME'] ?? '',
        'PRODUCT NAME': row['PRODUCT NAME'],
        'AVAILABLE QTY': row['AVAILABLE QTY'] ?? 0,
        'QTY IN BOX': row['QTY IN BOX'] ?? 0,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'IC Products');
      XLSX.writeFile(
        wb,
        `Inventory_Count_Products_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      toast.success('Database exported successfully!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to export data');
    } finally {
      setIsSaving(false);
    }
  };

  const normalizeExcelId = (val: unknown): string => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'number' && Number.isFinite(val)) {
      return Number.isInteger(val) ? String(Math.trunc(val)) : String(val);
    }
    return String(val).trim();
  };

  const downloadUploadIssuesReport = (
    fileName: string,
    title: string,
    sections: { heading: string; lines: string[] }[]
  ) => {
    const nonEmptySections = sections.filter((section) => section.lines.length > 0);
    if (nonEmptySections.length === 0) return;

    const lines: string[] = [title, `Generated: ${new Date().toLocaleString('en-GB')}`, ''];
    nonEmptySections.forEach((section) => {
      lines.push(section.heading);
      section.lines.forEach((line) => lines.push(line));
      lines.push('');
    });

    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error('The uploaded Excel file is empty.');
        return;
      }

      const { data: latestProducts, error: fetchErr } = await bhs_supabas
        .from('mix_INVENTORY_COUNT_PRODUCTS')
        .select('ID, "PRODUCT ID"');

      if (fetchErr) throw fetchErr;

      const dbProductIdToIdMap = new Map<string, string>();
      let maxRecordNum = 0;
      (latestProducts || []).forEach((product) => {
        const productId = normalizeExcelId(product['PRODUCT ID']);
        if (productId) {
          dbProductIdToIdMap.set(productId, product.ID);
        }
        const num = parseRecordNum(product.ID || '');
        if (num !== null && num > maxRecordNum) maxRecordNum = num;
      });

      const duplicateProductIdsInFile = new Map<string, number[]>();
      const missingNameRows: number[] = [];
      const missingProductIdRows: number[] = [];
      const conflictingProductIdRows: string[] = [];

      const trackRow = (map: Map<string, number[]>, key: string, rowNumber: number) => {
        if (!key) return;
        const rows = map.get(key) || [];
        rows.push(rowNumber);
        map.set(key, rows);
      };

      jsonData.forEach((row, index) => {
        const rowNumber = index + 2;
        const recordId = row.ID?.toString().trim() || '';
        const productId = normalizeExcelId(row['PRODUCT ID']);
        const productName = row['PRODUCT NAME']?.toString().trim() || '';

        if (!productName) missingNameRows.push(rowNumber);
        if (!productId) missingProductIdRows.push(rowNumber);
        if (productId) trackRow(duplicateProductIdsInFile, productId, rowNumber);

        if (productId && recordId && dbProductIdToIdMap.has(productId)) {
          const existingId = dbProductIdToIdMap.get(productId);
          if (existingId && existingId !== recordId) {
            conflictingProductIdRows.push(
              `Row ${rowNumber}: PRODUCT ID "${productId}" already belongs to record ${existingId}, not ${recordId}`
            );
          }
        }
      });

      const issueSections = [
        {
          heading: `=== MISSING PRODUCT NAME (${missingNameRows.length}) ===`,
          lines: missingNameRows.map((row) => `Row ${row}`),
        },
        {
          heading: `=== MISSING PRODUCT ID (${missingProductIdRows.length}) ===`,
          lines: missingProductIdRows.map((row) => `Row ${row}`),
        },
        {
          heading: '=== DUPLICATE PRODUCT ID IN FILE ===',
          lines: [...duplicateProductIdsInFile.entries()]
            .filter(([, rows]) => rows.length > 1)
            .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
            .map(([productId, rows]) => `${productId} -> rows ${rows.join(', ')}`),
        },
        {
          heading: `=== PRODUCT ID ALREADY LINKED TO ANOTHER RECORD (${conflictingProductIdRows.length}) ===`,
          lines: conflictingProductIdRows,
        },
      ];

      const hasIssues = issueSections.some((section) => section.lines.length > 0);
      if (hasIssues) {
        downloadUploadIssuesReport(
          `IC_Products_Upload_Issues_${new Date().toISOString().split('T')[0]}.txt`,
          'Inventory Count Products Upload - Issues Found',
          issueSections
        );
        toast.error(
          'Upload blocked. A text file with all issues has been downloaded. Fix the Excel file and upload again.'
        );
        return;
      }

      let nextRecordNum = maxRecordNum;
      const formattedData = jsonData.map((row) => {
        const productId = normalizeExcelId(row['PRODUCT ID']);
        const existingId = dbProductIdToIdMap.get(productId);
        let recordId = existingId;

        if (!recordId) {
          nextRecordNum += 1;
          recordId = formatInventoryRecordId(nextRecordNum);
        }

        return {
          ID: recordId,
          'PRODUCT ID': productId,
          'BARCODE NAME': row['BARCODE NAME']?.toString().trim() || '',
          'PRODUCT NAME': row['PRODUCT NAME']?.toString().trim() || '',
          'AVAILABLE QTY': parseNum(row['AVAILABLE QTY']),
          'QTY IN BOX': parseNum(row['QTY IN BOX']),
        };
      });

      const chunkSize = 500;
      for (let i = 0; i < formattedData.length; i += chunkSize) {
        const chunk = formattedData.slice(i, i + chunkSize);
        const { error } = await bhs_supabas
          .from('mix_INVENTORY_COUNT_PRODUCTS')
          .upsert(chunk, { onConflict: 'PRODUCT ID' });

        if (error) throw error;
      }

      toast.success(`Successfully imported ${formattedData.length} products!`);
      fetchRows(searchTerm, currentPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to import data');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-4xl font-normal text-black tracking-tighter">Inventory Count Products</h1>
        {canEdit && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isSaving}
              className="p-4 bg-white border border-gray-200 text-green-600 rounded-2xl shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50"
              title="Export Excel"
            >
              <Download className="w-6 h-6" />
            </button>

            <label
              className={`p-4 bg-white border border-gray-200 text-blue-600 rounded-2xl shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Import/Update from Excel"
            >
              {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleImportExcel}
                disabled={isUploading}
              />
            </label>

            <button
              type="button"
              onClick={() => openModal()}
              className="p-4 bg-black text-[#D4AF37] rounded-2xl shadow-xl hover:scale-[1.02] transition-all"
              title="New Product"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, barcode, or product ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>
      </div>

      <InventoryCountProductsTable
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

      <InventoryCountProductsModal
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
        message="Are you sure you want to delete this inventory count product?"
      />
    </div>
  );
}
