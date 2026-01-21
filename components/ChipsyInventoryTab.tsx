
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Package, RotateCw, AlertCircle, Plus,
    ArrowLeftRight, History, Layers, LogOut, ArrowRight, ArrowLeft
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Loading from './Loading';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

// --- Types ---
interface ChipsyProduct {
    rowIndex: number;
    barcode: string;
    productName: string;
    qtyPcs: number;
    pcsInCtn: number;
    price: number;
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
    number?: string;
}

type TabView = 'inventory' | 'transfers' | 'new_transaction' | 'people_inventory' | 'person_details' | 'transaction_details';

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

    // Transaction Details State
    const [selectedTransactionNumber, setSelectedTransactionNumber] = useState<string>('');
    const [selectedTransactionItems, setSelectedTransactionItems] = useState<ChipsyTransfer[]>([]);

    // Print State
    const [printTransaction, setPrintTransaction] = useState<any>(null);

    // Cart now holds all row data including search state for each row
    const [cart, setCart] = useState<{
        product: ChipsyProduct | null,
        qty: number | string,
        unit: 'CTN' | 'PCS',
        price: number,
        searchTerm: string,
        showDropdown: boolean
    }[]>([
        { product: null, qty: '', unit: 'CTN', price: 0, searchTerm: '', showDropdown: false }
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

    // Auto-populate cart with all products when opening New Transaction tab
    useEffect(() => {
        if (activeTab === 'new_transaction' && products.length > 0) {
            const sortedProducts = [...products].sort((a, b) => a.productName.localeCompare(b.productName));
            console.log('Populating cart with', sortedProducts.length, 'products');

            const allRows = sortedProducts.map(p => ({
                product: p,
                searchTerm: `${p.productName} - ${p.barcode}`,
                qty: '',
                unit: 'CTN' as 'CTN' | 'PCS',
                price: p.price || 0,
                showDropdown: false
            }));
            setCart(allRows);
        }
    }, [activeTab]);

    const activeUser = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : 'Unknown';

    // Row Management
    const addRow = () => {
        setCart([...cart, { product: null, qty: '', unit: 'CTN', price: 0, searchTerm: '', showDropdown: false }]);
    };

    const removeRow = (index: number) => {
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
            newCart[index].searchTerm = `${value.productName} - ${value.barcode}`;
            newCart[index].price = value.price || 0;
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
            // New Batch Transaction Payload
            const payload = {
                transaction: {
                    type: transactionType,
                    user: activeUser ? JSON.parse(activeUser).name : 'Unknown',
                    personName,
                    customerName,
                    description
                },
                items: validRows.map(row => ({
                    barcode: row.product!.barcode,
                    qty: parseFloat(row.qty as string),
                    unit: row.unit
                }))
            };

            const res = await fetch('/api/chipsy/transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success && data.transactionNumber) {
                // Set print data to trigger hidden invoice render
                const now = new Date();
                setPrintTransaction({
                    number: data.transactionNumber,
                    date: `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}`,
                    person: personName,
                    customer: customerName,
                    items: validRows.map(row => ({
                        barcode: row.product!.barcode,
                        name: row.product!.productName,
                        qtyPcs: parseFloat(row.qty as string) * (row.unit === 'CTN' ? row.product!.pcsInCtn : 1),
                        qtyCtns: (parseFloat(row.qty as string) * (row.unit === 'CTN' ? row.product!.pcsInCtn : 1)) / (row.product!.pcsInCtn || 1),
                        price: row.price || 0
                    }))
                });

                // Wait for render then print
                setTimeout(async () => {
                    const element = document.getElementById('transaction-invoice');
                    if (element) {
                        try {
                            const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                            const imgData = canvas.toDataURL('image/jpeg', 0.7);
                            const pdf = new jsPDF('p', 'mm', 'a4');
                            const pdfWidth = pdf.internal.pageSize.getWidth();
                            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                            pdf.save(`${data.transactionNumber}.pdf`);
                        } catch (e) {
                            console.error('PDF Generation Failed', e);
                            alert('PDF Generation Failed');
                        } finally {
                            setPrintTransaction(null);
                        }
                    } else {
                        console.error('Invoice element not found');
                        setPrintTransaction(null);
                    }
                }, 1000);
            }

            // Refresh Data
            await fetchData();
            setActiveTab('inventory');

            // Reset Form (Wait for fetch to finish to avoid UI jump?)
            setCart([{ product: null, qty: '', unit: 'CTN', price: 0, searchTerm: '', showDropdown: false }]);
            setPersonName('');
            setCustomerName('');
            setDescription('');

        } catch (error) {
            console.error(error);
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
                                <th className="p-4 font-semibold text-center">Trx #</th>
                                <th className="p-4 font-semibold text-center">Date</th>
                                <th className="p-4 font-semibold text-center">User</th>
                                <th className="p-4 font-semibold text-center">Type</th>
                                <th className="p-4 font-semibold text-center">Person / Customer</th>
                                <th className="p-4 font-semibold text-center">Items</th>
                                <th className="p-4 font-semibold text-center">Total Qty (Pcs)</th>
                                <th className="p-4 font-semibold text-center">Total Qty (Ctns)</th>
                                <th className="p-4 font-semibold text-center">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(() => {
                                const grouped = new Map<string, typeof transfers>();
                                transfers.forEach(t => {
                                    const key = t.number || `LEGACY-${t.date}-${t.personName}`;
                                    if (!grouped.has(key)) grouped.set(key, []);
                                    grouped.get(key)!.push(t);
                                });

                                return Array.from(grouped.entries()).map(([trxNum, items], idx) => {
                                    const first = items[0];
                                    const count = items.length;
                                    const totalQty = items.reduce((acc, i) => acc + i.qtyPcs, 0);

                                    const totalCartons = items.reduce((acc, i) => {
                                        const p = products.find(prod => prod.barcode === i.barcode);
                                        return acc + (i.qtyPcs / (p?.pcsInCtn || 1));
                                    }, 0).toFixed(1);

                                    return (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4">
                                                <button
                                                    onClick={() => {
                                                        setSelectedTransactionNumber(trxNum);
                                                        setSelectedTransactionItems(items);
                                                        setActiveTab('transaction_details');
                                                    }}
                                                    className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline text-sm"
                                                >
                                                    {trxNum.startsWith('LEGACY') ? 'Old Log' : trxNum}
                                                </button>
                                            </td>
                                            <td className="p-4 text-sm text-gray-500">{first.date}</td>
                                            <td className="p-4 text-sm font-medium text-gray-700">{first.user}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${first.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {first.type}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-gray-600">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold">{first.personName || '-'}</span>
                                                    {first.customerName && <span className="text-xs text-gray-400">{first.customerName}</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm font-bold text-gray-700">{count}</td>
                                            <td className="p-4 font-mono font-medium text-gray-800">{totalQty}</td>
                                            <td className="p-4 font-mono font-medium text-green-700">{totalCartons}</td>
                                            <td className="p-4 text-sm text-gray-500 italic">{first.description || '-'}</td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Transaction Details Tab */}
            {activeTab === 'transaction_details' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setActiveTab('transfers')}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                                </button>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">
                                        Transaction {selectedTransactionNumber.startsWith('LEGACY') ? 'Details' : selectedTransactionNumber}
                                    </h2>
                                    <p className="text-gray-500 text-sm">{selectedTransactionItems[0]?.date}</p>
                                </div>
                            </div>
                            <span className={`px-4 py-2 rounded-lg text-sm font-bold ${selectedTransactionItems[0]?.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {selectedTransactionItems[0]?.type === 'IN' ? 'RECEIVED' : 'ISSUED'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8 p-4 bg-gray-50 rounded-xl">
                            <div className="text-center">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">User</p>
                                <p className="font-semibold text-gray-800">{selectedTransactionItems[0]?.user}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Person Name</p>
                                <p className="font-semibold text-gray-800">{selectedTransactionItems[0]?.personName || '-'}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Customer</p>
                                <p className="font-semibold text-gray-800">{selectedTransactionItems[0]?.customerName || '-'}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Qty</p>
                                <p className="font-semibold text-blue-600">
                                    {selectedTransactionItems.reduce((acc, i) => acc + i.qtyPcs, 0)} Pcs
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Cartons</p>
                                <p className="font-semibold text-green-600">
                                    {selectedTransactionItems.reduce((acc, i) => {
                                        const p = products.find(prod => prod.barcode === i.barcode);
                                        return acc + (i.qtyPcs / (p?.pcsInCtn || 1));
                                    }, 0).toFixed(1)} Ctns
                                </p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-gray-200">
                            <table className="w-full text-center">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Barcode</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Product Name</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Qty (Pieces)</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Qty (Ctns)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {[...selectedTransactionItems].sort((a, b) => a.productName.localeCompare(b.productName)).map((item, idx) => {
                                        const product = products.find(p => p.barcode === item.barcode);
                                        const pcsInCtn = product?.pcsInCtn || 1;
                                        const cartons = (item.qtyPcs / pcsInCtn).toFixed(1);
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-mono text-sm text-gray-500 text-center">{item.barcode}</td>
                                                <td className="px-6 py-4 font-medium text-gray-900 text-center">{item.productName}</td>
                                                <td className="px-6 py-4 text-center font-bold text-blue-600">{item.qtyPcs}</td>
                                                <td className="px-6 py-4 text-center font-medium text-gray-600">{cartons}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
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
                                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 w-[5%]">#</th>
                                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[30%]">Product</th>
                                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[15%]">Quantity</th>
                                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[15%]">Unit</th>
                                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[15%]">Price / Pcs</th>
                                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[15%]">Total</th>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 w-[5%]">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {cart.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50">
                                            {/* Index */}
                                            <td className="px-6 py-4 align-top text-center font-bold text-gray-400 pt-7">
                                                {idx + 1}
                                            </td>

                                            {/* Product Search Input */}
                                            <td className="px-6 py-4 align-top">
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={row.searchTerm}
                                                        onChange={e => updateRow(idx, 'searchTerm', e.target.value)}
                                                        onFocus={() => {
                                                            updateRow(idx, 'showDropdown', true);
                                                        }}
                                                        onBlur={() => {
                                                            // Small delay to allow click on dropdown
                                                            setTimeout(() => updateRow(idx, 'showDropdown', false), 200);
                                                        }}
                                                        placeholder="Search Name / Barcode..."
                                                        className={`w-full h-[50px] px-4 border-2 rounded-xl text-sm font-medium outline-none transition-all flex items-center ${row.product ? 'border-blue-100 bg-blue-50 text-blue-800' : 'border-gray-200 focus:border-orange-400'}`}
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
                                                            Pcs/Ctn: {row.product.pcsInCtn} | Stock: {row.product.qtyPcs} Pcs / {(row.product.qtyPcs / row.product.pcsInCtn).toFixed(1)} Ctns
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

                                            {/* Price Input */}
                                            <td className="px-6 py-4 align-top">
                                                <input
                                                    type="number"
                                                    value={row.price}
                                                    onChange={e => updateRow(idx, 'price', parseFloat(e.target.value))}
                                                    className="w-full h-[50px] border-2 border-gray-200 rounded-xl text-center font-bold focus:border-orange-400 outline-none"
                                                />
                                            </td>

                                            {/* Total Display */}
                                            <td className="px-6 py-4 align-top">
                                                <div className="h-[50px] flex items-center justify-center font-mono font-bold text-gray-700 bg-gray-50 rounded-xl border border-gray-200">
                                                    {(() => {
                                                        const qty = parseFloat(row.qty as string) || 0;
                                                        const pcsInCtn = row.product?.pcsInCtn || 1;
                                                        const multiplier = row.unit === 'CTN' ? pcsInCtn : 1;
                                                        const total = qty * multiplier * (row.price || 0);
                                                        return total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                    })()}
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

                        {/* Totals Footer */}
                        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                            {(() => {
                                const subTotal = cart.reduce((acc, row) => {
                                    const qty = parseFloat(row.qty as string) || 0;
                                    const pcsInCtn = row.product?.pcsInCtn || 1;
                                    const multiplier = row.unit === 'CTN' ? pcsInCtn : 1;
                                    return acc + (qty * multiplier * (row.price || 0));
                                }, 0);
                                const vat = subTotal * 0.05;
                                const grandTotal = subTotal + vat;

                                return (
                                    <div className="flex justify-end gap-8">
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-gray-400 uppercase">Subtotal</p>
                                            <p className="font-mono font-bold text-gray-800">{subTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-gray-400 uppercase">VAT (5%)</p>
                                            <p className="font-mono font-bold text-red-600">{vat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-gray-400 uppercase">Grand Total</p>
                                            <p className="font-mono font-bold text-xl text-blue-600">{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer Actions */}
                        <div className="bg-white px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                            <button
                                onClick={addRow}
                                disabled={submitting}
                                className="flex items-center gap-2 text-orange-600 font-bold hover:bg-orange-100 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-5 h-5" /> Add New Row
                            </button>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setActiveTab('inventory')}
                                    disabled={submitting}
                                    className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Hidden Invoice Template */}
            {printTransaction && (
                <div style={{ position: 'fixed', top: '-9999px', left: '-9999px' }}>
                    <div id="transaction-invoice" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', backgroundColor: 'white', color: 'black', fontFamily: 'Arial, sans-serif' }}>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '5mm' }}>
                            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>Al Marai Al Arabia Trading Sole Proprietorship L.L.C</h1>
                        </div>

                        {/* Info Section */}
                        <div style={{ textAlign: 'center', marginBottom: '10mm', borderBottom: '1px solid #ddd', paddingBottom: '5mm' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '5mm', fontSize: '14px', fontWeight: 'bold' }}>
                                <span>{printTransaction.date}</span>
                                <span>|</span>
                                <span>{printTransaction.number}</span>
                                <span>|</span>
                                <span>{printTransaction.person}</span>
                            </div>

                            {printTransaction.customer && (
                                <div style={{ fontSize: '16px', color: '#000', fontWeight: 'bold' }}>
                                    {printTransaction.customer}
                                </div>
                            )}
                        </div>

                        {/* Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10mm' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#16a34a', color: 'white' }}>
                                    <th style={{ width: '40%', paddingTop: '1mm', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', border: '1px solid #16a34a' }}>Barcode / Product</th>
                                    <th style={{ width: '15%', paddingTop: '1mm', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', border: '1px solid #16a34a' }}>Qty (Pcs)</th>
                                    <th style={{ width: '15%', paddingTop: '1mm', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', border: '1px solid #16a34a' }}>Qty (Ctns)</th>
                                    <th style={{ width: '15%', paddingTop: '1mm', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', border: '1px solid #16a34a' }}>Price</th>
                                    <th style={{ width: '15%', paddingTop: '1mm', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', border: '1px solid #16a34a' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {printTransaction.items.map((item: any, idx: number) => {
                                    const total = item.qtyPcs * item.price;
                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ paddingTop: '1mm', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', border: '1px solid #eee' }}>
                                                <span style={{ fontWeight: 'bold', marginRight: '5px' }}>{item.barcode}</span>
                                                <span>{item.name}</span>
                                            </td>
                                            <td style={{ paddingTop: '1mm', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', border: '1px solid #eee' }}>{item.qtyPcs}</td>
                                            <td style={{ paddingTop: '1mm', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', border: '1px solid #eee' }}>{item.qtyCtns.toFixed(2)}</td>
                                            <td style={{ paddingTop: '1mm', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', border: '1px solid #eee' }}>{item.price.toFixed(2)}</td>
                                            <td style={{ paddingTop: '1mm', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', border: '1px solid #eee' }}>{total.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Footer Totals */}
                        <div style={{ float: 'right', width: '60mm', textAlign: 'right', fontSize: '12px' }}>
                            {(() => {
                                const subTotal = printTransaction.items.reduce((acc: number, item: any) => acc + (item.qtyPcs * item.price), 0);
                                const vat = subTotal * 0.05;
                                const grandTotal = subTotal + vat;
                                return (
                                    <>
                                        <div style={{ marginBottom: '2mm', display: 'flex', justifyContent: 'space-between' }}><span>Subtotal:</span> <span style={{ fontWeight: 'bold' }}>{subTotal.toFixed(2)}</span></div>
                                        <div style={{ marginBottom: '2mm', display: 'flex', justifyContent: 'space-between' }}><span>VAT (5%):</span> <span style={{ fontWeight: 'bold' }}>{vat.toFixed(2)}</span></div>
                                        <div style={{ borderTop: '1px solid #000', paddingTop: '2mm', fontSize: '14px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}><span>Grand Total:</span> <span>{grandTotal.toFixed(2)}</span></div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
