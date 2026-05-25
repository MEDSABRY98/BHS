import React from 'react';
import {
    SearchCode,
    ShieldCheck,
    AlertTriangle,
    History,
    Activity,
    Plus,
    FileText,
    Truck,
    CheckCircle2,
    Package
} from 'lucide-react';
import { DeliveryEntry, STATUS_CONFIG } from './types';

interface CheckingTabProps {
    orders: DeliveryEntry[];
    checkingSearchQuery: string;
    setCheckingSearchQuery: (query: string) => void;
    checkingSubmittedQuery: string;
    setCheckingSubmittedQuery: (query: string) => void;
}

export default function CheckingTab({
    orders,
    checkingSearchQuery,
    setCheckingSearchQuery,
    checkingSubmittedQuery,
    setCheckingSubmittedQuery
}: CheckingTabProps) {
    const query = checkingSubmittedQuery.trim().toLowerCase();

    const found = query
        ? orders.find(o =>
            (o.lpo || '').toLowerCase().includes(query) ||
            (o.id || '').toLowerCase() === query ||
            (o.lpoId || '').toLowerCase() === query
        )
        : null;

    let content;

    if (!query) {
        content = (
            <div className="flex flex-col items-center justify-center py-24 opacity-40">
                <ShieldCheck className="w-20 h-20 text-[#94A3B8] mb-4" />
                <p className="text-[16px] font-bold text-[#64748B]">Type an LPO identifier to begin audit</p>
            </div>
        );
    } else if (!found) {
        content = (
            <div className="bg-white rounded-[24px] p-16 text-center border-[2px] border-dashed border-[#E2E8F0] animate-in zoom-in-95">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-rose-500" />
                </div>
                <h3 className="text-[18px] font-black text-[#0F172A] mb-2">LPO Not Found</h3>
                <p className="text-[#64748B] font-medium">No record matches "{checkingSearchQuery}". Please check the number and try again.</p>
            </div>
        );
    } else {
        const foundStatus = (found.status || 'pending').toLowerCase();
        const s = STATUS_CONFIG[foundStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
        const diff = found.invoiceVal - found.lpoVal;
        const diffPct = found.lpoVal > 0 ? (diff / found.lpoVal) * 100 : 0;
        const totalResolved = (found.shippedItems?.length || 0) + (found.canceledItems?.length || 0);
        const totalItems = totalResolved + found.missing.length;
        const progress = totalItems > 0 ? Math.round((totalResolved / totalItems) * 100) : (found.status === 'delivered' ? 100 : 0);

        content = (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 pb-12">
                {/* MAIN HEADER GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* INFO CARD */}
                    <div className="lg:col-span-2 bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] flex flex-col justify-between">
                        <div className="flex items-start justify-between mb-8">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider">{found.lpoId}</span>
                                    <span className="text-[14px] text-[#64748B] font-bold">LPO Record Audit</span>
                                </div>
                                <h2 className="text-[36px] font-[950] text-[#0F172A] leading-tight">{found.lpo}</h2>
                                <p className="text-[18px] font-bold text-[#4F46E5]">{found.customer}</p>
                            </div>
                            <div className={`p-4 rounded-[20px] border shadow-sm ${s.color} text-center min-w-[140px]`}>
                                <div className="text-[20px] mb-1">{s.icon}</div>
                                <div className="text-[14px] font-black uppercase tracking-tight">{s.label}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 pt-8 border-t border-[#F1F5F9]">
                            <div>
                                <div className="text-[10px] text-[#94A3B8] font-black uppercase tracking-widest mb-1">LPO Date</div>
                                <div className="text-[15px] font-bold text-[#0F172A]">{found.date || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-[#94A3B8] font-black uppercase tracking-widest mb-1">Invoice Date</div>
                                <div className="text-[15px] font-bold text-[#0F172A]">{found.invoiceDate || 'Pending'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-[#94A3B8] font-black uppercase tracking-widest mb-1">Invoice Number</div>
                                <div className="text-[15px] font-bold text-[#0F172A]">{found.invoiceNumber || 'Not Issued'}</div>
                            </div>
                        </div>
                    </div>

                    {/* FINANCIAL AUDIT */}
                    <div className="bg-[#1e1b4b] rounded-[24px] p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <History className="w-24 h-24 text-white" />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-[13px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-6">Financial Comparison</h3>
                            <div className="space-y-6">
                                <div>
                                    <div className="text-[11px] text-indigo-300 font-bold uppercase mb-1 opacity-60">LPO Value</div>
                                    <div className="text-[28px] font-black font-mono-dm tracking-tighter">{found.lpoVal.toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-indigo-300 font-bold uppercase mb-1 opacity-60">Invoice Value</div>
                                    <div className="text-[28px] font-black font-mono-dm tracking-tighter text-emerald-400">{found.invoiceVal.toLocaleString()}</div>
                                </div>
                            </div>
                        </div>
                        <div className={`mt-8 p-5 rounded-[18px] flex items-center justify-between ${diff < 0 ? 'bg-rose-500/20 border border-rose-500/30' : diff > 0 ? 'bg-indigo-500/20 border border-indigo-500/30' : 'bg-white/5 border border-white/10'}`}>
                            <div>
                                <div className="text-[10px] font-black uppercase text-white/50 tracking-widest mb-0.5">Variance</div>
                                <div className="text-[18px] font-black font-mono-dm">{diff >= 0 ? '+' : ''}{diff.toLocaleString()}</div>
                            </div>
                            <div className={`text-[12px] font-extrabold px-3 py-1 rounded-full ${diff < 0 ? 'bg-rose-500 text-white' : diff > 0 ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/50'}`}>
                                {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </div>

                {/* MIDDLE CONTENT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* DELIVERY PROGRESS / MOVEMENTS */}
                    <div className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-emerald-50 rounded-[12px] flex items-center justify-center">
                                <Activity className="w-5 h-5 text-emerald-600" />
                            </div>
                            <h3 className="text-[18px] font-black text-[#0F172A]">Delivery Movement Analytics</h3>
                        </div>

                        {/* PROGRESS BAR */}
                        <div className="mb-10">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[13px] font-black text-[#0F172A] uppercase tracking-wider">Completion Status</span>
                                <span className="text-[20px] font-black text-indigo-600 font-mono-dm">{progress}%</span>
                            </div>
                            <div className="w-full h-[14px] bg-[#F1F5F9] rounded-full overflow-hidden shadow-inner">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-lg"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* TIMELINE SIMULATION / MOVEMENTS */}
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg z-10">
                                        <Plus className="w-4 h-4" />
                                    </div>
                                    <div className="w-1 h-full bg-[#F1F5F9] -mt-1" />
                                </div>
                                <div className="pb-6">
                                    <div className="text-[14px] font-black text-[#0F172A]">LPO Recorded</div>
                                    <div className="text-[12px] text-[#64748B] font-medium mt-1">
                                        Order issued on {found.date}
                                        {found.createdAt && <span className="block text-[10px] text-[#94A3B8] mt-0.5 italic">System Entry: {found.createdAt}</span>}
                                    </div>
                                </div>
                            </div>

                            {found.invoiceNumber && (
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-lg z-10">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="w-1 h-full bg-[#F1F5F9] -mt-1" />
                                    </div>
                                    <div className="pb-6">
                                        <div className="text-[14px] font-black text-[#0F172A]">Invoice Linked</div>
                                        <div className="text-[12px] text-[#64748B] font-medium mt-1">Inv #{found.invoiceNumber} recorded with value {found.invoiceVal.toLocaleString()}</div>
                                    </div>
                                </div>
                            )}

                            {totalResolved > 0 && (
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-lg z-10">
                                            <Truck className="w-4 h-4" />
                                        </div>
                                        <div className="w-1 h-full bg-[#F1F5F9] -mt-1" />
                                    </div>
                                    <div className="pb-6">
                                        <div className="text-[14px] font-black text-[#0F172A]">Delivery Adjustments</div>
                                        <div className="text-[12px] text-[#64748B] font-medium mt-1">{(found.shippedItems || []).length} items re-shipped, {(found.canceledItems || []).length} items canceled.</div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-lg z-10 ${progress === 100 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                </div>
                                <div>
                                    <div className={`text-[14px] font-black ${progress === 100 ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>Final Handover</div>
                                    <div className="text-[12px] text-[#64748B] font-medium mt-1">
                                        {progress === 100 ? 'Fully delivered and closed.' : 'Awaiting missing items resolution.'}
                                        {found.updatedAt && <span className="block text-[10px] text-[#94A3B8] mt-0.5 italic">Last Synced: {found.updatedAt}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MISSING & PENDING ITEMS */}
                    <div className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] flex flex-col">
                        <div className="flex items-center gap-3 mb-6 shrink-0">
                            <div className="w-10 h-10 bg-rose-50 rounded-[12px] flex items-center justify-center">
                                <Package className="w-5 h-5 text-rose-600" />
                            </div>
                            <h3 className="text-[18px] font-black text-[#0F172A]">Items Status Log</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {found.missing.length === 0 && (found.shippedItems?.length || 0) === 0 && (found.canceledItems?.length || 0) === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-[#94A3B8]">
                                    <CheckCircle2 className="w-12 h-12 mb-3 opacity-20" />
                                    <p className="font-bold">No specific item issues reported.</p>
                                </div>
                            ) : (
                                <>
                                    {found.missing.map((item, i) => (
                                        <div key={`m-${i}`} className="flex items-center justify-between p-4 bg-rose-50/50 rounded-[14px] border border-rose-100 font-bold">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                                <span className="text-[13px] font-black text-rose-700">{item}</span>
                                            </div>
                                            <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full uppercase">Missing</span>
                                        </div>
                                    ))}
                                    {(found.shippedItems || []).map((item, i) => (
                                        <div key={`s-${i}`} className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-[14px] border border-emerald-100 font-bold">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                <span className="text-[13px] font-bold text-emerald-700">{item}</span>
                                            </div>
                                            <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase">Shipped</span>
                                        </div>
                                    ))}
                                    {(found.canceledItems || []).map((item, i) => (
                                        <div key={`c-${i}`} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-[14px] border border-slate-200 font-bold">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-slate-400" />
                                                <span className="text-[13px] font-bold text-slate-500 line-through decoration-slate-300">{item}</span>
                                            </div>
                                            <span className="text-[10px] font-black bg-slate-400 text-white px-2 py-0.5 rounded-full uppercase">Canceled</span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {found.notes && (
                            <div className="mt-6 p-5 bg-[#F8FAFC] rounded-[18px] border border-[#E2E8F0] shrink-0 font-bold">
                                <div className="text-[10px] text-[#94A3B8] font-black uppercase tracking-widest mb-2">Delivery Notes</div>
                                <p className="text-[13px] text-[#475569] leading-relaxed font-medium italic">"{found.notes}"</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* SEARCH BOX */}
            <div className="bg-white rounded-[24px] p-8 shadow-[0_15px_50px_rgba(0,0,0,0.05)] border-[1.5px] border-[#E4EDE8] mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#4F46E5]/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700" />
                <div className="relative z-10 flex flex-col items-center gap-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-[24px] font-[900] text-[#0F172A] tracking-tight">Full LPO Audit & Tracking</h2>
                    </div>
                    <div className="flex items-center gap-3 w-full max-w-[600px] bg-[#F8FAFC] border-[2px] border-[#E2E8F0] focus-within:border-[#4F46E5] focus-within:ring-4 focus-within:ring-[#4F46E5]/10 rounded-[18px] px-6 py-4 transition-all shadow-sm">
                        <SearchCode className="w-5 h-5 text-[#94A3B8]" />
                        <input
                            type="text"
                            placeholder="Type LPO & press Enter... ↵"
                            className="bg-transparent border-none text-[16px] w-full outline-none placeholder:text-[#94A3B8] font-bold text-[#0F172A]"
                            value={checkingSearchQuery}
                            onChange={(e) => setCheckingSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') setCheckingSubmittedQuery(checkingSearchQuery);
                            }}
                        />
                    </div>
                </div>
            </div>

            {content}
        </div>
    );
}
