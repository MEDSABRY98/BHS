'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, AlertCircle, ChevronDown, Filter, Check } from 'lucide-react';
import Loading from './Loading';

interface ItemCodeEntry {
    tags: string;
    itemCode: string;
    barcode: string;
}

export default function ItemCodeTab() {
    const [itemCodes, setItemCodes] = useState<ItemCodeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTag, setActiveTag] = useState('All');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

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

    const uniqueTags = React.useMemo(() => {
        const tags = new Set<string>();
        itemCodes.forEach(item => {
            if (item.tags) {
                // Split multi-tags if they are comma-separated
                item.tags.split(',').forEach(t => tags.add(t.trim()));
            }
        });
        const sortedTags = Array.from(tags).filter(Boolean).sort((a, b) => a.localeCompare(b));
        return ['All', ...sortedTags];
    }, [itemCodes]);

    // Filter based on search query and tag
    const filteredItems = itemCodes.filter(item => {
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = !query || (
            item.itemCode.toLowerCase().includes(query) ||
            item.barcode.toLowerCase().includes(query)
        );

        const matchesTag = activeTag === 'All' || (item.tags && item.tags.split(',').map(t => t.trim()).includes(activeTag));

        return matchesSearch && matchesTag;
    });

    if (loading) {
        return <Loading message="Loading Item Codes..." />;
    }

    return (
        <div className="space-y-6">
            {/* Search Bar & Filter */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by Item Code or Barcode..."
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none transition-all focus:border-blue-400"
                    />
                </div>

                <div className="relative md:w-72 shrink-0 z-20" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`w-full flex items-center justify-between pl-12 pr-4 py-3 bg-white border-2 rounded-xl text-sm font-semibold transition-all outline-none ${isDropdownOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Filter className={`w-5 h-5 transition-colors ${isDropdownOpen ? 'text-indigo-600' : 'text-indigo-500'}`} />
                        </div>
                        <span className="text-gray-700">{activeTag === 'All' ? 'All Tags' : activeTag}</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                            {uniqueTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => {
                                        setActiveTag(tag);
                                        setIsDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center justify-between transition-colors group/item ${activeTag === tag ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                                >
                                    <span>{tag === 'All' ? 'All Tags' : tag}</span>
                                    {activeTag === tag && <Check className="w-4 h-4 text-indigo-600" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            <tr>
                                <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider text-white/90 w-[5%]">
                                    #
                                </th>
                                <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider text-white/90 w-[15%]">
                                    Tag
                                </th>
                                <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider text-white/90 w-[40%]">
                                    Item Code
                                </th>
                                <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider text-white/90 w-[40%]">
                                    Barcode
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredItems.length > 0 ? (
                                filteredItems.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="px-6 py-4 text-center text-sm font-bold text-gray-400 group-hover:text-blue-500">
                                            {idx + 1}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {item.tags ? (
                                                <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                    {item.tags}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm font-bold text-gray-800">
                                            {item.itemCode}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm font-mono text-gray-600 bg-gray-50/30 rounded-lg">
                                            {item.barcode}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
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
