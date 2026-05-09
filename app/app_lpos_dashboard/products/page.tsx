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
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmAction('save');
    setIsConfirmOpen(true);
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      if (editingProduct) {
        const { error } = await app_lpos_supabase
          .from('app_lpos_PRODUCTS')
          .update({ "PRODUCT NAME": name, "PRODUCT BARCODE": barcode })
          .eq('ID', editingProduct.ID);
        if (error) throw error;
      } else {
        // Simple ID generation for new products
        const nextId = `P-${(products.length + 1).toString().padStart(4, '0')}`;
        const { error } = await app_lpos_supabase
          .from('app_lpos_PRODUCTS')
          .insert({ ID: nextId, "PRODUCT NAME": name, "PRODUCT BARCODE": barcode });
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
    p["PRODUCT BARCODE"]?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">Products</h1>
        </div>
        {canEdit && (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-8 py-4 bg-black text-[#D4AF37] rounded-2xl font-bold text-sm shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="w-5 h-5" />
            NEW PRODUCT
          </button>
        )}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-[2rem] animate-pulse"></div>
          ))
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full">
            <NoData title="NO PRODUCTS FOUND" />
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.ID} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 group hover:border-[#D4AF37]/30 transition-all duration-300 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-black/20" />
                </div>
                <div className="flex gap-1">
                  {canEdit && (
                    <button 
                      onClick={() => handleOpenModal(product)}
                      className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-black transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(product.ID)}
                      className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-lg text-black leading-tight mb-2">{product["PRODUCT NAME"]}</h3>
                <div className="flex items-center gap-2 text-gray-400">
                  <Barcode className="w-3 h-3" />
                  <span className="text-xs font-medium tracking-wider">{product["PRODUCT BARCODE"]}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{product.ID}</span>
                <div className="px-3 py-1 bg-black text-[#D4AF37] text-[10px] font-bold rounded-lg uppercase tracking-wider">
                  Active
                </div>
              </div>
            </div>
          ))
        )}
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
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Product Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Classic Gold Fountain Pen"
                  required
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Product Barcode</label>
                <div className="relative">
                  <Barcode className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="text" 
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Enter unique barcode..."
                    required
                    className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-mono"
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
        onConfirm={confirmAction === 'save' ? executeSave : executeDelete}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={isSaving}
        title={confirmAction === 'save' ? 'Confirm Save' : 'Confirm Deletion'}
        message={confirmAction === 'save' ? 'Are you sure you want to save these changes?' : 'Are you sure you want to delete this product? This action cannot be undone.'}
      />
    </div>
  );
}
