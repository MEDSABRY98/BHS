'use client';

import React, { useState, useEffect } from 'react';
import { Send, FileCheck } from 'lucide-react';
import { Check } from '../types';
import { createPortal } from 'react-dom';
import { getDeliveryPersonnel } from '../../Service/documents_tracking_service';

interface BulkDeliverModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: string[];
    checks: Check[];
    onConfirm: (whoDelivery: string, whoTake: string) => Promise<void>;
    isLoading: boolean;
}

export default function BulkDeliverModal({
    isOpen,
    onClose,
    selectedIds,
    checks,
    onConfirm,
    isLoading
}: BulkDeliverModalProps) {
    const [whoDelivery, setWhoDelivery] = useState('');
    const [whoTake, setWhoTake] = useState('');
    const [reps, setReps] = useState<string[]>([]);
    const [receivers, setReceivers] = useState<string[]>([]);
    const [focusedInput, setFocusedInput] = useState<'rep' | 'receiver' | null>(null);
    const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        const fetchPersonnel = async () => {
            const data = await getDeliveryPersonnel();
            setReps(data.representatives);
            setReceivers(data.receivers);
        };
        fetchPersonnel();
    }, []);

    useEffect(() => {
        if (isOpen) {
            setWhoDelivery('');
            setWhoTake('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const selectedChecks = checks.filter(c => selectedIds.includes(c.id));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(whoDelivery, whoTake);
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} dir="rtl">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-gray-900">تسليم للمقر الرئيسي</h3>
                    <button className="text-gray-400 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center" onClick={onClose}>
                        ✕
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="relative">
                        <label className="block text-sm font-bold text-gray-500 mb-2">مين اللي راح يسلم (اسم المندوب)</label>
                        <input
                            type="text"
                            value={whoDelivery}
                            onChange={e => setWhoDelivery(e.target.value)}
                            onFocus={(e) => {
                                const rect = e.target.getBoundingClientRect();
                                setDropdownCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
                                setFocusedInput('rep');
                            }}
                            onBlur={() => setTimeout(() => setFocusedInput(null), 200)}
                            placeholder="اسم المندوب المسؤول عن التوصيل..."
                            required
                            className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-indigo-600 outline-none transition-all font-bold text-gray-900"
                        />
                        {focusedInput === 'rep' && whoDelivery && typeof document !== 'undefined' && createPortal(
                            <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px`, width: `${dropdownCoords.width}px`, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', zIndex: 999999, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} dir="rtl">
                                {reps.filter(r => r.toLowerCase().includes(whoDelivery.toLowerCase())).map(r => (
                                    <div key={r} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1e293b' }} 
                                        onMouseDown={(e) => { e.preventDefault(); setWhoDelivery(r); setFocusedInput(null); }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >{r}</div>
                                ))}
                            </div>,
                            document.body
                        )}
                    </div>
                    <div className="relative">
                        <label className="block text-sm font-bold text-gray-500 mb-2">مين اللي استلم في المكتب (المستلم النهائي)</label>
                        <input
                            type="text"
                            value={whoTake}
                            onChange={e => setWhoTake(e.target.value)}
                            onFocus={(e) => {
                                const rect = e.target.getBoundingClientRect();
                                setDropdownCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
                                setFocusedInput('receiver');
                            }}
                            onBlur={() => setTimeout(() => setFocusedInput(null), 200)}
                            placeholder="اسم الموظف المستلم بالمركز الرئيسي..."
                            required
                            className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-indigo-600 outline-none transition-all font-bold text-gray-900"
                        />
                        {focusedInput === 'receiver' && whoTake && typeof document !== 'undefined' && createPortal(
                            <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px`, width: `${dropdownCoords.width}px`, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', zIndex: 999999, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} dir="rtl">
                                {receivers.filter(r => r.toLowerCase().includes(whoTake.toLowerCase())).map(r => (
                                    <div key={r} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1e293b' }} 
                                        onMouseDown={(e) => { e.preventDefault(); setWhoTake(r); setFocusedInput(null); }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >{r}</div>
                                ))}
                            </div>,
                            document.body
                        )}
                    </div>

                    <div className="flex w-full gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-[0.4] py-3.5 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg hover:shadow-green-600/30 transition-all disabled:opacity-50"
                        >
                            <FileCheck size={18} />
                            {isLoading ? 'جاري التسليم...' : `تأكيد تسليم (${selectedChecks.length})`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
