'use client';

import { useState, useEffect } from 'react';
import { bhs_supabas } from '@/lib/Supabase';
import * as XLSX from 'xlsx';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Barcode,
  Loader2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload
} from 'lucide-react';
import { ConfirmModal } from '../../LPOs/Components/ConfirmModal';
import NoData from '@/app/Components/NoDataTab';
import { usePermissions } from '../../LPOs/Hooks/usePermissions';
import { toast } from '@/app/Components/Notification';


export default function ProductsPage() {
  const { canEdit, canDelete, isLoaded } = usePermissions();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'save' | 'delete'>('save');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Form states
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [productId, setProductId] = useState('');
  const [itemCode, setItemCode] = useState<string>('');
  const [productCategory, setProductCategory] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Fetch products when page or search term changes (debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProducts(searchTerm, currentPage);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, currentPage]);

  async function fetchProducts(search: string = '', page: number = 1) {
    try {
      const start = (page - 1) * itemsPerPage;
      const end = start + itemsPerPage - 1;

      let query = bhs_supabas
        .from('bhs_PRODUCTS')
        .select('*', { count: 'exact' });

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`"PRODUCT NAME".ilike.${term},"PRODUCT BARCODE".ilike.${term},"PRODUCT ID".ilike.${term}`);
      }

      const { data, error, count } = await query
        .order('PRODUCT NAME')
        .range(start, end);

      if (error) throw error;
      setProducts(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenModal = (product: any = null) => {
    setEditingProduct(product);
    setName(product ? product["PRODUCT NAME"] : '');
    setBarcode(product ? product["PRODUCT BARCODE"] : '');
    setProductId(product ? product["PRODUCT ID"] : '');
    setItemCode(product ? (product["ITEM CODE"] ?? '').toString() : '');
    setProductCategory(product ? product["PRODUCT CATEGORY"] || '' : '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave();
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      // Validate Product ID is unique
      if (productId.trim()) {
        const { data: existing, error: checkError } = await bhs_supabas
          .from('bhs_PRODUCTS')
          .select('ID')
          .eq('PRODUCT ID', productId.trim())
          .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
          if (!editingProduct || existing.ID !== editingProduct.ID) {
            toast.error(`The Product ID "${productId}" is already in use by another product!`);
            setIsSaving(false);
            return;
          }
        }
      }

      const itemCodeValue = itemCode !== '' ? Number(itemCode) : null;
      if (editingProduct) {
        const { error } = await bhs_supabas
          .from('bhs_PRODUCTS')
          .update({
            "PRODUCT NAME": name,
            "PRODUCT BARCODE": barcode,
            "PRODUCT ID": productId,
            "ITEM CODE": itemCodeValue,
            "PRODUCT CATEGORY": productCategory
          })
          .eq('ID', editingProduct.ID);
        if (error) throw error;
      } else {
        // Query the database view directly to get the absolute maximum ID stored, bypass client-side limits
        const { data: maxIdData, error: maxIdError } = await bhs_supabas
          .from('bhs_PRODUCTS_MAX_ID')
          .select('ID')
          .single();

        if (maxIdError && maxIdError.code !== 'PGRST116') { // PGRST116 is code for no rows returned, which is fine
          throw maxIdError;
        }

        let nextNum = 1;
        if (maxIdData && maxIdData.ID) {
          const match = maxIdData.ID.match(/^R-(\d+)$/i);
          if (match) {
            nextNum = parseInt(match[1], 10) + 1;
          }
        }
        const nextId = `R-${String(nextNum).padStart(4, '0')}`;

        const { error } = await bhs_supabas
          .from('bhs_PRODUCTS')
          .insert({
            ID: nextId,
            "PRODUCT NAME": name,
            "PRODUCT BARCODE": barcode,
            "PRODUCT ID": productId,
            "ITEM CODE": itemCodeValue,
            "PRODUCT CATEGORY": productCategory
          });
        if (error) throw error;
      }
      setIsConfirmOpen(false);
      setIsModalOpen(false);
      fetchProducts(searchTerm, currentPage);
      toast.success(editingProduct ? 'Product updated successfully!' : 'Product added successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setConfirmAction('delete');
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    setIsSaving(true);
    try {
      const { error } = await bhs_supabas
        .from('bhs_PRODUCTS')
        .delete()
        .eq('ID', itemToDelete);
      if (error) throw error;
      fetchProducts(searchTerm, currentPage);
      toast.success('Product deleted successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete product');
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const handleExportExcel = async () => {
    setIsSaving(true);
    try {
      let allData: any[] = [];
      let start = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await bhs_supabas
          .from('bhs_PRODUCTS')
          .select('*')
          .order('PRODUCT NAME')
          .range(start, start + step - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          start += step;
        } else {
          hasMore = false;
        }

        if (data && data.length < step) {
          hasMore = false;
        }
      }

      const exportData = allData.map((p: any) => ({
        'ID': p.ID,
        'PRODUCT ID': p['PRODUCT ID'],
        'PRODUCT BARCODE': p['PRODUCT BARCODE'],
        'PRODUCT NAME': p['PRODUCT NAME'],
        'PRODUCT CATEGORY': p['PRODUCT CATEGORY'],
        'ITEM CODE': p['ITEM CODE']
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      XLSX.writeFile(wb, `Products_Database_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Database exported successfully!');
    } catch (err: any) {
      toast.error('Failed to export data: ' + err.message);
    } finally {
      setIsSaving(false);
    }
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
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error('The uploaded Excel file is empty.');
        return;
      }

      // Map JSON to match the database columns
      const formattedData = jsonData.map(row => ({
        ID: row['ID'] || undefined,
        "PRODUCT NAME": row['PRODUCT NAME'] || '',
        "PRODUCT BARCODE": row['PRODUCT BARCODE'] || '',
        "PRODUCT ID": row['PRODUCT ID'] || '',
        "ITEM CODE": row['ITEM CODE'] ? Number(row['ITEM CODE']) : null,
        "PRODUCT CATEGORY": row['PRODUCT CATEGORY'] || ''
      })).filter(row => row["PRODUCT NAME"] && row.ID);

      if (formattedData.length === 0) {
        toast.error('No valid products found in the file. Make sure ID and PRODUCT NAME exist.');
        return;
      }

      const chunkSize = 500;
      for (let i = 0; i < formattedData.length; i += chunkSize) {
        const chunk = formattedData.slice(i, i + chunkSize);
        const { error } = await bhs_supabas
          .from('bhs_PRODUCTS')
          .upsert(chunk, { onConflict: 'ID' });

        if (error) throw error;
      }

      toast.success(`Successfully imported ${formattedData.length} products!`);
      fetchProducts(searchTerm, currentPage);
    } catch (err: any) {
      toast.error('Failed to import data: ' + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = products;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">Products</h1>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {canEdit && (
            <>
              <button
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
                onClick={() => handleOpenModal()}
                className="p-4 bg-black text-[#D4AF37] rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center"
                title="New Product"
              >
                <Plus className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, barcode, ID, or item code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[1200px]">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-6 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-24">ID</th>
                <th className="px-6 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[35%]">Product Name</th>
                <th className="px-6 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-48">Barcode</th>
                <th className="px-6 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[20%]">Category</th>
                <th className="px-6 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-32">Item Code</th>
                <th className="px-6 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6">
                      <div className="h-8 bg-gray-50 rounded-xl w-full"></div>
                    </td>
                  </tr>
                ))
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center">
                    <NoData title="NO PRODUCTS FOUND" />
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr key={product.ID} className="group hover:bg-gray-50/50 transition-all duration-300">
                    <td className="px-8 py-6 text-center">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{product.ID}</span>
                    </td>
                    <td className="px-6 py-6 text-center overflow-hidden">
                      <div className="flex items-center justify-center gap-3 w-full">
                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-black/5">
                          <Package className="w-5 h-5 text-[#D4AF37]" />
                        </div>
                        <span className="font-bold text-black truncate" title={product["PRODUCT NAME"]}>{product["PRODUCT NAME"]}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        <Barcode className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium font-mono tracking-widest">{product["PRODUCT BARCODE"]}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center overflow-hidden">
                      <span
                        className="text-xs font-bold text-gray-600 px-3 py-1 bg-gray-100 rounded-lg whitespace-nowrap truncate inline-block max-w-full"
                        title={product["PRODUCT CATEGORY"] || ''}
                      >
                        {product["PRODUCT CATEGORY"] || '—'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      {product["ITEM CODE"] != null ? (
                        <span className="inline-flex items-center px-3 py-1 bg-[#D4AF37]/10 text-[#B8960C] text-xs font-black font-mono rounded-lg tracking-widest">
                          {product["ITEM CODE"]}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        {canEdit && (
                          <button onClick={() => handleOpenModal(product)} className="p-2.5 hover:bg-white hover:shadow-sm rounded-xl text-gray-400 hover:text-black transition-all border border-transparent hover:border-gray-100">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(product.ID)} className="p-2.5 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-white px-8 py-6 rounded-3xl border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm mt-6">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Showing <span className="text-black font-black">{startIndex + 1}</span> to{" "}
            <span className="text-black font-black">
              {Math.min(startIndex + itemsPerPage, totalCount)}
            </span>{" "}
            of <span className="text-black font-black">{totalCount}</span> products
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 hover:text-black hover:border-black disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-100 transition-all"
              title="Previous Page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;

                return (
                  <div key={p} className="flex items-center gap-2">
                    {showEllipsis && <span className="text-xs text-gray-400 font-bold px-1">...</span>}
                    <button
                      onClick={() => setCurrentPage(p)}
                      className={`w-10 h-10 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${currentPage === p
                        ? 'bg-black text-[#D4AF37] shadow-lg shadow-black/10'
                        : 'bg-gray-50 text-gray-400 hover:text-black border border-gray-100 hover:border-black'
                        }`}
                    >
                      {p}
                    </button>
                  </div>
                );
              })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 hover:text-black hover:border-black disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-100 transition-all"
              title="Next Page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{editingProduct ? 'Edit Product' : 'New Product'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">PRODUCT ID</label>
                  <input
                    type="text"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    placeholder="Internal SKU or ID"
                    required
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">PRODUCT NAME</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Classic Gold Fountain Pen"
                    required
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                  />
                </div>                 <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">BARCODE</label>
                  <div className="relative">
                    <Barcode className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Barcode..."
                      required
                      className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">PRODUCT CATEGORY</label>
                  <input
                    type="text"
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    placeholder="e.g. ELECTRONICS"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">ITEM CODE</label>
                  <input
                    type="number"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="e.g. 1001"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-4 bg-black text-[#D4AF37] rounded-2xl font-bold shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  SAVE PRODUCT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        onConfirm={executeDelete}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={isSaving}
        title="Confirm Deletion"
        message="Are you sure you want to delete this product? This action cannot be undone."
      />
    </div>
  );
}
