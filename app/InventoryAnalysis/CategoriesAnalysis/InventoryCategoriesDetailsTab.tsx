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
import { getProductMovementsData, updateProductColumn, getProductsBalanceReportData } from '../Service/inventory_service';


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
    const [endingBalances, setEndingBalances] = useState<Record<string, number>>({});
    const [fetchingBalance, setFetchingBalance] = useState(false);


    useEffect(() => {
        setLocalProducts(initialProducts);
    }, [initialProducts]);

    const filteredProducts = useMemo(() => {
        const filtered = localProducts.filter(p =>
            p.formattedTag === categoryName &&
            (p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        return filtered.sort((a, b) => a.productName.localeCompare(b.productName));
    }, [localProducts, categoryName, searchTerm]);

    // Fetch movements + ending balances on mount
    useEffect(() => {
        fetchMovements();
        fetchBalances();
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

    const fetchBalances = async () => {
        try {
            setFetchingBalance(true);
            const json = await getProductsBalanceReportData();
            if (json.success) {
                const map: Record<string, number> = {};
                (json.data || []).forEach((item: any) => {
                    map[item.productId] = item.endingStock;
                });
                setEndingBalances(map);
            }
        } catch (err) {
            console.error('Error fetching balances:', err);
        } finally {
            setFetchingBalance(false);
        }
    };

    const handleExport = async () => {
        const data = filteredProducts.map(p => {
            const m = movements[p.productId] || { sales: 0, returns: 0, netPurchases: 0 };
            const endingStock = endingBalances[p.productId] ?? p.onHand;
            return {
                'Barcode': p.barcode,
                'Name': p.productName,
                'QTY (Pcs)': endingStock,
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
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col lg:flex-row items-center justify-between gap-4">

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <button
                        onClick={onBack}
                        className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-500 hover:text-[#D4AF37] hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/5 transition-all shadow-sm group shrink-0"
                    >
                        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="bg-[#D4AF37]/10 p-3 rounded-2xl">
                            <Box className="w-6 h-6 text-[#D4AF37]" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight line-clamp-1">
                            {categoryName}
                        </h2>
                    </div>
                </div>

                {/* Centered Search Bar & Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-96 group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all"
                            placeholder={`Search ${categoryName}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={handleExport}
                            className="flex items-center justify-center p-3.5 bg-green-50 border border-green-200 text-green-700 rounded-2xl hover:bg-green-100 transition-all shadow-sm group shrink-0"
                            title="Export to Excel"
                        >
                            <FileSpreadsheet className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => {
                                fetchMovements();
                                onRefresh();
                            }}
                            className="flex items-center justify-center p-3.5 bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-2xl transition-all shadow-sm shrink-0"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-5 h-5 ${(loading || fetchingMovements) ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>



            {/* Main Table Container */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden relative">
                <div className="overflow-x-auto scrollbar-thin scrollbar-track-gray-50 scrollbar-thumb-gray-300">
                    <table className="w-full text-left border-collapse table-fixed min-w-[1200px]">
                        <thead className="sticky top-0 z-20 shadow-sm">
                            <tr className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b-[3px] border-[#D4AF37]">
                                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-center w-[12%] text-gray-200">BARCODE</th>
                                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-center w-[40%] text-gray-200">PRODUCT NAME</th>
                                <th className="px-2 py-4 text-[11px] font-bold uppercase tracking-wider text-center w-[9%] text-gray-200">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" /> SALES
                                    </div>
                                </th>
                                <th className="px-2 py-4 text-[11px] font-bold uppercase tracking-wider text-center w-[9%] text-gray-200">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <TrendingDown className="w-4 h-4 text-rose-400" /> RETURNS
                                    </div>
                                </th>
                                <th className="px-2 py-4 text-[11px] font-bold uppercase tracking-wider text-center w-[8%] text-gray-200">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Truck className="w-4 h-4 text-indigo-400" /> PURCHASES
                                    </div>
                                </th>
                                <th className="px-2 py-4 text-[11px] font-bold uppercase tracking-wider text-center w-[10%] text-emerald-300">
                                    ENDING BALANCE
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && filteredProducts.length === 0 ? (
                                [...Array(8)].map((_, i) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-all duration-300">
                                        <td className="px-6 py-4 border-r border-gray-100 bg-white">
                                            <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                                        </td>
                                        <td className="px-6 py-4 border-r border-gray-100 bg-white">
                                            <div className="flex items-center gap-3 w-full animate-pulse">
                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-4 border-r border-gray-100 bg-white">
                                            <div className="h-5 bg-gray-200 rounded w-10 mx-auto animate-pulse"></div>
                                        </td>
                                        <td className="px-2 py-4 border-r border-gray-100 bg-white">
                                            <div className="h-5 bg-gray-200 rounded w-10 mx-auto animate-pulse"></div>
                                        </td>
                                        <td className="px-2 py-4 bg-white">
                                            <div className="h-5 bg-gray-200 rounded w-10 mx-auto animate-pulse"></div>
                                        </td>
                                        <td className="px-2 py-4 bg-white">
                                            <div className="h-5 bg-gray-200 rounded w-12 mx-auto animate-pulse"></div>
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
                                filteredProducts.map((product) => {
                                    const move = movements[product.productId] || { sales: 0, returns: 0, netPurchases: 0 };
                                    const endingStock = endingBalances[product.productId] ?? null;
                                    const metricsPending = fetchingMovements || fetchingBalance;
                                    const hasMovementData = Object.prototype.hasOwnProperty.call(movements, product.productId);
                                    const hasBalanceData = Object.prototype.hasOwnProperty.call(endingBalances, product.productId);

                                    const renderMetricCell = (
                                        value: number | null,
                                        hasData: boolean,
                                        activeClass: string,
                                        formatter?: (val: number) => string,
                                    ) => {
                                        if (metricsPending && !hasData) {
                                            return <div className="h-5 bg-gray-200 rounded w-10 mx-auto animate-pulse" />;
                                        }

                                        if (value === null || value === 0) {
                                            return <span className="text-sm font-bold text-gray-400">-</span>;
                                        }

                                        return (
                                            <span className={`text-sm font-bold ${activeClass}`}>
                                                {formatter ? formatter(value) : value.toLocaleString()}
                                            </span>
                                        );
                                    };

                                    return (
                                        <tr key={product.productId} className="hover:bg-gray-50 transition-all duration-300 group">
                                            <td className="px-6 py-3 text-xs font-semibold text-gray-500 group-hover:text-gray-900 text-center border-r border-gray-100 transition-colors tracking-tight bg-white">{product.barcode}</td>

                                            <td
                                                className="px-6 py-3 text-sm font-bold text-gray-800 border-r border-gray-100 text-center cursor-pointer group-hover:text-[#D4AF37] transition-all bg-white"
                                                title={product.productName}
                                                onClick={() => setSelectedProduct({ id: product.productId, name: product.productName, barcode: product.barcode })}
                                            >
                                                <div className="flex items-center gap-3 w-full">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-[#D4AF37] transition-colors shrink-0" />
                                                    <span className="flex-1 min-w-0 whitespace-normal break-words leading-snug">{product.productName}</span>
                                                </div>
                                            </td>

                                            <td className="px-2 py-3 text-center border-r border-gray-100 bg-white">
                                                {renderMetricCell(move.sales, hasMovementData, 'text-blue-600')}
                                            </td>
                                            <td className="px-2 py-3 text-center border-r border-gray-100 bg-white">
                                                {renderMetricCell(move.returns, hasMovementData, 'text-amber-600')}
                                            </td>
                                            <td className="px-2 py-3 text-center border-r border-gray-100 bg-white">
                                                {renderMetricCell(move.netPurchases, hasMovementData, 'text-indigo-600')}
                                            </td>
                                            <td className="px-2 py-3 text-center bg-white">
                                                {metricsPending && !hasBalanceData ? (
                                                    <div className="h-5 bg-gray-200 rounded w-12 mx-auto animate-pulse" />
                                                ) : endingStock === null ? (
                                                    <span className="text-gray-300 text-xs">—</span>
                                                ) : (
                                                    <span className={`px-2 py-1 rounded-md text-sm font-black inline-block min-w-[50px] ${
                                                        endingStock < 0
                                                            ? 'bg-red-50 text-red-600 border border-red-100'
                                                            : endingStock === 0
                                                            ? 'bg-gray-50 text-gray-400 border border-gray-100'
                                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    }`}>
                                                        {endingStock.toLocaleString('en-US')}
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
