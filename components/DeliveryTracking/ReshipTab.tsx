import React from 'react';
import { X } from 'lucide-react';
import { DeliveryEntry } from './types';
import NoData from '../01-Unified/NoDataTab';

interface ReshipTabProps {
    filteredOrders: DeliveryEntry[];
    filterYear: string;
    setFilterYear: (y: string) => void;
    filterMonth: string;
    setFilterMonth: (m: string) => void;
    filterDateFrom: string;
    setFilterDateFrom: (d: string) => void;
    filterDateTo: string;
    setFilterDateTo: (d: string) => void;
    openReshipPopup: (o: DeliveryEntry) => void;
}

export default function ReshipTab({
    filteredOrders,
    filterYear,
    setFilterYear,
    filterMonth,
    setFilterMonth,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    openReshipPopup
}: ReshipTabProps) {
    const reshipOrders = filteredOrders.filter(o => o.reship);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 font-bold">
            <div className="flex items-center gap-2 text-[15px] font-[700] text-[#0F1A14] mb-[14px]">
                <div className="w-[3px] h-[16px] bg-[#4F46E5] rounded-[3px]"></div>
                Re-Shipments Management
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

            <div className="bg-white rounded-[14px] border-[1.5px] border-[#E4EDE8] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-center">
                        <thead>
                            <tr className="bg-[#4F46E5]">
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">LPO ID</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">LPO Number</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Date</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Customer</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Missing Items</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E0E7FF] font-bold">
                            {reshipOrders.map((o) => (
                                <tr key={o.id} className="hover:bg-[#F0FAF4] transition-colors group">
                                    <td className="p-[12px_16px] text-center">
                                        <span className="font-mono-dm text-[12px] font-[500] text-[#2980B9] bg-[#EBF5FB] px-[9px] py-[3px] rounded-[5px] border border-[#2980B9]/15">
                                            #{o.lpoId}
                                        </span>
                                    </td>
                                    <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#0F1A14]">{o.lpo}</td>
                                    <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#5A7266]">
                                        {o.date}
                                    </td>
                                    <td className="p-[12px_16px] text-center font-[700] text-[12.5px] text-[#0F1A14]">{o.customer}</td>
                                    <td className="p-[12px_16px] text-center">
                                        <button
                                            onClick={() => openReshipPopup(o)}
                                            className="bg-[#FDEDEC] text-[#A93226] text-[11px] font-bold px-3 py-1 rounded-full hover:bg-[#FADBD8] transition-colors shadow-sm flex items-center gap-1.5 mx-auto"
                                        >
                                            {o.missing.length} Items
                                        </button>
                                    </td>
                                    <td className="p-[12px_16px] text-center font-[500] text-[12px] text-[#5A7266] italic max-w-[200px] truncate">
                                        {o.notes || '—'}
                                    </td>
                                </tr>
                            ))}
                            {reshipOrders.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-24">
                                        <NoData
                                            title="No Re-Shipments"
                                            message="There are no active re-shipment records matching your filters."
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
