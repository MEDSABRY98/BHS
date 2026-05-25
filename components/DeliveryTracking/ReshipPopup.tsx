import React, { useState, useEffect } from 'react';
import { X, Package, Clock, Truck, XCircle } from 'lucide-react';
import { DeliveryEntry } from './types';

interface ReshipPopupProps {
    isOpen: boolean;
    onClose: () => void;
    selectedReshipOrder: DeliveryEntry | null;
    canReship: boolean;
    handleReshipItem: (orderId: string, itemIdx: number, action: 'ship' | 'cancel', amount?: number) => Promise<void>;
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    triggerConfirm: (title: string, msg: string, onConfirm: () => void, type?: 'danger' | 'warning' | 'success' | 'info') => void;
}

export default function ReshipPopup({
    isOpen,
    onClose,
    selectedReshipOrder,
    canReship,
    handleReshipItem,
    showToast,
    triggerConfirm
}: ReshipPopupProps) {
    const [reshipAmounts, setReshipAmounts] = useState<Record<number, string>>({});
    const [shippingIdx, setShippingIdx] = useState<number | null>(null);

    useEffect(() => {
        setReshipAmounts({});
        setShippingIdx(null);
    }, [selectedReshipOrder, isOpen]);

    if (!isOpen || !selectedReshipOrder) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 font-bold">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[6px] animate-in fade-in duration-300" onClick={onClose}></div>
            <div className="bg-white rounded-[28px] w-full max-w-[520px] shadow-[0_40px_100px_rgba(0,0,0,0.35)] relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">

                {/* HEADER */}
                <div className="relative bg-gradient-to-br from-[#1a1f5e] via-[#2d3494] to-[#3b4fd8] p-6 overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl border border-white/20 shadow-inner">
                                🚚
                            </div>
                            <div>
                                <h3 className="text-white text-[18px] font-[900] tracking-tight leading-tight">Re-shipment Items</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-white/60 text-[11px] font-[600]">{selectedReshipOrder.customer}</span>
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

                {/* ITEMS LIST */}
                <div className="p-5 space-y-3 max-h-[380px] overflow-y-auto bg-[#F8FAFC]">
                    {(selectedReshipOrder.missing || []).map((item, idx) => (
                        <div
                            key={idx}
                            className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden hover:border-[#6366F1]/30 hover:shadow-[0_4px_16px_rgba(99,102,241,0.08)] transition-all duration-200 font-bold"
                        >
                            {/* Item name row */}
                            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                                <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                                    <Package className="w-4 h-4 text-rose-500" />
                                </div>
                                <span className="text-[14px] font-[800] text-[#0F172A] flex-1 leading-tight">{item}</span>
                            </div>

                            {/* Divider */}
                            <div className="mx-4 border-t border-dashed border-[#E2E8F0]" />

                            {/* Value input + actions row */}
                            {canReship && (
                                <div className="flex items-center gap-3 px-4 py-3">
                                    {/* Amount input */}
                                    <div className="flex-1 flex items-center gap-2 bg-[#F8FAFC] border-[1.5px] border-[#E2E8F0] rounded-[12px] px-3 py-2 focus-within:border-[#6366F1] focus-within:bg-white transition-all">
                                        <span className="text-[10px] font-[700] text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">AED</span>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={reshipAmounts[idx] || ''}
                                            onChange={(e) => setReshipAmounts(prev => ({ ...prev, [idx]: e.target.value }))}
                                            className="w-full bg-transparent border-none text-[15px] font-[900] text-[#1E293B] focus:outline-none placeholder:text-[#CBD5E1] placeholder:font-[400]"
                                        />
                                    </div>

                                    {/* Ship button */}
                                    <button
                                        onClick={async () => {
                                            const amtInput = reshipAmounts[idx];
                                            if (!amtInput || parseFloat(amtInput) <= 0) {
                                                showToast('Please enter a valid shipment value', 'error');
                                                return;
                                            }
                                            const amt = parseFloat(amtInput);
                                            setShippingIdx(idx);
                                            await handleReshipItem(selectedReshipOrder.id, idx, 'ship', amt);
                                            setShippingIdx(null);
                                            setReshipAmounts(prev => {
                                                const n = { ...prev };
                                                delete n[idx];
                                                return n;
                                            });
                                            showToast(`Item "${item}" shipped. Invoice value updated.`, 'success');
                                        }}
                                        disabled={shippingIdx === idx}
                                        className="flex items-center justify-center gap-2 w-[90px] bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-[12px] text-[12px] font-[800] transition-all shadow-[0_4px_12px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 whitespace-nowrap"
                                    >
                                        {shippingIdx === idx ? (
                                            <span className="w-4 h-4 border-[2px] border-white/30 border-t-white rounded-full animate-spin inline-block" />
                                        ) : (
                                            <Truck className="w-3.5 h-3.5" />
                                        )}
                                        Ship
                                    </button>

                                    {/* Cancel button */}
                                    <button
                                        onClick={() => {
                                            triggerConfirm(
                                                'Cancel Item Shipment',
                                                `Are you sure you want to cancel the shipment for "${item}"?`,
                                                () => {
                                                    handleReshipItem(selectedReshipOrder.id, idx, 'cancel');
                                                    showToast(`Shipment for "${item}" canceled`, 'info');
                                                },
                                                'warning'
                                            );
                                        }}
                                        className="flex items-center justify-center gap-2 w-[90px] bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white px-4 py-2.5 rounded-[12px] text-[12px] font-[800] border border-rose-200 hover:border-rose-500 transition-all hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
                                    >
                                        <XCircle className="w-3.5 h-3.5" />
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* FOOTER */}
                <div className="px-5 py-4 bg-white border-t border-[#E2E8F0] flex justify-between items-center">
                    <div className="flex items-center gap-2 text-[12px] text-[#64748B] font-[600]">
                        <Clock className="w-3.5 h-3.5" />
                        {(selectedReshipOrder.missing || []).length} item{(selectedReshipOrder.missing || []).length !== 1 ? 's' : ''} remaining
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-7 py-2.5 rounded-[12px] text-[13px] font-[800] transition-all shadow-[0_4px_14px_rgba(15,23,42,0.25)] hover:-translate-y-0.5 active:translate-y-0"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
