'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
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
  MoreVertical
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import NoData from '@/components/01-Unified/NoDataTab';
import { usePermissions } from '../hooks/usePermissions';
import { ExcelUploadButton } from '../components/ExcelUploadButton';

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

  // Form states
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [productId, setProductId] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const { data, error } = await app_lpos_supabase
        .from('app_lpos_PRODUCTS')
        .select('*')
        .order('PRODUCT NAME');
      if (error) throw error;
      setProducts(data || []);
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
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave();
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      if (editingProduct) {
        const { error } = await app_lpos_supabase
          .from('app_lpos_PRODUCTS')
          .update({ 
            "PRODUCT NAME": name, 
            "PRODUCT BARCODE": barcode,
            "PRODUCT ID": productId
          })
          .eq('ID', editingProduct.ID);
        if (error) throw error;
      } else {
        // Simple ID generation for new products
        const nextId = `P-${(products.length + 1).toString().padStart(4, '0')}`;
        const { error } = await app_lpos_supabase
          .from('app_lpos_PRODUCTS')
          .insert({ 
            ID: nextId, 
            "PRODUCT NAME": name, 
            "PRODUCT BARCODE": barcode,
            "PRODUCT ID": productId
          });
        if (error) throw error;
      }
      setIsConfirmOpen(false);
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
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
      const { error } = await app_lpos_supabase
        .from('app_lpos_PRODUCTS')
        .delete()
        .eq('ID', itemToDelete);
      if (error) throw error;
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const filteredProducts = products.filter(p => 
    p["PRODUCT NAME"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p["PRODUCT BARCODE"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p["PRODUCT ID"]?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">Products</h1>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {canEdit && (
            <>
              <ExcelUploadButton type="products" onSuccess={fetchProducts} />
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
            placeholder="Search by product name or barcode..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-32">ID</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Product Name</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-64">Barcode</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-40">Status</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-6">
                      <div className="h-8 bg-gray-50 rounded-xl w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center">
                    <NoData title="NO PRODUCTS FOUND" />
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.ID} className="group hover:bg-gray-50/50 transition-all duration-300">
                    <td className="px-8 py-6 text-center">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{product.ID}</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-black/20" />
                        </div>
                        <span className="font-bold text-black">{product["PRODUCT NAME"]}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        <Barcode className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium font-mono tracking-widest">{product["PRODUCT BARCODE"]}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-flex items-center px-3 py-1 bg-black text-[#D4AF37] text-[10px] font-black uppercase tracking-widest rounded-lg">
                        Active
                      </div>
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
                </div>

                <div className="space-y-2">
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
