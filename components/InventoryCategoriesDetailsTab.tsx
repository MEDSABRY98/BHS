'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    Search, FileSpreadsheet, ChevronLeft,
    Box, RefreshCw, TrendingUp, TrendingDown, Truck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProductOrder, OrderItem } from './InventoryCategoriesTab';
import NoData from './01-Unified/NoDataTab';
import ProductDetails from './InventoryProductDetails';

interface Props {
    categoryName: string;
    products: ProductOrder[];
    onBack: () => void;
    loading: boolean;
    onRefresh: () => void;
    orderItems: OrderItem[];
    setOrderItems: (items: any) => void;
}

interface MovementData {
    sales: number;
    returns: number;
    netPurchases: number;
}

export default function InventoryProductOrdersDetailsTab({
    categoryName,
    products: initialProducts,
    onBack,
    loading,
    onRefresh,
    orderItems,
    setOrderItems
}: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [localProducts, setLocalProducts] = useState(initialProducts);
    const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);
    const [movements, setMovements] = useState<Record<string, MovementData>>({});
    const [fetchingMovements, setFetchingMovements] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<{ id: string, name: string, barcode: string } | null>(null);

    useEffect(() => {
        setLocalProducts(initialProducts);
    }, [initialProducts]);

    const filteredProducts = useMemo(() => {
        return localProducts.filter(p =>
            p.formattedTag === categoryName &&
            (p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [localProducts, categoryName, searchTerm]);

    // Fetch movements on mount
    useEffect(() => {
        fetchMovements();
    }, []);

    const fetchMovements = async () => {
        try {
            setFetchingMovements(true);
            const res = await fetch('/api/inventory/movements');
            const json = await res.json();
            if (res.ok) {
                setMovements(json.data || {});
            }
        } catch (err) {
            console.error('Error fetching movements:', err);
        } finally {
            setFetchingMovements(false);
        }
    };

    const handleExport = () => {
        const data = filteredProducts.map(p => {
            const m = movements[p.productId] || { sales: 0, returns: 0, netPurchases: 0 };
            const stockCtns = (p.onHand / (p.qinc || 1)).toFixed(2);
            return {
                'Barcode': p.barcode,
                'Name': p.productName,
                'QTY (Pcs)': p.onHand,
                'Stock (Ctns)': stockCtns,
                'Min CTN': p.minQ,
                'Max CTN': p.maxQ,
                'QTY in CTN': p.qinc,
                'Sales': m.sales,
                'Returns': m.returns,
                'Purchases': m.netPurchases,
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
        XLSX.writeFile(wb, `${categoryName}_inventory.xlsx`);
    };

    const handleUpdateField = async (product: ProductOrder, field: string, value: string) => {
        const numValue = Number(value);
        if (isNaN(numValue)) return;

        try {
            setUpdating(product.productId);
            const res = await fetch('/api/inventory', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex: product.rowIndex, field, value: numValue })
            });

            if (!res.ok) throw new Error('Failed to update');

            setLocalProducts(prev => prev.map(p =>
                p.productId === product.productId ? { ...p, [field]: numValue } : p
            ));

            onRefresh();

        } catch (err) {
            console.error('Update error:', err);
            alert('Failed to update column in Google Sheets');
        } finally {
            setUpdating(null);
            setEditingCell(null);
        }
    };

    const EditableCell = ({ product, field, value }: { product: ProductOrder, field: string, value: any }) => {
        const isEditing = editingCell?.id === product.productId && editingCell?.field === field;
        const [tempValue, setTempValue] = useState(value?.toString() || '');

        if (isEditing) {
            return (
                <input
                    autoFocus
                    type="text"
                    className="w-full h-8 px-2 text-center bg-blue-100 border border-blue-500 rounded font-black text-blue-900 focus:outline-none shadow-inner"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={() => handleUpdateField(product, field, tempValue)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateField(product, field, tempValue);
                        if (e.key === 'Escape') setEditingCell(null);
                    }}
                />
            );
        }

        return (
            <div
                className="cursor-pointer hover:bg-indigo-100/50 py-1 rounded transition-colors group relative"
                onClick={() => setEditingCell({ id: product.productId, field })}
            >
                <span className="font-bold text-indigo-600">{value || '-'}</span>
                <div className="absolute inset-0 border border-transparent group-hover:border-indigo-200 rounded pointer-events-none" />
            </div>
        );
    };

    if (selectedProduct) {
        return (
            <ProductDetails
                productId={selectedProduct.id}
                productName={selectedProduct.name}
                barcode={selectedProduct.barcode}
                onBack={() => setSelectedProduct(null)}
            />
        );
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-8 duration-500 pb-12">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-3 bg-white border border-gray-100 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50 transition-all shadow-sm group"
                    >
                        <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                            <Box className="w-8 h-8 text-blue-500" />
                            {categoryName}
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center justify-center h-12 w-12 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg group"
                        title="Export to Excel"
                    >
                        <FileSpreadsheet className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => {
                            fetchMovements();
                            onRefresh();
                        }}
                        className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-blue-600 transition-all shadow-lg"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-6 h-6 ${(loading || fetchingMovements) ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl text-base font-bold text-slate-700 placeholder:text-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm"
                    placeholder={`Search within ${categoryName}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Main Table Container */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden relative min-h-[400px]">
                {(updating || fetchingMovements) && (
                    <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center backdrop-blur-[1px]">
                        <div className="bg-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-blue-50">
                            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                            <span className="font-black text-blue-900 text-sm uppercase tracking-widest">
                                {fetchingMovements ? 'FETCHING LIVE MOVES...' : 'SYNCING TO CLOUD...'}
                            </span>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                    <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#0f172a] text-white">
                                {/* Inventory columns */}
                                <th className="px-3 py-4 text-[11px] font-black uppercase tracking-wider text-center border-r border-white/10 w-[12%]">BARCODE</th>
                                <th className="px-4 py-4 text-[11px] font-black uppercase tracking-wider text-center border-r border-white/10 w-[22%]">PRODUCT NAME</th>
                                <th className="px-3 py-4 text-[11px] font-black uppercase tracking-wider text-center border-r border-white/10 bg-slate-800 w-[8%]">QTY (Pcs)</th>
                                <th className="px-3 py-4 text-[11px] font-black uppercase tracking-wider text-center border-r border-white/10 bg-slate-800 w-[8%]">QTY (CTN)</th>
                                <th className="px-2 py-4 text-[11px] font-black uppercase tracking-wider text-center border-r border-white/10 bg-indigo-900/50 w-[8%]">MIN CTN</th>
                                <th className="px-2 py-4 text-[11px] font-black uppercase tracking-wider text-center border-r border-white/10 bg-indigo-900/50 w-[8%]">MAX CTN</th>
                                <th className="px-2 py-4 text-[11px] font-black uppercase tracking-wider text-center border-r border-white/10 bg-indigo-900/50 w-[8%]">QTY IN CTN</th>
                                {/* Movement columns */}
                                <th className="px-2 py-4 text-[11px] font-black uppercase tracking-wider text-center border-r border-white/10 bg-rose-900/40 w-[9%]">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <TrendingUp className="w-3 h-3 text-rose-400" /> SALES
                                    </div>
                                </th>
                                <th className="px-2 py-4 text-[11px] font-black uppercase tracking-wider text-center border-r border-white/10 bg-amber-900/40 w-[9%]">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <TrendingDown className="w-3 h-3 text-amber-400" /> RETURNS
                                    </div>
                                </th>
                                <th className="px-2 py-4 text-[11px] font-black uppercase tracking-wider text-center bg-emerald-900/40 w-[10%]">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Truck className="w-3 h-3 text-emerald-400" /> PURCHASES
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredProducts.length > 0 ? (
                                filteredProducts.map((product) => {
                                    const stockCtns = (product.onHand / (product.qinc || 1)).toFixed(2);
                                    const move = movements[product.productId] || { sales: 0, returns: 0, netPurchases: 0 };
                                    return (
                                        <tr key={product.productId} className="hover:bg-slate-50 transition-colors group">
                                            {/* Barcode */}
                                            <td className="px-3 py-4 text-[13px] font-mono font-bold text-slate-900 text-center border-r border-gray-50 break-all">{product.barcode}</td>
                                            {/* Name */}
                                            <td
                                                className="px-4 py-4 text-[13px] font-bold text-slate-700 border-r border-gray-50 text-center truncate cursor-pointer hover:text-blue-600 hover:bg-blue-50/50 transition-all decoration-blue-200 underline-offset-4 hover:underline"
                                                title={product.productName}
                                                onClick={() => setSelectedProduct({ id: product.productId, name: product.productName, barcode: product.barcode })}
                                            >
                                                {product.productName}
                                            </td>
                                            {/* QTY Pcs */}
                                            <td className="px-3 py-4 text-center border-r border-gray-50 bg-slate-50/30">
                                                <span className={`px-2 py-1 rounded text-[13px] font-black shadow-sm ${product.onHand <= 0 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                                                    {product.onHand === 0 ? '-' : product.onHand}
                                                </span>
                                            </td>
                                            {/* QTY CTN */}
                                            <td className="px-3 py-4 text-center border-r border-gray-50 bg-slate-50/30">
                                                <span className="text-[13px] font-black text-slate-700">{Number(stockCtns) === 0 ? '-' : stockCtns}</span>
                                            </td>
                                            {/* Min CTN */}
                                            <td className="px-2 py-4 text-center border-r border-gray-50 bg-indigo-50/20">
                                                <EditableCell product={product} field="minQ" value={product.minQ} />
                                            </td>
                                            {/* Max CTN */}
                                            <td className="px-2 py-4 text-center border-r border-gray-50 bg-indigo-50/20">
                                                <EditableCell product={product} field="maxQ" value={product.maxQ} />
                                            </td>
                                            {/* QTY in CTN */}
                                            <td className="px-2 py-4 text-center border-r border-gray-50 bg-indigo-50/20">
                                                <EditableCell product={product} field="qinc" value={product.qinc} />
                                            </td>
                                            {/* Sales */}
                                            <td className="px-2 py-4 text-center border-r border-gray-50 bg-rose-50/10">
                                                <span className={`text-[14px] font-black ${move.sales > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                                                    {move.sales === 0 ? '-' : move.sales.toLocaleString()}
                                                </span>
                                            </td>
                                            {/* Returns */}
                                            <td className="px-2 py-4 text-center border-r border-gray-50 bg-amber-50/10">
                                                <span className={`text-[14px] font-black ${move.returns > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                                                    {move.returns === 0 ? '-' : move.returns.toLocaleString()}
                                                </span>
                                            </td>
                                            {/* Net Purchases */}
                                            <td className="px-2 py-4 text-center bg-emerald-50/10">
                                                <span className={`text-[14px] font-black ${move.netPurchases !== 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                                    {move.netPurchases === 0 ? '-' : move.netPurchases.toLocaleString()}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12">
                                        <NoData title="No Matches" />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
