'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Package, ShoppingCart,
    AlertCircle, RefreshCw, ArrowUpDown, FileDown, Mail
} from 'lucide-react';
import Loading from './Loading';
import { ProductOrder as BaseProductOrder } from './ProductOrdersMakeTab';

// Ensure local interface matches
interface ProductOrder extends BaseProductOrder {
    salesBreakdown?: { label: string; qty: number }[];
    minQ?: number;
    maxQ?: number;
}

export default function NotificationOrderTab() {
    const [products, setProducts] = useState<ProductOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTag, setActiveTag] = useState<string>('All');

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
            console.log('NotificationTab: Received products:', data.length);
            // DEBUG: Check first few products for minQ/qinc/tags
            if (data.length > 0) {
                console.log('NotificationTab: Sample Product:', data[0]);
            }

            setProducts(data);
            setError(null);
        } catch (err) {
            console.error('Error loading orders:', err);
            setError('Failed to load orders data');
        } finally {
            setLoading(false);
        }
    };

    // Filter products below Min Q
    const lowStockProducts = useMemo(() => {
        const filtered = products.filter(p => {
            const min = p.minQ !== undefined ? Number(p.minQ) : 0;
            if (min <= 0) return false; // No limit set

            // Calculate current cartons
            const packSize = p.qinc && Number(p.qinc) > 0 ? Number(p.qinc) : 1;
            const currentCtns = (p.qtyFreeToUse || 0) / packSize;

            const isLow = currentCtns < min;
            // if (isLow) console.log(`NotificationTab: Low Stock detected: ${p.productName} (Current: ${currentCtns}, Min: ${min})`);
            return isLow;
        });
        console.log('NotificationTab: Low Stock Products Count:', filtered.length);
        return filtered;
    }, [products]);

    // Extract Tags from low stock products
    const tags = useMemo(() => {
        const uniqueTags = new Set<string>();
        uniqueTags.add('All');
        lowStockProducts.forEach(p => {
            if (p.tags) {
                // Split by comma if multiple tags? Assuming single tag or simple string for now as per prompt "from TAGS column"
                // User said "subtabs arranged alphabetically and taken from TAGS column"
                // Usually tags might be comma separated, but let's assume the column value is the category.
                // Trimming and capitalising first letter might be good.
                const tag = p.tags.trim();
                if (tag) uniqueTags.add(tag);
            } else {
                uniqueTags.add('Uncategorized');
            }
        });
        return Array.from(uniqueTags).sort();
    }, [lowStockProducts]);

    // Filter by Tag and Search
    const displayedProducts = useMemo(() => {
        let result = lowStockProducts;

        // Filter by Tag
        if (activeTag !== 'All') {
            if (activeTag === 'Uncategorized') {
                result = result.filter(p => !p.tags || !p.tags.trim());
            } else {
                result = result.filter(p => p.tags && p.tags.trim() === activeTag);
            }
        }

        // Filter by Search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p =>
                p.productName.toLowerCase().includes(query) ||
                p.barcode.toLowerCase().includes(query)
            );
        }

        // Sort by diff (Shortage) descending? Or Name? User asked for subtabs alphabetical.
        // Let's sort products by Name inside the tab.
        result.sort((a, b) => a.productName.localeCompare(b.productName));

        return result;
    }, [lowStockProducts, activeTag, searchQuery]);

    const handleEmailReport = async () => {
        try {
            const XLSX = await import('xlsx');

            // 1. Generate Excel with Multiple Sheets
            const wb = XLSX.utils.book_new();

            // Sheet 1: All Items (Filtered by Low Stock)
            const allItemsData = lowStockProducts.map(p => {
                const packSize = p.qinc || 1;
                const currentCtns = (p.qtyFreeToUse || 0) / packSize;

                return {
                    'Barcode': p.barcode || '---',
                    'Product Name': p.productName,
                    'Category': p.tags || 'Uncategorized',
                    'Current (Ctn)': currentCtns.toFixed(2),
                    'Min Limit (Ctn)': p.minQ || 0,
                    'Status': p.qtyFreeToUse <= 0 ? 'Zero Quantity' : 'Below Min'
                };
            });

            const wsAll = XLSX.utils.json_to_sheet(allItemsData);
            // Auto width
            wsAll['!cols'] = [
                { wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
            ];
            XLSX.utils.book_append_sheet(wb, wsAll, 'Low Stock Items');

            // Sheets by Tag (Filtered by Low Stock)
            const allTags = new Set<string>();
            lowStockProducts.forEach(p => {
                if (p.tags) allTags.add(p.tags);
                else allTags.add('Uncategorized');
            });

            Array.from(allTags).sort().forEach(tag => {
                const tagItems = lowStockProducts.filter(p => (p.tags || 'Uncategorized') === tag);
                if (tagItems.length > 0) {
                    const tagData = tagItems.map(p => {
                        const packSize = p.qinc || 1;
                        const currentCtns = (p.qtyFreeToUse || 0) / packSize;
                        return {
                            'Barcode': p.barcode || '---',
                            'Product Name': p.productName,
                            'Current (Ctn)': currentCtns.toFixed(2),
                            'Min Limit (Ctn)': p.minQ || 0
                        };
                    });

                    const wsTag = XLSX.utils.json_to_sheet(tagData);
                    wsTag['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 }];

                    // Sheet name max 31 chars and safe chars
                    const safeTagName = tag.substring(0, 30).replace(/[:\/?*\[\]\\]/g, "");
                    XLSX.utils.book_append_sheet(wb, wsTag, safeTagName);
                }
            });

            // Save File
            const today = new Date();
            const dateStr = today.toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Inventory_Status_${dateStr}.xlsx`);

            // 2. Prepare Email Body
            const itemsToReport = lowStockProducts; // Use the filtered Low Stock products (Notification Tab items)
            const timeStr = today.toLocaleString('en-GB'); // DD/MM/YYYY, HH:MM:SS

            let body = "Dear Mr. Sadek,\n\n";
            body += `This is the list of Low Stock Items (Below Minimum) as of ${timeStr}:\n\n`;

            if (itemsToReport.length > 0) {
                // Limit to first 20 items to prevent mailto URL length issues
                const maxItems = 20;
                const listedItems = itemsToReport.slice(0, maxItems);

                listedItems.forEach(p => {
                    const packSize = p.qinc || 1;
                    const current = (p.qtyFreeToUse || 0) / packSize;
                    const barcode = p.barcode || 'No Barcode';
                    body += `- [${barcode}] ${p.productName} (Current: ${current.toFixed(1)} Ctn, Min: ${p.minQ})\n`;
                });

                if (itemsToReport.length > maxItems) {
                    body += `\n...and ${itemsToReport.length - maxItems} more items. Please check the attached Excel file for the full list.\n`;
                }
            } else {
                body += "No items are currently below the minimum limit.\n";
            }

            body += "\nBest Regards,\nInventory Warehouse Mazid";

            // 3. Open Email Client
            const subject = `Low Stock Alert Report - ${dateStr}`;

            // Trigger mailto after a short delay to allow Excel download to initiate
            setTimeout(() => {
                window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }, 500);

        } catch (error) {
            console.error('Error handling email report:', error);
            alert('Failed to generate report');
        }
    };

    const handleExportExcel = async () => {
        try {
            const XLSX = await import('xlsx');

            // Prepare data for export
            const exportData = displayedProducts.map(product => {
                const packSize = product.qinc || 1;
                const currentCtns = product.qtyFreeToUse / packSize;
                const min = product.minQ || 0;
                const shortage = min - currentCtns;

                return {
                    'Barcode': product.barcode || '---',
                    'Product Name': product.productName,
                    'Category': product.tags || 'Uncategorized',
                    'Current (Ctn)': currentCtns.toFixed(1),
                    'Min Limit (Ctn)': min,
                    'Shortage (Ctn)': shortage.toFixed(1),
                    'Status': 'Below Minimum'
                };
            });

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Set column widths
            ws['!cols'] = [
                { wch: 15 }, // Barcode
                { wch: 35 }, // Product Name
                { wch: 20 }, // Category
                { wch: 15 }, // Current
                { wch: 15 }, // Min Limit
                { wch: 15 }, // Shortage
                { wch: 15 }  // Status
            ];

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Low Stock Alerts');

            // Generate filename with date
            const today = new Date();
            const dateStr = today.toISOString().slice(0, 10);
            const filename = `Low_Stock_Alerts_${activeTag}_${dateStr}.xlsx`;

            // Download
            XLSX.writeFile(wb, filename);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Failed to export Excel file');
        }
    };

    if (loading && products.length === 0) return <Loading message="Checking Inventory Limits..." />;

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
                    <RefreshCw className="w-4 h-4" /> Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Search */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Low Stock Alerts
                    <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">
                        {lowStockProducts.length} Products
                    </span>
                </h2>

                <div className="relative w-full md:w-96 group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        placeholder="Search alerts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportExcel}
                        disabled={displayedProducts.length === 0}
                        className={`p-2 rounded-lg transition-colors ${displayedProducts.length === 0
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                            }`}
                        title="Export to Excel"
                    >
                        <FileDown className="w-5 h-5" />
                    </button>

                    <button
                        onClick={handleEmailReport}
                        disabled={products.length === 0}
                        className={`p-2 rounded-lg transition-colors ${products.length === 0
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                        title="Send Email Report"
                    >
                        <Mail className="w-5 h-5" />
                    </button>

                    <button
                        onClick={fetchOrders}
                        disabled={loading}
                        className={`p-2 rounded-lg transition-colors ${loading
                            ? 'bg-blue-50 text-blue-600 cursor-wait'
                            : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                        title="Refresh"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Tags Tabs */}
            <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                    <button
                        key={tag}
                        onClick={() => setActiveTag(tag)}
                        className={`min-w-[120px] px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTag === tag
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                            }`}
                    >
                        {tag}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-900 text-white">
                            <th className="p-3 text-sm font-bold w-[15%]">Barcode</th>
                            <th className="p-3 text-sm font-bold w-[35%]">Product Name</th>
                            <th className="p-3 text-sm font-bold w-[10%]">Current (Ctn)</th>
                            <th className="p-3 text-sm font-bold w-[10%]">Min Limit (Ctn)</th>
                            <th className="p-3 text-sm font-bold w-[10%]">Shortage (Ctn)</th>
                            <th className="p-3 text-sm font-bold w-[20%]">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayedProducts.length > 0 ? (
                            displayedProducts.map((product, idx) => {
                                const packSize = product.qinc || 1;
                                const currentCtns = product.qtyFreeToUse / packSize;
                                const min = product.minQ || 0;
                                const shortage = min - currentCtns;

                                return (
                                    <tr key={`${product.productId}-${idx}`} className="hover:bg-red-50 group transition-colors border-b border-gray-100 last:border-0">
                                        <td className="p-3 text-center border-r border-gray-100">
                                            <span className="font-mono text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                                {product.barcode || '---'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center border-r border-gray-100">
                                            <div className="flex flex-col items-center">
                                                <span className="font-semibold text-gray-800">{product.productName}</span>
                                                {product.tags && <span className="text-xs text-gray-400 mt-1">{product.tags}</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center border-r border-gray-100">
                                            <span className="text-gray-700 font-bold">
                                                {currentCtns.toFixed(1)}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center border-r border-gray-100">
                                            <span className="text-gray-500">
                                                {min}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center border-r border-gray-100 bg-red-50/50">
                                            <span className="text-red-600 font-bold">
                                                -{shortage.toFixed(1)}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                                <AlertCircle className="w-3 h-3" />
                                                Below Minimum
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-gray-400">
                                    <div className="flex flex-col items-center justify-center">
                                        <Package className="w-12 h-12 mb-3 opacity-20" />
                                        <p>No alerts found in this category.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
