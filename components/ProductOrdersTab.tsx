'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Package, ShoppingCart,
    ArrowUpDown, RotateCw, RefreshCw, AlertCircle, FileDown
} from 'lucide-react';
import Loading from './Loading';
import { OrderItem, ProductOrder as BaseProductOrder } from './ProductOrdersMakeTab';
import ProductSalesAnalysisModal from './ProductSalesAnalysisModal';

// Ensure local interface matches BaseProductOrder so we can cast it.
interface ProductOrder extends BaseProductOrder {
    salesBreakdown?: { label: string; qty: number }[];
    minQ?: number;
    maxQ?: number;
}

interface Props {
    orderItems: OrderItem[];
    setOrderItems: (items: OrderItem[]) => void;
}

// ... Components ...
const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: number | string, icon: any, color: 'blue' | 'green' | 'red' | 'amber' }) => {
    const styles = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', icon: 'text-blue-600' },
        green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100', icon: 'text-green-600' },
        red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100', icon: 'text-red-600' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', icon: 'text-amber-600' },
    };

    const s = styles[color];

    return (
        <div className={`rounded-xl border ${s.border} bg-white p-5 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <div className={`text-2xl font-bold ${s.text}`}>{value}</div>
                </div>
                <div className={`p-3 rounded-lg ${s.bg}`}>
                    <Icon className={`w-6 h-6 ${s.icon}`} />
                </div>
            </div>
        </div>
    );
};

export default function ProductOrdersTab({ orderItems, setOrderItems }: Props) {
    const [products, setProducts] = useState<ProductOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<keyof ProductOrder>('qtyFreeToUse');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'out_of_stock' | 'low_stock'>('all');
    const [packSizes, setPackSizes] = useState<Record<string, string>>({});
    const [limits, setLimits] = useState<Record<string, { min: string, max: string }>>({});

    // Modal State
    const [selectedProductForAnalysis, setSelectedProductForAnalysis] = useState<ProductOrder | null>(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/inventory/orders');
            const json = await res.json();

            if (!res.ok) throw new Error(json.details || json.error || 'Failed to fetch orders data');

            const data = json.data || [];
            setProducts(data);

            // Initialize pack sizes and limits
            const initialPackSizes: Record<string, string> = {};
            const initialLimits: Record<string, { min: string, max: string }> = {};

            data.forEach((p: ProductOrder) => {
                if (p.qinc) {
                    initialPackSizes[p.productId] = p.qinc.toString();
                }
                const min = p.minQ !== undefined ? p.minQ.toString() : '';
                const max = p.maxQ !== undefined ? p.maxQ.toString() : '';
                initialLimits[p.productId] = { min, max };
            });
            setPackSizes(initialPackSizes);
            setLimits(initialLimits);
            setError(null);
        } catch (err) {
            console.error('Error loading orders:', err);
            setError('Failed to load orders data');
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const totalProducts = products.length;
        const lowStock = products.filter(p => p.qtyFreeToUse > 0 && p.qtyFreeToUse < (p.salesQty || 0) * 0.25).length;
        const outOfStock = products.filter(p => p.qtyFreeToUse <= 0).length;

        return { totalProducts, lowStock, outOfStock };
    }, [products]);

    const filteredAndSortedProducts = useMemo(() => {
        let result = [...products];

        // Filter by Search Query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p =>
                p.productName.toLowerCase().includes(query) ||
                p.barcode.toLowerCase().includes(query) ||
                p.productId.toLowerCase().includes(query) ||
                p.tags.toLowerCase().includes(query)
            );
        }

        // Filter by Status
        if (statusFilter !== 'all') {
            result = result.filter(p => {
                if (statusFilter === 'out_of_stock') return p.qtyFreeToUse <= 0;
                if (statusFilter === 'low_stock') return p.qtyFreeToUse > 0 && p.qtyFreeToUse < (p.salesQty || 0) * 0.25;
                if (statusFilter === 'in_stock') return p.qtyFreeToUse > 0;
                return true;
            });
        }

        // Sort
        result.sort((a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }
            return 0;
        });

        return result;
    }, [products, searchQuery, statusFilter, sortField, sortDirection]);

    const handleSort = (field: keyof ProductOrder) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (field: keyof ProductOrder) => {
        if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
        return <ArrowUpDown className={`w-4 h-4 text-blue-600 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} />;
    };

    // Helper to handle order qty change
    const handleOrderQtyChange = (product: ProductOrder, qtyStr: string) => {
        const qty = parseInt(qtyStr);

        if (isNaN(qty) || qty <= 0) {
            // If empty string or invalid, remove from order logic could be debated.
            // User: "don't delete the number visual input"
            // But we display `orderItem.orderQty`. So if I type 0, it removes from list, and visual becomes empty or 0.
            // Let's stick to standard behavior: if invalid/0, remove from list.
            if (qtyStr === '' || qty === 0) {
                setOrderItems(orderItems.filter(item => item.productId !== product.productId));
            }
            return;
        }

        const existingItemIndex = orderItems.findIndex(item => item.productId === product.productId);

        if (existingItemIndex >= 0) {
            // Update
            const newItems = [...orderItems];
            newItems[existingItemIndex] = { ...newItems[existingItemIndex], orderQty: qty };
            setOrderItems(newItems);
        } else {
            // Add
            setOrderItems([...orderItems, { ...product, orderQty: qty }]);
        }
    };

    const handleQincSave = async (product: ProductOrder) => {
        const val = packSizes[product.productId];
        // If empty, treat as 1
        const qincValue = val ? parseFloat(val) : 0;

        // Optimistic update/No need to wait, but let's save to backend
        try {
            await fetch('/api/inventory/update-qinc', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex: product.rowIndex, qinc: qincValue })
            });
            // Optional: show toast/notification
        } catch (error) {
            console.error('Failed to save QINC', error);
            // Revert or show error? For now, silent fail/log is okay as input persists state
        }
    };

    const handleLimitSave = async (product: ProductOrder, field: 'minQ' | 'maxQ') => {
        const val = field === 'minQ' ? limits[product.productId]?.min : limits[product.productId]?.max;
        const numValue = val ? parseFloat(val) : 0;

        try {
            await fetch('/api/inventory/update-limit', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex: product.rowIndex, field, value: numValue })
            });
        } catch (error) {
            console.error(`Failed to save ${field}`, error);
        }
    };

    const handleExportExcel = async () => {
        try {
            const XLSX = await import('xlsx');

            // Prepare data for export
            const exportData = filteredAndSortedProducts.map(product => {
                const packSize = parseFloat(packSizes[product.productId]) || 1;
                const cartons = product.qtyFreeToUse / packSize;
                const minLimit = limits[product.productId]?.min || '';
                const maxLimit = limits[product.productId]?.max || '';

                return {
                    'Barcode': product.barcode || '---',
                    'Product Name': product.productName,
                    'Tags': product.tags || '',
                    'Min (Ctn)': minLimit,
                    'Max (Ctn)': maxLimit,
                    'Free (Pcs)': product.qtyFreeToUse,
                    'Free (Ctns)': cartons.toFixed(1),
                    'Units/Carton': packSize
                };
            });

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Set column widths
            ws['!cols'] = [
                { wch: 15 }, // Barcode
                { wch: 35 }, // Product Name
                { wch: 15 }, // Tags
                { wch: 12 }, // Min
                { wch: 12 }, // Max
                { wch: 12 }, // Free Pcs
                { wch: 12 }, // Free Ctns
                { wch: 12 }  // Units/Carton
            ];

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Inventory Orders');

            // Generate filename with date
            const today = new Date();
            const dateStr = today.toISOString().slice(0, 10);
            const filename = `Inventory_Orders_${dateStr}.xlsx`;

            // Download
            XLSX.writeFile(wb, filename);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Failed to export Excel file');
        }
    };

    if (loading && products.length === 0) return <Loading message="Loading Product Orders Data..." />;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-2xl border border-red-100 mt-4">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-red-700 mb-2">Error Loading Data</h3>
                <p className="text-red-500 mb-6">{error}</p>
                <button
                    onClick={fetchOrders}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                    <RotateCw className="w-4 h-4" /> Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Search & Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Total Products"
                    value={stats.totalProducts}
                    icon={Package}
                    color="blue"
                />
                <StatCard
                    title="Low Stock Warning"
                    value={stats.lowStock}
                    icon={AlertCircle}
                    color="amber"
                />
                <StatCard
                    title="Out of Stock"
                    value={stats.outOfStock}
                    icon={ShoppingCart}
                    color="red"
                />
            </div>

            <div className="relative flex flex-col md:flex-row justify-center items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="relative w-full max-w-xl group flex gap-2">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-center placeholder:text-center"
                            placeholder="Search by name, barcode, ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                        <option value="all">All Status</option>
                        <option value="in_stock">In Stock</option>
                        <option value="out_of_stock">Out of Stock</option>
                        <option value="low_stock">Low Stock</option>
                    </select>
                </div>

                <div className="flex items-center gap-3 md:absolute md:right-4">
                    <button
                        onClick={handleExportExcel}
                        disabled={filteredAndSortedProducts.length === 0}
                        className={`p-2 rounded-lg transition-colors ${filteredAndSortedProducts.length === 0
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                            }`}
                        title="Export to Excel"
                    >
                        <FileDown className="w-5 h-5" />
                    </button>
                    <button
                        onClick={fetchOrders}
                        disabled={loading}
                        className={`p-2 rounded-lg transition-colors ${loading ? 'bg-blue-50 text-blue-600 cursor-wait' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-900 text-white">
                                <th
                                    className="sticky top-20 z-30 bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[15%] cursor-pointer hover:bg-gray-800 transition-colors shadow-md"
                                    onClick={() => handleSort('barcode')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Barcode
                                        {getSortIcon('barcode')}
                                    </div>
                                </th>
                                <th
                                    className="sticky top-20 z-30 bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[30%] cursor-pointer hover:bg-gray-800 transition-colors shadow-md"
                                    onClick={() => handleSort('productName')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Product Name
                                        {getSortIcon('productName')}
                                    </div>
                                </th>
                                <th className="sticky top-20 z-30 bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[9%] shadow-md">Min (Ctn)</th>
                                <th className="sticky top-20 z-30 bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[9%] shadow-md">Max (Ctn)</th>
                                <th
                                    className="sticky top-20 z-30 bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[9%] cursor-pointer hover:bg-gray-800 transition-colors shadow-md"
                                    onClick={() => handleSort('qtyFreeToUse')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Free (Pcs)
                                        {getSortIcon('qtyFreeToUse')}
                                    </div>
                                </th>
                                <th
                                    className="sticky top-20 z-30 bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[9%] shadow-md"
                                >
                                    Free (Ctns)
                                </th>
                                <th className="sticky top-20 z-30 bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[9%] shadow-md">Units/Carton</th>
                                <th className="sticky top-20 z-30 bg-gray-900 text-white border border-gray-700 p-3 text-sm font-bold w-[9%] shadow-md">Make Order</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedProducts.map((product, idx) => {
                                const isLowStock = product.qtyFreeToUse > 0 && product.qtyFreeToUse < (product.salesQty || 0) * 0.25;
                                const isOutOfStock = product.qtyFreeToUse <= 0;
                                const orderItem = orderItems.find(item => item.productId === product.productId);
                                const orderQty = orderItem ? orderItem.orderQty : '';

                                const packSize = parseFloat(packSizes[product.productId]) || 1;
                                const cartons = product.qtyFreeToUse / packSize;

                                return (
                                    <tr
                                        key={`${product.productId}-${idx}`}
                                        className="hover:bg-blue-50"
                                    >
                                        <td className="border border-gray-300 p-2 text-center">
                                            <span className="font-mono text-sm text-gray-700 font-bold bg-gray-50 px-2 py-1 rounded border border-gray-200 block w-full">
                                                {product.barcode || '---'}
                                            </span>
                                        </td>
                                        <td className="border border-gray-300 p-2 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="font-semibold text-gray-800 text-sm leading-snug">
                                                    {product.productName}
                                                </span>
                                                {product.tags && (
                                                    <span className="text-[10px] text-gray-400 truncate max-w-[150px] mt-1">
                                                        {product.tags}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Min Q input */}
                                        <td className="border border-gray-300 p-2">
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-full px-1 py-1 text-base text-center font-bold focus:outline-none focus:bg-blue-50 bg-transparent"
                                                placeholder="Min"
                                                value={limits[product.productId]?.min || ''}
                                                onChange={(e) => setLimits(prev => ({
                                                    ...prev,
                                                    [product.productId]: { ...prev[product.productId], min: e.target.value }
                                                }))}
                                                onBlur={() => handleLimitSave(product, 'minQ')}
                                            />
                                        </td>
                                        {/* Max Q input */}
                                        <td className="border border-gray-300 p-2">
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-full px-1 py-1 text-base text-center font-bold focus:outline-none focus:bg-blue-50 bg-transparent"
                                                placeholder="Max"
                                                value={limits[product.productId]?.max || ''}
                                                onChange={(e) => setLimits(prev => ({
                                                    ...prev,
                                                    [product.productId]: { ...prev[product.productId], max: e.target.value }
                                                }))}
                                                onBlur={() => handleLimitSave(product, 'maxQ')}
                                            />
                                        </td>
                                        <td className="border border-gray-300 p-2 text-center">
                                            <div className="flex flex-col items-center relative gap-1">
                                                <span className={`text-base font-bold ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-emerald-600'
                                                    }`}>
                                                    {product.qtyFreeToUse}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="border border-gray-300 p-2 text-center">
                                            <span className="font-bold text-gray-700 text-sm">
                                                {cartons.toFixed(1)}
                                            </span>
                                        </td>
                                        {/* Sales Data Removed */}
                                        <td className="border border-gray-300 p-2">
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full px-1 py-1 text-base text-center font-bold focus:outline-none focus:bg-blue-50 bg-transparent"
                                                placeholder=""
                                                value={packSizes[product.productId] || ''}
                                                onChange={(e) => setPackSizes(prev => ({ ...prev, [product.productId]: e.target.value }))}
                                                onBlur={() => handleQincSave(product)}
                                            />
                                        </td>

                                        <td className="border border-gray-300 p-2">
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-full px-1 py-1 text-base text-center font-bold focus:outline-none focus:bg-blue-50 bg-transparent"
                                                placeholder=""
                                                value={orderQty}
                                                onChange={(e) => handleOrderQtyChange(product, e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                </div>
                {filteredAndSortedProducts.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center justify-center text-gray-400">
                        <Package className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-semibold">No products found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                    </div>
                )}
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-500">
                    Showing {filteredAndSortedProducts.length} of {products.length} products
                </div>
            </div>

            {/* Analysis Modal */}
            {selectedProductForAnalysis && (
                <ProductSalesAnalysisModal
                    product={selectedProductForAnalysis}
                    isOpen={!!selectedProductForAnalysis}
                    onClose={() => setSelectedProductForAnalysis(null)}
                    packSize={parseFloat(packSizes[selectedProductForAnalysis.productId]) || 1}
                />
            )}
        </div>
    );
}
