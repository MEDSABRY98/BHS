'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Package, ShoppingCart, Plus, Trash2, Save, FileSpreadsheet,
    AlertCircle, RotateCw, CheckCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Loading from './Loading';

// ... imports ...

export interface ProductOrder {
    productId: string;
    barcode: string;
    productName: string;
    tags: string;
    qtyOnHand: number;
    qtyFreeToUse: number;
    salesQty: number;
}

export interface OrderItem extends ProductOrder {
    orderQty: number;
}

interface Props {
    poNumber: string;
    orderItems: OrderItem[];
    setOrderItems: (items: OrderItem[]) => void;
    setPoNumber: (po: string) => void;
}

export default function ProductOrdersMakeTab({ poNumber, orderItems, setOrderItems, setPoNumber }: Props) {
    const [allProducts, setAllProducts] = useState<ProductOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Product Selection State
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredProducts, setFilteredProducts] = useState<ProductOrder[]>([]);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/inventory/orders');
            const json = await res.json();
            if (!res.ok) throw new Error(json.details || json.error || 'Failed to fetch products');
            setAllProducts(json.data || []);
            setFilteredProducts(json.data || []);
            setError(null);
        } catch (err) {
            console.error('Error loading products:', err);
            setError('Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    // Filter products based on search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredProducts([]);
            return;
        }
        const query = searchQuery.toLowerCase();
        const filtered = allProducts.filter(p =>
            p.productName.toLowerCase().includes(query) ||
            p.barcode.toLowerCase().includes(query) ||
            p.productId.toLowerCase().includes(query) ||
            p.tags.toLowerCase().includes(query)
        );
        // Exclude products already in order
        const orderProductIds = new Set(orderItems.map(item => item.productId));
        setFilteredProducts(filtered.filter(p => !orderProductIds.has(p.productId)).slice(0, 10)); // Limit to 10 suggestions
    }, [searchQuery, allProducts, orderItems]);

    const addToOrder = (product: ProductOrder) => {
        setOrderItems([...orderItems, { ...product, orderQty: 1 }]);
        setSearchQuery(''); // Clear search to reset suggestions
    };

    const removeFromOrder = (productId: string) => {
        setOrderItems(orderItems.filter(item => item.productId !== productId));
    };

    const updateOrderQty = (productId: string, qty: number) => {
        if (qty < 0) return;
        setOrderItems(orderItems.map(item =>
            item.productId === productId ? { ...item, orderQty: qty } : item
        ));
    };

    const handleSaveOrder = async () => {
        if (!poNumber.trim()) {
            alert('Please enter a PO Number');
            return;
        }
        if (orderItems.length === 0) {
            alert('Please add items to the order');
            return;
        }

        try {
            setLoading(true);
            const itemsToSave = orderItems.map(item => ({
                poNumber: poNumber,
                productId: item.productId,
                barcode: item.barcode,
                productName: item.productName,
                qtyOrder: item.orderQty,
                status: 'Pending'
            }));

            const res = await fetch('/api/inventory/make-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: itemsToSave })
            });

            if (!res.ok) throw new Error('Failed to save order');

            // Download Excel after saving
            handleDownloadExcel();

            // Reset
            // Reset
            // alert('Order saved successfully!');
            setOrderItems([]);

            // Generate new PO
            try {
                const res = await fetch('/api/inventory/next-po');
                const data = await res.json();
                if (data.poNumber) setPoNumber(data.poNumber);
            } catch (e) {
                console.error("Failed to refresh PO number", e);
            }

        } catch (err) {
            console.error('Error saving order:', err);
            alert('Failed to save order. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadExcel = () => {
        if (orderItems.length === 0) return;

        const data = orderItems.map(item => ({
            'PO Number': poNumber,
            'Product ID': item.productId,
            'Barcode': item.barcode,
            'Product Name': item.productName,
            'Qty Order': item.orderQty,
            'Status': 'Pending'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Order Details");
        XLSX.writeFile(wb, `${poNumber}.xlsx`);
    };

    if (loading && allProducts.length === 0) return <Loading message="Loading System..." />;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header & Controls */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <ShoppingCart className="w-6 h-6 text-blue-600" />
                            Create New Order
                        </h2>
                        <p className="text-sm text-gray-500">Add products and generate a purchase order</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-600">PO Number:</label>
                        <input
                            type="text"
                            value={poNumber}
                            readOnly
                            className="px-3 py-2 border border-gray-300 bg-gray-100 text-gray-500 rounded-lg focus:ring-0 outline-none font-mono text-sm cursor-not-allowed"
                        />
                    </div>
                </div>

                {/* Search Product */}
                <div className="relative max-w-2xl mx-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search product to add OR Enter PO Number to view..."
                            value={searchQuery}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchQuery(val);

                                // Check for PO Number search
                                if (val.toUpperCase().startsWith('PO-') && val.length > 10) {
                                    // Debounce or direct fetch? simpler to direct fetch if length is sufficient
                                    // Let's do a quick fetch
                                    fetch(`/api/inventory/order/${val}`)
                                        .then(res => res.json())
                                        .then(json => {
                                            if (json.success && json.data && json.data.length > 0) {
                                                setPoNumber(val);
                                                // Map to OrderItem
                                                const items: OrderItem[] = json.data.map((row: any) => {
                                                    // Find product details from allProducts if possible to fill stock info
                                                    const product = allProducts.find(p => p.productId === row.productId);
                                                    return {
                                                        productId: row.productId,
                                                        barcode: row.barcode,
                                                        productName: row.productName,
                                                        qtyOnHand: product ? product.qtyOnHand : 0,
                                                        qtyFreeToUse: product ? product.qtyFreeToUse : 0,
                                                        orderQty: row.qtyOrder,
                                                        tags: product ? product.tags : ''
                                                    };
                                                });
                                                setOrderItems(items);
                                            }
                                        })
                                        .catch(console.error);
                                }
                            }}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>

                    {/* Suggestions Dropdown */}
                    {searchQuery && !searchQuery.toUpperCase().startsWith('PO-') && filteredProducts.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-60 overflow-y-auto">
                            {filteredProducts.map(product => (
                                <div
                                    key={product.productId}
                                    onClick={() => {
                                        addToOrder(product);
                                        setSearchQuery('');
                                    }}
                                    className="p-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center group border-b border-gray-100 last:border-none"
                                >
                                    <div>
                                        <p className="font-medium text-gray-800">{product.productName}</p>
                                        <p className="text-xs text-gray-500">ID: {product.productId} | Stock: {product.qtyFreeToUse}</p>
                                    </div>
                                    <button className="p-1.5 bg-blue-100 text-blue-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Order Items Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[300px]">
                {orderItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg">Your order list is empty</p>
                        <p className="text-sm">Search for products above to start adding items</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Barcode</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Product Name</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Current Stock</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Order Qty</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {orderItems.map((item) => (
                                <tr key={item.productId} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-center font-mono text-sm text-gray-600">
                                        {item.barcode || '---'}
                                    </td>
                                    <td className="px-6 py-4 text-center font-semibold text-gray-800">
                                        {item.productName}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${item.qtyFreeToUse <= 0 ? 'bg-red-100 text-red-700' :
                                            item.qtyFreeToUse <= 10 ? 'bg-amber-100 text-amber-700' :
                                                'bg-green-100 text-green-700'
                                            }`}>
                                            {item.qtyFreeToUse}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center">
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.orderQty}
                                                onChange={(e) => updateOrderQty(item.productId, parseInt(e.target.value) || 0)}
                                                className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => removeFromOrder(item.productId)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Remove Item"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer Actions */}
            {orderItems.length > 0 && (
                <div className="fixed bottom-6 left-0 right-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-white p-4 rounded-xl shadow-2xl border border-gray-200 flex justify-between items-center animate-in slide-in-from-bottom-5">
                        <div className="text-gray-600 font-medium">
                            Total Items: <span className="text-blue-600 font-bold">{orderItems.length}</span>
                        </div>
                        <div className="flex gap-4">

                            <button
                                onClick={handleSaveOrder}
                                disabled={loading}
                                className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-bold shadow-lg shadow-blue-200 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                            >
                                {loading ? (
                                    <>
                                        <RotateCw className="w-5 h-5 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Save & Download
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
