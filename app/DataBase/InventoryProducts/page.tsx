'use client';

import { useState, useEffect } from 'react';
import { bhs_supabas } from '@/lib/supabase';
import { Search, Plus, ChevronLeft, ChevronRight, Download, Upload, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
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
  qty: '0',
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
  const [isUploading, setIsUploading] = useState(false);

  const [activeTab, setActiveTab] = useState<'products'|'categories'>('products');
  const [categories, setCategories] = useState<{name: string, count: number}[]>([]);
  const [isConfirmCategoryOpen, setIsConfirmCategoryOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (activeTab === 'products') {
      const t = setTimeout(() => fetchRows(searchTerm, currentPage), 300);
      return () => clearTimeout(t);
    }
  }, [searchTerm, currentPage, activeTab]);

  useEffect(() => {
    if (activeTab === 'categories') {
      fetchCategories();
    }
  }, [activeTab]);

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
        qty: String(row.QTY ?? 0),
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
        QTY: parseNum(formValues.qty),
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

  const fetchCategories = async () => {
    setIsCategoriesLoading(true);
    try {
      let allTags: string[] = [];
      let fetchMore = true;
      let pageIndex = 0;
      const limit = 1000;

      while (fetchMore) {
        const { data, error } = await bhs_supabas
          .from('web_INVENTORY_PRODUCTS')
          .select('TAGS')
          .range(pageIndex * limit, (pageIndex + 1) * limit - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allTags = [...allTags, ...data.map(d => d.TAGS || '')];
          if (data.length < limit) fetchMore = false;
          else pageIndex++;
        } else {
          fetchMore = false;
        }
      }

      const counts: Record<string, number> = {};
      allTags.forEach(tag => {
        const t = tag.trim() || 'Uncategorized';
        counts[t] = (counts[t] || 0) + 1;
      });

      const cats = Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      setCategories(cats);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  const handleDeleteCategory = (categoryName: string) => {
    setCategoryToDelete(categoryName);
    setIsConfirmCategoryOpen(true);
  };

  const executeDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsSaving(true);
    try {
      let query = bhs_supabas.from('web_INVENTORY_PRODUCTS').delete();
      
      if (categoryToDelete === 'Uncategorized') {
        query = query.or('TAGS.eq."",TAGS.is.null');
      } else {
        query = query.eq('TAGS', categoryToDelete);
      }

      const { error } = await query;
      if (error) throw error;
      
      toast.success('Category and its products deleted successfully');
      fetchCategories();
      // Optional: Refresh products if we switch back
      setTotalCount(prev => prev - (categories.find(c => c.name === categoryToDelete)?.count || 0));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setIsSaving(false);
      setIsConfirmCategoryOpen(false);
      setCategoryToDelete(null);
    }
  };

  const downloadProductsExcel = async () => {
    setIsSaving(true);
    try {
      let allProducts: any[] = [];
      let fetchMore = true;
      let pageIndex = 0;
      const limit = 1000;

      while (fetchMore) {
        const { data, error } = await bhs_supabas
          .from('web_INVENTORY_PRODUCTS')
          .select('*')
          .order('PRODUCT NAME')
          .range(pageIndex * limit, (pageIndex + 1) * limit - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allProducts = [...allProducts, ...data];
          if (data.length < limit) fetchMore = false;
          else pageIndex++;
        } else {
          fetchMore = false;
        }
      }

      const exportData = (allProducts || []).map(p => ({
        "ID": p.ID,
        "Product ID": p["PRODUCT ID"] || '',
        "Product Barcode": p["PRODUCT BARCODE"] || '',
        "Product Name": p["PRODUCT NAME"] || '',
        "Tags": p["TAGS"] || '',
        "Min Q": p["MIN Q BY CTN"] || 0,
        "Max Q": p["MAX Q BY CTN"] || 0,
        "QINC": p["QINC"] || 0,
        "Qty": p["QTY"] || 0
      }));

      if (exportData.length === 0) {
        toast.error('No products found in database to export');
        setIsSaving(false);
        return;
      }

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventory Products");
      XLSX.writeFile(wb, "Inventory_Products.xlsx");
      toast.success('Excel file exported successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to export Excel file');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

        if (data.length === 0) {
          toast.error('Excel file is empty');
          setIsUploading(false);
          return;
        }

        const { data: latestProducts, error: fetchErr } = await bhs_supabas
          .from('web_INVENTORY_PRODUCTS')
          .select('ID, "PRODUCT ID"');

        if (fetchErr) throw fetchErr;

        const dbProductIdMap = new Map<string, any>();
        (latestProducts || []).forEach((p) => {
          if (p['PRODUCT ID']) {
            dbProductIdMap.set(String(p['PRODUCT ID']).trim(), p);
          }
        });

        const recordsToUpsert: any[] = [];
        let nextIdNum = -1; // To hold the next max ID for new records
        let newCount = 0;

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const productId = String(row['Product ID'] || '').trim();
          if (!productId) continue;

          let id = '';
          const existing = dbProductIdMap.get(productId);
          if (existing) {
             id = existing.ID;
          } else {
             if (nextIdNum === -1) {
                // Fetch next id using util function
                const nextIdStr = await getNextInventoryRecordId('web_INVENTORY_PRODUCTS');
                const match = nextIdStr.match(/^P-(\d+)$/i);
                if (match) nextIdNum = parseInt(match[1], 10);
                else nextIdNum = 1;
             }
             id = `P-${String(nextIdNum + newCount).padStart(4, '0')}`;
             newCount++;
          }

          const record = {
            ID: id,
            'PRODUCT ID': productId,
            'PRODUCT BARCODE': String(row['Product Barcode'] ?? '').trim(),
            'PRODUCT NAME': String(row['Product Name'] ?? '').trim(),
            'TAGS': String(row['Tags'] ?? '').trim(),
            'MIN Q BY CTN': parseNum(String(row['Min Q'] ?? '0')),
            'MAX Q BY CTN': parseNum(String(row['Max Q'] ?? '0')),
            'QINC': parseNum(String(row['QINC'] ?? '0')),
            'QTY': parseNum(String(row['Qty'] ?? '0'))
          };
          recordsToUpsert.push(record);
        }

        if (recordsToUpsert.length === 0) {
          toast.error('No valid product rows found to upload.');
          setIsUploading(false);
          e.target.value = '';
          return;
        }

        // Upsert in batches of 1000 to avoid limits
        for (let i = 0; i < recordsToUpsert.length; i += 1000) {
           const batch = recordsToUpsert.slice(i, i + 1000);
           const { error: upsertErr } = await bhs_supabas
             .from('web_INVENTORY_PRODUCTS')
             .upsert(batch, { onConflict: 'ID' });
           if (upsertErr) throw upsertErr;
        }

        toast.success(`${recordsToUpsert.length} products processed successfully!`);
        fetchRows(searchTerm, currentPage);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Failed to process Excel file');
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      toast.error('Error reading Excel file');
      setIsUploading(false);
    };

    reader.readAsBinaryString(file);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <h1 className="text-4xl font-normal text-black tracking-tighter flex items-center gap-3">
            Inventory Products DB <span className="text-lg font-black text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">{totalCount.toLocaleString()}</span>
          </h1>

          <div className="flex bg-gray-100 p-1 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-6 py-2.5 rounded-xl text-sm font-black tracking-widest uppercase transition-all ${
                activeTab === 'products'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              Products
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-2.5 rounded-xl text-sm font-black tracking-widest uppercase transition-all ${
                activeTab === 'categories'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              Product Categories
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {canEdit && (
            <>
              <button
                onClick={downloadProductsExcel}
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
                  onChange={handleFileUpload}
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
            </>
          )}
        </div>
      </div>

      {activeTab === 'products' ? (
        <>
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
        </>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {isCategoriesLoading ? (
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {Array(8).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse bg-white rounded-3xl p-6 border border-gray-100 h-[140px] flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="h-6 bg-gray-100 rounded w-3/4 mx-auto" />
                      <div className="h-4 bg-gray-100 rounded w-full" />
                    </div>
                    <div className="h-10 bg-gray-100 rounded-xl w-full" />
                  </div>
                ))}
              </div>
            </div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-bold uppercase tracking-widest">
              No Categories Found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest text-center">Category Name</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest text-center">Products Count</th>
                    {canDelete && (
                      <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest text-center">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categories.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-5 font-bold text-black text-center">{cat.name}</td>
                      <td className="px-6 py-5 text-center">
                        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-black">
                          {cat.count.toLocaleString()}
                        </span>
                      </td>
                      {canDelete && (
                        <td className="px-6 py-5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.name)}
                            className="px-4 py-2 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-xs font-black tracking-widest uppercase transition-all inline-block"
                          >
                            Delete Category
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

      <ConfirmModal
        isOpen={isConfirmCategoryOpen}
        onConfirm={executeDeleteCategory}
        onCancel={() => { setIsConfirmCategoryOpen(false); setCategoryToDelete(null); }}
        isLoading={isSaving}
        title="Delete Category"
        message={`Are you sure you want to completely delete the category "${categoryToDelete}" and ALL its products from the database? This action cannot be undone.`}
      />
    </div>
  );
}
