import React, { useState } from 'react';
import { FileSpreadsheet, Calendar, ChevronDown, Loader2, X, Pencil, Trash2 } from 'lucide-react';
import { DeliveryEntry, STATUS_CONFIG } from './types';
import NoData from '../01-Unified/NoDataTab';

interface OrdersTabProps {
    filteredOrders: DeliveryEntry[];
    filterStatus: string;
    setFilterStatus: (status: string) => void;
    canDownload: boolean;
    exportOrdersCSV: () => void;
    filterYear: string;
    setFilterYear: (y: string) => void;
    filterMonth: string;
    setFilterMonth: (m: string) => void;
    filterDateFrom: string;
    setFilterDateFrom: (d: string) => void;
    filterDateTo: string;
    setFilterDateTo: (d: string) => void;
    canEdit: boolean;
    onUpdateStatus: (orderId: string, status: string, postponedDate?: string) => Promise<void>;
    onDeleteOrder: (id: string) => void;
    onEditOrder: (order: DeliveryEntry) => void;
}

export default function OrdersTab({
    filteredOrders,
    filterStatus,
    setFilterStatus,
    canDownload,
    exportOrdersCSV,
    filterYear,
    setFilterYear,
    filterMonth,
    setFilterMonth,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    canEdit,
    onUpdateStatus,
    onDeleteOrder,
    onEditOrder
}: OrdersTabProps) {
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    const handleStatusChange = async (order: DeliveryEntry, newStatus: string) => {
        if (!canEdit) return;
        setUpdatingId(order.id);
        try {
            // Default postponed date to existing deliveryDate or today if not set yet
            const defaultDate = order.deliveryDate || new Date().toISOString().split('T')[0];
            await onUpdateStatus(
                order.id,
                newStatus,
                newStatus === 'postponed' ? defaultDate : undefined
            );
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDateChange = async (order: DeliveryEntry, newDate: string) => {
        if (!canEdit) return;
        setUpdatingId(order.id);
        try {
            await onUpdateStatus(order.id, order.status, newDate);
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 font-sans">
            {/* Top Bar with Title & Status Tabs */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-8 bg-indigo-600 rounded-full"></div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Delivery Tracking Register</h2>
                        <p className="text-xs text-slate-500 font-medium font-sans">Track and update the status of your orders</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {[
                        { id: 'all', label: 'All' },
                        { id: 'delivered', label: 'Delivered' },
                        { id: 'pending', label: 'Pending' },
                        { id: 'postponed', label: 'Postponed' },
                        { id: 'canceled', label: 'Canceled' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterStatus(tab.id)}
                            className={`
                                px-5 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm
                                ${filterStatus === tab.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-600/10'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'
                                }
                            `}
                        >
                            {tab.label}
                        </button>
                    ))}
                    <div className="w-px h-6 bg-slate-200 mx-2"></div>
                    {canDownload && (
                        <button
                            onClick={exportOrdersCSV}
                            title="Export to CSV"
                            className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/10 flex items-center justify-center transition-all hover:scale-105"
                        >
                            <FileSpreadsheet className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Date Filters Bar */}
            <div className="flex flex-wrap items-center gap-4 mb-6 bg-white border border-slate-200/80 rounded-2xl px-5 py-4 shadow-sm font-sans font-bold">
                <span className="text-xs font-extrabold text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
                    <Calendar className="w-4 h-4 text-indigo-500" /> Filter by Date:
                </span>
                <div className="w-px h-5 bg-slate-200 hidden lg:block" />

                {/* Year */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">Year</span>
                    <input
                        type="text"
                        placeholder="YYYY"
                        value={filterYear}
                        onChange={e => setFilterYear(e.target.value)}
                        maxLength={4}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all w-24 text-center"
                    />
                </div>

                {/* Month */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">Month</span>
                    <input
                        type="text"
                        placeholder="MM"
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value)}
                        maxLength={2}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all w-20 text-center"
                    />
                </div>

                <div className="w-px h-5 bg-slate-200" />

                {/* From */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">From</span>
                    <input
                        type="date"
                        value={filterDateFrom}
                        onChange={e => setFilterDateFrom(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    />
                </div>

                {/* To */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">To</span>
                    <input
                        type="date"
                        value={filterDateTo}
                        onChange={e => setFilterDateTo(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    />
                </div>

                {/* Clear */}
                {(filterYear || filterMonth || filterDateFrom || filterDateTo) && (
                    <>
                        <div className="w-px h-5 bg-slate-200" />
                        <button
                            onClick={() => { setFilterYear(''); setFilterMonth(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                            className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors"
                        >
                            <X className="w-4 h-4" /> Clear Filters
                        </button>
                    </>
                )}
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
                <div className="overflow-visible">
                    <table className="w-full table-fixed border-collapse">
                        <colgroup>
                            <col className="w-[11%]" />
                            <col className="w-[11%]" />
                            <col className="w-[12%]" />
                            <col className="w-[22%]" />
                            <col className="w-[9%]" />
                            <col className="w-[13%]" />
                            <col className="w-[12%]" />
                            <col className="w-[10%]" />
                        </colgroup>
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 text-xs font-extrabold text-slate-500 text-center">LPO Date</th>
                                <th className="p-4 text-xs font-extrabold text-slate-500 text-center">Delivery Date</th>
                                <th className="p-4 text-xs font-extrabold text-slate-500 text-center">LPO Number</th>
                                <th className="p-4 text-xs font-extrabold text-slate-500 text-center">Customer Name</th>
                                <th className="p-4 text-xs font-extrabold text-slate-500 text-center">Value</th>
                                <th className="p-4 text-xs font-extrabold text-slate-500 text-center">Status</th>
                                <th className="p-4 text-xs font-extrabold text-slate-500 text-center">Postponed Date</th>
                                <th className="p-4 text-xs font-extrabold text-slate-500 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans font-bold">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center">
                                        <NoData
                                            title="No Orders Found"
                                            message="Try adjusting your search query or filters to find what you are looking for."
                                        />
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((o) => {
                                    const currentStatus = o.status || 'pending';
                                    const statusConfig = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;

                                    return (
                                        <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                                            {/* LPO Date */}
                                            <td className="p-4 text-sm text-slate-700 font-mono text-center">
                                                {o.date || '—'}
                                            </td>

                                            {/* Delivery Date */}
                                            <td className="p-4 text-sm text-indigo-600 font-mono text-center font-bold">
                                                {o.deliveryDate || '—'}
                                            </td>

                                            {/* LPO Number */}
                                            <td className="p-4 text-center">
                                                <span className="font-mono text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2.5 py-1 rounded-lg">
                                                    {o.lpo || '—'}
                                                </span>
                                            </td>

                                            {/* Customer Name */}
                                            <td className="p-4 text-sm text-slate-800 font-extrabold text-center truncate" title={o.customer || '—'}>
                                                {o.customer || '—'}
                                            </td>

                                            {/* Value */}
                                            <td className="p-4 text-center text-sm font-semibold text-slate-600 font-mono">
                                                {(o.lpoVal || 0).toLocaleString()}
                                            </td>

                                            {/* Status Dropdown */}
                                            <td className="p-4 text-center relative">
                                                <div className="inline-flex items-center justify-center gap-2">
                                                    {updatingId === o.id ? (
                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 text-slate-500 rounded-xl border border-slate-200">
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            <span>Saving...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="relative inline-block text-left">
                                                            <button
                                                                type="button"
                                                                disabled={!canEdit}
                                                                onClick={() => setOpenDropdownId(openDropdownId === o.id ? null : o.id)}
                                                                className={`
                                                                    inline-flex items-center justify-center gap-2 pl-7 pr-7 py-1.5 rounded-xl text-xs font-black border transition-all outline-none text-center shadow-sm select-none relative w-[110px]
                                                                    ${statusConfig.color}
                                                                    ${!canEdit ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.03] active:scale-95'}
                                                                `}
                                                            >
                                                                <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${statusConfig.dot}`} />
                                                                <span>{statusConfig.label}</span>
                                                                <ChevronDown className="w-3.5 h-3.5 opacity-60 absolute right-2.5 top-1/2 -translate-y-1/2" />
                                                            </button>

                                                            {openDropdownId === o.id && (
                                                                <>
                                                                    {/* Click outside backdrop */}
                                                                    <div
                                                                        className="fixed inset-0 z-30"
                                                                        onClick={() => setOpenDropdownId(null)}
                                                                    />

                                                                    {/* Dropdown Menu */}
                                                                    <div className="absolute right-1/2 translate-x-1/2 mt-1.5 w-36 bg-white border border-slate-100 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.12)] py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 origin-top">
                                                                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                                                            <button
                                                                                key={key}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    handleStatusChange(o, key);
                                                                                    setOpenDropdownId(null);
                                                                                }}
                                                                                className={`
                                                                                    w-full px-3 py-2 flex items-center gap-2 text-left text-xs font-extrabold hover:bg-slate-50 transition-colors first:rounded-t-xl last:rounded-b-xl
                                                                                    ${currentStatus === key ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'}
                                                                                `}
                                                                            >
                                                                                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                                                                <span>{cfg.label}</span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Postponed Date input */}
                                            <td className="p-4 text-center">
                                                {currentStatus === 'postponed' ? (
                                                    <div className="inline-flex items-center gap-2">
                                                        <input
                                                            type="date"
                                                            value={o.deliveryDate || ''}
                                                            disabled={!canEdit || updatingId === o.id}
                                                            onChange={(e) => handleDateChange(o, e.target.value)}
                                                            className="bg-purple-50/50 border border-purple-200 text-purple-800 rounded-xl px-3 py-1 text-xs font-bold outline-none focus:border-purple-500 focus:bg-white transition-all font-mono"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => onEditOrder(o)}
                                                        disabled={!canEdit}
                                                        title="Edit LPO"
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteOrder(o.id)}
                                                        disabled={!canEdit}
                                                        title="Delete LPO"
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
