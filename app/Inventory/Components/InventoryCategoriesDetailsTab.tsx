'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    Search, FileSpreadsheet, ChevronLeft,
    Box, RefreshCw, TrendingUp, TrendingDown, Truck, Info, X, Save
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProductOrder, OrderItem } from './InventoryCategoriesTab';
import NoData from '@/app/Components/NoDataTab';
import { exportInventoryExcel } from './ExcelExport';
import ProductDetails from './InventoryProductDetails';
import { getProductMovementsData, updateProductColumn } from '../Service/inventory_service';

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
            const json = await getProductMovementsData();
            if (json.success) {
                setMovements(json.data || {});
            }
        } catch (err) {
            console.error('Error fetching movements:', err);
        } finally {
            setFetchingMovements(false);
        }
    };

    const handleExport = async () => {
        const data = filteredProducts.map(p => {
            const m = movements[p.productId] || { sales: 0, returns: 0, netPurchases: 0 };
            return {
                'Barcode': p.barcode,
                'Name': p.productName,
                'QTY (Pcs)': p.onHand,
                'Sales': m.sales,
                'Returns': m.returns,
                'Purchases': m.netPurchases,
            };
        });

        await exportInventoryExcel(data, 'Inventory', `${categoryName}_inventory.xlsx`);
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
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">

                <div className="flex items-center gap-4 relative z-10">
                    <button
                        onClick={onBack}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm group"
                    >
                        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">CATEGORY</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
                            <Box className="w-6 h-6 text-blue-600" />
                            {categoryName}
                        </h2>
                    </div>
                </div>

                {/* Centered Search Bar */}
                <div className="flex-1 max-w-md mx-auto relative group z-10 hidden lg:block">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                        placeholder={`Search ${categoryName}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <button
                        onClick={handleExport}
                        className="flex items-center justify-center h-11 w-11 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm group"
                        title="Export to Excel"
                    >
                        <FileSpreadsheet className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => {
                            fetchMovements();
                            onRefresh();
                        }}
                        className="flex items-center justify-center h-11 w-11 bg-slate-800 text-white rounded-lg hover:bg-slate-700 active:scale-95 transition-all shadow-sm"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-5 h-5 ${(loading || fetchingMovements) ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Mobile Search Bar (only shows on smaller screens) */}
            <div className="lg:hidden relative group w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all shadow-sm"
                    placeholder={`Search within ${categoryName}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Main Table Container */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                <div className="overflow-x-auto scrollbar-thin scrollbar-track-slate-50 scrollbar-thumb-slate-300">
                    <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-slate-900 text-white border-b border-slate-800">
                                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-center border-r border-slate-800 w-[12%] text-slate-300">BARCODE</th>
                                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-center border-r border-slate-800 w-[40%] text-slate-300">PRODUCT NAME</th>
                                <th className="px-3 py-4 text-[11px] font-bold uppercase tracking-wider text-center border-r border-slate-800 w-[8%] text-slate-300">QTY (Pcs)</th>
                                <th className="px-2 py-4 text-[11px] font-bold uppercase tracking-wider text-center border-r border-slate-800 w-[9%] text-slate-300">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <TrendingUp className="w-3.5 h-3.5" /> SALES
                                    </div>
                                </th>
                                <th className="px-2 py-4 text-[11px] font-bold uppercase tracking-wider text-center border-r border-slate-800 w-[9%] text-slate-300">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <TrendingDown className="w-3.5 h-3.5" /> RETURNS
                                    </div>
                                </th>
                                <th className="px-2 py-4 text-[11px] font-bold uppercase tracking-wider text-center w-[8%] text-slate-300">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Truck className="w-3.5 h-3.5" /> PURCHASES
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                [...Array(8)].map((_, i) => (
                                    <tr key={i} className="hover:bg-slate-50/80 transition-all duration-300">
                                        <td className="px-6 py-4 border-r border-slate-100 bg-white">
                                            <div className="h-4 bg-slate-200 rounded w-full animate-pulse"></div>
                                        </td>
                                        <td className="px-6 py-4 border-r border-slate-100 bg-white">
                                            <div className="flex items-center gap-3 w-full animate-pulse">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 border-r border-slate-100 bg-white">
                                            <div className="h-6 bg-slate-200 rounded-lg w-12 mx-auto animate-pulse"></div>
                                        </td>
                                        <td className="px-2 py-4 border-r border-slate-100 bg-white">
                                            <div className="h-5 bg-slate-200 rounded w-10 mx-auto animate-pulse"></div>
                                        </td>
                                        <td className="px-2 py-4 border-r border-slate-100 bg-white">
                                            <div className="h-5 bg-slate-200 rounded w-10 mx-auto animate-pulse"></div>
                                        </td>
                                        <td className="px-2 py-4 bg-white">
                                            <div className="h-5 bg-slate-200 rounded w-10 mx-auto animate-pulse"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12">
                                        <NoData title="No Items Found" />
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product, idx) => {
                                    const move = movements[product.productId] || { sales: 0, returns: 0, netPurchases: 0 };
                                    return (
                                        <tr key={product.productId} className="hover:bg-slate-50/80 transition-all duration-300 group">
                                            {/* Barcode */}
                                            <td className="px-6 py-3 text-xs font-semibold text-slate-500 group-hover:text-slate-900 text-center border-r border-slate-100 transition-colors tracking-tight bg-white">{product.barcode}</td>

                                            {/* Name */}
                                            <td
                                                className="px-6 py-3 text-sm font-bold text-slate-800 border-r border-slate-100 text-center cursor-pointer group-hover:text-blue-600 transition-all bg-white"
                                                title={product.productName}
                                                onClick={() => setSelectedProduct({ id: product.productId, name: product.productName, barcode: product.barcode })}
                                            >
                                                <div className="flex items-center gap-3 w-full">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors shrink-0" />
                                                    <span className="flex-1 min-w-0 whitespace-normal break-words leading-snug">{product.productName}</span>
                                                </div>
                                            </td>

                                            {/* QTY Pcs */}
                                            <td className="px-3 py-3 text-center border-r border-slate-100 bg-white">
                                                <span className={`px-2 py-1 rounded-md text-sm font-bold inline-block min-w-[50px] ${product.onHand <= 0
                                                    ? 'bg-red-50 text-red-600 border border-red-100'
                                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                    }`}>
                                                    {product.onHand === 0 ? '-' : product.onHand.toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Metrics with sophisticated colors or skeletons */}
                                            <td className="px-2 py-3 text-center border-r border-slate-100 bg-white">
                                                {fetchingMovements ? (
                                                    <div className="h-5 bg-slate-200 rounded w-8 mx-auto animate-pulse"></div>
                                                ) : (
                                                    <span className={`text-sm font-bold ${move.sales > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                                        {move.sales === 0 ? '-' : move.sales.toLocaleString()}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2 py-3 text-center border-r border-slate-100 bg-white">
                                                {fetchingMovements ? (
                                                    <div className="h-5 bg-slate-200 rounded w-8 mx-auto animate-pulse"></div>
                                                ) : (
                                                    <span className={`text-sm font-bold ${move.returns > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                        {move.returns === 0 ? '-' : move.returns.toLocaleString()}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2 py-3 text-center bg-white">
                                                {fetchingMovements ? (
                                                    <div className="h-5 bg-slate-200 rounded w-8 mx-auto animate-pulse"></div>
                                                ) : (
                                                    <span className={`text-sm font-bold ${move.netPurchases !== 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                        {move.netPurchases === 0 ? '-' : move.netPurchases.toLocaleString()}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


        </div>
    );
}
