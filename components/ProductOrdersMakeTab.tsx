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
    qinc?: number;
    rowIndex?: number;
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

    const removeFromOrder = (productId: string, index: number) => {
        setOrderItems(orderItems.filter((_, i) => i !== index));
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
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Left: Title & Save */}
                <div className="flex items-center gap-3 shrink-0">
                    <ShoppingCart className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">
                        Create New Order
                    </h2>
                    <button
                        onClick={handleSaveOrder}
                        disabled={loading || orderItems.length === 0}
                        className={`p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm ${loading || orderItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Save & Download"
                    >
                        {loading ? (
                            <RotateCw className="w-5 h-5 animate-spin" />
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                    </button>
                </div>

                {/* Center: Search Product */}
                <div className="relative flex-1 w-full max-w-2xl px-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search product..."
                            value={searchQuery}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchQuery(val);

                                // Check for PO Number search
                                if (val.toUpperCase().startsWith('PO-') && val.length > 10) {
                                    fetch(`/api/inventory/order/${val}`)
                                        .then(res => res.json())
                                        .then(json => {
                                            if (json.success && json.data && json.data.length > 0) {
                                                setPoNumber(val);
                                                // Map to OrderItem
                                                const items: OrderItem[] = json.data.map((row: any) => {
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
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                        />
                    </div>

                    {/* Suggestions Dropdown */}
                    {searchQuery && !searchQuery.toUpperCase().startsWith('PO-') && filteredProducts.length > 0 && (
                        <div className="absolute top-full left-4 right-4 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-60 overflow-y-auto">
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

                {/* Right: PO Number */}
                <div className="flex items-center gap-2 shrink-0">
                    <label className="text-sm font-medium text-gray-600 whitespace-nowrap">PO Number:</label>
                    <input
                        type="text"
                        value={poNumber}
                        readOnly
                        className="w-32 px-3 py-2 border border-gray-300 bg-gray-100 text-gray-500 rounded-lg focus:ring-0 outline-none font-mono text-sm cursor-not-allowed text-center"
                    />
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
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-900 text-white">
                                <th className="bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[15%]">BARCODE</th>
                                <th className="bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[45%]">PRODUCT NAME</th>
                                <th className="bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[15%]">CURRENT STOCK</th>
                                <th className="bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[15%]">ORDER QTY</th>
                                <th className="bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[10%]">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orderItems.map((item, idx) => (
                                <tr key={`${item.productId}-${idx}`} className="hover:bg-blue-50 transition-colors">
                                    <td className="border border-gray-300 p-2 text-center font-mono text-sm text-gray-600">
                                        {item.barcode || '---'}
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center font-semibold text-gray-800 text-sm">
                                        {item.productName}
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center">
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${item.qtyFreeToUse <= 0 ? 'bg-red-100 text-red-700 border border-red-200' :
                                            item.qtyFreeToUse <= 10 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                                'bg-green-100 text-green-700 border border-green-200'
                                            }`}>
                                            {item.qtyFreeToUse}
                                        </span>
                                    </td>
                                    <td className="border border-gray-300 p-2">
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.orderQty}
                                            onChange={(e) => updateOrderQty(item.productId, parseInt(e.target.value) || 0)}
                                            className="w-full px-1 py-1 text-sm text-center font-bold focus:outline-none focus:bg-blue-50 bg-transparent"
                                        />
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center">
                                        <button
                                            onClick={() => removeFromOrder(item.productId, idx)}
                                            className="text-red-500 hover:text-red-700 transition-colors"
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


        </div>
    );
}
