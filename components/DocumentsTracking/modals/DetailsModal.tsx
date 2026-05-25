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

    const isStepDone = (step: 'received' | 'registered' | 'delivered') => {
        if (step === 'received') return true;
        if (step === 'registered') return currentStatus === 'registered' || currentStatus === 'delivered';
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
                    <div className="check-details-grid">
                        <div className="detail-item">
                            <span className="label">صاحب الشيك:</span>
                            <span className="value font-bold">{check.client}</span>
                        </div>
                        <div className="detail-item">
                            <span className="label">رقم الشيك:</span>
                            <span className="value check-num">{check.num}</span>
                        </div>
                        <div className="detail-item">
                            <span className="label">تاريخ الشيك:</span>
                            <span className="value">{formatDate(check.checkDate)}</span>
                        </div>
                        <div className="detail-item">
                            <span className="label">تاريخ الاستلام:</span>
                            <span className="value">{formatDate(check.date)}</span>
                        </div>
                        <div className="detail-item">
                            <span className="label">البنك المستلم منه:</span>
                            <span className="value">{check.bank}</span>
                        </div>
                        <div className="detail-item">
                            <span className="label">المبلغ:</span>
                            <span className="value check-amount gold">
                                {check.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })} د.إ
                            </span>
                        </div>
                        <div className="detail-item">
                            <span className="label">الحالة الحالية:</span>
                            <span className={`badge badge-${currentStatus}`}>
                                {STATUS_LABELS[currentStatus]}
                            </span>
                        </div>
                        {check.receiverName && (
                            <div className="detail-item">
                                <span className="label">المندوب المستلم:</span>
                                <span className="value">{check.receiverName}</span>
                            </div>
                        )}
                        {check.finalReceiverName && (
                            <div className="detail-item">
                                <span className="label">المستلم النهائي بالشركة:</span>
                                <span className="value">{check.finalReceiverName}</span>
                            </div>
                        )}
                        <div className="detail-item full-width" style={{ gridColumn: '1 / -1' }}>
                            <span className="label">ملاحظات:</span>
                            <span className="value notes-box">{check.notes || 'لا يوجد ملاحظات'}</span>
                        </div>
                    </div>

                    {/* Progress tracking bar */}
                    <div className="modal-progress-bar">
                        <div className={`step-item ${isStepDone('received') ? 'completed' : ''}`}>
                            <div className="circle">1</div>
                            <span>استلام</span>
                        </div>
                        <div className="progress-line-between"></div>
                        <div className={`step-item ${isStepDone('registered') ? 'completed' : ''}`}>
                            <div className="circle">2</div>
                            <span>تسجيل</span>
                        </div>
                        <div className="progress-line-between"></div>
                        <div className={`step-item ${isStepDone('delivered') ? 'completed' : ''}`}>
                            <div className="circle">3</div>
                            <span>تسليم مكتب</span>
                        </div>
                    </div>

                    {/* Action form to advance status */}
                    {nextStatus && (
                        <div className="status-action-box">
                            <h4 className="action-box-title">
                                <Info size={16} /> ترقية حالة الشيك إلى: {STATUS_LABELS[nextStatus]}
                            </h4>
                            <form onSubmit={handleAdvance} className="action-form">
                                {currentStatus === 'received' && (
                                    <div className="field">
                                        <label>اسم المندوب المسؤول عن التسجيل</label>
                                        <input
                                            type="text"
                                            value={receiverNameInput}
                                            onChange={e => setReceiverNameInput(e.target.value)}
                                            placeholder="أدخل اسم المندوب..."
                                            required
                                            style={{ color: '#000' }}
                                        />
                                    </div>
                                )}
                                {currentStatus === 'registered' && (
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '12px'
                                        }}
                                    >
                                        <div className="field">
                                            <label>اسم المندوب</label>
                                            <input
                                                type="text"
                                                value={receiverNameInput}
                                                onChange={e => setReceiverNameInput(e.target.value)}
                                                placeholder="اسم المندوب..."
                                                required
                                                style={{ color: '#000' }}
                                            />
                                        </div>
                                        <div className="field">
                                            <label>المستلم النهائي بالمكتب</label>
                                            <input
                                                type="text"
                                                value={finalReceiverNameInput}
                                                onChange={e => setFinalReceiverNameInput(e.target.value)}
                                                placeholder="اسم مستلم المكتب..."
                                                required
                                                style={{ color: '#000' }}
                                            />
                                        </div>
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    className="btn-status-confirm"
                                    disabled={isAdvancing}
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
