'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Save, Loader2, RefreshCw, Edit2, X, Check, Plus, Trash2 } from 'lucide-react';

interface PaymentDefinitionEntry {
    customerId: string;
    customerName: string;
    date: string;
    invoiceNumber: string;
    amount: number;
    monthsClosed: string;
    rowIndex: number;
}

interface AllocationEntry {
    id: string;
    month: string;
    year: string;
    amount: string;
}

const MONTHS = ['OB', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default function PaymentDefinitionTab() {
    const [data, setData] = useState<PaymentDefinitionEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [entries, setEntries] = useState<AllocationEntry[]>([]);
    const [saving, setSaving] = useState(false);
    const [maxAmount, setMaxAmount] = useState<number>(0);

    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/payment-definitions');
            const result = await res.json();
            if (result.error) throw new Error(result.error);
            setData(result.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            // alert('Failed to load payment definitions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const lower = searchTerm.toLowerCase();
        return data.filter(row =>
            row.customerName.toLowerCase().includes(lower) ||
            row.invoiceNumber.toLowerCase().includes(lower)
        );
    }, [data, searchTerm]);

    const handleEdit = (row: PaymentDefinitionEntry) => {
        setEditingRow(row.rowIndex);
        setMaxAmount(row.amount);
        const newEntries: AllocationEntry[] = [];
        if (row.monthsClosed) {
            const regex = /([A-Z]{3}) (\d{2,4}) \((\d+)\)/g;
            let match;
            while ((match = regex.exec(row.monthsClosed)) !== null) {
                newEntries.push({
                    id: Math.random().toString(36).substr(2, 9),
                    month: match[1],
                    year: match[2],
                    amount: match[3]
                });
            }
        }
        if (newEntries.length === 0) {
            newEntries.push({
                id: Math.random().toString(36).substr(2, 9),
                month: 'JAN',
                year: new Date().getFullYear().toString().slice(-2),
                amount: ''
            });
        }
        setEntries(newEntries);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingRow(null);
        setEntries([]);
        setMaxAmount(0);
    };

    const handleAddRow = () => {
        setEntries([...entries, {
            id: Math.random().toString(36).substr(2, 9),
            month: 'JAN',
            year: new Date().getFullYear().toString().slice(-2),
            amount: ''
        }]);
    };

    const handleRemoveRow = (id: string) => {
        setEntries(entries.filter(e => e.id !== id));
    };

    const handleEntryChange = (id: string, field: keyof AllocationEntry, value: string) => {
        setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const totalAllocated = entries.reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);
    const isOverLimit = maxAmount > 0 && totalAllocated > maxAmount;

    const handleSave = async () => {
        if (editingRow === null || isOverLimit) return;
        setSaving(true);

        const parts = entries
            .filter(e => e.amount && e.amount.trim() !== '')
            .map(e => `${e.month} ${e.year} (${e.amount})`);

        const finalString = parts.join(', ');

        try {
            const res = await fetch('/api/payment-definitions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex: editingRow, monthsClosed: finalString })
            });
            const result = await res.json();
            if (result.error) throw new Error(result.error);

            setData(prev => prev.map(row =>
                row.rowIndex === editingRow ? { ...row, monthsClosed: finalString } : row
            ));
            closeModal();
        } catch (error) {
            console.error('Error updating:', error);
            alert('Failed to update');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row justify-center items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                <div className="relative w-full md:w-96 group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
                        placeholder="Search by Customer Name or Invoice..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="md:absolute md:right-4">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className={`p-2 rounded-lg transition-colors ${loading ? 'bg-blue-50 text-blue-600 cursor-wait' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                            <tr>
                                <th className="px-6 py-4 w-[10%] text-center">Date</th>
                                <th className="px-6 py-4 w-[20%] text-center">Customer Name</th>
                                <th className="px-6 py-4 w-[40%] text-center">Invoice #</th>
                                <th className="px-6 py-4 w-[10%] text-center">Amount</th>
                                <th className="px-6 py-4 w-[15%] text-center">Months Closed</th>
                                <th className="px-6 py-4 w-[5%] text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                            <p>Loading definitions...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        No records found.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row) => (
                                    <tr key={row.rowIndex} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 text-sm text-gray-600 font-mono text-center">{row.date}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 text-center">{row.customerName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600 font-mono text-center font-bold text-lg">{row.invoiceNumber}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900 text-center">
                                            {row.amount?.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-800 text-center truncate max-w-[200px]" title={row.monthsClosed}>
                                            {row.monthsClosed || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                <button
                                                    onClick={() => handleEdit(row)}
                                                    className="p-2 rounded-full hover:bg-blue-50 text-blue-600 transition-colors"
                                                    title={row.monthsClosed || "Add details"}
                                                >
                                                    <Edit2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b pb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Edit Months Closed</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Allocated: <span className={isOverLimit ? "text-red-600 font-bold" : "text-gray-900 font-bold"}>
                                        {totalAllocated.toLocaleString()}
                                    </span>
                                    {' / '}
                                    <span className="text-gray-900 font-bold">{maxAmount?.toLocaleString()}</span>
                                </p>
                            </div>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                            <div className="space-y-3">
                                {entries.map((entry) => (
                                    <div key={entry.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-gray-50/50 p-3 rounded-xl border border-gray-100 hover:border-blue-200 transition-all">
                                        <div className="flex gap-2 flex-1 w-full">
                                            <div className="w-24">
                                                <label className="block text-xs font-semibold text-gray-500 mb-1 ml-1">Year</label>
                                                <input
                                                    type="text"
                                                    value={entry.year}
                                                    onChange={(e) => handleEntryChange(entry.id, 'year', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-center font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                    placeholder="Year"
                                                />
                                            </div>
                                            <div className="w-28">
                                                <label className="block text-xs font-semibold text-gray-500 mb-1 ml-1">Month</label>
                                                <select
                                                    value={entry.month}
                                                    onChange={(e) => handleEntryChange(entry.id, 'month', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none cursor-pointer"
                                                >
                                                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-gray-500 mb-1 ml-1">Amount</label>
                                                <input
                                                    type="number"
                                                    value={entry.amount}
                                                    onChange={(e) => handleEntryChange(entry.id, 'amount', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveRow(entry.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-6 sm:mt-0"
                                            title="Remove row"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleAddRow}
                                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 font-medium"
                            >
                                <Plus className="w-5 h-5" />
                                Add Month Allocation
                            </button>
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t mt-2">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || isOverLimit}
                                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${saving || isOverLimit ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
