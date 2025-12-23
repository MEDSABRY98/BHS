'use client';

import React, { useState, useEffect } from 'react';
import { Package, Layers, Calculator, Loader2, Search, Edit2, Save, X, Check, ArrowLeft } from 'lucide-react';
import Loading from './Loading';

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
    <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold text-gray-800">Edit Product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.barcode}
              onChange={(e) => handleChange('barcode', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.itemCode}
              onChange={(e) => handleChange('itemCode', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.productName}
              onChange={(e) => handleChange('productName', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Q IN BOX (Qty in Box)</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={formData.qtyInBox}
                  onChange={(e) => handleChange('qtyInBox', parseInt(e.target.value) || 0)}
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={formData.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={formData.size}
                  onChange={(e) => handleChange('size', e.target.value)}
                />
             </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductAnalyzer = () => {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseQty, setPurchaseQty] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
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
      
      if (!res.ok) {
        throw new Error(json.details || json.error || 'Failed to fetch inventory');
      }

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
    // Use only data from Google Sheets - no parsing from product name
    const qtyInBox = product.qtyInBox || 0;
    const typeFromSheet = product.type || ''; // TYPE column from sheet
    
    // Construct specs ONLY from sheet data (Weight and Size columns)
    const parts = [];
    if (product.weight) parts.push(product.weight);
    if (product.size) parts.push(product.size);
    const specsFromSheet = parts.join(', ');

    // Determine if offer based ONLY on TYPE column from Google Sheets
    const lowerType = typeFromSheet.toLowerCase();
    const isOffer = lowerType.includes('offer');
    
    // Base Name - keep original name or clean it for display (this is just for UI)
    let baseName = productName.trim();
    
    // Specs - use ONLY from Google Sheets (Weight and Size columns)
    const specs = specsFromSheet;
    
    // Determine pack type based on TYPE column from sheet
    let packType = 'Single';
    
    // Check TYPE column from sheet
    if (lowerType.includes('blister') || lowerType.includes('bp')) {
      packType = 'Blister Pack';
    } else if (lowerType.includes('offer')) {
      packType = 'Offer';
    } else if (lowerType.includes('pack')) {
      packType = 'Pack';
    }

    return {
      original: product,
      baseName,
      isOffer,
      qtyInBox,
      specs: specs || '-', // Show '-' if no specs from sheet
      type: typeFromSheet || 'Single',
      packType
    };
  };

  const analyzedProducts = products.map(p => analyzeProduct(p));

  const filteredProducts = analyzedProducts.filter(p => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    
    const originalName = p.original.productName;
    const barcode = p.original.barcode;
    const itemCode = p.original.itemCode;
    const tags = p.original.tags || '';
    
    return (
      originalName.toLowerCase().includes(query) ||
      p.baseName.toLowerCase().includes(query) ||
      barcode.toLowerCase().includes(query) ||
      itemCode.toLowerCase().includes(query) ||
      tags.toLowerCase().includes(query) ||
      p.specs.toLowerCase().includes(query)
    );
  });

  const calculateTotalPieces = (productIndex: number) => {
    const qty = purchaseQty[productIndex] || 0;
    const product = analyzedProducts[productIndex];
    if (!product) return 0;
    // Calculation uses Q IN BOX (qtyInBox) from Google Sheets
    return qty * (product.qtyInBox || 0);
  };
  
  const handleQtyChange = (originalIndex: number, val: number) => {
      setPurchaseQty(prev => ({...prev, [originalIndex]: val}));
  };

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      if (!res.ok) {
        throw new Error('Failed to update');
      }

      // Update local state
      setProducts(prev => prev.map(p => p.rowIndex === updatedData.rowIndex ? updatedData : p));
      closeEditModal();
    } catch (error) {
      console.error('Failed to save edit:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && products.length === 0) {
    return <Loading message="Loading Inventory..." />;
  }

  return (
    <div className="min-h-screen bg-white" dir="ltr">
      <div className="max-w-7xl mx-auto pt-6 pb-6">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.href = '/'}
                className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to Home"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Inventory Analyzer</h1>
              </div>
            </div>
            {filteredProducts.length > 0 && (
              <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                <span className="text-blue-700 font-semibold">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'}
                </span>
              </div>
            )}
          </div>

          {/* Search Box */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all sm:text-sm"
              placeholder="Search by product name, barcode, item code, tags, or specs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border-2 border-red-200 animate-in fade-in">
              <div className="flex items-center gap-2">
                <X className="w-5 h-5" />
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium">
                {searchQuery ? 'No products found matching your search' : 'No products available'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-center font-semibold text-sm uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-center font-semibold text-sm uppercase tracking-wider w-32">Barcode</th>
                    <th className="px-6 py-4 text-center font-semibold text-sm uppercase tracking-wider">Product Name</th>
                    <th className="px-6 py-4 text-center font-semibold text-sm uppercase tracking-wider">Tags</th>
                    <th className="px-6 py-4 text-center font-semibold text-sm uppercase tracking-wider w-40 whitespace-nowrap">Type</th>
                    <th className="px-6 py-4 text-center font-semibold text-sm uppercase tracking-wider w-28 whitespace-nowrap">Q IN BOX</th>
                    <th className="px-6 py-4 text-center font-semibold text-sm uppercase tracking-wider w-40">Specs (W/S)</th>
                    <th className="px-6 py-4 text-center font-semibold text-sm uppercase tracking-wider w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProducts.map((product, idx) => {
                    const originalIndex = analyzedProducts.indexOf(product);

                    return (
                      <tr 
                        key={originalIndex} 
                        className={`hover:bg-blue-50/50 transition-all duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                      >
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full font-semibold text-sm">
                            {idx + 1}
                          </span>
                        </td>
                        
                        {/* Barcode */}
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block bg-gray-100 text-gray-800 font-mono text-xs px-3 py-1.5 rounded-lg border border-gray-200">
                            {product.original.barcode || '-'}
                          </span>
                        </td>

                        {/* Product Name */}
                        <td className="px-6 py-4 text-center">
                          <div className="text-sm font-semibold text-gray-800">
                            {product.original.productName}
                          </div>
                          {product.original.itemCode && (
                            <div className="text-xs text-gray-500 mt-1">Code: {product.original.itemCode}</div>
                          )}
                        </td>

                        {/* Tags */}
                        <td className="px-6 py-4 text-center">
                          {product.original.tags ? (
                            <span className="inline-block bg-cyan-100 text-cyan-700 px-3 py-1 rounded-lg text-xs font-medium">
                              {product.original.tags}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>

                        {/* Type */}
                        <td className="px-6 py-4 text-center">
                          {product.original.type ? (
                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm">
                              {product.original.type}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>

                        {/* Q IN BOX */}
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-12 h-10 bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold text-sm shadow-sm border border-blue-200">
                            {product.original.qtyInBox || '-'}
                          </span>
                        </td>

                        {/* Specs (Weight/Size) */}
                        <td className="px-6 py-4 text-center">
                          {product.specs && product.specs !== '-' ? (
                            <span className="inline-block bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-xs font-medium border border-amber-200">
                              {product.specs}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => openEditModal(product.original)}
                            className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-150"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Edit Modal */}
      <EditModal
        isOpen={isModalOpen}
        onClose={closeEditModal}
        onSave={saveEdit}
        data={modalData}
        isSaving={isSaving}
      />
    </div>
  );
};

export default ProductAnalyzer;
