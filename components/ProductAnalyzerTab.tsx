'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Search, Edit2, Save, X, ArrowLeft,
  ChevronLeft, ChevronRight, Filter, Box,
  Tag, Layers, Zap, MoreVertical
} from 'lucide-react';
import Loading from './Loading';

// --- Interfaces ---
interface InventoryItem {
  rowIndex: number;
  barcode: string;
  itemCode: string;
  productName: string;
  tags: string;
  type: string;
  qtyInBox: number;
  weight: string;
  size: string;
}

interface AnalyzedProduct {
  original: InventoryItem;
  baseName: string;
  isOffer: boolean;
  qtyInBox: number;
  specs: string;
  type: string;
  packType: string;
}

// --- Modern Components ---

const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: 'blue' | 'amber' | 'purple' }) => {
  const styles = {
    blue: {
      bg: 'bg-blue-500/10',
      groupHoverBg: 'group-hover:bg-blue-500/20',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      shadow: 'shadow-blue-100'
    },
    amber: {
      bg: 'bg-amber-500/10',
      groupHoverBg: 'group-hover:bg-amber-500/20',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      shadow: 'shadow-amber-100'
    },
    purple: {
      bg: 'bg-purple-500/10',
      groupHoverBg: 'group-hover:bg-purple-500/20',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      shadow: 'shadow-purple-100'
    }
  };

  const currentStyle = styles[color];

  return (
    <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16 transition-all ${currentStyle.bg} ${currentStyle.groupHoverBg}`}></div>
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-1">{title}</p>
          <h3 className="text-4xl font-black text-gray-800 tracking-tight">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg ${currentStyle.iconBg} ${currentStyle.iconColor} ${currentStyle.shadow}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

const Badge = ({ children, color }: { children: React.ReactNode, color: 'blue' | 'purple' | 'green' | 'amber' | 'cyan' | 'slate' }) => {
  const colorStyles = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${colorStyles[color]} shadow-sm whitespace-nowrap`}>
      {children}
    </span>
  );
};

// --- Edit Modal (Glassmorphism) ---
const EditModal = ({
  isOpen,
  onClose,
  onSave,
  data,
  isSaving
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InventoryItem) => void;
  data: InventoryItem | null;
  isSaving: boolean;
}) => {
  const [formData, setFormData] = useState<InventoryItem | null>(null);

  useEffect(() => {
    setFormData(data);
  }, [data]);

  if (!isOpen || !formData) return null;

  const handleChange = (field: keyof InventoryItem, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20 relative animate-in zoom-in-95 duration-200">

        {/* Modal Header */}
        <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Edit Product</h2>
            <p className="text-gray-500 text-sm mt-1">Refine product details and specifications</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Product Name</label>
              <input
                type="text"
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-lg font-semibold text-gray-800 focus:border-blue-500 focus:ring-0 transition-all placeholder-gray-300"
                value={formData.productName}
                onChange={(e) => handleChange('productName', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Barcode</label>
              <input
                type="text"
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-mono text-sm text-gray-700 focus:border-blue-500 focus:ring-0 transition-all"
                value={formData.barcode}
                onChange={(e) => handleChange('barcode', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Item Code</label>
              <input
                type="text"
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-mono text-sm text-gray-700 focus:border-blue-500 focus:ring-0 transition-all"
                value={formData.itemCode}
                onChange={(e) => handleChange('itemCode', e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tags (Keywords)</label>
              <input
                type="text"
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 focus:border-blue-500 focus:ring-0 transition-all"
                value={formData.tags}
                onChange={(e) => handleChange('tags', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Type / Category</label>
              <input
                type="text"
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 focus:border-blue-500 focus:ring-0 transition-all"
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Qty In Box</label>
              <input
                type="number"
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-blue-600 focus:border-blue-500 focus:ring-0 transition-all"
                value={formData.qtyInBox}
                onChange={(e) => handleChange('qtyInBox', parseInt(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Weight</label>
              <input
                type="text"
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 focus:border-blue-500 focus:ring-0 transition-all"
                value={formData.weight}
                onChange={(e) => handleChange('weight', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Size</label>
              <input
                type="text"
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 focus:border-blue-500 focus:ring-0 transition-all"
                value={formData.size}
                onChange={(e) => handleChange('size', e.target.value)}
              />
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-all"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            disabled={isSaving}
          >
            {isSaving ? 'Saving Changes...' : 'Save Product'}
            {!isSaving && <Save className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---
const ProductAnalyzer = () => {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20; // Reduced page size for better card view

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<InventoryItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/inventory');
      const json = await res.json();

      if (!res.ok) throw new Error(json.details || json.error || 'Failed to fetch inventory');

      setProducts(json.data || []);
      setError(null);
    } catch (err) {
      console.error('Error loading inventory:', err);
      setError('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const analyzeProduct = (product: InventoryItem): AnalyzedProduct => {
    const productName = product.productName;
    const qtyInBox = product.qtyInBox || 0;
    const typeFromSheet = product.type || '';

    const parts = [];
    if (product.weight) parts.push(product.weight);
    if (product.size) parts.push(product.size);
    const specsFromSheet = parts.join(', ');

    const lowerType = typeFromSheet.toLowerCase();
    const isOffer = lowerType.includes('offer');
    const baseName = productName.trim();

    let packType = 'Single';
    if (lowerType.includes('blister') || lowerType.includes('bp')) packType = 'Blister Pack';
    else if (lowerType.includes('offer')) packType = 'Offer';
    else if (lowerType.includes('pack')) packType = 'Pack';

    return {
      original: product,
      baseName,
      isOffer,
      qtyInBox,
      specs: specsFromSheet || '-',
      type: typeFromSheet || 'Single',
      packType
    };
  };

  const analyzedProducts = useMemo(() => products.map(p => analyzeProduct(p)), [products]);

  const filteredProducts = useMemo(() => {
    return analyzedProducts.filter(p => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        p.original.productName.toLowerCase().includes(query) ||
        p.original.barcode.toLowerCase().includes(query) ||
        p.original.itemCode.toLowerCase().includes(query) ||
        (p.original.tags || '').toLowerCase().includes(query)
      );
    });
  }, [analyzedProducts, searchQuery]);

  // No pagination - infinite scroll effectively
  const paginatedProducts = filteredProducts;

  // Sync page reset - keep for safety but effectively unused
  useEffect(() => setCurrentPage(1), [searchQuery]);

  // Stats Logic
  const stats = useMemo(() => {
    const total = products.length;
    const offers = products.filter(p => (p.type || '').toLowerCase().includes('offer')).length;
    const missingDocs = products.filter(p => !p.barcode || !p.qtyInBox).length;
    return { total, offers, missingDocs };
  }, [products]);

  const openEditModal = (item: InventoryItem) => {
    setModalData(item);
    setIsModalOpen(true);
  };

  const closeEditModal = () => {
    setIsModalOpen(false);
    setModalData(null);
  };

  const saveEdit = async (updatedData: InventoryItem) => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/inventory/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (!res.ok) throw new Error('Failed to update');

      setProducts(prev => prev.map(p => p.rowIndex === updatedData.rowIndex ? updatedData : p));
      closeEditModal();
    } catch (error) {
      console.error('Failed to save edit:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && products.length === 0) return <Loading message="Initializing Dashboard..." />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900 pb-12">

      {/* --- Top Navigation Bar --- */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => window.location.href = '/'}
              className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-200">
                <Box className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Inventory</h1>
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">
                {filteredProducts.length} Results
              </span>
            </div>
          </div>


        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">



        {/* --- Search & Controls --- */}
        <div className="flex flex-col gap-4 items-center justify-center mb-10 transition-all">
          <div className="relative w-full max-w-3xl group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-14 pr-4 py-5 bg-white border-none rounded-2xl text-lg font-medium text-slate-700 placeholder-slate-400 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-100 focus:ring-4 focus:ring-blue-100 focus:shadow-xl transition-all text-center"
              placeholder="Search products by name, code, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600"
              >
                <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">ESC</span>
              </button>
            )}
          </div>
        </div>

        {/* --- Product Grid / Table --- */}
        <div className="space-y-4">
          {paginatedProducts.map((product, idx) => (
            <div
              key={product.original.rowIndex}
              className="group bg-white rounded-2xl border border-slate-100 p-5 flex flex-col md:flex-row items-start md:items-center gap-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-blue-100 transition-all duration-300 relative overflow-hidden"
            >
              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                    {product.original.barcode || 'NO BARCODE'}
                  </span>
                  {product.isOffer && (
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase px-2 py-1 rounded-md tracking-wide flex items-center gap-1">
                      <Zap className="w-3 h-3" /> OFFER
                    </span>
                  )}
                  {product.original.tags && (
                    <span className="bg-cyan-50 text-cyan-600 text-[10px] font-bold uppercase px-2 py-1 rounded-md tracking-wide">
                      {product.original.tags.split(',')[0]}
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-bold text-slate-800 truncate group-hover:text-blue-700 transition-colors">
                  {product.original.productName}
                </h3>

                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                  <div className="flex items-center gap-1.5 has-tooltip" title="Item Code">
                    <Layers className="w-4 h-4" />
                    <span className="font-mono">{product.original.itemCode || '---'}</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                  <div className="flex items-center gap-1.5" title="Category / Type">
                    <Tag className="w-4 h-4" />
                    <span>{product.type}</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                  <span>{product.specs}</span>
                </div>
              </div>

              {/* Stats & Action */}
              <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-100 pt-4 md:pt-0 mt-2 md:mt-0">
                <div className="text-center min-w-[80px]">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Qty / Box</div>
                  <div className="text-2xl font-black text-slate-700">{product.qtyInBox || 0}</div>
                </div>

                <div className="w-px h-10 bg-slate-100 hidden md:block"></div>

                <button
                  onClick={() => openEditModal(product.original)}
                  className="p-3 bg-slate-50 text-slate-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all duration-300 transform group-hover:scale-105 shadow-sm hover:shadow-lg hover:shadow-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {paginatedProducts.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-700">No products found</h3>
              <p className="text-slate-500 mt-2">Try adjusting your search terms</p>
            </div>
          )}
        </div>



      </div>

      <EditModal
        isOpen={isModalOpen}
        onClose={closeEditModal}
        onSave={saveEdit}
        data={modalData}
        isSaving={isSaving}
      />
    </div >
  );
};

export default ProductAnalyzer;
