'use client';

import { useState, useEffect } from 'react';
import { bhs_supabas } from '@/lib/supabase';
import { Search, Plus, ChevronLeft, ChevronRight, ArrowLeft, FileSpreadsheet, Download, Upload, X, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ConfirmModal } from '@/app/LPOs/Components/ConfirmModal';
import { usePermissions } from '@/app/LPOs/Hooks/usePermissions';
import { toast } from '@/app/Components/Notification';
import { getNextInventoryRecordId, formatInventoryRecordId } from '@/app/DataBase/Utils/InventoryRecordIds';
import InventoryMovesTable, { InventoryMoveRow } from './Components/InventoryMovesTable';
import InventoryMovesModal, { InventoryMoveFormValues } from './Components/InventoryMovesModal';
import InventoryMovesMonthsGrid, { MoveMonthSummary, englishMonths } from './Components/InventoryMovesMonthsGrid';
import InventoryMovesDaysGrid, { MoveDaySummary } from './Components/InventoryMovesDaysGrid';

const emptyForm = (): InventoryMoveFormValues => ({
  date: new Date().toISOString().split('T')[0],
  reference: '',
  locationFrom: '',
  locationTo: '',
  productId: '',
  qty: '0',
});

function parseNum(val: string): number {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
}

function toDateInput(val: string | null): string {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function dayDateRange(dateKey: string) {
  const start = `${dateKey}T00:00:00.000Z`;
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const end = `${d.toISOString().split('T')[0]}T00:00:00.000Z`;
  return { start, end };
}

function formatDayLabel(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  return `${d.getUTCDate()} ${englishMonths[d.getUTCMonth() + 1]} ${d.getUTCFullYear()}`;
}

export default function InventoryMovesPage() {
  const { canEdit, canDelete } = usePermissions();
  const [view, setView] = useState<'months' | 'days' | 'dayDetail'>('months');
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [moveMonths, setMoveMonths] = useState<MoveMonthSummary[]>([]);
  const [moveDays, setMoveDays] = useState<MoveDaySummary[]>([]);
  const [monthsLoading, setMonthsLoading] = useState(true);
  const [daysLoading, setDaysLoading] = useState(false);

  const [rows, setRows] = useState<InventoryMoveRow[]>([]);
  const [productOptions, setProductOptions] = useState<{ 'PRODUCT ID': string; 'PRODUCT NAME': string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 100;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryMoveRow | null>(null);
  const [formValues, setFormValues] = useState<InventoryMoveFormValues>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'move' | 'month' | 'day'>('move');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [monthToDelete, setMonthToDelete] = useState<{ year: number; month: number } | null>(null);
  const [dayToDelete, setDayToDelete] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchMoveMonths();
    fetchProductOptions();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDay]);

  useEffect(() => {
    if (view !== 'dayDetail' || !selectedDay) return;
    const t = setTimeout(() => fetchRows(searchTerm, currentPage, selectedDay), 300);
    return () => clearTimeout(t);
  }, [searchTerm, currentPage, selectedDay, view]);

  async function fetchMoveMonths() {
    setMonthsLoading(true);
    try {
      const response = await fetch('/api/Inventory/MovesDb?action=months');
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setMoveMonths(result.data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load move months');
    } finally {
      setMonthsLoading(false);
    }
  }

  async function fetchMoveDays(year: number, month: number) {
    setDaysLoading(true);
    try {
      const response = await fetch(`/api/Inventory/MovesDb?action=days&year=${year}&month=${month}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setMoveDays(result.data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load move days');
    } finally {
      setDaysLoading(false);
    }
  }

  async function fetchProductOptions() {
    try {
      const { data, error } = await bhs_supabas
        .from('web_INVENTORY_PRODUCTS')
        .select('"PRODUCT ID","PRODUCT NAME"')
        .order('PRODUCT NAME');
      if (error) throw error;
      setProductOptions((data || []) as { 'PRODUCT ID': string; 'PRODUCT NAME': string }[]);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchRows(search: string, page: number, dateKey: string) {
    try {
      setIsLoading(true);
      const start = (page - 1) * itemsPerPage;
      const end = start + itemsPerPage - 1;
      const { start: dayStart, end: dayEnd } = dayDateRange(dateKey);

      let query = bhs_supabas
        .from('web_INVENTORY_MOVES')
        .select('*', { count: 'exact' })
        .gte('DATE', dayStart)
        .lt('DATE', dayEnd);

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`"PRODUCT ID".ilike.${term},REFERENCE.ilike.${term},"LOCATION FROM".ilike.${term},"LOCATION TO".ilike.${term}`);
      }

      const { data, error, count } = await query.order('DATE', { ascending: false }).range(start, end);
      if (error) throw error;
      setRows((data || []) as InventoryMoveRow[]);
      setTotalCount(count || 0);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load moves');
    } finally {
      setIsLoading(false);
    }
  }

  const openMonth = (year: number, month: number) => {
    setSelectedMonth({ year, month });
    setSelectedDay(null);
    setSearchTerm('');
    setCurrentPage(1);
    setView('days');
    fetchMoveDays(year, month);
  };

  const openDay = (dateKey: string) => {
    setSelectedDay(dateKey);
    setSearchTerm('');
    setCurrentPage(1);
    setView('dayDetail');
  };

  const backToMonths = () => {
    setView('months');
    setSelectedMonth(null);
    setSelectedDay(null);
    setMoveDays([]);
    setRows([]);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const backToDays = () => {
    setView('days');
    setSelectedDay(null);
    setRows([]);
    setSearchTerm('');
    setCurrentPage(1);
    if (selectedMonth) fetchMoveDays(selectedMonth.year, selectedMonth.month);
  };

  const openModal = (row: InventoryMoveRow | null = null) => {
    setEditing(row);
    if (row) {
      setFormValues({
        date: toDateInput(row.DATE),
        reference: row.REFERENCE || '',
        locationFrom: row['LOCATION FROM'] || '',
        locationTo: row['LOCATION TO'] || '',
        productId: row['PRODUCT ID'] || '',
        qty: String(row.QTY ?? 0),
      });
    } else {
      const defaults = emptyForm();
      if (selectedDay) {
        defaults.date = selectedDay;
      } else if (selectedMonth) {
        defaults.date = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-01`;
      }
      setFormValues(defaults);
    }
    setIsModalOpen(true);
  };

  const validateProductId = async (productId: string) => {
    const { data, error } = await bhs_supabas
      .from('web_INVENTORY_PRODUCTS')
      .select('ID')
      .eq('PRODUCT ID', productId.trim())
      .maybeSingle();
    if (error) throw error;
    return !!data;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.productId.trim()) {
      toast.warning('Product ID is required');
      return;
    }

    setIsSaving(true);
    try {
      const productExists = await validateProductId(formValues.productId);
      if (!productExists) {
        toast.error('Product ID does not exist in Inventory Products');
        return;
      }

      const payload = {
        DATE: formValues.date ? new Date(formValues.date).toISOString() : null,
        REFERENCE: formValues.reference.trim(),
        'LOCATION FROM': formValues.locationFrom.trim(),
        'LOCATION TO': formValues.locationTo.trim(),
        'PRODUCT ID': formValues.productId.trim(),
        QTY: parseNum(formValues.qty),
      };

      if (editing) {
        const { error } = await bhs_supabas
          .from('web_INVENTORY_MOVES')
          .update(payload)
          .eq('ID', editing.ID);
        if (error) throw error;
        toast.success('Move updated successfully');
      } else {
        const nextId = await getNextInventoryRecordId('web_INVENTORY_MOVES');
        const { error } = await bhs_supabas
          .from('web_INVENTORY_MOVES')
          .insert({ ID: nextId, ...payload });
        if (error) throw error;
        toast.success('Move added successfully');
      }

      setIsModalOpen(false);
      if (selectedDay) fetchRows(searchTerm, currentPage, selectedDay);
      await fetchMoveMonths();
      if (selectedMonth) await fetchMoveDays(selectedMonth.year, selectedMonth.month);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save move');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMove = (id: string) => {
    setConfirmMode('move');
    setItemToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleDeleteMonth = (year: number, month: number) => {
    setConfirmMode('month');
    setMonthToDelete({ year, month });
    setIsConfirmOpen(true);
  };

  const handleDeleteDay = (dateKey: string) => {
    setConfirmMode('day');
    setDayToDelete(dateKey);
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    setIsSaving(true);
    try {
      if (confirmMode === 'day' && dayToDelete) {
        const response = await fetch(`/api/Inventory/MovesDb?date=${dayToDelete}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        toast.success(`Deleted moves for ${formatDayLabel(dayToDelete)}`);
        await fetchMoveMonths();
        if (selectedMonth) await fetchMoveDays(selectedMonth.year, selectedMonth.month);
        if (selectedDay === dayToDelete) backToDays();
      } else if (confirmMode === 'month' && monthToDelete) {
        const response = await fetch(
          `/api/Inventory/MovesDb?year=${monthToDelete.year}&month=${monthToDelete.month}`,
          { method: 'DELETE' }
        );
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        toast.success(`Deleted moves for ${englishMonths[monthToDelete.month]} ${monthToDelete.year}`);
        await fetchMoveMonths();
        if (
          selectedMonth &&
          selectedMonth.year === monthToDelete.year &&
          selectedMonth.month === monthToDelete.month
        ) {
          backToMonths();
        }
      } else if (itemToDelete) {
        const { error } = await bhs_supabas
          .from('web_INVENTORY_MOVES')
          .delete()
          .eq('ID', itemToDelete);
        if (error) throw error;
        toast.success('Move deleted successfully');
        if (selectedDay) fetchRows(searchTerm, currentPage, selectedDay);
        await fetchMoveMonths();
        if (selectedMonth) await fetchMoveDays(selectedMonth.year, selectedMonth.month);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
      setItemToDelete(null);
      setMonthToDelete(null);
      setDayToDelete(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;

  const formatExcelDate = (val: unknown): string => {
    if (!val) return '';
    if (typeof val === 'number') {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    const strVal = String(val).trim();
    if (!strVal) return '';

    const d = new Date(strVal);
    if (!Number.isNaN(d.getTime())) {
      const parts = strVal.split(/[-/.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${String(parseInt(parts[1], 10)).padStart(2, '0')}-${String(parseInt(parts[2], 10)).padStart(2, '0')}`;
        }
        if (parts[2].length === 4) {
          return `${parts[2]}-${String(parseInt(parts[1], 10)).padStart(2, '0')}-${String(parseInt(parts[0], 10)).padStart(2, '0')}`;
        }
      }
      return d.toISOString().split('T')[0];
    }

    const parts = strVal.split(/[-/.]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year) && year > 1000) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    return strVal;
  };

  const downloadMovesTemplate = () => {
    const headers = ['DATE', 'REFERENCE', 'LOCATION FROM', 'LOCATION TO', 'PRODUCT ID', 'QTY'];
    const sampleRow = {
      DATE: '2026-06-12',
      REFERENCE: 'REF-001',
      'LOCATION FROM': 'Partners/Vendors',
      'LOCATION TO': 'Partners/Customers',
      'PRODUCT ID': 'PROD-001',
      QTY: 10,
    };
    const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Moves Template');
    XLSX.writeFile(wb, 'Inventory_Moves_Import_Template.xlsx');
    toast.success('Template downloaded successfully!');
  };

  const handleMovesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error('The uploaded Excel file is empty.');
        return;
      }

      const requiredColumns = ['DATE', 'REFERENCE', 'LOCATION FROM', 'LOCATION TO', 'PRODUCT ID', 'QTY'];
      const firstRow = jsonData[0];
      const missingColumns = requiredColumns.filter((col) => !(col in firstRow));
      if (missingColumns.length > 0) {
        toast.error(`Missing required columns: ${missingColumns.join(', ')}`);
        return;
      }

      const { data: products, error: productsError } = await bhs_supabas
        .from('web_INVENTORY_PRODUCTS')
        .select('"PRODUCT ID"');
      if (productsError) throw productsError;

      const productIds = new Set((products || []).map((p) => p['PRODUCT ID'] as string));

      const nextId = await getNextInventoryRecordId('web_INVENTORY_MOVES');
      let nextNum = parseInt(nextId.substring(2), 10);

      const formattedRows: Record<string, unknown>[] = [];
      const invalidProductRows: number[] = [];

      jsonData.forEach((row, index) => {
        const productId = String(row['PRODUCT ID'] ?? '').trim();
        const date = formatExcelDate(row.DATE);
        if (!date || !productId) return;

        if (!productIds.has(productId)) {
          invalidProductRows.push(index + 2);
          return;
        }

        formattedRows.push({
          ID: formatInventoryRecordId(nextNum++),
          DATE: new Date(date).toISOString(),
          REFERENCE: String(row.REFERENCE ?? '').trim(),
          'LOCATION FROM': String(row['LOCATION FROM'] ?? '').trim(),
          'LOCATION TO': String(row['LOCATION TO'] ?? '').trim(),
          'PRODUCT ID': productId,
          QTY: Number(row.QTY) || 0,
        });
      });

      if (invalidProductRows.length > 0) {
        toast.error(`Invalid PRODUCT ID on row(s): ${invalidProductRows.slice(0, 5).join(', ')}${invalidProductRows.length > 5 ? '...' : ''}`);
        return;
      }

      if (formattedRows.length === 0) {
        toast.error('No valid rows found. Check DATE and PRODUCT ID columns.');
        return;
      }

      const chunkSize = 500;
      for (let i = 0; i < formattedRows.length; i += chunkSize) {
        const chunk = formattedRows.slice(i, i + chunkSize);
        const { error: insertErr } = await bhs_supabas.from('web_INVENTORY_MOVES').insert(chunk);
        if (insertErr) throw insertErr;
      }

      toast.success(`Successfully uploaded ${formattedRows.length} inventory move rows!`);
      setIsUploadModalOpen(false);
      await fetchMoveMonths();
      if (selectedDay && view === 'dayDetail') {
        fetchRows(searchTerm, currentPage, selectedDay);
      }
      if (selectedMonth) await fetchMoveDays(selectedMonth.year, selectedMonth.month);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const excelUploadModal = isUploadModalOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500 overflow-hidden">
        <div className="p-8 flex items-center justify-between border-b border-gray-50">
          <h2 className="text-2xl font-bold text-black">Inventory Moves Import</h2>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all"
            disabled={isUploading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <button
              type="button"
              onClick={downloadMovesTemplate}
              disabled={isUploading}
              className="w-full py-4 px-6 bg-gray-50 border border-gray-100 hover:border-black/10 text-gray-800 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.01]"
            >
              <Download className="w-5 h-5 text-[#D4AF37]" />
              <span>Download Blank Template</span>
            </button>

            <label
              className={`w-full py-4 px-6 bg-black text-[#D4AF37] rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-black/10 transition-all hover:scale-[1.01] cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              <span>{isUploading ? 'Uploading...' : 'Upload Excel File'}</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleMovesUpload}
                disabled={isUploading}
              />
            </label>
          </div>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(false)}
              className="text-xs font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest"
              disabled={isUploading}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (view === 'months') {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-normal text-black tracking-tighter">Inventory Moves</h1>
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="p-3 bg-white border border-gray-200 text-green-600 rounded-2xl shadow-sm hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center justify-center shrink-0 cursor-pointer"
              title="Import Moves Excel"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
          )}
        </div>

        <InventoryMovesMonthsGrid
          months={moveMonths}
          isLoading={monthsLoading}
          canDelete={canDelete}
          onOpenMonth={openMonth}
          onDeleteMonth={handleDeleteMonth}
        />

        <ConfirmModal
          isOpen={isConfirmOpen && confirmMode === 'month'}
          onConfirm={executeDelete}
          onCancel={() => { setIsConfirmOpen(false); setMonthToDelete(null); }}
          isLoading={isSaving}
          title="Confirm Month Deletion"
          message={
            monthToDelete
              ? `Are you sure you want to delete all inventory moves for ${englishMonths[monthToDelete.month]} ${monthToDelete.year}? This cannot be undone.`
              : ''
          }
        />
        {excelUploadModal}
      </div>
    );
  }

  if (view === 'days' && selectedMonth) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={backToMonths}
              className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:scale-[1.02] transition-all"
              title="Back to months"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-normal text-black tracking-tighter">
                {englishMonths[selectedMonth.month]} {selectedMonth.year}
              </h1>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Inventory Moves</p>
            </div>
          </div>
        </div>

        <InventoryMovesDaysGrid
          days={moveDays}
          month={selectedMonth.month}
          isLoading={daysLoading}
          canDelete={canDelete}
          onOpenDay={openDay}
          onDeleteDay={handleDeleteDay}
        />

        <ConfirmModal
          isOpen={isConfirmOpen && confirmMode === 'day'}
          onConfirm={executeDelete}
          onCancel={() => { setIsConfirmOpen(false); setDayToDelete(null); }}
          isLoading={isSaving}
          title="Confirm Day Deletion"
          message={
            dayToDelete
              ? `Are you sure you want to delete all inventory moves for ${formatDayLabel(dayToDelete)}? This cannot be undone.`
              : ''
          }
        />
        {excelUploadModal}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={backToDays}
            className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:scale-[1.02] transition-all"
            title="Back to days"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-4xl font-normal text-black tracking-tighter">
              {selectedDay ? formatDayLabel(selectedDay) : ''}
            </h1>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Inventory Moves</p>
          </div>
        </div>
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
            placeholder="Search by product ID, reference, or locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>
      </div>

      <InventoryMovesTable
        rows={rows}
        isLoading={isLoading}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={openModal}
        onDelete={handleDeleteMove}
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

      <InventoryMovesModal
        isOpen={isModalOpen}
        editing={editing}
        values={formValues}
        productOptions={productOptions}
        isSaving={isSaving}
        onChange={setFormValues}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSave}
      />

      <ConfirmModal
        isOpen={isConfirmOpen && confirmMode === 'move'}
        onConfirm={executeDelete}
        onCancel={() => { setIsConfirmOpen(false); setItemToDelete(null); }}
        isLoading={isSaving}
        title="Delete Move"
        message="Are you sure you want to delete this inventory move?"
      />
      {excelUploadModal}
    </div>
  );
}
