'use client';

import React, { useState, useEffect } from 'react';
import { Send, FileCheck } from 'lucide-react';
import { Check } from '../types';

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
        <div className="modal-overlay open" onClick={onClose}>
            <div className="modal bulk-deliver-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-title">
                    <span>تسليم المستندات المحددة للمقر الرئيسي</span>
                    <button className="modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>
                <div className="modal-content">
                    <form onSubmit={handleSubmit}>
                        <div className="bulk-form-grid">
                            <div className="field">
                                <label>مين اللي راح يسلم (اسم المندوب)</label>
                                <input
                                    type="text"
                                    value={whoDelivery}
                                    onChange={e => setWhoDelivery(e.target.value)}
                                    placeholder="اسم المندوب المسؤول عن التوصيل..."
                                    required
                                    style={{ color: '#000' }}
                                />
                            </div>
                            <div className="field">
                                <label>مين اللي استلم في المكتب (المستلم النهائي)</label>
                                <input
                                    type="text"
                                    value={whoTake}
                                    onChange={e => setWhoTake(e.target.value)}
                                    placeholder="اسم الموظف المستلم بالمركز الرئيسي..."
                                    required
                                    style={{ color: '#000' }}
                                />
                            </div>
                        </div>

                        <div className="selected-checks-list-preview">
                            <h4>قائمة الشيكات الجاري تسليمها ({selectedChecks.length}) شيك:</h4>
                            <div className="checks-mini-grid">
                                {selectedChecks.map(c => (
                                    <div key={c.id} className="mini-check-card">
                                        <span className="mini-card-num">{c.num}</span>
                                        <span className="mini-card-client">{c.client}</span>
                                        <span className="mini-card-amount">
                                            {c.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })} د.إ
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pdf-modal-actions" style={{ marginTop: '20px' }}>
                            <button
                                type="button"
                                className="btn-pdf-cancel"
                                onClick={onClose}
                                disabled={isLoading}
                            >
                                إلغاء
                            </button>
                            <button
                                type="submit"
                                className="btn-pdf-generate"
                                style={{ background: '#2E7D32', borderColor: '#2E7D32' }}
                                disabled={isLoading}
                            >
                                <FileCheck size={16} />{' '}
                                {isLoading ? 'جاري التسليم...' : 'تأكيد التسليم الجماعي'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
