import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, FileSpreadsheet, MinusCircle, CheckCircle2, AlertCircle, ChevronDown, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SupplierTransaction, SupplierSummary, standardizeToken } from './types';
import MatchingModal from './MatchingModal';
import NoData from '@/app/Components/NoDataTab';
import { getSuppliersMatching, saveSuppliersMatching } from '../Service/suppliers_service';

interface MatchingTabProps {
    data: SupplierTransaction[];
}

const MONTH_INDEX: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

const formatMonthTokenLabel = (token: string) => {
    if (!token) return 'Full View';
    const mon = token.slice(0, 3);
    const yy = parseInt(token.slice(3), 10);
    if (Number.isNaN(yy) || MONTH_INDEX[mon] === undefined) return token;
    const year = 2000 + yy;
    return new Date(year, MONTH_INDEX[mon], 1).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
    });
};

export default function MatchingTab({ data }: MatchingTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [reportMonthFilter, setReportMonthFilter] = useState('');
    const [matchingData, setMatchingData] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [selectedSupplierForModal, setSelectedSupplierForModal] = useState<string | null>(null);
    const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
    const monthDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
                setIsMonthDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchMatchingData();
    }, []);

    const fetchMatchingData = async () => {
        try {
            const json = await getSuppliersMatching();
            if (json && json.data) {
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
            await saveSuppliersMatching(supplierName, months);
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

    const monthOptions = useMemo(
        () => [
            { value: '', label: 'Full View' },
            ...allUniqueTokens.map((token) => ({
                value: token,
                label: formatMonthTokenLabel(token),
            })),
        ],
        [allUniqueTokens],
    );

    const selectedMonthLabel = formatMonthTokenLabel(reportMonthFilter);

    const visibleSuppliers = useMemo(
        () =>
            processedData.filter(
                (s) => !reportMonthFilter || (supplierMonths[s.supplierName] || []).includes(reportMonthFilter)
            ),
        [processedData, reportMonthFilter, supplierMonths]
    );

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
        <>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-8 w-full max-w-5xl mx-auto">
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search suppliers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition-all outline-none text-sm font-medium"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <span className="text-[10px] uppercase font-black text-slate-400 shrink-0">Report for</span>
                    <div className="relative w-full md:w-64 min-w-[240px]" ref={monthDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsMonthDropdownOpen((open) => !open)}
                            className={`w-full px-4 py-3 bg-white border rounded-xl shadow-sm outline-none text-sm font-bold transition-all flex items-center justify-between gap-3 group ${
                                isMonthDropdownOpen
                                    ? 'border-teal-500 ring-2 ring-teal-500/20'
                                    : 'border-gray-200 hover:border-teal-300'
                            }`}
                        >
                            <span className="flex items-center gap-2 min-w-0">
                                <Calendar className={`w-4 h-4 shrink-0 ${reportMonthFilter ? 'text-teal-600' : 'text-slate-400'}`} />
                                <span className={`truncate ${reportMonthFilter ? 'text-teal-700' : 'text-slate-500 font-semibold'}`}>
                                    {selectedMonthLabel}
                                </span>
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isMonthDropdownOpen ? 'rotate-180 text-teal-600' : 'group-hover:text-slate-600'}`} />
                        </button>

                        {isMonthDropdownOpen && (
                            <div className="absolute z-[100] mt-2 w-full min-w-[240px] bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden ring-1 ring-slate-100 animate-in fade-in zoom-in-95 duration-150">
                                <div className="max-h-72 overflow-y-auto py-1">
                                    {monthOptions.map((option) => (
                                        <button
                                            key={option.value || 'full-view'}
                                            type="button"
                                            onClick={() => {
                                                setReportMonthFilter(option.value);
                                                setIsMonthDropdownOpen(false);
                                            }}
                                            className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between gap-3 ${
                                                reportMonthFilter === option.value
                                                    ? 'bg-teal-50 text-teal-700 font-bold'
                                                    : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-teal-600'
                                            }`}
                                        >
                                            <span className="truncate">{option.label}</span>
                                            {reportMonthFilter === option.value && (
                                                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {reportMonthFilter && (
                        <button
                            onClick={handleExportMatchReport}
                            title="Export Excel Report"
                            className="flex items-center justify-center h-10 w-10 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors shrink-0"
                        >
                            <FileSpreadsheet className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {visibleSuppliers.length === 0 ? (
                <NoData />
            ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier Name</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Available Months</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Matched Months</th>
                        {reportMonthFilter && (
                            <th className="px-6 py-4 text-center text-xs font-bold text-emerald-600 uppercase tracking-wider">Status: {selectedMonthLabel}</th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {visibleSuppliers.map((supplier) => {
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
                </tbody>
            </table>
            </div>
            )}

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
        </>
    );
}
