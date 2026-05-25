import React, { useState } from 'react';
import { FileSpreadsheet, Clock, Edit2, X, Activity } from 'lucide-react';
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
    openEditModal: (o: DeliveryEntry) => void;
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
    openEditModal
}: OrdersTabProps) {
    const [showMissingPopup, setShowMissingPopup] = useState(false);
    const [popupItems, setPopupItems] = useState<{ name: string, type: 'missing' | 'shipped' | 'canceled' }[]>([]);
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between mb-[14px]">
                <div className="flex items-center gap-2 text-[15px] font-[700] text-[#0F1A14]">
                    <div className="w-[3px] h-[16px] bg-[#4F46E5] rounded-[3px]"></div>
                    All Orders Register
                </div>
                <div className="flex items-center gap-[6px]">
                    {['all', 'delivered', 'partial', 'pending', 'canceled'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`
                px-[12px] py-[4px] rounded-[20px] text-[11px] font-[600] capitalize border-[1.5px] transition-all
                ${filterStatus === s
                                    ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]'
                                    : 'bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#4F46E5]'
                                }
              `}
                        >
                            {s === 'all' ? 'All' : (STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label || s)}
                        </button>
                    ))}
                    <div className="w-px h-4 bg-[#B2C4BB] mx-1"></div>
                    {canDownload && (
                        <button
                            onClick={exportOrdersCSV}
                            title="Export Excel"
                            className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm flex items-center justify-center transition-colors"
                        >
                            <FileSpreadsheet className="w-5 h-5" />
                        </button>
                    )}
                </div>
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
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center min-w-[110px]">LPO ID</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">LPO Number</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center min-w-[130px]">LPO Date</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center min-w-[130px]">Delivery Date</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Customer Name</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">LPO Value</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Invoice DATE</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Invoice Number</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Invoice Value</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Difference</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Status</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Missing Items</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Re-ship?</th>
                                <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E0E7FF] font-bold">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={14} className="py-24">
                                        <NoData
                                            title="No Orders Found"
                                            message="Try adjusting your filters or search query to find the LPOs you're looking for."
                                        />
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((o, index) => {
                                    const diff = o.invoiceVal > 0 ? o.invoiceVal - o.lpoVal : 0;
                                    const showHeader = index === 0 || o.date !== filteredOrders[index - 1].date;
                                    return (
                                        <React.Fragment key={o.id}>
                                            {showHeader && (
                                                <tr className="bg-[#F8FAFC]">
                                                    <td colSpan={14} className="p-[10px_16px] text-left">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center">
                                                                <Clock className="w-4 h-4 text-[#4F46E5]" />
                                                            </div>
                                                            <div>
                                                                <span className="text-[14px] font-[900] text-[#1e1b4b] tracking-tight">{o.date}</span>
                                                                <span className="ml-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-l border-slate-200 pl-3">
                                                                    {filteredOrders.filter(ord => ord.date === o.date).length} Orders
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            <tr className="hover:bg-[#F0FAF4] transition-colors group">
                                                <td className="p-[12px_16px] text-center"><span className="font-mono-dm text-[12px] font-[500] text-[#5A7266] bg-[#F6F9F7] px-[9px] py-[3px] rounded-[5px] border border-[#E4EDE8]">{o.lpoId || '—'}</span></td>
                                                <td className="p-[12px_16px] text-center"><span className="font-mono-dm text-[12px] font-[500] text-[#4F46E5] bg-[#EEF2FF] px-[9px] py-[3px] rounded-[5px] border border-[#4F46E5]/12">{o.lpo || '—'}</span></td>
                                                <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#2C3E35]">{o.date || '—'}</td>
                                                <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#2980B9]">
                                                    {o.deliveryDate
                                                        ? <span className="bg-[#EBF8FF] text-[#2980B9] px-[9px] py-[3px] rounded-[5px] border border-[#2980B9]/12 text-[12px] font-[600]">{o.deliveryDate}</span>
                                                        : <span className="text-[#B2C4BB]">&mdash;</span>
                                                    }
                                                </td>
                                                <td className="p-[12px_16px] text-center font-[600] text-[12.5px] text-[#0F1A14]">{o.customer || '—'}</td>
                                                <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#5A7266]">{(o.lpoVal || 0).toLocaleString()}</td>
                                                <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#2C3E35]">{o.invoiceDate || '—'}</td>
                                                <td className="p-[12px_16px] text-center"><span className="font-mono-dm text-[12px] font-[500] text-[#2980B9] bg-[#EBF5FB] px-[9px] py-[3px] rounded-[5px] border border-[#2980B9]/12">{o.invoiceNumber || '—'}</span></td>
                                                <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#5A7266]">{o.invoiceVal && o.invoiceVal > 0 ? o.invoiceVal.toLocaleString() : '—'}</td>
                                                <td className="p-[12px_16px] text-center">
                                                    {!o.invoiceVal || o.invoiceVal === 0 ? '—' :
                                                        <span className={`text-[12px] font-[700] font-mono-dm ${diff < 0 ? 'text-[#E74C3C]' : diff > 0 ? 'text-[#1A8A47]' : 'text-[#B2C4BB]'}`}>
                                                            {diff === 0 ? '0' : (diff > 0 ? `+${diff.toLocaleString()}` : `-${Math.abs(diff).toLocaleString()}`)}
                                                        </span>
                                                    }
                                                </td>
                                                <td className="p-[12px_16px] text-center">
                                                    {(() => {
                                                        const normalizedStatus = (o.status || 'pending').toLowerCase();
                                                        const statusConf = STATUS_CONFIG[normalizedStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                                                        return (
                                                            <div className={`inline-flex items-center gap-[5px] px-[10px] py-[3px] rounded-[20px] text-[11px] font-[600] border border-transparent ${statusConf.color}`}>
                                                                <div className={`w-[5px] h-[5px] rounded-full ${statusConf.dot}`}></div>
                                                                {statusConf.label}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="p-[12px_16px] text-center">
                                                    {(() => {
                                                        const mCount = o.missing?.length || 0;
                                                        const sCount = (o.shippedItems || []).length;
                                                        const cCount = (o.canceledItems || []).length;
                                                        const total = mCount + sCount + cCount;

                                                        if (total === 0) return '—';

                                                        const allItems = [
                                                            ...(o.missing || []).map(m => ({ name: m, type: 'missing' as const })),
                                                            ...(o.shippedItems || []).map(m => ({ name: m, type: 'shipped' as const })),
                                                            ...(o.canceledItems || []).map(m => ({ name: m, type: 'canceled' as const })),
                                                        ];

                                                        return (
                                                            <button
                                                                onClick={() => { setPopupItems(allItems); setShowMissingPopup(true); }}
                                                                className="bg-[#FDEDEC] text-[#A93226] text-[11px] font-bold px-3 py-1 rounded-full hover:bg-[#FADBD8] transition-colors shadow-sm"
                                                            >
                                                                {total} Items
                                                            </button>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="p-[12px_16px] text-center">
                                                    {o.reship ? <span className="bg-[#EBF5FB] text-[#2980B9] text-[10px] font-bold px-2 py-0.5 rounded-full">YES</span> : (o.missing && o.missing.length > 0) ? <span className="text-[#A93226] font-bold text-[10px]">NO</span> : '—'}
                                                </td>
                                                <td className="p-[12px_16px] text-center">
                                                    {canEdit && o.status === 'pending' && (
                                                        <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => openEditModal(o)}
                                                                className="w-7 h-7 bg-[#EBF5FB] text-[#2980B9] rounded-md flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PARTIAL DELIVERY AUDIT POPUP */}
            {showMissingPopup && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0F1A14]/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => setShowMissingPopup(false)}></div>
                    <div className="bg-white rounded-[18px] w-full max-w-[400px] shadow-[0_24px_64px_rgba(0,0,0,0.2)] relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden border border-[#E4EDE8]">
                        <div className="p-5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Activity className="w-5 h-5 text-indigo-600" />
                                <h3 className="text-indigo-900 text-[15px] font-[800]">Partial Delivery Audit</h3>
                            </div>
                            <button onClick={() => setShowMissingPopup(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-2 max-h-[400px] overflow-y-auto">
                            {popupItems.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-3 bg-[#F9FBFA] border border-[#E4EDE8] p-3 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1.5 h-1.5 rounded-full ${item.type === 'missing' ? 'bg-[#E67E22]' : item.type === 'shipped' ? 'bg-[#10B981]' : 'bg-slate-400'}`}></div>
                                        <span className="text-[13px] font-[700] text-[#0F1A14]">{item.name}</span>
                                    </div>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                        item.type === 'shipped' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                        item.type === 'canceled' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                        'bg-orange-50 text-orange-600 border-orange-100'
                                    }`}>
                                        {item.type}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-[#F6F9F7] flex justify-end px-6">
                            <button onClick={() => setShowMissingPopup(false)} className="bg-[#A93226] text-white px-6 py-2 rounded-lg text-[12px] font-bold shadow-md hover:bg-[#922B21] transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
