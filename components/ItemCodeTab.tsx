'use client';

import React, { useState, useEffect } from 'react';
import { Search, Package, AlertCircle } from 'lucide-react';
import Loading from './Loading';

interface ItemCodeEntry {
    itemCode: string;
    barcode: string;
}

export default function ItemCodeTab() {
    const [itemCodes, setItemCodes] = useState<ItemCodeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchItemCodes();
    }, []);

    const fetchItemCodes = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/inventory/item-codes');
            const json = await res.json();
            if (json.data) {
                setItemCodes(json.data);
            }
        } catch (e) {
            console.error('Failed to load item codes', e);
        } finally {
            setLoading(false);
        }
    };

    // Filter based on search query
    const filteredItems = itemCodes.filter(item => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
            item.itemCode.toLowerCase().includes(query) ||
            item.barcode.toLowerCase().includes(query)
        );
    });

    if (loading) {
        return <Loading message="Loading Item Codes..." />;
    }

    return (
        <div className="space-y-6">
            {/* Search Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by Item Code or Barcode..."
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none transition-all focus:border-blue-400"
                    />
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            <tr>
                                <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">
                                    #
                                </th>
                                <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">
                                    Item Code
                                </th>
                                <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">
                                    Barcode
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredItems.length > 0 ? (
                                filteredItems.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50 transition-colors">
                                        <td className="px-6 py-4 text-center text-sm font-bold text-gray-400">
                                            {idx + 1}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm font-bold text-gray-800">
                                            {item.itemCode}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm font-mono text-gray-600">
                                            {item.barcode}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle className="w-8 h-8 opacity-50" />
                                            <p>
                                                {searchQuery
                                                    ? 'No results found for your search.'
                                                    : 'No item codes available.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer with count */}
                {filteredItems.length > 0 && (
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Package className="w-4 h-4" />
                                <span className="font-medium">
                                    Showing {filteredItems.length} of {itemCodes.length} items
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
