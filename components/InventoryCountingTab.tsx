'use client';

import React, { useState, useEffect } from 'react';
import { Search, Package, CheckCircle, XCircle, ArrowRight, Barcode, Box, Hash, Loader2, X, AlertCircle } from 'lucide-react';
import Loading from './Loading';

interface Product {
  id: number;
  rowIndex: number;
  barcode: string;
  name: string;
  boxCount: number;
  piecesPerBox: number;
  counted: boolean;
  actualCount: number;
}

const InventoryCountingTab = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [currentScreen, setCurrentScreen] = useState<'list' | 'count'>('list');
  const [filterStatus, setFilterStatus] = useState<'all' | 'counted' | 'uncounted'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [countingBarcode, setCountingBarcode] = useState('');
  const [qtyInBoxInput, setQtyInBoxInput] = useState('');
  const [boxInput, setBoxInput] = useState('');
  const [pieceInput, setPieceInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/inventory-counting');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to fetch data');
      }

      // Transform data from Google Sheets to Product format
      const transformedProducts: Product[] = result.data.map((item: any, index: number) => ({
        id: index + 1,
        rowIndex: item.rowIndex,
        barcode: item.barcode,
        name: item.productName,
        boxCount: 0, // Will be calculated from totalQty and qtyInBox
        piecesPerBox: item.qtyInBox || 0,
        counted: item.totalQty > 0,
        actualCount: item.totalQty || 0,
      }));

      setProducts(transformedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Failed to load products. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesFilter = filterStatus === 'all' || 
      (filterStatus === 'counted' && p.counted) || 
      (filterStatus === 'uncounted' && !p.counted);
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode.includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  const countedProducts = products.filter(p => p.counted).length;
  const totalProducts = products.length;

  const handleBarcodeSearch = () => {
    if (!countingBarcode.trim()) {
      setSearchResults([]);
      return;
    }
    const searchTerm = countingBarcode.toLowerCase().trim();
    const results = products.filter(p => 
      p.barcode.includes(countingBarcode) || 
      p.name.toLowerCase().includes(searchTerm)
    );
    setSearchResults(results);
  };

  const selectProduct = (product: Product) => {
    setSelectedProduct(product);
    setQtyInBoxInput(product.piecesPerBox.toString());
    setBoxInput('');
    setPieceInput('');
    setSearchResults([]);
    setCountingBarcode(product.barcode);
  };

  const calculateTotal = () => {
    const boxes = parseInt(boxInput) || 0;
    const pieces = parseInt(pieceInput) || 0;
    const perBox = parseInt(qtyInBoxInput) || (selectedProduct ? selectedProduct.piecesPerBox : 0);
    return (boxes * perBox) + pieces;
  };

  const saveCount = async () => {
    if (!selectedProduct) return;
    
    // Validate QTY IN BOX - must be greater than 0
    const qtyInBox = parseInt(qtyInBoxInput) || 0;
    if (qtyInBox <= 0) {
      setErrorMessage('دخل عدد البوكس الواحد');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }
    
    setErrorMessage('');
    
    const newCount = calculateTotal();
    const boxes = parseInt(boxInput) || 0;
    
    // Get current total from Google Sheets and add new count
    const currentTotal = selectedProduct.actualCount || 0;
    const totalQty = currentTotal + newCount;
    
    try {
      setSaving(true);
      
      // Update in Google Sheets
      const response = await fetch('/api/inventory-counting/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex: selectedProduct.rowIndex,
          barcode: selectedProduct.barcode,
          productName: selectedProduct.name,
          qtyInBox: qtyInBox,
          totalQty: totalQty,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to save');
      }

      // Update local state
      setProducts(products.map(p => 
        p.id === selectedProduct.id 
          ? { ...p, counted: true, actualCount: totalQty, boxCount: boxes, piecesPerBox: qtyInBox }
          : p
      ));
      
      setSelectedProduct(null);
      setCountingBarcode('');
      setQtyInBoxInput('');
      setBoxInput('');
      setPieceInput('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error saving count:', error);
      alert('Failed to save count. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading message="Loading Inventory..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 p-6">
      {/* Error Message Toast */}
      {errorMessage && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-5">
          <div className="bg-red-50 border-2 border-red-200 rounded-xl shadow-lg p-4 flex items-center gap-3 max-w-md">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-700 font-medium flex-1">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage('')}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-lg rounded-xl mb-6">
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 mb-4">
              <Package className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-800">Inventory Counting</h1>
            </div>
            
            {/* Screen Toggle */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCurrentScreen('list')}
                className={`py-3 px-6 rounded-xl font-semibold transition-all ${
                  currentScreen === 'list'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                View List
              </button>
              <button
                onClick={() => setCurrentScreen('count')}
                className={`py-3 px-6 rounded-xl font-semibold transition-all ${
                  currentScreen === 'count'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Enter Count
              </button>
            </div>
          </div>
        </div>
        {/* List Screen */}
        {currentScreen === 'list' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="lg:col-span-2 relative">
                  <Search className="absolute left-4 top-4 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by name or barcode..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none shadow-sm text-base"
                  />
                </div>
                
                {/* Filters */}
                <div className="lg:col-span-2 grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`py-3 px-4 rounded-xl font-medium transition-all ${
                      filterStatus === 'all'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterStatus('counted')}
                    className={`py-3 px-4 rounded-xl font-medium transition-all ${
                      filterStatus === 'counted'
                        ? 'bg-green-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Counted
                  </button>
                  <button
                    onClick={() => setFilterStatus('uncounted')}
                    className={`py-3 px-4 rounded-xl font-medium transition-all ${
                      filterStatus === 'uncounted'
                        ? 'bg-red-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Pending
                  </button>
                </div>
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-800 text-lg">{product.name}</h3>
                        {product.counted ? (
                          <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                        <Barcode className="w-4 h-4" />
                        <span className="font-mono">{product.barcode}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Box className="w-4 h-4" />
                      <span>{product.piecesPerBox} pcs/box</span>
                    </div>
                    <div>
                      {product.counted ? (
                        <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold text-sm">
                          {product.actualCount} pcs
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm font-medium">Not counted</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Count Screen */}
        {currentScreen === 'count' && (
          <div className="flex justify-center items-center min-h-[60vh]">
            {!selectedProduct ? (
              /* Search Section - Centered */
              <div className="w-full max-w-2xl mx-auto space-y-6">
                {/* Barcode Input */}
                <div className="bg-white rounded-2xl shadow-md p-6">
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <Barcode className="w-5 h-5" />
                    Scan or Enter Barcode
                  </label>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={countingBarcode}
                      onChange={(e) => {
                        setCountingBarcode(e.target.value);
                        setSearchResults([]);
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                      placeholder="Enter partial or full barcode or product name"
                      className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none font-mono text-lg text-center tracking-wider"
                    />
                    <button
                      onClick={handleBarcodeSearch}
                      className="w-full bg-indigo-600 text-white py-4 rounded-xl hover:bg-indigo-700 transition-colors font-bold text-base shadow-lg"
                    >
                      Search Product
                    </button>
                  </div>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-md p-6 space-y-3">
                    <p className="text-sm font-bold text-gray-700 mb-3">Select Product ({searchResults.length} found)</p>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {searchResults.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => selectProduct(product)}
                          className="w-full text-left bg-slate-50 hover:bg-indigo-50 p-4 rounded-xl transition-colors border-2 border-transparent hover:border-indigo-300"
                        >
                          <div className="font-bold text-gray-800 mb-1">{product.name}</div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Barcode className="w-3.5 h-3.5" />
                            <span className="font-mono">{product.barcode}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <Box className="w-3.5 h-3.5" />
                            <span>{product.piecesPerBox} pcs/box</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchResults.length === 0 && (
                  <div className="bg-white rounded-2xl shadow-md p-12 text-center">
                    <Package className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-400 text-lg">Enter barcode or product name to start counting</p>
                  </div>
                )}
              </div>
            ) : (
              /* Selected Product Section - Centered */
              <div className="w-full max-w-2xl mx-auto space-y-6">
                {/* Back to Search Button */}
                <div className="flex justify-start">
                  <button
                    onClick={() => {
                      setSelectedProduct(null);
                      setCountingBarcode('');
                      setQtyInBoxInput('');
                      setBoxInput('');
                      setPieceInput('');
                      setSearchResults([]);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    Search Again
                  </button>
                </div>

                {/* Selected Product Info */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
                  <div className="flex items-start gap-4">
                    <Package className="w-8 h-8 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-bold text-2xl mb-3">{selectedProduct.name}</h3>
                      <div className="flex items-center gap-2 text-sm opacity-90 mb-2">
                        <Barcode className="w-4 h-4" />
                        <span className="font-mono">{selectedProduct.barcode}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm opacity-90">
                        <Box className="w-4 h-4" />
                        <span>{selectedProduct.piecesPerBox} pieces per box</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input Fields */}
                <div className="bg-white rounded-2xl shadow-md p-4">
                  <label className="block text-sm font-bold text-gray-700 mb-3">Enter Quantity</label>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-2">
                        <Box className="w-3.5 h-3.5" />
                        QTY IN BOX
                      </label>
                      <input
                        type="number"
                        value={qtyInBoxInput}
                        onChange={(e) => setQtyInBoxInput(e.target.value)}
                        min="0"
                        className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-center text-2xl font-bold"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-2">
                        <Box className="w-3.5 h-3.5" />
                        Boxes
                      </label>
                      <input
                        type="number"
                        value={boxInput}
                        onChange={(e) => setBoxInput(e.target.value)}
                        min="0"
                        className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-center text-2xl font-bold"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5" />
                        Loose Pieces
                      </label>
                      <input
                        type="number"
                        value={pieceInput}
                        onChange={(e) => setPieceInput(e.target.value)}
                        min="0"
                        className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-center text-2xl font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Calculation */}
                <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl shadow-lg p-4 text-white">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-sm opacity-90">Total:</span>
                    <span className="text-sm opacity-90">
                      ({boxInput || 0} × {parseInt(qtyInBoxInput) || selectedProduct.piecesPerBox}) + {pieceInput || 0}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                    <p className="text-3xl font-bold">
                      {calculateTotal()}
                    </p>
                    <span className="text-base font-medium">pcs</span>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={saveCount}
                  disabled={saving}
                  className="w-full bg-green-600 text-white py-5 rounded-2xl hover:bg-green-700 transition-colors font-bold text-lg shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-6 h-6" />
                      Save Count
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryCountingTab;

