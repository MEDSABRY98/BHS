'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    Search, FileSpreadsheet, ChevronLeft,
    Box, RefreshCw, TrendingUp, TrendingDown, Truck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProductOrder, OrderItem } from './InventoryCategoriesTab';
import NoData from '@/app/Components/NoDataTab';
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
    orderItems: _orderItems,
    setOrderItems: _setOrderItems
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

    const handleUpdateField = async (product: ProductOrder, field: 'minQ' | 'maxQ' | 'qinc', value: string) => {
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

    const EditableCell = ({ product, field, value }: { product: ProductOrder, field: 'minQ' | 'maxQ' | 'qinc', value: any }) => {
        const isEditing = editingCell?.id === product.productId && editingCell?.field === field;
        const [tempValue, setTempValue] = useState(value?.toString() || '');

        if (isEditing) {
            return (
                <div className="relative w-full max-w-[80px] mx-auto">
                    <input
                        autoFocus
                        type="text"
                        className="w-full h-8 px-2 text-center bg-amber-50 border-2 border-amber-500 rounded-lg font-black text-amber-900 focus:outline-none shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={() => handleUpdateField(product, field, tempValue)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateField(product, field, tempValue);
                            if (e.key === 'Escape') setEditingCell(null);
                        }}
                    />
                </div>
            );
        }

        return (
            <div
                className="cursor-pointer hover:bg-amber-50/50 py-1.5 px-2 rounded-lg transition-all duration-300 group relative flex items-center justify-center gap-1 min-h-[36px]"
                onClick={() => setEditingCell({ id: product.productId, field })}
            >
                <span className="font-extrabold text-slate-600 group-hover:text-amber-600 transition-colors">{value || '0'}</span>
                <div className="absolute inset-0 border border-transparent group-hover:border-amber-200 group-hover:bg-amber-50/30 rounded-lg pointer-events-none transition-all scale-95 group-hover:scale-100" />
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
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-8 duration-700 pb-12">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -ml-32 -mb-32" />

                <div className="flex items-center gap-5 relative z-10">
                    <button
                        onClick={onBack}
                        className="p-3.5 bg-slate-800 border border-slate-700 rounded-2xl text-slate-400 hover:text-amber-400 hover:border-amber-500/30 hover:bg-slate-800/50 transition-all shadow-lg group backdrop-blur-md"
                    >
                        <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black tracking-[0.2em] text-amber-500/60 uppercase">INVENTORY CATEGORY</span>
                        </div>
                        <h2 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                            <Box className="w-8 h-8 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
                            {categoryName}
                        </h2>
                    </div>
                </div>

                {/* Centered Search Bar */}
                <div className="flex-1 max-w-md mx-auto relative group z-10 hidden lg:block">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-12 pr-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/30 focus:bg-white/10 transition-all backdrop-blur-md"
                        placeholder={`Search ${categoryName}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <button
                        onClick={handleExport}
                        className="flex items-center justify-center h-14 w-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-xl group backdrop-blur-md"
                        title="Export to Excel"
                    >
                        <FileSpreadsheet className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => {
                            fetchMovements();
                            onRefresh();
                        }}
                        className="flex items-center justify-center h-14 w-14 bg-amber-500 text-slate-950 rounded-2xl hover:bg-amber-400 hover:scale-105 active:scale-95 transition-all shadow-[0_8px_25px_rgba(245,158,11,0.3)]"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-6 h-6 ${(loading || fetchingMovements) ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Mobile Search Bar (only shows on smaller screens) */}
            <div className="lg:hidden relative group w-full">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-14 pr-8 py-4 bg-white border border-slate-100 rounded-[2rem] text-lg font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-[12px] focus:ring-amber-500/5 focus:border-amber-400 transition-all shadow-lg"
                    placeholder={`Search within ${categoryName}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Main Table Container */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.07)] overflow-hidden relative min-h-[500px]">
                {(updating || fetchingMovements) && (
                    <div className="absolute inset-0 bg-white/40 z-50 flex items-center justify-center transition-all duration-500">
                        <div className="bg-slate-900 px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border border-amber-500/20 animate-in zoom-in duration-300">
                            <div className="relative">
                                <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full animate-pulse" />
                                <RefreshCw className="w-10 h-10 text-amber-500 animate-spin relative z-10" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="font-black text-amber-500 text-xs uppercase tracking-[0.3em]">
                                    {fetchingMovements ? 'SYNCING DATA' : 'CLOUD UPDATE'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60">Please wait a moment...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto scrollbar-thin scrollbar-track-slate-50 scrollbar-thumb-amber-200/50">
                    <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-slate-950 text-white shadow-xl">
                                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center border-r border-white/5 w-[12%] text-amber-500/80">BARCODE</th>
                                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center border-r border-white/5 w-[22%]">PRODUCT NAME</th>
                                <th className="px-3 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center border-r border-white/5 bg-slate-900 w-[8%]">QTY (Pcs)</th>
                                <th className="px-3 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center border-r border-white/5 bg-slate-900 w-[8%]">QTY (CTN)</th>
                                <th className="px-2 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center border-r border-white/5 bg-amber-500/10 w-[8%] text-amber-400">MIN CTN</th>
                                <th className="px-2 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center border-r border-white/5 bg-amber-500/10 w-[8%] text-amber-400">MAX CTN</th>
                                <th className="px-2 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center border-r border-white/5 bg-amber-500/10 w-[8%] text-amber-400">IN CTN</th>
                                <th className="px-2 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center border-r border-white/5 bg-rose-500/10 w-[9%] text-rose-400">
                                    <div className="flex items-center justify-center gap-2">
                                        <TrendingUp className="w-3.5 h-3.5" /> SALES
                                    </div>
                                </th>
                                <th className="px-2 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center border-r border-white/5 bg-orange-500/10 w-[9%] text-orange-400">
                                    <div className="flex items-center justify-center gap-2">
                                        <TrendingDown className="w-3.5 h-3.5" /> RETURNS
                                    </div>
                                </th>
                                <th className="px-2 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center bg-emerald-500/10 w-[10%] text-emerald-400">
                                    <div className="flex items-center justify-center gap-2">
                                        <Truck className="w-3.5 h-3.5" /> PURCHASES
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredProducts.length > 0 ? (
                                filteredProducts.map((product, idx) => {
                                    const stockCtns = (product.onHand / (product.qinc || 1)).toFixed(2);
                                    const move = movements[product.productId] || { sales: 0, returns: 0, netPurchases: 0 };
                                    return (
                                        <tr key={product.productId} className="hover:bg-slate-50/80 transition-all duration-300 group">
                                            {/* Barcode */}
                                            <td className="px-6 py-3 text-[13px] font-black text-slate-400 group-hover:text-slate-900 text-center border-r border-slate-50 transition-colors tracking-tight">{product.barcode}</td>

                                            {/* Name */}
                                            <td
                                                className="px-6 py-3 text-[14px] font-extrabold text-slate-700 border-r border-slate-50 text-center cursor-pointer group-hover:text-amber-600 transition-all"
                                                title={product.productName}
                                                onClick={() => setSelectedProduct({ id: product.productId, name: product.productName, barcode: product.barcode })}
                                            >
                                                <div className="flex items-center justify-center gap-3">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-amber-400 transition-colors" />
                                                    <span className="truncate max-w-[250px]">{product.productName}</span>
                                                </div>
                                            </td>

                                            {/* QTY Pcs */}
                                            <td className="px-3 py-3 text-center border-r border-slate-50 bg-slate-50/30">
                                                <span className={`px-3 py-1.5 rounded-xl text-lg font-black shadow-sm inline-block min-w-[60px] ${product.onHand <= 0
                                                    ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                    }`}>
                                                    {product.onHand === 0 ? '-' : product.onHand.toLocaleString()}
                                                </span>
                                            </td>

                                            {/* QTY CTN */}
                                            <td className="px-3 py-3 text-center border-r border-slate-50 bg-slate-50/30">
                                                <span className="text-[14px] font-black text-slate-600">
                                                    {Number(stockCtns) === 0 ? '-' : stockCtns}
                                                </span>
                                            </td>

                                            {/* Editable columns with Gold touch */}
                                            <td className="px-2 py-3 text-center border-r border-slate-50 bg-amber-50/10">
                                                <EditableCell product={product} field="minQ" value={product.minQ} />
                                            </td>
                                            <td className="px-2 py-3 text-center border-r border-slate-50 bg-amber-50/10">
                                                <EditableCell product={product} field="maxQ" value={product.maxQ} />
                                            </td>
                                            <td className="px-2 py-3 text-center border-r border-slate-50 bg-amber-50/10">
                                                <EditableCell product={product} field="qinc" value={product.qinc} />
                                            </td>

                                            {/* Metrics with sophisticated colors */}
                                            <td className="px-2 py-3 text-center border-r border-slate-50 bg-rose-50/10">
                                                <span className={`text-[15px] font-black ${move.sales > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                                                    {move.sales === 0 ? '-' : move.sales.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-2 py-3 text-center border-r border-slate-50 bg-orange-50/10">
                                                <span className={`text-[15px] font-black ${move.returns > 0 ? 'text-orange-500' : 'text-slate-300'}`}>
                                                    {move.returns === 0 ? '-' : move.returns.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-2 py-3 text-center bg-emerald-50/10">
                                                <span className={`text-[15px] font-black ${move.netPurchases !== 0 ? 'text-emerald-500' : 'text-slate-300'}`}>
                                                    {move.netPurchases === 0 ? '-' : move.netPurchases.toLocaleString()}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} className="px-6 py-24">
                                        <div className="flex flex-col items-center justify-center opacity-40 grayscale group-hover:grayscale-0 transition-all duration-500">
                                            <NoData title="No Items Found" />
                                        </div>
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
