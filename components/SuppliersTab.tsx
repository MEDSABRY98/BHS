'use client';

import { useState, useEffect, useMemo } from 'react';
import { generateBulkSupplierStatementsPDF } from '@/lib/PdfUtils';
import * as XLSX from 'xlsx';
import { Printer, Search, FileSpreadsheet, FileText, CheckSquare, Save, X, CheckCircle2, AlertCircle, MinusCircle, FileDown } from 'lucide-react';

interface SupplierTransaction {
    date: string;
    number: string;
    supplierName: string;
    amount: number; // For calculation
    type: 'Purchase' | 'Refund';
}

interface SupplierSummary {
    supplierName: string;
    totalPurchase: number;
    totalRefund: number;
    netAmount: number;
    transactions: SupplierTransaction[];
}

interface SuppliersTabProps {
    data: SupplierTransaction[];
    activeTab: 'statements' | 'matching';
}

const MONTH_MAP: Record<string, string> = {
    '01': 'JAN', '02': 'FEB', '03': 'MAR', '04': 'APR', '05': 'MAY', '06': 'JUN',
    '07': 'JUL', '08': 'AUG', '09': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DEC',
    '1': 'JAN', '2': 'FEB', '3': 'MAR', '4': 'APR', '5': 'MAY', '6': 'JUN',
    '7': 'JUL', '8': 'AUG', '9': 'SEP', 'JAN': 'JAN', 'FEB': 'FEB', 'MAR': 'MAR',
    'APR': 'APR', 'MAY': 'MAY', 'JUN': 'JUN', 'JUL': 'JUL', 'AUG': 'AUG',
    'SEP': 'SEP', 'OCT': 'OCT', 'NOV': 'NOV', 'DEC': 'DEC'
};

/**
 * Standardizes any month string (e.g. "Jan 25", "01/25", "JAN-25") to "JAN25"
 */
const standardizeToken = (raw: string): string => {
    if (!raw) return '';
    const clean = raw.trim().toUpperCase();

    // Extract Month (Name or Number) and Year (2 or 4 digits)
    // Matches: JAN 25, JAN-25, 01/25, 1-2025, etc.
    const match = clean.match(/([A-Z]{3}|[0-9]{1,2})[^A-Z0-9]*([0-9]{2,4})/);
    if (!match) return clean.replace(/[^A-Z0-9]/g, '');

    let m = match[1];
    let y = match[2];

    // Convert month number to name
    const monthName = MONTH_MAP[m] || m;

    // Convert year to 2 digits
    const yearYY = y.length === 4 ? y.slice(-2) : y;

    return `${monthName}${yearYY}`;
};

export default function SuppliersTab({ data, activeTab }: SuppliersTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [reportMonthFilter, setReportMonthFilter] = useState('');
    const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
    const [matchingData, setMatchingData] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedSupplierForModal, setSelectedSupplierForModal] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab === 'matching') {
            fetchMatchingData();
        }
    }, [activeTab]);

    const fetchMatchingData = async () => {
        try {
            const res = await fetch('/api/suppliers-matching');
            const json = await res.json();
            if (json.data) {
                const map: Record<string, string> = {};
                json.data.forEach((item: any) => {
                    // Use Normalized Supplier Name as Key (Trimmed + Uppercase)
                    const key = item.name.trim().toUpperCase();
                    map[key] = item.months;
                });
                setMatchingData(map);
            }
        } catch (e) {
            console.error('Failed to fetch matching data', e);
        }
    };

    const handleSaveMatching = async (supplierName: string, updatedMonths?: string) => {
        const months = updatedMonths !== undefined ? updatedMonths : (getRawMonths(supplierName));
        setIsSaving(true);
        try {
            await fetch('/api/suppliers-matching', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supplierId: supplierName,
                    supplierName,
                    months
                })
            });
        } catch (e) {
            console.error(e);
            alert('Failed to save matching data');
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to get raw months string from normalized map
    const getRawMonths = (supplierName: string) => {
        return matchingData[supplierName.trim().toUpperCase()] || '';
    };

    // Helper to get array of standard tokens for a supplier
    const getMatchedTokens = (supplierName: string): string[] => {
        const raw = getRawMonths(supplierName);
        if (!raw) return [];
        return raw.split(',').map(m => standardizeToken(m)).filter(Boolean);
    };

    // Extract all unique months for each supplier from the data
    const supplierMonths = useMemo(() => {
        const map = new Map<string, Set<string>>();
        data.forEach(tx => {
            const d = new Date(tx.date);
            if (!isNaN(d.getTime())) {
                const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                const yy = d.getFullYear().toString().slice(-2);
                const token = `${mon}${yy}`;
                if (!map.has(tx.supplierName)) map.set(tx.supplierName, new Set());
                map.get(tx.supplierName)!.add(token);
            }
        });

        const result: Record<string, string[]> = {};
        map.forEach((months, name) => {
            result[name] = Array.from(months).sort((a, b) => {
                const monA = a.slice(0, 3);
                const yrA = parseInt(a.slice(3));
                const monB = b.slice(0, 3);
                const yrB = parseInt(b.slice(3));
                const monthsIdx: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
                if (yrA !== yrB) return yrA - yrB;
                return monthsIdx[monA] - monthsIdx[monB];
            });
        });
        return result;
    }, [data]);

    const allUniqueTokens = useMemo(() => {
        const tokens = new Set<string>();
        Object.values(supplierMonths).forEach(mList => mList.forEach(t => tokens.add(t)));
        return Array.from(tokens).sort((a, b) => {
            const monA = a.slice(0, 3);
            const yrA = parseInt(a.slice(3));
            const monB = b.slice(0, 3);
            const yrB = parseInt(b.slice(3));
            const monthsIdx: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
            if (yrA !== yrB) return yrA - yrB;
            return monthsIdx[monA] - monthsIdx[monB];
        });
    }, [supplierMonths]);

    const toggleMatchingMonth = async (supplierName: string, month: string) => {
        const currentMatchedTokens = getMatchedTokens(supplierName);
        const next = new Set(currentMatchedTokens);

        const targetToken = standardizeToken(month);
        if (next.has(targetToken)) next.delete(targetToken);
        else next.add(targetToken);

        const sortedNext = Array.from(next).sort((a, b) => {
            const monA = a.slice(0, 3);
            const yrA = parseInt(a.slice(3));
            const monB = b.slice(0, 3);
            const yrB = parseInt(b.slice(3));
            const monthsIdx: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
            if (yrA !== yrB) return yrA - yrB;
            return monthsIdx[monA] - monthsIdx[monB];
        });

        const nextStr = sortedNext.join(', ');

        // Optimistic Update
        setMatchingData(prev => ({ ...prev, [supplierName.trim().toUpperCase()]: nextStr }));

        // Save to Sheets
        await handleSaveMatching(supplierName, nextStr);
    };

    const processedData = useMemo(() => {
        let filteredTx = data;

        if (filterYear) {
            const y = filterYear.trim();
            if (y.length >= 2) {
                filteredTx = filteredTx.filter(tx => {
                    const d = new Date(tx.date);
                    if (isNaN(d.getTime())) return false;
                    const yearStr = d.getFullYear().toString();
                    return yearStr.includes(y) || yearStr.slice(-2) === y;
                });
            }
        }

        if (filterMonth) {
            const m = parseInt(filterMonth.trim());
            if (!isNaN(m) && m >= 1 && m <= 12) {
                filteredTx = filteredTx.filter(tx => {
                    const d = new Date(tx.date);
                    if (isNaN(d.getTime())) return false;
                    return (d.getMonth() + 1) === m;
                });
            }
        }

        const map = new Map<string, SupplierSummary>();
        filteredTx.forEach(tx => {
            const name = tx.supplierName;
            if (!map.has(name)) {
                map.set(name, {
                    supplierName: name,
                    totalPurchase: 0,
                    totalRefund: 0,
                    netAmount: 0,
                    transactions: []
                });
            }
            const summary = map.get(name)!;
            summary.transactions.push(tx);
            if (tx.type === 'Purchase') {
                summary.totalPurchase += tx.amount;
            } else {
                summary.totalRefund += tx.amount;
            }
            summary.netAmount = summary.totalPurchase - summary.totalRefund;
        });

        let summaries = Array.from(map.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName));

        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            summaries = summaries.filter(s => s.supplierName.toLowerCase().includes(lower));
        }

        return summaries;
    }, [data, filterYear, filterMonth, searchQuery]);

    const toggleSelectAll = () => {
        if (selectedSuppliers.size === processedData.length) {
            setSelectedSuppliers(new Set());
        } else {
            setSelectedSuppliers(new Set(processedData.map(s => s.supplierName)));
        }
    };

    const toggleSelect = (name: string) => {
        const next = new Set(selectedSuppliers);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setSelectedSuppliers(next);
    };

    const handleBulkPrint = async () => {
        if (selectedSuppliers.size === 0) return;
        setIsGenerating(true);
        try {
            const statements = [];
            for (const name of selectedSuppliers) {
                const summary = processedData.find(s => s.supplierName === name);
                if (summary) {
                    statements.push({
                        supplierName: name,
                        transactions: summary.transactions
                    });
                }
            }
            const pdfBlob = await generateBulkSupplierStatementsPDF(statements);
            const url = URL.createObjectURL(pdfBlob as Blob);
            window.open(url, '_blank');
        } catch (e) {
            console.error(e);
            alert('Error generating PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleBulkExcel = () => {
        if (selectedSuppliers.size === 0) return;
        setIsGenerating(true);
        try {
            const wb = XLSX.utils.book_new();
            const summaryRows = Array.from(selectedSuppliers).map(name => {
                const s = processedData.find(x => x.supplierName === name);
                return {
                    'Supplier Name': name,
                    'Total Purchase': s?.totalPurchase || 0,
                    'Total Refund': s?.totalRefund || 0,
                    'Net Balance': s?.netAmount || 0
                };
            });
            const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

            const detailRows: any[] = [];
            Array.from(selectedSuppliers).forEach(name => {
                const s = processedData.find(x => x.supplierName === name);
                if (s) {
                    s.transactions.forEach(tx => {
                        detailRows.push({
                            'Supplier Name': name,
                            'Date': tx.date,
                            'Type': tx.type,
                            'Number': tx.number,
                            'Purchase': tx.type === 'Purchase' ? tx.amount : 0,
                            'Refund': tx.type === 'Refund' ? tx.amount : 0
                        });
                    });
                }
            });
            const wsDetails = XLSX.utils.json_to_sheet(detailRows);
            XLSX.utils.book_append_sheet(wb, wsDetails, 'Details');
            XLSX.writeFile(wb, `Suppliers_Statement_${new Date().toISOString().split('T')[0]}.xlsx`);

        } catch (e) {
            console.error(e);
            alert('Error generating Excel');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExportMatchReport = () => {
        if (!reportMonthFilter) return;

        try {
            const wb = XLSX.utils.book_new();
            const rows = processedData.map(s => {
                const available = (supplierMonths[s.supplierName] || []).includes(reportMonthFilter);
                const matchedTokens = getMatchedTokens(s.supplierName);
                const isMatched = matchedTokens.includes(standardizeToken(reportMonthFilter));

                let status = 'No Data';
                if (available) {
                    status = isMatched ? 'Matched' : 'Pending';
                }

                return {
                    'Supplier Name': s.supplierName,
                    [`Status for ${reportMonthFilter}`]: status,
                    'Total Available Months': (supplierMonths[s.supplierName] || []).length,
                    'Total Matched Months': matchedTokens.length
                };
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, `Report ${reportMonthFilter}`);
            XLSX.writeFile(wb, `Suppliers_Match_Report_${reportMonthFilter}_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (e) {
            console.error(e);
            alert('Error generating report');
        }
    };

    return (
        <div className="p-6">
            {activeTab === 'statements' ? (
                <>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-8 w-full max-w-4xl mx-auto">
                        <div className="relative flex-1 w-full md:w-auto">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-center placeholder:text-gray-400"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Year"
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value)}
                                className="w-20 py-3 px-3 text-center border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder:text-gray-400"
                            />
                            <input
                                type="text"
                                placeholder="Month"
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value)}
                                className="w-20 py-3 px-3 text-center border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder:text-gray-400"
                            />
                        </div>

                        {selectedSuppliers.size > 0 && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                <button
                                    onClick={handleBulkPrint}
                                    disabled={isGenerating}
                                    className="p-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-sm transition-all disabled:opacity-70 flex-shrink-0"
                                >
                                    {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Printer className="h-5 w-5" />}
                                </button>
                                <button
                                    onClick={handleBulkExcel}
                                    disabled={isGenerating}
                                    className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-sm transition-all disabled:opacity-70 flex-shrink-0"
                                >
                                    <FileSpreadsheet className="h-5 w-5" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50/80 border-b border-gray-200 backdrop-blur-sm">
                                <tr>
                                    <th className="px-6 py-4 w-16 text-center">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                                            checked={processedData.length > 0 && selectedSuppliers.size === processedData.length}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="px-6 py-4 font-bold text-gray-700 text-center uppercase tracking-wider text-xs">Supplier Name</th>
                                    <th className="px-6 py-4 font-bold text-gray-700 text-center uppercase tracking-wider text-xs">Total Purchase</th>
                                    <th className="px-6 py-4 font-bold text-gray-700 text-center uppercase tracking-wider text-xs">Total Refund</th>
                                    <th className="px-6 py-4 font-bold text-gray-700 text-center uppercase tracking-wider text-xs">Net Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {processedData.map((supplier) => (
                                    <tr
                                        key={supplier.supplierName}
                                        className={`group transition-colors ${selectedSuppliers.has(supplier.supplierName) ? 'bg-teal-50/30' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                                                checked={selectedSuppliers.has(supplier.supplierName)}
                                                onChange={() => toggleSelect(supplier.supplierName)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-gray-900 text-center">{supplier.supplierName}</td>
                                        <td className="px-6 py-4 text-center text-gray-600">{supplier.totalPurchase.toLocaleString('en-US')} AED</td>
                                        <td className="px-6 py-4 text-center text-red-500">{supplier.totalRefund.toLocaleString('en-US')} AED</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`font-bold px-3 py-1 rounded-full text-sm ${supplier.netAmount > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {supplier.netAmount.toLocaleString('en-US')} AED
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {processedData.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-16">
                                            <div className="flex items-center justify-center gap-3 text-gray-500">
                                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <Search className="w-5 h-5 text-gray-400" />
                                                </div>
                                                <span className="font-medium">No suppliers found</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row items-center justify-center gap-8">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search suppliers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition-all outline-none text-sm font-medium"
                            />
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="flex items-center gap-3 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200">
                                <span className="text-[10px] uppercase font-black text-slate-400 ml-2">Report for</span>
                                <select
                                    value={reportMonthFilter}
                                    onChange={(e) => setReportMonthFilter(e.target.value)}
                                    className="bg-white border-none rounded-xl px-4 py-2 text-sm font-black text-teal-600 shadow-sm focus:ring-2 focus:ring-teal-500 outline-none min-w-[120px]"
                                >
                                    <option value="">Full View</option>
                                    {allUniqueTokens.map(token => (
                                        <option key={token} value={token}>{token}</option>
                                    ))}
                                </select>
                                {reportMonthFilter && (
                                    <button
                                        onClick={handleExportMatchReport}
                                        title="Export Excel Report"
                                        className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                                    >
                                        <FileDown className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier Name</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Available Months</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Matched Months</th>
                                {reportMonthFilter && (
                                    <th className="px-6 py-4 text-center text-xs font-bold text-emerald-600 uppercase tracking-wider">Status: {reportMonthFilter}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {processedData.map((supplier) => {
                                const available = supplierMonths[supplier.supplierName] || [];
                                const matchedTokens = getMatchedTokens(supplier.supplierName);

                                // Specific Status for Report (Normalized Comparison)
                                const targetStandardToken = standardizeToken(reportMonthFilter);
                                const hasDataInTargetMonth = available.includes(reportMonthFilter);
                                const isMatchedInTargetMonth = matchedTokens.includes(targetStandardToken);

                                return (
                                    <tr
                                        key={supplier.supplierName}
                                        className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                                        onClick={() => setSelectedSupplierForModal(supplier.supplierName)}
                                    >
                                        <td className="px-6 py-4 text-center border-r border-gray-50">
                                            <span className="font-black text-teal-600 group-hover:underline transition-all uppercase tracking-wide">
                                                {supplier.supplierName}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center border-r border-gray-50">
                                            <span className="bg-slate-100 text-slate-800 px-4 py-2 rounded-full font-black text-sm border border-slate-200 shadow-sm">
                                                {available.length}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center border-r border-gray-50">
                                            <span className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full font-black text-sm border border-emerald-100 shadow-sm">
                                                {matchedTokens.length}
                                            </span>
                                        </td>
                                        {reportMonthFilter && (
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center">
                                                    {!hasDataInTargetMonth ? (
                                                        <div className="flex items-center gap-1.5 text-slate-300">
                                                            <MinusCircle className="w-4 h-4" />
                                                            <span className="text-[10px] font-bold uppercase">No Data</span>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleMatchingMonth(supplier.supplierName, reportMonthFilter);
                                                            }}
                                                            className={`group/status flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all duration-300 ${isMatchedInTargetMonth
                                                                ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                                                : 'bg-rose-50 border-rose-100 text-rose-500 animate-pulse hover:animate-none'
                                                                }`}
                                                        >
                                                            {isMatchedInTargetMonth ? (
                                                                <>
                                                                    <CheckCircle2 className="w-4 h-4 fill-emerald-500 text-white" />
                                                                    <span className="text-[10px] font-black uppercase tracking-wider">Matched</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <AlertCircle className="w-4 h-4 fill-rose-500 text-white group-hover/status:rotate-12 transition-transform" />
                                                                    <span className="text-[10px] font-black uppercase tracking-wider">Pending</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MATCHING MODAL */}
            {selectedSupplierForModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">{selectedSupplierForModal}</h3>
                                <p className="text-sm text-slate-400 font-bold mt-1">Select months to match</p>
                            </div>
                            <button
                                onClick={() => setSelectedSupplierForModal(null)}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8">
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                {(supplierMonths[selectedSupplierForModal] || []).map(month => {
                                    const matchedTokens = getMatchedTokens(selectedSupplierForModal);
                                    const isMatched = matchedTokens.includes(standardizeToken(month));
                                    return (
                                        <button
                                            key={month}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleMatchingMonth(selectedSupplierForModal, month);
                                            }}
                                            className={`py-3 rounded-xl text-sm font-black transition-all border-2 flex items-center justify-center ${isMatched
                                                ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-100 scale-105'
                                                : 'bg-rose-50 text-rose-500 border-rose-100 hover:border-rose-200'
                                                }`}
                                        >
                                            {month}
                                        </button>
                                    );
                                })}
                                {(supplierMonths[selectedSupplierForModal] || []).length === 0 && (
                                    <div className="col-span-full py-12 text-center">
                                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Search className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <p className="text-slate-400 font-bold italic">No transaction data available for this supplier</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                    <span className="text-xs font-bold text-slate-500">Matched</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                                    <span className="text-xs font-bold text-slate-500">Not Matched</span>
                                </div>
                                {isSaving && (
                                    <div className="flex items-center gap-2 ml-4 text-teal-600">
                                        <div className="w-3 h-3 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-xs font-bold">Saving...</span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedSupplierForModal(null)}
                                className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-black hover:bg-slate-900 transition-all uppercase tracking-wider"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
