
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Package, RotateCw, AlertCircle, Plus,
    ArrowLeftRight, History, Layers, LogOut, ArrowRight, ArrowLeft
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Loading from './Loading';

// --- Types ---
interface ChipsyProduct {
    rowIndex: number;
    barcode: string;
    productName: string;
    qtyPcs: number;
    pcsInCtn: number;
}

interface ChipsyTransfer {
    user: string;
    date: string;
    type: 'IN' | 'OUT';
    personName?: string;
    customerName?: string;
    barcode: string;
    productName: string;
    qtyPcs: number;
    description?: string;
}

type TabView = 'inventory' | 'transfers' | 'new_transaction' | 'people_inventory' | 'person_details';

// --- Component ---
export default function ChipsyInventoryTab() {
    const [activeTab, setActiveTab] = useState<TabView>('inventory');
    const [products, setProducts] = useState<ChipsyProduct[]>([]);
    const [transfers, setTransfers] = useState<ChipsyTransfer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Transaction Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<ChipsyProduct | null>(null);
    const [transactionType, setTransactionType] = useState<'IN' | 'OUT'>('OUT');
    const [personName, setPersonName] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [description, setDescription] = useState('');
    const router = useRouter();

    // Person Inventory State
    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

    // Cart now holds all row data including search state for each row
    const [cart, setCart] = useState<{
        product: ChipsyProduct | null,
        qty: number | string,
        unit: 'CTN' | 'PCS',
        searchTerm: string,
        showDropdown: boolean
    }[]>([
        { product: null, qty: '', unit: 'CTN', searchTerm: '', showDropdown: false }
    ]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchInventory(), fetchTransfers()]);
        setLoading(false);
    };

    const fetchInventory = async () => {
        try {
            const res = await fetch('/api/chipsy');
            const json = await res.json();
            if (json.data) setProducts(json.data);
        } catch (e) {
            console.error('Failed to load chipsy inventory', e);
        }
    };

    const fetchTransfers = async () => {
        try {
            const res = await fetch('/api/chipsy/transfers');
            const json = await res.json();
            if (json.data) setTransfers(json.data);
        } catch (e) {
            console.error('Failed to load chipsy transfers', e);
        }
    };

    const activeUser = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : 'Unknown';

    // Row Management
    const addRow = () => {
        setCart([...cart, { product: null, qty: '', unit: 'CTN', searchTerm: '', showDropdown: false }]);
    };

    const removeRow = (index: number) => {
        if (cart.length === 1) {
            // If it's the last row, just reset it
            setCart([{ product: null, qty: '', unit: 'CTN', searchTerm: '', showDropdown: false }]);
            return;
        }
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const updateRow = (index: number, field: keyof typeof cart[0], value: any) => {
        const newCart = [...cart];

        if (field === 'searchTerm') {
            // If typing search, show dropdown, clear product
            newCart[index].product = null;
            newCart[index].showDropdown = true;
        }

        if (field === 'product') {
            // If selecting product, set product, set name to search term, hide dropdown
            newCart[index].product = value;
            newCart[index].searchTerm = value.productName;
            newCart[index].showDropdown = false;
            // Auto focus next qty input could be added here if we had refs
        }

        (newCart[index] as any)[field] = value;
        setCart(newCart);
    };

    const handleTransaction = async () => {
        // Filter out incomplete rows
        const validRows = cart.filter(row => row.product && row.qty && parseFloat(row.qty as string) > 0);

        if (validRows.length === 0 || !personName) return;

        setSubmitting(true);
        try {
            const promises = validRows.map(row => {
                // Determine actual Qty
                const finalQty = parseFloat(row.qty as string);

                const payload = {
                    barcode: row.product!.barcode,
                    type: transactionType,
                    qty: finalQty,
                    unit: row.unit,
                    personName,
                    customerName,
                    user: activeUser ? JSON.parse(activeUser).name : 'Unknown',
                    description: description
                };

                return fetch('/api/chipsy/transaction', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            });

            await Promise.all(promises);

            // Refresh Data
            await fetchData();
            setActiveTab('inventory');

            // Reset Form (Single Empty Row)
            setCart([{ product: null, qty: '', unit: 'CTN', searchTerm: '', showDropdown: false }]);
            setPersonName('');
            setCustomerName('');
            setDescription('');

        } catch (error) {
            alert('Transaction Failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculations
    const filteredProducts = useMemo(() => {
        if (!searchQuery) return products;
        const lower = searchQuery.toLowerCase();
        return products.filter(p =>
            p.productName.toLowerCase().includes(lower) ||
            p.barcode.includes(lower)
        );
    }, [products, searchQuery]);

    const stats = useMemo(() => {
        const totalPcs = products.reduce((acc, p) => acc + p.qtyPcs, 0);
        const totalCtns = products.reduce((acc, p) => acc + (p.qtyPcs / (p.pcsInCtn || 1)), 0);
        const totalItems = products.length;
        return { totalPcs, totalCtns, totalItems };
    }, [products]);

    // Person Inventory Stats
    const peopleStats = useMemo(() => {
        const persons: Record<string, Record<string, number>> = {}; // name -> { barcode: qty }

        transfers.forEach(t => {
            if (!t.personName) return;
            const name = t.personName.trim();
            if (!persons[name]) persons[name] = {};

            if (!persons[name][t.barcode]) persons[name][t.barcode] = 0;

            if (t.type === 'OUT') {
                persons[name][t.barcode] += t.qtyPcs;
            } else {
                persons[name][t.barcode] -= t.qtyPcs;
            }
        });

        // Convert to array
        const result = Object.entries(persons).map(([name, prodMap]) => {
            let totalPcs = 0;
            let totalCtns = 0;
            let productCount = 0;

            Object.entries(prodMap).forEach(([barcode, qty]) => {
                if (qty !== 0) {
                    productCount++;
                    totalPcs += qty;

                    // Find product for CTN calc
                    const prod = products.find(p => p.barcode === barcode);
                    const pcsInCtn = prod ? prod.pcsInCtn : 1;
                    totalCtns += qty / pcsInCtn;
                }
            });

            return { name, prodMap, totalPcs, totalCtns, productCount };
        }).filter(p => p.totalPcs !== 0 || p.productCount !== 0); // Hide empty

        return result.sort((a, b) => b.totalPcs - a.totalPcs);
    }, [transfers, products]);

    // Helper to get suggestions for a specific row
    const getRowSuggestions = (searchTerm: string) => {
        if (!searchTerm) return [];
        const lower = searchTerm.toLowerCase();
        return products.filter(p =>
            p.productName.toLowerCase().includes(lower) ||
            p.barcode.includes(lower)
        );
    };

    if (loading && products.length === 0) return <Loading message="Loading Chipsy System..." />;

    return (
        <div className="space-y-6 max-w-[95%] mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <div className="flex items-center gap-4 mb-2">
                        <button
                            onClick={() => router.push('/')}
                            disabled={activeTab === 'new_transaction'}
                            className={`p-2 border border-gray-200 rounded-xl transition-colors shadow-sm text-gray-600 ${activeTab === 'new_transaction' ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Package className="w-8 h-8 text-orange-600" />
                            Chipsy Inventory
                        </h1>
                    </div>
                </div>
                {activeTab !== 'new_transaction' && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setActiveTab('new_transaction'); }}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-sm transition-all font-medium"
                        >
                            <Plus className="w-5 h-5" /> New Transaction
                        </button>
                    </div>
                )}
            </div>

            {/* Tabs (Hide when in transaction mode) */}
            {activeTab !== 'new_transaction' && activeTab !== 'person_details' && (
                <div className="flex w-full bg-white rounded-xl shadow-sm p-1 border border-gray-200">
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={`flex-1 pb-3 pt-2 font-medium transition-colors border-b-2 text-center ${activeTab === 'inventory' ? 'border-orange-500 text-orange-600 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                        Current Inventory
                    </button>
                    <button
                        onClick={() => setActiveTab('people_inventory')}
                        className={`flex-1 pb-3 pt-2 font-medium transition-colors border-b-2 text-center ${activeTab === 'people_inventory' ? 'border-orange-500 text-orange-600 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                        People Inventory
                    </button>
                    <button
                        onClick={() => setActiveTab('transfers')}
                        className={`flex-1 pb-3 pt-2 font-medium transition-colors border-b-2 text-center ${activeTab === 'transfers' ? 'border-orange-500 text-orange-600 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                        History Logs
                    </button>
                </div>
            )}

            {/* Content */}
            {activeTab === 'inventory' && (
                <div className="space-y-4">
                    {/* Stats Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                            <p className="text-gray-500 text-xs uppercase font-bold">Total Products</p>
                            <p className="text-2xl font-bold text-gray-800">{stats.totalItems}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                            <p className="text-gray-500 text-xs uppercase font-bold">Total Stock (Pcs)</p>
                            <p className="text-2xl font-bold text-blue-600">{(stats.totalPcs).toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                            <p className="text-gray-500 text-xs uppercase font-bold">Total Stock (Ctns)</p>
                            <p className="text-2xl font-bold text-green-600">{(stats.totalCtns).toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-white pl-10 p-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none transition-all"
                        />
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-center">
                            <thead className="bg-white text-gray-500 text-sm uppercase border-b border-gray-200">
                                <tr>
                                    <th className="p-4 font-semibold text-center">Barcode</th>
                                    <th className="p-4 font-semibold text-center">Product</th>
                                    <th className="p-4 font-semibold text-center">Pcs/Ctn</th>
                                    <th className="p-4 font-semibold text-center bg-blue-50 text-blue-700">Stock (Pieces)</th>
                                    <th className="p-4 font-semibold text-center">Stock (Cartons)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredProducts.map(p => {
                                    const cartons = (p.qtyPcs / (p.pcsInCtn || 1)).toFixed(1);
                                    return (
                                        <tr key={p.barcode} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-mono text-sm text-gray-500 text-center">{p.barcode}</td>
                                            <td className="p-4 font-medium text-gray-800 text-center">{p.productName}</td>
                                            <td className="p-4 text-center text-gray-500 text-sm">{p.pcsInCtn}</td>
                                            <td className="p-4 text-center font-bold text-blue-600 bg-blue-50/30">{p.qtyPcs.toLocaleString()}</td>
                                            <td className="p-4 text-center font-medium text-gray-600">{cartons}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredProducts.length === 0 && <div className="p-8 text-center text-gray-400">No products found</div>}
                    </div>
                </div>
            )}

            {activeTab === 'transfers' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-center">
                        <thead className="bg-white text-gray-500 text-sm uppercase border-b border-gray-200">
                            <tr>
                                <th className="p-4 font-semibold text-center">Date</th>
                                <th className="p-4 font-semibold text-center">User</th>
                                <th className="p-4 font-semibold text-center">Type</th>
                                <th className="p-4 font-semibold text-center">Person Name</th>
                                <th className="p-4 font-semibold text-center">Customer Name</th>

                                <th className="p-4 font-semibold text-center">Product</th>
                                <th className="p-4 font-semibold text-center">Qty (Pcs)</th>
                                <th className="p-4 font-semibold text-center">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {transfers.map((t, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="p-4 text-sm text-gray-500 text-center">{t.date}</td>
                                    <td className="p-4 text-sm font-medium text-gray-700 text-center">{t.user}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-600 text-center">{t.personName || '-'}</td>
                                    <td className="p-4 text-sm text-gray-600 text-center">{t.customerName || '-'}</td>

                                    <td className="p-4 text-sm text-gray-800 text-center">{t.productName}</td>
                                    <td className="p-4 font-mono font-medium text-center">{t.qtyPcs > 0 ? '+' : ''}{t.type === 'OUT' ? '-' : ''}{t.qtyPcs}</td>
                                    <td className="p-4 text-sm text-gray-500 text-center italic">{t.description || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* New Transaction Tab (Full Screen) */}
            {activeTab === 'new_transaction' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">

                    {/* Header Controls */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        {/* Header Details same as before */}
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">New Bulk Transaction</h2>
                            <button onClick={() => setActiveTab('inventory')} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-all">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Type */}
                            <div className="md:col-span-1">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Transaction Type</label>
                                <div className="grid grid-cols-2 gap-4 h-[50px]">
                                    <button
                                        onClick={() => setTransactionType('IN')}
                                        className={`rounded-xl font-bold border-2 transition-all flex items-center justify-center gap-2 ${transactionType === 'IN' ? 'border-green-500 bg-green-50 text-green-700 shadow-sm' : 'border-gray-200 text-gray-400 hover:border-gray-300 bg-white'}`}
                                    >
                                        <ArrowLeftRight className="w-4 h-4" /> RECEIVE (IN)
                                    </button>
                                    <button
                                        onClick={() => setTransactionType('OUT')}
                                        className={`rounded-xl font-bold border-2 transition-all flex items-center justify-center gap-2 ${transactionType === 'OUT' ? 'border-red-500 bg-red-50 text-red-700 shadow-sm' : 'border-gray-200 text-gray-400 hover:border-gray-300 bg-white'}`}
                                    >
                                        <LogOut className="w-4 h-4" /> ISSUE (OUT)
                                    </button>
                                </div>
                            </div>

                            {/* Names */}
                            <div className="md:col-span-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Person Name</label>
                                        <input
                                            type="text"
                                            value={personName}
                                            onChange={e => setPersonName(e.target.value)}
                                            className="w-full h-[50px] px-4 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none transition-all"
                                            placeholder="Name for log reference..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Customer Name</label>
                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={e => setCustomerName(e.target.value)}
                                            className="w-full h-[50px] px-4 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none transition-all"
                                            placeholder="Optional customer name..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Description Field - Full Width Row */}
                        <div className="mt-4">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                            <input
                                type="text"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full h-[50px] px-4 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none transition-all"
                                placeholder="Enter transaction details..."
                            />
                        </div>
                    </div>

                    {/* Transaction Items Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-visible">
                        <div className="overflow-visible">
                            <table className="w-full">
                                <thead className="bg-white border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[50%]">Product</th>
                                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[20%]">Quantity</th>
                                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[20%]">Unit</th>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 w-[10%]">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {cart.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50">
                                            {/* Product Search Input */}
                                            <td className="px-6 py-4 align-top">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                    <input
                                                        type="text"
                                                        value={row.searchTerm}
                                                        onChange={e => updateRow(idx, 'searchTerm', e.target.value)}
                                                        onFocus={() => {
                                                            if (row.product) updateRow(idx, 'searchTerm', ''); // Clear name on fix to allow search
                                                            updateRow(idx, 'showDropdown', true);
                                                        }}
                                                        onBlur={() => {
                                                            // Small delay to allow click on dropdown
                                                            setTimeout(() => updateRow(idx, 'showDropdown', false), 200);
                                                        }}
                                                        placeholder="Search Name / Barcode..."
                                                        className={`w-full h-[50px] pl-9 pr-4 border-2 rounded-xl text-sm font-medium outline-none transition-all flex items-center ${row.product ? 'border-blue-100 bg-blue-50 text-blue-800' : 'border-gray-200 focus:border-orange-400'}`}
                                                    />

                                                    {/* Row Dropdown */}
                                                    {row.showDropdown && row.searchTerm && !row.product && (
                                                        <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-20">
                                                            {getRowSuggestions(row.searchTerm).length > 0 ? (
                                                                getRowSuggestions(row.searchTerm).map(p => (
                                                                    <div
                                                                        key={p.barcode}
                                                                        className="p-3 hover:bg-orange-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center"
                                                                        onMouseDown={() => updateRow(idx, 'product', p)} // MouseDown fires before Blur
                                                                    >
                                                                        <div>
                                                                            <p className="font-bold text-gray-800 text-sm">{p.productName}</p>
                                                                            <p className="text-xs text-gray-400 font-mono">{p.barcode}</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">
                                                                                {p.qtyPcs} Pcs
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="p-3 text-center text-xs text-gray-400">No matches</div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {row.product && row.product.pcsInCtn > 1 && (
                                                        <div className="mt-2 text-xs text-blue-400 pl-2">
                                                            Pcs/Ctn: {row.product.pcsInCtn} | Stock: {row.product.qtyPcs}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Qty Input */}
                                            <td className="px-6 py-4 align-top">
                                                <input
                                                    type="number"
                                                    value={row.qty}
                                                    onChange={e => updateRow(idx, 'qty', e.target.value)}
                                                    placeholder="0"
                                                    className="w-full h-[50px] border-2 border-gray-200 rounded-xl text-center font-bold focus:border-orange-400 outline-none"
                                                />
                                            </td>

                                            {/* Unit Toggle */}
                                            <td className="px-6 py-4 align-top">
                                                <div className="flex h-[50px] bg-gray-100 p-1 rounded-xl items-center">
                                                    <button
                                                        onClick={() => updateRow(idx, 'unit', 'CTN')}
                                                        className={`flex-1 h-full rounded-lg text-xs font-bold transition-all flex items-center justify-center ${row.unit === 'CTN' ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}
                                                    >
                                                        CTN
                                                    </button>
                                                    <button
                                                        onClick={() => updateRow(idx, 'unit', 'PCS')}
                                                        className={`flex-1 h-full rounded-lg text-xs font-bold transition-all flex items-center justify-center ${row.unit === 'PCS' ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}
                                                    >
                                                        PCS
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Delete Action */}
                                            <td className="px-6 py-4 align-top text-center">
                                                <div className="h-[50px] flex items-center justify-center">
                                                    <button
                                                        onClick={() => removeRow(idx)}
                                                        className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                        title="Remove Row"
                                                    >
                                                        <Plus className="w-5 h-5 rotate-45" />
                                                        <span className="sr-only">Delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer Actions */}
                        <div className="bg-white px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                            <button
                                onClick={addRow}
                                className="flex items-center gap-2 text-orange-600 font-bold hover:bg-orange-100 px-4 py-2 rounded-lg transition-colors"
                            >
                                <Plus className="w-5 h-5" /> Add New Row
                            </button>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setActiveTab('inventory')}
                                    className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-200 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleTransaction}
                                    disabled={submitting || !personName}
                                    className="px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 shadow-lg transition-all flex items-center gap-2"
                                >
                                    {submitting ? 'Saving...' : 'Confirm Transaction'} <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }

            {/* People Inventory Tab */}
            {
                activeTab === 'people_inventory' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-white border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Person Name</th>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Unique Products</th>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Total Cartons</th>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Total Pieces</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {peopleStats.length > 0 ? (
                                        peopleStats.map((person, idx) => (
                                            <tr
                                                key={idx}
                                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                                onClick={() => {
                                                    setSelectedPerson(person.name);
                                                    setActiveTab('person_details');
                                                }}
                                            >
                                                <td className="px-6 py-4 text-sm font-bold text-gray-800 text-center">{person.name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 text-center">{person.productCount}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 font-mono text-center">
                                                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">{person.totalCtns.toFixed(1)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-gray-800 text-center">{person.totalPcs}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <AlertCircle className="w-8 h-8 opacity-50" />
                                                    <p>No inventory records found for any person.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {/* Person Details Tab (Drill Down) */}
            {
                activeTab === 'person_details' && selectedPerson && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setActiveTab('people_inventory')}
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
                            >
                                <ArrowRight className="w-6 h-6 rotate-180" />
                            </button>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">{selectedPerson}</h2>
                                <p className="text-sm text-gray-500">Inventory Details</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-white border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Product Name</th>
                                            <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Cartons</th>
                                            <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Pieces</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {Object.entries(peopleStats.find(p => p.name === selectedPerson)?.prodMap || {})
                                            .filter(([_, qty]) => qty !== 0)
                                            .map(([barcode, qty]) => {
                                                const product = products.find(p => p.barcode === barcode);
                                                const productName = product ? product.productName : barcode;
                                                const pcsInCtn = product ? (product.pcsInCtn || 1) : 1;
                                                const ctns = qty / pcsInCtn;

                                                return (
                                                    <tr key={barcode} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-800 text-center">{productName}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-600 font-mono text-center">
                                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">{ctns.toFixed(1)}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-bold text-gray-800 text-center">{qty}</td>
                                                    </tr>
                                                );
                                            })}
                                        {(!peopleStats.find(p => p.name === selectedPerson)?.prodMap ||
                                            Object.values(peopleStats.find(p => p.name === selectedPerson)?.prodMap || {}).every(q => q === 0)) && (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-8 text-center text-gray-400">
                                                        No active inventory items.
                                                    </td>
                                                </tr>
                                            )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
}
