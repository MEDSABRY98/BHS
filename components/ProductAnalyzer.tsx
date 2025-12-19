'use client';

import React, { useState, useEffect } from 'react';
import { Package, Layers, Calculator, Loader2, Search, Edit2, Save, X, Check } from 'lucide-react';
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              value={formData.barcode}
              onChange={(e) => handleChange('barcode', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              value={formData.itemCode}
              onChange={(e) => handleChange('itemCode', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              value={formData.productName}
              onChange={(e) => handleChange('productName', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              value={formData.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Q IN BOX (Qty in Box)</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  value={formData.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6" dir="ltr">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-3 rounded-xl">
                <Package className="w-8 h-8 text-white" />
                </div>
                <div>
                <h1 className="text-3xl font-bold text-gray-800">Inventory Analyzer</h1>
                </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative mt-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Search by product name, barcode, item code, tags, or specs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {error && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                  {error}
              </div>
          )}
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-indigo-600 text-white">
                <tr>
                  <th className="px-4 py-4 text-center">#</th>
                  <th className="px-4 py-4 text-center w-24">Barcode</th>
                  <th className="px-4 py-4 text-center">Product Name</th>
                  <th className="px-4 py-4 text-center">Tags</th>
                  <th className="px-4 py-4 text-center w-40 whitespace-nowrap">Type</th>
                  <th className="px-4 py-4 text-center w-24 whitespace-nowrap">Q IN BOX</th>
                  <th className="px-4 py-4 text-center w-32">Specs (W/S)</th>
                  <th className="px-4 py-4 text-center w-16">Edit</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, idx) => {
                  const originalIndex = analyzedProducts.indexOf(product);

                  return (
                  <tr key={originalIndex} className={`border-b hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-3 text-center text-gray-600 font-semibold">{idx + 1}</td>
                    
                    {/* Barcode */}
                    <td className="px-4 py-3 text-center text-gray-800 font-mono text-sm">
                        {product.original.barcode || '-'}
                    </td>

                    {/* Product Name */}
                    <td className="px-4 py-3 text-center">
                        <div className="text-sm font-medium text-gray-800">
                           {product.original.productName}
                        </div>
                    </td>

                    {/* Tags - Display directly from Google Sheets */}
                    <td className="px-4 py-3 text-center">
                        <div className="text-sm text-gray-700">
                           {product.original.tags || '-'}
                        </div>
                    </td>

                    {/* Type - Display directly from Google Sheets */}
                    <td className="px-4 py-3 text-center">
                        {product.original.type ? (
                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
                              {product.original.type}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )
                      }
                    </td>

                    {/* Q IN BOX - Display directly from Google Sheets */}
                    <td className="px-4 py-3 text-center">
                        <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg font-bold">
                           {product.original.qtyInBox || '-'}
                        </span>
                    </td>

                    {/* Specs (Weight/Size) */}
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                           {product.specs || '-'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => openEditModal(product.original)}
                          className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
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
