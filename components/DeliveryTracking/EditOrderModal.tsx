import React, { useState, useEffect } from 'react';
import { X, Package, Plus, History, CheckCircle2 } from 'lucide-react';
import { DeliveryEntry } from './types';

interface EditOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: DeliveryEntry | null;
    isSaving: boolean;
    onSave: (updatedOrder: DeliveryEntry) => void;
}

export default function EditOrderModal({
    isOpen,
    onClose,
    order,
    isSaving,
    onSave
}: EditOrderModalProps) {
    const [editingOrder, setEditingOrder] = useState<DeliveryEntry | null>(null);
    const [missingItemInput, setMissingItemInput] = useState('');

    useEffect(() => {
        if (order) {
            setEditingOrder({ ...order });
        } else {
            setEditingOrder(null);
        }
        setMissingItemInput('');
    }, [order, isOpen]);

    if (!isOpen || !editingOrder) return null;

    const addMissingItem = () => {
        if (!missingItemInput.trim()) return;
        setEditingOrder(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                missing: [...(prev.missing || []), missingItemInput.trim()]
            };
        });
        setMissingItemInput('');
    };

    const removeMissingItem = (idx: number) => {
        setEditingOrder(prev => {
            if (!prev) return prev;
            const updated = [...(prev.missing || [])];
            updated.splice(idx, 1);
            return {
                ...prev,
                missing: updated
            };
        });
    };

    const handleSave = () => {
        if (editingOrder) {
            onSave(editingOrder);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-bold">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[6px] animate-in fade-in duration-300" onClick={onClose}></div>
            <div className="bg-[#F8FAFC] rounded-[28px] w-full max-w-[680px] max-h-[92vh] overflow-hidden flex flex-col shadow-[0_40px_100px_rgba(0,0,0,0.35)] relative z-10 animate-in zoom-in-95 duration-200">

                {/* HEADER */}
                <div className="relative bg-gradient-to-br from-[#1a1f5e] via-[#2d3494] to-[#3b4fd8] p-6 rounded-t-[28px] sticky top-0 z-20 overflow-hidden">
                    <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3 pointer-events-none" />
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl border border-white/20">
                                🚚
                            </div>
                            <div>
                                <h3 className="text-white text-[18px] font-[900] tracking-tight">Update Delivery Progress</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-white/60 text-[11px] font-[600]">{editingOrder.customer}</span>
                                    <span className="text-white/30">·</span>
                                    <span className="bg-white/15 text-white/80 text-[10px] font-[800] px-2 py-0.5 rounded-full border border-white/20">{editingOrder.lpo}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-xl bg-white/10 text-white hover:bg-white/25 transition-all flex items-center justify-center border border-white/15"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* BODY */}
                <div className="p-6 space-y-5 flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>

                    {/* SECTION 1 — Delivery Status */}
                    <div className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                        <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
                            <div className="w-1 h-4 bg-[#6366F1] rounded-full" />
                            <span className="text-[11px] font-[800] text-[#475569] uppercase tracking-widest">Delivery Status</span>
                        </div>
                        <div className="p-4 grid grid-cols-3 gap-3">
                            {([
                                { value: 'delivered', label: 'Fully Delivered', icon: '✅', selectedBg: 'bg-emerald-50 border-emerald-400 text-emerald-700', dot: 'bg-emerald-500' },
                                { value: 'partial', label: 'Partial Delivery', icon: '⚠️', selectedBg: 'bg-amber-50 border-amber-400 text-amber-700', dot: 'bg-amber-500' },
                                { value: 'canceled', label: 'Canceled', icon: '❌', selectedBg: 'bg-rose-50 border-rose-400 text-rose-700', dot: 'bg-rose-500' },
                            ] as const).map(opt => {
                                const hasMissing = (editingOrder.missing || []).length > 0;
                                const isInsufficientValue = opt.value === 'delivered' && editingOrder.invoiceVal > 0 && editingOrder.invoiceVal < editingOrder.lpoVal;
                                const isDisabled = (opt.value === 'delivered' && hasMissing) || isInsufficientValue;
                                const isSelected = editingOrder.status === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        disabled={isDisabled}
                                        title={isDisabled ? (hasMissing ? 'Cannot select Fully Delivered when there are missing products' : 'Invoice value must match or exceed LPO value for Full Delivery') : undefined}
                                        onClick={() => { if (!isDisabled) setEditingOrder({ ...editingOrder, status: opt.value }); }}
                                        className={`relative flex items-center gap-3 p-4 rounded-[14px] border-2 transition-all text-left
                                            ${isDisabled
                                                ? 'border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed opacity-50'
                                                : isSelected
                                                    ? opt.selectedBg + ' shadow-sm'
                                                    : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#CBD5E1] hover:bg-white'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isDisabled ? 'border-[#CBD5E1]' : isSelected ? 'border-current' : 'border-[#CBD5E1]'}`}>
                                            {isSelected && !isDisabled && <div className={`w-2.5 h-2.5 rounded-full ${opt.dot}`} />}
                                        </div>
                                        <div>
                                            <div className="text-[13px] font-[800] leading-tight">{opt.icon} {opt.label}</div>
                                        </div>
                                        {isSelected && !isDisabled && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-current opacity-60" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECTION 2 — Invoice Info */}
                    {editingOrder.status !== 'canceled' && (
                        <div className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                            <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
                                <div className="w-1 h-4 bg-[#0EA5E9] rounded-full" />
                                <span className="text-[11px] font-[800] text-[#475569] uppercase tracking-widest">Invoice Details</span>
                            </div>
                            <div className="p-4 grid grid-cols-3 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-[700] text-[#94A3B8] uppercase tracking-wider">Invoice Date</label>
                                    <input
                                        type="date"
                                        value={editingOrder.invoiceDate ?? ''}
                                        onChange={(e) => setEditingOrder({ ...editingOrder, invoiceDate: e.target.value })}
                                        className="w-full border-[1.5px] rounded-[10px] p-[10px_12px] text-[13px] font-medium outline-none transition-all appearance-none bg-[#F8FAFC] border-[#E2E8F0] focus:border-[#6366F1] focus:bg-white"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-[700] text-[#94A3B8] uppercase tracking-wider">Invoice Number</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. SAL-001"
                                        className="w-full bg-[#F8FAFC] border-[1.5px] border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] outline-none focus:border-[#6366F1] focus:bg-white transition-all font-bold"
                                        value={editingOrder.invoiceNumber ?? ''}
                                        onChange={(e) => setEditingOrder({ ...editingOrder, invoiceNumber: e.target.value.toUpperCase() })}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-[700] text-[#94A3B8] uppercase tracking-wider">Invoice Value</label>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={editingOrder.invoiceVal || ''}
                                        onChange={(e) => {
                                            const valStr = e.target.value;
                                            const newVal = valStr === '' ? 0 : Number(valStr);
                                            const isInsufficient = newVal > 0 && newVal < editingOrder.lpoVal;
                                            let nextStatus = editingOrder.status;
                                            if (nextStatus === 'delivered' && isInsufficient) {
                                                nextStatus = 'partial';
                                            }
                                            setEditingOrder({ ...editingOrder, invoiceVal: newVal, status: nextStatus });
                                        }}
                                        className="w-full border-[1.5px] rounded-[10px] p-[10px_12px] text-[13px] font-[700] outline-none transition-all font-mono-dm bg-[#F8FAFC] border-[#E2E8F0] focus:border-[#6366F1] focus:bg-white"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 3 — Missing Products */}
                    {editingOrder.status !== 'canceled' && editingOrder.status !== 'delivered' && (
                        <div className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                            <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-4 bg-rose-400 rounded-full" />
                                    <span className="text-[11px] font-[800] text-[#475569] uppercase tracking-widest">Missing Products</span>
                                </div>
                                {(editingOrder.missing || []).length > 0 && (
                                    <span className="bg-rose-100 text-rose-600 text-[10px] font-[800] px-2 py-0.5 rounded-full border border-rose-200">
                                        {(editingOrder.missing || []).length} item{(editingOrder.missing || []).length !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Add specific missing item title..."
                                        value={missingItemInput}
                                        onChange={(e) => setMissingItemInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addMissingItem()}
                                        className="flex-1 bg-[#F8FAFC] border-[1.5px] border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] outline-none focus:border-[#6366F1] focus:bg-white transition-all font-bold"
                                    />
                                    <button
                                        onClick={addMissingItem}
                                        className="bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-[10px] px-5 text-[12px] font-[800] transition-all shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:-translate-y-0.5"
                                    >
                                        + Add
                                    </button>
                                </div>
                                <div className="min-h-[44px] flex flex-wrap gap-2">
                                    {(editingOrder.missing || []).length > 0 ? (
                                        editingOrder.missing.map((m, i) => (
                                            <span key={i} className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-[700] px-3 py-1.5 rounded-full shadow-sm hover:bg-rose-100 transition-colors">
                                                <Package className="w-3 h-3" />
                                                {m}
                                                <button onClick={() => removeMissingItem(i)} className="ml-1 hover:text-rose-900 transition-colors">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-[12px] text-[#94A3B8] italic py-2">No missing items reported.</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 4 — Re-ship + Notes (only shown if missing items exist) */}
                    {editingOrder.status !== 'canceled' && (editingOrder.missing || []).length > 0 && (
                        <div className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                            <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
                                <div className="w-1 h-4 bg-amber-400 rounded-full" />
                                <span className="text-[11px] font-[800] text-[#475569] uppercase tracking-widest">Re-shipment & Notes</span>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setEditingOrder({ ...editingOrder, reship: true, status: 'partial' })}
                                        className={`flex items-center justify-center gap-2 py-3 rounded-[12px] border-2 text-[13px] font-[800] transition-all
                                            ${editingOrder.reship === true
                                                ? 'bg-[#6366F1] border-[#6366F1] text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)]'
                                                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#6366F1] hover:text-[#6366F1]'}`}
                                    >
                                        🔄 Yes, Re-ship
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditingOrder({ ...editingOrder, reship: false, status: 'partial' })}
                                        className={`flex items-center justify-center gap-2 py-3 rounded-[12px] border-2 text-[13px] font-[800] transition-all
                                            ${editingOrder.reship === false
                                                ? 'bg-rose-500 border-rose-500 text-white shadow-[0_4px_14px_rgba(239,68,68,0.4)]'
                                                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-rose-400 hover:text-rose-500'}`}
                                    >
                                        🚫 No, Cancel
                                    </button>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-[700] text-[#94A3B8] uppercase tracking-wider flex items-center gap-1">
                                        Delivery Notes
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={editingOrder.notes || ''}
                                        onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                                        placeholder="explain missing items situation..."
                                        className="w-full border-[1.5px] rounded-[10px] p-[10px_14px] text-[13px] outline-none transition-all resize-none bg-[#F8FAFC] border-[#E2E8F0] focus:border-[#6366F1] focus:bg-white font-bold"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* notes when no missing items or canceled */}
                    {(editingOrder.status === 'canceled' || (editingOrder.missing || []).length === 0) && (
                        <div className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                            <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
                                <div className={`w-1 h-4 ${editingOrder.status === 'canceled' ? 'bg-rose-500' : 'bg-slate-300'} rounded-full`} />
                                <span className="text-[11px] font-[800] text-[#475569] uppercase tracking-widest">
                                    Delivery Notes
                                </span>
                            </div>
                            <div className="p-4 flex flex-col gap-1.5">
                                {editingOrder.status === 'canceled' && (
                                    <label className="text-[10px] font-[700] text-[#94A3B8] uppercase tracking-wider flex items-center gap-1">
                                        Cancellation Reason
                                    </label>
                                )}
                                <textarea
                                    rows={2}
                                    value={editingOrder.notes || ''}
                                    onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                                    placeholder={editingOrder.status === 'canceled' ? "specify the reason for cancellation..." : "Notes regarding delivery issues, discrepancies, etc..."}
                                    className="w-full border-[1.5px] rounded-[10px] p-[10px_14px] text-[13px] outline-none transition-all resize-none bg-[#F8FAFC] border-[#E2E8F0] focus:border-[#6366F1] focus:bg-white font-bold"
                                />
                            </div>
                        </div>
                    )}

                    {/* SYSTEM STAMPS */}
                    {(editingOrder.createdAt || editingOrder.updatedAt) && (
                        <div className="flex items-center justify-between px-2 pt-2 pb-1 opacity-50 text-slate-500">
                            {editingOrder.createdAt && (
                                <div className="flex items-center gap-1.5">
                                    <Plus className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase tracking-tighter">System Entry: {editingOrder.createdAt}</span>
                                </div>
                            )}
                            {editingOrder.updatedAt && (
                                <div className="flex items-center gap-1.5">
                                    <History className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase tracking-tighter">Last Audit: {editingOrder.updatedAt}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="px-6 py-4 bg-white border-t border-[#E2E8F0] flex items-center justify-center rounded-b-[28px] sticky bottom-0">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-indigo-600 text-white font-black py-2.5 px-8 rounded-xl text-[13px] shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 flex items-center gap-2.5 min-w-[220px] justify-center"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Complete & Sync</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
