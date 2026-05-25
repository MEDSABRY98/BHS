import React from 'react';
import { Users } from 'lucide-react';
import { DeliveryEntry, STATUS_CONFIG } from './types';
import NoData from '../01-Unified/NoDataTab';

interface DuplicatesTabProps {
    duplicateOrders: {
        list: DeliveryEntry[];
        grouped: Record<string, DeliveryEntry[]>;
        counts: Record<string, number>;
    };
}

export default function DuplicatesTab({ duplicateOrders }: DuplicatesTabProps) {
    const hasGroups = Object.keys(duplicateOrders.grouped).length > 0;

    return (
        <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 font-bold">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="w-[48px] h-[48px] bg-amber-500 rounded-2xl flex items-center justify-center text-[24px] shadow-lg shadow-amber-500/20 text-white">👯‍♂️</div>
                    <div>
                        <h2 className="text-[22px] font-bold text-[#0F172A]">Duplicate LPO Records</h2>
                    </div>
                </div>
            </div>

            {!hasGroups ? (
                <div className="py-24">
                    <NoData
                        title="No Duplicates Detected"
                        message="Great! Your database is clean of duplicate LPO records for the same customers."
                    />
                </div>
            ) : (
                <div className="space-y-8 pb-12">
                    {Object.entries(duplicateOrders.grouped).map(([customer, orders]) => (
                        <div key={customer} className="bg-white rounded-[24px] border-[1.5px] border-[#E4EDE8] shadow-sm overflow-hidden animate-in slide-in-from-left duration-300">
                            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-[17px] font-[800] text-[#1E293B] tracking-tight">{customer}</h3>
                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{orders.length} Duplicate Entries</span>
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-center">
                                    <thead>
                                        <tr className="bg-[#4F46E5]">
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center w-[110px] min-w-[110px]">LPO ID</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center w-[150px]">LPO Number</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center w-[130px] min-w-[130px]">LPO Date</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center w-[130px] min-w-[130px]">Delivery Date</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center w-[120px]">Status</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center w-[150px]">LPO Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-bold">
                                        {orders.map((o) => (
                                            <tr key={o.id} className="hover:bg-[#F0FAF4] transition-colors group">
                                                <td className="p-4 w-[110px]"><span className="font-mono-dm text-[12px] font-[500] text-[#5A7266] bg-[#F6F9F7] px-[9px] py-[3px] rounded-[5px] border border-[#E4EDE8]">{o.lpoId || '—'}</span></td>
                                                <td className="p-4 w-[150px]"><span className="font-mono-dm text-[12px] font-[500] text-[#4F46E5] bg-[#EEF2FF] px-[9px] py-[3px] rounded-[5px] border border-[#4F46E5]/12">{o.lpo || '—'}</span></td>
                                                <td className="p-4 w-[130px] font-mono-dm text-[12.5px] text-[#2C3E35]">{o.date || '—'}</td>
                                                <td className="p-4 w-[130px] font-mono-dm text-[12.5px] text-[#2980B9]">
                                                    {o.deliveryDate
                                                        ? <span className="bg-[#EBF8FF] text-[#2980B9] px-[9px] py-[3px] rounded-[5px] border border-[#2980B9]/12 text-[12px] font-[600]">{o.deliveryDate}</span>
                                                        : <span className="text-[#B2C4BB]">&mdash;</span>
                                                    }
                                                </td>
                                                <td className="p-4 w-[120px]">
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
                                                <td className="p-4 w-[150px] font-mono-dm text-[12.5px] text-[#5A7266]">{(o.lpoVal || 0).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
