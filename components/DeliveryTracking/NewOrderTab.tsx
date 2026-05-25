import React, { useRef } from 'react';
import { Plus, Search, Trash2, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { Customer, LpoRow } from './types';

interface NewOrderTabProps {
    canAdd: boolean;
    customers: Customer[];
    lpoRows: LpoRow[];
    setLpoRows: React.Dispatch<React.SetStateAction<LpoRow[]>>;
    isSaving: boolean;
    setIsSaving: (isSaving: boolean) => void;
    refreshOrders: () => Promise<void>;
    setActiveTab: (tab: string) => void;
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
    setIsLpoExcelModalOpen: (open: boolean) => void;
}

export default function NewOrderTab({
    canAdd,
    customers,
    lpoRows,
    setLpoRows,
    isSaving,
    setIsSaving,
    refreshOrders,
    setActiveTab,
    showToast,
    setIsLpoExcelModalOpen
}: NewOrderTabProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!canAdd) {
        return (
            <div className="p-8 text-center text-red-500 font-bold bg-red-50 rounded-2xl border border-red-200">
                You do not have permission to add new LPOs.
            </div>
        );
    }

    const handleSaveRecords = async () => {
        const incompleteIdx = lpoRows.findIndex(r => !r.lpoNumber || !r.lpoDate || !r.customerName || !r.lpoValue);

        if (incompleteIdx !== -1) {
            showToast(`Please fill all required fields in Row #${incompleteIdx + 1}`, 'error');
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/delivery-tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add_lpo',
                    lpos: lpoRows.map(r => ({
                        lpoNumber: r.lpoNumber,
                        lpoDate: r.lpoDate,
                        lpoDeliveryDate: r.lpoDeliveryDate,
                        customerName: r.customerId || r.customerName,
                        lpoValue: parseFloat(r.lpoValue),
                    }))
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to save');
            }

            await refreshOrders();
            const rowCount = lpoRows.length;
            setLpoRows([{
                lpoNumber: '',
                lpoDate: new Date().toISOString().split('T')[0],
                lpoDeliveryDate: '',
                customerName: '',
                customerId: '',
                lpoValue: '',
                customerSearch: '',
                showDropdown: false
            }]);
            setActiveTab('stats');
            showToast(`${rowCount} LPO(s) recorded successfully`, 'success');
        } catch (error: any) {
            console.error('Save error:', error);
            showToast(error.message || 'Failed to save LPOs', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white rounded-[24px] border-[1.5px] border-[#E2E8F0] shadow-[0_10px_40px_rgba(0,0,0,0.04)] relative">
                <div className="p-8 bg-[#312E81] flex items-center justify-between rounded-t-[22px]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-[24px]">📦</div>
                        <div>
                            <h3 className="text-white text-[20px] font-[900] tracking-tight">Record New LPOs</h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                const lastDate = lpoRows[lpoRows.length - 1]?.lpoDate || new Date().toISOString().split('T')[0];
                                setLpoRows(prev => [...prev, {
                                    lpoNumber: '',
                                    lpoDate: lastDate,
                                    lpoDeliveryDate: '',
                                    customerName: '',
                                    customerId: '',
                                    lpoValue: '',
                                    customerSearch: '',
                                    showDropdown: false
                                }]);
                            }}
                            className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl border border-white/20 text-[13px] font-bold flex items-center gap-2 transition-all"
                        >
                            <Plus className="w-4 h-4" /> Add Row
                        </button>
                    </div>
                </div>

                <div className="p-8 min-h-[300px]">
                    <div className="space-y-4">
                        {lpoRows.map((row, idx) => (
                            <div key={idx} className="flex items-start gap-4 p-5 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] group animate-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                <div className="flex-none pt-2 font-black text-indigo-300 text-[16px] w-6">#{idx + 1}</div>

                                {/* LPO Date */}
                                <div className="w-[180px]">
                                    <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-1.5 block">LPO Date <span className="text-rose-500">*</span></label>
                                    <input
                                        type="date"
                                        value={row.lpoDate}
                                        onChange={(e) => {
                                            const newRows = [...lpoRows];
                                            newRows[idx].lpoDate = e.target.value;
                                            setLpoRows(newRows);
                                        }}
                                        className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-[14px] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                                    />
                                </div>

                                {/* LPO Delivery Date */}
                                <div className="w-[180px]">
                                    <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-1.5 block">Delivery Date</label>
                                    <input
                                        type="date"
                                        value={row.lpoDeliveryDate}
                                        onChange={(e) => {
                                            const newRows = [...lpoRows];
                                            newRows[idx].lpoDeliveryDate = e.target.value;
                                            setLpoRows(newRows);
                                        }}
                                        className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-[14px] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold appearance-none"
                                    />
                                </div>

                                {/* LPO Number */}
                                <div className="flex-1 min-w-[180px]">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider block">LPO Number <span className="text-rose-500">*</span></label>
                                        <button
                                            onClick={() => {
                                                const newRows = [...lpoRows];
                                                newRows[idx].lpoNumber = 'No Number';
                                                setLpoRows(newRows);
                                            }}
                                            className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-tighter bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                                        >
                                            No Number
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="e.g. LPO-2025-01"
                                        value={row.lpoNumber}
                                        onChange={(e) => {
                                            const newRows = [...lpoRows];
                                            newRows[idx].lpoNumber = e.target.value;
                                            setLpoRows(newRows);
                                        }}
                                        className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-[14px] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                                    />
                                </div>

                                {/* Customer Name */}
                                <div className="flex-[2] min-w-[280px] relative">
                                    <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-1.5 block">Customer Name <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search Customer..."
                                            value={row.customerName || row.customerSearch}
                                            onChange={(e) => {
                                                const newRows = [...lpoRows];
                                                newRows[idx].customerSearch = e.target.value;
                                                newRows[idx].showDropdown = true;
                                                newRows[idx].customerName = '';
                                                setLpoRows(newRows);
                                            }}
                                            onFocus={() => {
                                                const newRows = [...lpoRows];
                                                newRows[idx].showDropdown = true;
                                                setLpoRows(newRows);
                                            }}
                                            className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 pr-10 text-[14px] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                                        />
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                                        {row.showDropdown && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => {
                                                    const newRows = [...lpoRows];
                                                    newRows[idx].showDropdown = false;
                                                    setLpoRows(newRows);
                                                }} />
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-[250px] overflow-y-auto p-1.5 font-bold">
                                                    {customers
                                                        .filter(c => c.customerName.toLowerCase().includes(row.customerSearch.toLowerCase()))
                                                        .map((c, ci) => (
                                                            <button
                                                                key={`${ci}-${c.customerId}`}
                                                                onClick={() => {
                                                                    const newRows = [...lpoRows];
                                                                    newRows[idx].customerName = c.customerName;
                                                                    newRows[idx].customerId = c.customerId;
                                                                    newRows[idx].customerSearch = '';
                                                                    newRows[idx].showDropdown = false;
                                                                    setLpoRows(newRows);
                                                                }}
                                                                className="w-full text-left p-3 hover:bg-indigo-50 rounded-lg transition-colors group/item"
                                                            >
                                                                <span className="text-[13px] font-bold text-slate-700 group-hover/item:text-indigo-600">{c.customerName}</span>
                                                            </button>
                                                        ))
                                                    }
                                                    {customers.filter(c => c.customerName.toLowerCase().includes(row.customerSearch.toLowerCase())).length === 0 && (
                                                        <div className="p-4 text-center text-slate-400 text-[12px] italic font-medium">No results</div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* LPO Value */}
                                <div className="w-[160px]">
                                    <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-1.5 block">LPO Value <span className="text-rose-500">*</span></label>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={row.lpoValue}
                                        onChange={(e) => {
                                            const newRows = [...lpoRows];
                                            newRows[idx].lpoValue = e.target.value;
                                            setLpoRows(newRows);
                                        }}
                                        className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-[14px] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-mono-dm font-bold"
                                    />
                                </div>

                                {/* Actions */}
                                <div className="flex-none pt-7">
                                    <button
                                        onClick={() => {
                                            if (lpoRows.length === 1) return;
                                            setLpoRows(prev => prev.filter((_, i) => i !== idx));
                                        }}
                                        disabled={lpoRows.length === 1}
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-0"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-between rounded-b-[22px]">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsLpoExcelModalOpen(true)}
                            disabled={isSaving}
                            className="w-[52px] h-[52px] bg-white text-indigo-900 border border-slate-200 rounded-xl flex items-center justify-center transition-all hover:bg-indigo-50 hover:border-indigo-200 shadow-sm hover:shadow-md disabled:opacity-50 group"
                            title="LPO Excel Actions (Upload/Download)"
                        >
                            <FileSpreadsheet className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleSaveRecords}
                            disabled={isSaving}
                            className="bg-indigo-600 text-white font-black h-[52px] min-w-[220px] px-8 rounded-xl text-[15px] flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>Save Records</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
