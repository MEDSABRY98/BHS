'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Info } from 'lucide-react';
import {
    Check,
    STATUS_LABELS,
    STATUS_NEXT,
    STATUS_NEXT_LABEL,
    formatDate
} from '../types';
import { createPortal } from 'react-dom';
import { getDeliveryPersonnel } from '../../Service/documents_tracking_service';

interface DetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    check: Check | null;
    onAdvanceStatus: (checkId: string, currentStatus: string, details: any) => Promise<void>;
    isAdvancing: boolean;
}

export default function DetailsModal({
    isOpen,
    onClose,
    check,
    onAdvanceStatus,
    isAdvancing
}: DetailsModalProps) {
    const [receiverNameInput, setReceiverNameInput] = useState('');
    const [finalReceiverNameInput, setFinalReceiverNameInput] = useState('');
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
        if (isOpen && check) {
            setReceiverNameInput(check.receiverName || '');
            setFinalReceiverNameInput(check.finalReceiverName || '');
        }
    }, [isOpen, check]);

    if (!isOpen || !check) return null;

    const currentStatus = check.status;
    const nextStatus = STATUS_NEXT[currentStatus];
    const nextStatusLabel = STATUS_NEXT_LABEL[currentStatus];

    const handleAdvance = (e: React.FormEvent) => {
        e.preventDefault();
        onAdvanceStatus(check.id, currentStatus, {
            receiverName: receiverNameInput,
            finalReceiverName: finalReceiverNameInput
        });
    };

    const isStepDone = (step: 'received' | 'delivered') => {
        if (step === 'received') return true;
        if (step === 'delivered') return currentStatus === 'delivered';
        return false;
    };

    return (
        <div className="modal-overlay open" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
                <div className="modal-title">
                    <span>تفاصيل مستند الشيك: {check.num}</span>
                    <button className="modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>
                <div className="modal-content">
                    {/* DETAILS LIST */}
                    <div className="check-details" style={{ marginBottom: '24px' }}>
                        <div className="detail-row">
                            <span className="detail-label">صاحب الشيك:</span>
                            <span className="detail-value font-bold">{check.client}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">رقم الشيك:</span>
                            <span className="detail-value check-num">{check.num}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">تاريخ الشيك:</span>
                            <span className="detail-value">{formatDate(check.checkDate)}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">تاريخ الاستلام:</span>
                            <span className="detail-value">{formatDate(check.date)}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">تم الاستلام من:</span>
                            <span className="detail-value">{check.bank || '—'}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">المبلغ:</span>
                            <span className="detail-value check-amount gold" style={{ color: 'var(--gold-dark)' }}>
                                {check.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })} د.إ
                            </span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">الحالة الحالية:</span>
                            <span className={`badge badge-${currentStatus}`}>
                                {STATUS_LABELS[currentStatus]}
                            </span>
                        </div>
                        {check.receiverName && (
                            <div className="detail-row">
                                <span className="detail-label">المندوب المستلم:</span>
                                <span className="detail-value">{check.receiverName}</span>
                            </div>
                        )}
                        {check.finalReceiverName && (
                            <div className="detail-row">
                                <span className="detail-label">المستلم النهائي بالشركة:</span>
                                <span className="detail-value">{check.finalReceiverName}</span>
                            </div>
                        )}
                    </div>

                    {/* NOTES BOX */}
                    {check.notes && (
                        <div style={{ marginBottom: '24px' }}>
                            <div className="detail-label" style={{ marginBottom: '8px', fontSize: '13px' }}>ملاحظات:</div>
                            <div className="notes-box">{check.notes}</div>
                        </div>
                    )}

                    {/* Progress tracking bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                        <div className="progress-track" style={{ justifyContent: 'center', width: '100%' }}>
                            <div className={`step ${isStepDone('received') ? 'done' : ''}`} title="مستلمة">
                                {isStepDone('delivered') ? '✓' : '1'}
                            </div>
                            <div className={`step-line ${isStepDone('delivered') ? 'done' : ''}`}></div>
                            <div className={`step ${isStepDone('delivered') ? 'done' : ''}`} title="مسلمة للمكتب">
                                {isStepDone('delivered') ? '✓' : '2'}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '80%', fontSize: '11px', fontWeight: 700, color: 'var(--gray-600)' }}>
                            <span>استلام</span>
                            <span>تسليم مكتب</span>
                        </div>
                    </div>

                    {/* Action form to advance status */}
                    {nextStatus && (
                        <div className="status-action-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginTop: '20px' }}>
                            <h4 className="action-box-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: 'var(--black)', marginBottom: '12px' }}>
                                <Info size={16} style={{ color: 'var(--gold-dark)' }} /> ترقية حالة الشيك إلى: {STATUS_LABELS[nextStatus]}
                            </h4>
                            <form onSubmit={handleAdvance} className="action-form">
                                <div className="delivery-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                                    {currentStatus === 'received' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="field">
                                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-600)', display: 'block', marginBottom: '6px' }}>مين اللي راح يسلم (اسم المندوب)</label>
                                                <input
                                                    type="text"
                                                    value={receiverNameInput}
                                                    onChange={e => setReceiverNameInput(e.target.value)}
                                                    onFocus={(e) => {
                                                        const rect = e.target.getBoundingClientRect();
                                                        setDropdownCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
                                                        setFocusedInput('rep');
                                                    }}
                                                    onBlur={() => setTimeout(() => setFocusedInput(null), 200)}
                                                    placeholder="اسم المندوب المسؤول عن التوصيل..."
                                                    required
                                                    style={{ color: '#000' }}
                                                />
                                                {focusedInput === 'rep' && receiverNameInput && typeof document !== 'undefined' && createPortal(
                                                    <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px`, width: `${dropdownCoords.width}px`, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', zIndex: 999999, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} dir="rtl">
                                                        {reps.filter(r => r.toLowerCase().includes(receiverNameInput.toLowerCase())).map(r => (
                                                            <div key={r} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1e293b' }} 
                                                                onMouseDown={(e) => { e.preventDefault(); setReceiverNameInput(r); setFocusedInput(null); }}
                                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            >{r}</div>
                                                        ))}
                                                    </div>,
                                                    document.body
                                                )}
                                            </div>
                                            <div className="field">
                                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-600)', display: 'block', marginBottom: '6px' }}>المستلم النهائي بالمكتب</label>
                                                <input
                                                    type="text"
                                                    value={finalReceiverNameInput}
                                                    onChange={e => setFinalReceiverNameInput(e.target.value)}
                                                    onFocus={(e) => {
                                                        const rect = e.target.getBoundingClientRect();
                                                        setDropdownCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
                                                        setFocusedInput('receiver');
                                                    }}
                                                    onBlur={() => setTimeout(() => setFocusedInput(null), 200)}
                                                    placeholder="اسم مستلم المكتب..."
                                                    required
                                                    style={{ color: '#000' }}
                                                />
                                                {focusedInput === 'receiver' && finalReceiverNameInput && typeof document !== 'undefined' && createPortal(
                                                    <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px`, width: `${dropdownCoords.width}px`, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', zIndex: 999999, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} dir="rtl">
                                                        {receivers.filter(r => r.toLowerCase().includes(finalReceiverNameInput.toLowerCase())).map(r => (
                                                            <div key={r} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1e293b' }} 
                                                                onMouseDown={(e) => { e.preventDefault(); setFinalReceiverNameInput(r); setFocusedInput(null); }}
                                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            >{r}</div>
                                                        ))}
                                                    </div>,
                                                    document.body
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    className="btn-status btn-advance"
                                    disabled={isAdvancing}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <ShieldCheck size={18} />
                                    {isAdvancing ? 'جاري التحديث...' : nextStatusLabel}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
