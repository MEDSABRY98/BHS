'use client';

import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Check, normalizeDate } from '../types';

interface EditCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
    check: Check | null;
    onSave: (updatedData: any) => Promise<void>;
    isLoading: boolean;
}

export default function EditCheckModal({
    isOpen,
    onClose,
    check,
    onSave,
    isLoading
}: EditCheckModalProps) {
    const [formData, setFormData] = useState({
        num: '',
        client: '',
        amount: '',
        date: '',
        checkDate: '',
        bank: '',
        notes: '',
        receiverName: '',
        finalReceiverName: ''
    });

    useEffect(() => {
        if (check) {
            setFormData({
                num: check.num || '',
                client: check.client || '',
                amount: check.amount ? check.amount.toString() : '',
                date: check.date ? (/^\d{4}-\d{2}-\d{2}$/.test(check.date) ? check.date : normalizeDate(check.date)) : '',
                checkDate: check.checkDate ? (/^\d{4}-\d{2}-\d{2}$/.test(check.checkDate) ? check.checkDate : normalizeDate(check.checkDate)) : '',
                bank: check.bank || '',
                notes: check.notes || '',
                receiverName: check.receiverName || '',
                finalReceiverName: check.finalReceiverName || ''
            });
        }
    }, [check, isOpen]);

    if (!isOpen || !check) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="modal-overlay open" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '500px' }}
            >
                <div className="modal-title">
                    <span>تعديل الشيك: {check.num}</span>
                    <button className="modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>
                <div className="modal-content">
                    <form onSubmit={handleSubmit}>
                        <div
                            className="form-grid"
                            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}
                        >
                            <div className="field" style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
                                    صاحب الشيك
                                </label>
                                <input
                                    type="text"
                                    value={formData.client}
                                    onChange={e => setFormData({ ...formData, client: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        color: '#000'
                                    }}
                                    required
                                />
                            </div>

                            <div className="field">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
                                    رقم الشيك
                                </label>
                                <input
                                    type="text"
                                    value={formData.num}
                                    onChange={e => setFormData({ ...formData, num: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        color: '#000'
                                    }}
                                    required
                                />
                            </div>
                            <div className="field">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
                                    تاريخ الشيك
                                </label>
                                <input
                                    type="date"
                                    value={formData.checkDate}
                                    onChange={e => setFormData({ ...formData, checkDate: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        color: '#000'
                                    }}
                                    required
                                />
                            </div>

                            <div className="field">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
                                    المبلغ (د.إ)
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        color: '#000'
                                    }}
                                    required
                                />
                            </div>
                            <div className="field">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
                                    تاريخ الاستلام
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        color: '#000'
                                    }}
                                    required
                                />
                            </div>

                            <div className="field">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
                                    مستلم من مين؟
                                </label>
                                <input
                                    type="text"
                                    value={formData.bank}
                                    onChange={e => setFormData({ ...formData, bank: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        color: '#000'
                                    }}
                                    required
                                />
                            </div>
                            <div className="field">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
                                    مين اللي استلم (المندوب)؟
                                </label>
                                <input
                                    type="text"
                                    value={formData.receiverName}
                                    onChange={e =>
                                        setFormData({ ...formData, receiverName: e.target.value })
                                    }
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        color: '#000'
                                    }}
                                />
                            </div>

                            <div className="field" style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
                                    المستلم النهائي
                                </label>
                                <input
                                    type="text"
                                    value={formData.finalReceiverName}
                                    onChange={e =>
                                        setFormData({ ...formData, finalReceiverName: e.target.value })
                                    }
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        color: '#000'
                                    }}
                                />
                            </div>

                            <div className="field" style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
                                    ملاحظات
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        color: '#000',
                                        minHeight: '60px',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>
                        </div>

                        <div
                            style={{
                                marginTop: '20px',
                                display: 'flex',
                                gap: '15px',
                                borderTop: '1px solid #e2e8f0',
                                paddingTop: '15px'
                            }}
                        >
                            <button
                                type="button"
                                className="btn-cancel-delete"
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '8px'
                                }}
                                onClick={onClose}
                                disabled={isLoading}
                            >
                                إلغاء
                            </button>
                            <button
                                type="submit"
                                className="btn-confirm-delete"
                                style={{
                                    flex: 1,
                                    background: 'var(--gold)',
                                    color: 'black',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    padding: '12px',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    borderRadius: '8px'
                                }}
                                disabled={isLoading}
                            >
                                <Save size={18} /> {isLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
