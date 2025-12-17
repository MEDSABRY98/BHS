'use client';

import React, { useState, useEffect } from 'react';
import { Package, Layers, Calculator, Loader2, Search, Edit2, Save, X, Check } from 'lucide-react';
import Loading from './Loading';

interface InventoryItem {
  rowIndex: number;
  barcode: string;
  itemCode: string;
  productName: string;
  type: string;
  qtyInPack: number;
  qtyInCartoon: number;
  weight: string;
  size: string;
}

interface AnalyzedProduct {
  original: InventoryItem;
  baseName: string;
  isOffer: boolean;
  pcsPerUnit: number;
  qtyInCartoon: number;
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Q IN P (Qty in Pack)</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  value={formData.qtyInPack}
                  onChange={(e) => handleChange('qtyInPack', parseInt(e.target.value) || 0)}
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Q IN C (Qty in Cartoon)</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  value={formData.qtyInCartoon}
                  onChange={(e) => handleChange('qtyInCartoon', parseInt(e.target.value) || 0)}
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  value={formData.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                />
             </div>
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
    const qtyInPackFromSheet = product.qtyInPack;
    const qtyInCartoon = product.qtyInCartoon;
    
    // Construct specs from sheet data
    const parts = [];
    if (product.weight) parts.push(product.weight);
    if (product.size) parts.push(product.size);
    const specsFromSheet = parts.join(', ');

    const lowerName = productName.toLowerCase();
    const isOffer = lowerName.includes('offer');
    
    // Attempt to parse quantity from name (fallback or verification)
    const pcsMatch = productName.match(/(\d+)\s*pcs/i);
    const xMatch = productName.match(/x\s*(\d+)/i);
    const bpMatch = productName.match(/BP\s*-?\s*(\d+)/i);
    
    let parsedPcs = 1;
    if (pcsMatch) {
      parsedPcs = parseInt(pcsMatch[1]);
    } else if (bpMatch) {
      parsedPcs = parseInt(bpMatch[1]);
    } else if (xMatch && isOffer) {
      parsedPcs = parseInt(xMatch[1]);
    }

    let pcsPerUnit = qtyInPackFromSheet;
    
    // Base Name cleaning
    let baseName = productName
      .replace(/\d+\s*pcs/gi, '')
      .replace(/offer/gi, '')
      .replace(/x\s*(\d+)/gi, '')
      .replace(/BP\s*-?\s*\d+/gi, '')
      .replace(/PW/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Specs extraction (regex)
    const specs = [];
    if (specsFromSheet) {
        specs.push(specsFromSheet);
    } else {
        // Fallback to regex specs if string input or no sheet specs
        const sizeMatch = productName.match(/(\d+cm\s*[xX×]\s*\d+cm)/gi);
        const weightMatch = productName.match(/(\d+(?:\.\d+)?(?:g|gm|kg|sq\.ft))/gi);
        const modelMatch = productName.match(/(CR\d+|LR\d+|AAA|AA)/gi);
        
        if (modelMatch) specs.push(...modelMatch);
        if (sizeMatch) specs.push(...sizeMatch);
        if (weightMatch) specs.push(...weightMatch);
        
        if (bpMatch) {
            specs.push(`BP-${bpMatch[1]}`);
        }
    }
    
    const isPack = pcsPerUnit > 1;
    let packType = 'Single';
    if (bpMatch) packType = 'Blister Pack';
    else if (isOffer) packType = 'Offer';
    else if (isPack) packType = 'Pack';

    return {
      original: product,
      baseName,
      isOffer,
      pcsPerUnit,
      qtyInCartoon,
      specs: specs.join(', '),
      type: isPack ? 'Pack/Offer' : 'Single',
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
    
    return (
      originalName.toLowerCase().includes(query) ||
      p.baseName.toLowerCase().includes(query) ||
      barcode.toLowerCase().includes(query) ||
      itemCode.toLowerCase().includes(query) ||
      p.specs.toLowerCase().includes(query)
    );
  });

  const calculateTotalPieces = (productIndex: number) => {
    const qty = purchaseQty[productIndex] || 0;
    const product = analyzedProducts[productIndex];
    if (!product) return 0;
    // Calculation changed to use Q IN C (qtyInCartoon) as requested
    return qty * (product.qtyInCartoon || 0);
  };
  
  // Separate helper for Summary Pack Pieces (uses Q IN P)
  const calculatePackPieces = (productIndex: number) => {
    const qty = purchaseQty[productIndex] || 0;
    const product = analyzedProducts[productIndex];
    if (!product) return 0;
    return qty * product.pcsPerUnit;
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

          {/* Summary */}
          <div className="mt-4 border border-gray-200 rounded-xl p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Summary</h3>
            <div className="grid grid-cols-5 gap-2">
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm text-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Products</div>
                <div className="text-2xl font-bold text-gray-900">{products.length}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm text-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Singles</div>
                <div className="text-2xl font-bold text-gray-900">
                  {analyzedProducts.filter(p => p.pcsPerUnit <= 1).length}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm text-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Offers</div>
                <div className="text-2xl font-bold text-gray-900">
                  {analyzedProducts.filter(p => p.pcsPerUnit > 1).length}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm text-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total Pieces (Pack)</div>
                <div className="text-2xl font-bold text-gray-900">
                  {Object.keys(purchaseQty).reduce((sum, idx) => sum + calculatePackPieces(parseInt(idx)), 0)}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm text-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total Pieces (Carton)</div>
                <div className="text-2xl font-bold text-gray-900">
                  {Object.keys(purchaseQty).reduce((sum, idx) => {
                     const qty = purchaseQty[parseInt(idx)] || 0;
                     const product = analyzedProducts[parseInt(idx)];
                     return sum + (qty * (product.qtyInCartoon || 0));
                  }, 0)}
                </div>
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
              placeholder="Search by product name, barcode, item code, or specs..."
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
                  <th className="px-4 py-4 text-left">#</th>
                  <th className="px-4 py-4 text-left w-24">Barcode</th>
                  <th className="px-4 py-4 text-left">Product Name</th>
                  <th className="px-4 py-4 text-center w-24">Type</th>
                  <th className="px-4 py-4 text-center w-24">Q IN P</th>
                  <th className="px-4 py-4 text-center w-24">Q IN C</th>
                  <th className="px-4 py-4 text-left w-32">Specs (W/S)</th>
                  <th className="px-4 py-4 text-center w-28">Purchase Qty</th>
                  <th className="px-4 py-4 text-center">Total Pieces</th>
                  <th className="px-4 py-4 text-center w-16">Edit</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, idx) => {
                  const originalIndex = analyzedProducts.indexOf(product);

                  return (
                  <tr key={originalIndex} className={`border-b hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-3 text-gray-600 font-semibold">{originalIndex + 1}</td>
                    
                    {/* Barcode */}
                    <td className="px-4 py-3 text-gray-800 font-mono text-sm">
                        {product.original.barcode || '-'}
                    </td>

                    {/* Product Name */}
                    <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-800">
                           {product.original.productName}
                        </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 text-center">
                        {product.pcsPerUnit > 1 ? (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-semibold">
                              <Layers className="w-3 h-3" />
                              {product.packType}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                              <Package className="w-3 h-3" />
                              Single
                            </span>
                          )
                      }
                    </td>

                    {/* Q IN P */}
                    <td className="px-4 py-3 text-center">
                        <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg font-bold">
                           {product.pcsPerUnit}
                        </span>
                    </td>

                    {/* Q IN C */}
                    <td className="px-4 py-3 text-center">
                        <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-lg font-bold">
                           {product.qtyInCartoon || '-'}
                        </span>
                    </td>

                    {/* Specs (Weight/Size) */}
                    <td className="px-4 py-3 text-sm text-gray-600">
                           {product.specs || '-'}
                    </td>

                    {/* Purchase Qty (Always Editable) */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        value={purchaseQty[originalIndex] || ''}
                        onChange={(e) => handleQtyChange(originalIndex, parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-2 border-2 border-gray-200 rounded-lg text-center focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        placeholder="0"
                      />
                    </td>

                    {/* Total Pieces */}
                    <td className="px-4 py-3 text-center">
                      {purchaseQty[originalIndex] ? (
                        <div className="flex items-center justify-center gap-2">
                          <Calculator className="w-4 h-4 text-indigo-600" />
                          <span className="text-lg font-bold text-indigo-600">
                            {calculateTotalPieces(originalIndex)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
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
