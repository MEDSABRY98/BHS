import React from 'react';
import { FileSpreadsheet, X } from 'lucide-react';
import { DeliveryEntry } from './types';
import NoData from '../01-Unified/NoDataTab';

interface MissingItemsTabProps {
    groupedMissingItems: {
        order: DeliveryEntry;
        items: {
            item: string;
            status: 'pending' | 'canceled';
            id: string;
        }[];
    }[];
    canDownload: boolean;
    exportMissingItemsCSV: () => void;
    filterYear: string;
    setFilterYear: (y: string) => void;
    filterMonth: string;
    setFilterMonth: (m: string) => void;
    filterDateFrom: string;
    setFilterDateFrom: (d: string) => void;
    filterDateTo: string;
    setFilterDateTo: (d: string) => void;
}

export default function MissingItemsTab({
    groupedMissingItems,
    canDownload,
    exportMissingItemsCSV,
    filterYear,
    setFilterYear,
    filterMonth,
    setFilterMonth,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo
}: MissingItemsTabProps) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 font-bold">
            <div className="flex items-center justify-between mb-[14px]">
                <div className="flex items-center gap-2 text-[15px] font-[700] text-[#0F1A14]">
                    <div className="w-[3px] h-[16px] bg-[#4F46E5] rounded-[3px]"></div>
                    Missing & Canceled Items Track
                </div>
                {canDownload && (
                    <button
                        onClick={exportMissingItemsCSV}
                        title="Export Excel"
                        className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm flex items-center justify-center transition-colors"
                    >
                        <FileSpreadsheet className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* DATE FILTER BAR */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-[14px] bg-white border-[1.5px] border-[#E4EDE8] rounded-[12px] px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)] font-bold">
                <span className="text-[11px] font-[800] text-[#5A7266] uppercase tracking-widest whitespace-nowrap">📅 Filter by Date</span>
                <div className="w-px h-4 bg-[#E4EDE8]" />

                {/* Year */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-[700] text-[#5A7266]">Year</span>
                    <input
                        type="text"
                        placeholder="e.g. 2025"
                        value={filterYear}
                        onChange={e => setFilterYear(e.target.value)}
                        maxLength={4}
                        className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all w-[90px]"
                    />
                </div>

                {/* Month */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-[700] text-[#5A7266]">Month</span>
                    <input
                        type="text"
                        placeholder="e.g. 02"
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value)}
                        maxLength={2}
                        className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all w-[90px]"
                    />
                </div>

                <div className="w-px h-4 bg-[#E4EDE8]" />

                {/* From */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-[700] text-[#5A7266]">From</span>
                    <input
                        type="date"
                        value={filterDateFrom}
                        onChange={e => setFilterDateFrom(e.target.value)}
                        className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all appearance-none"
                    />
                </div>

                {/* To */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-[700] text-[#5A7266]">To</span>
                    <input
                        type="date"
                        value={filterDateTo}
                        onChange={e => setFilterDateTo(e.target.value)}
                        className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all appearance-none"
                    />
                </div>

                {/* Clear */}
                {(filterYear || filterMonth || filterDateFrom || filterDateTo) && (
                    <>
                        <div className="w-px h-4 bg-[#E4EDE8]" />
                        <button
                            onClick={() => { setFilterYear(''); setFilterMonth(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                            className="text-[11px] font-[700] text-[#E74C3C] hover:text-[#A93226] flex items-center gap-1 transition-colors"
                        >
                            <X className="w-3 h-3" /> Clear
                        </button>
                    </>
                )}
            </div>

            <div className="space-y-6">
                {groupedMissingItems.length === 0 ? (
                    <div className="py-24">
                        <NoData
                            title="Clean Tracking"
                            message="No missing or canceled items recorded for the current filters."
                        />
                    </div>
                ) : (
                    groupedMissingItems.map(({ order, items }) => (
                        <div key={order.id} className="bg-white rounded-[24px] border-[1.5px] border-[#E4EDE8] shadow-sm overflow-hidden animate-in slide-in-from-left duration-300">
                            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-[18px]">📦</div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono-dm text-[11px] font-[600] text-[#4F46E5] bg-[#EEF2FF] px-2 py-0.5 rounded border border-[#4F46E5]/10">{order.lpoId}</span>
                                            <h3 className="text-[15px] font-[800] text-[#1E293B] tracking-tight">{order.lpo}</h3>
                                        </div>
                                        <p className="text-[14px] font-[700] text-slate-600 mt-1">{order.customer}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{order.date}</div>
                                    <div className="text-[10px] font-bold text-indigo-500 mt-1">{items.length} Items Logged</div>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-[#F8FAFC]">
                                            <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[60%]">Item Description</th>
                                            <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tracking Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {items.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-[#F0FAF4]/30 transition-colors">
                                                <td className="px-6 py-4 text-[13.5px] font-[600] text-[#2C3E35]">
                                                    {entry.item}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {entry.status === 'pending' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F7EF] text-[#10B981] text-[10px] font-bold border border-[#10B981]/20">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></div>
                                                            PENDING RE-SHIP
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF2F2] text-[#EF4444] text-[10px] font-bold border border-[#EF4444]/20">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></div>
                                                            CANCELED
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
