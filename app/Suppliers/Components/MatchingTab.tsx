import React, { useState, useEffect, useMemo } from 'react';
import { Search, FileSpreadsheet, MinusCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SupplierTransaction, SupplierSummary, standardizeToken } from './types';
import MatchingModal from './MatchingModal';
import NoData from '@/app/Components/NoDataTab';

interface MatchingTabProps {
    data: SupplierTransaction[];
}

export default function MatchingTab({ data }: MatchingTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [reportMonthFilter, setReportMonthFilter] = useState('');
    const [matchingData, setMatchingData] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [selectedSupplierForModal, setSelectedSupplierForModal] = useState<string | null>(null);

    useEffect(() => {
        fetchMatchingData();
    }, []);

    const fetchMatchingData = async () => {
        try {
            const res = await fetch('/api/SuppliersMatching');
            const json = await res.json();
            if (json.data) {
                const map: Record<string, string> = {};
                json.data.forEach((item: any) => {
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
        const months = updatedMonths !== undefined ? updatedMonths : getRawMonths(supplierName);
        setIsSaving(true);
        try {
            await fetch('/api/SuppliersMatching', {
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

    const getRawMonths = (supplierName: string) => {
        return matchingData[supplierName.trim().toUpperCase()] || '';
    };

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
        const map = new Map<string, SupplierSummary>();
        data.forEach(tx => {
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
    }, [data, searchQuery]);

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
                                className="flex items-center justify-center h-10 w-10 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors"
                            >
                                <FileSpreadsheet className="w-5 h-5" />
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
                    {processedData
                        .filter(s => !reportMonthFilter || (supplierMonths[s.supplierName] || []).includes(reportMonthFilter))
                        .map((supplier) => {
                            const available = supplierMonths[supplier.supplierName] || [];
                            const matchedTokens = getMatchedTokens(supplier.supplierName);

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
                    {processedData.filter(s => !reportMonthFilter || (supplierMonths[s.supplierName] || []).includes(reportMonthFilter)).length === 0 && (
                        <tr>
                            <td colSpan={reportMonthFilter ? 4 : 3} className="py-10">
                                <NoData />
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {selectedSupplierForModal && (
                <MatchingModal
                    supplierName={selectedSupplierForModal}
                    months={supplierMonths[selectedSupplierForModal] || []}
                    matchedTokens={getMatchedTokens(selectedSupplierForModal)}
                    toggleMatchingMonth={toggleMatchingMonth}
                    isSaving={isSaving}
                    onClose={() => setSelectedSupplierForModal(null)}
                />
            )}
        </div>
    );
}
