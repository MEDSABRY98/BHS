'use client';

import React from 'react';
import { Check, formatDate } from '../types';

interface TrackingModalProps {
    isOpen: boolean;
    onClose: () => void;
    check: Check | null;
}

export default function TrackingModal({
    isOpen,
    onClose,
    check
}: TrackingModalProps) {
    if (!isOpen || !check) return null;

    const findEvent = (eventName: string) => {
        return check.timeline?.find(e => e.event === eventName);
    };

    const isStepDone = (step: 'received' | 'registered' | 'delivered') => {
        if (step === 'received') return true; // Always done since it exists
        if (step === 'registered') {
            return check.status === 'registered' || check.status === 'delivered';
        }
        if (step === 'delivered') {
            return check.status === 'delivered';
        }
        return false;
    };

    const steps = [
        {
            key: 'received' as const,
            title: 'تم استلام المستند',
            eventKey: 'مستلمة',
            desc: check.bank ? `تم الاستلام من: ${check.bank}` : 'تم استلام الشيك بنجاح'
        },
        {
            key: 'registered' as const,
            title: 'تم التسجيل في السيستم',
            eventKey: 'مسجلة في السيستم',
            desc: check.receiverName ? `المندوب المسؤول: ${check.receiverName}` : 'تم تسجيل بيانات الشيك بالنظام'
        },
        {
            key: 'delivered' as const,
            title: 'تم التسليم للمكتب الرئيسي',
            eventKey: 'مسلّمة للمكتب الرئيسي',
            desc: check.finalReceiverName ? `المستلم النهائي: ${check.finalReceiverName}` : 'تم إيداع/تسليم الشيك للمقر الرئيسي'
        }
    ];

    return (
        <div className="modal-overlay open tracking-overlay" onClick={onClose}>
            <div className="modal tracking-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="tracking-header">
                    <span className="tracking-id-badge">مستند رقم: {check.num}</span>
                    <h2 className="tracking-title">مسار وتتبع المستند</h2>
                    <p className="tracking-subtitle">صاحب الشيك: {check.client}</p>
                    <button className="tracking-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="tracking-body">
                    {/* Summary Grid */}
                    <div className="tracking-summary-grid">
                        <div className="summary-item">
                            <span className="summary-label">رقم الشيك</span>
                            <span className="summary-value">{check.num}</span>
                        </div>
                        <div className="summary-item border-x">
                            <span className="summary-label">المبلغ</span>
                            <span className="summary-value gold">
                                {check.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })} د.إ
                            </span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-label">تاريخ الاستلام</span>
                            <span className="summary-value">{formatDate(check.date)}</span>
                        </div>
                    </div>

                    {/* Timeline Section Title */}
                    <h3 className="timeline-section-title">حالة المسار</h3>

                    {/* Modern Timeline */}
                    <div className="modern-timeline">
                        {steps.map((s, index) => {
                            const done = isStepDone(s.key);
                            const ev = findEvent(s.eventKey);
                            const isFinal = index === steps.length - 1;
                            const stepClass = `timeline-step ${done ? 'active' : 'pending'} ${isFinal && done ? 'final' : ''}`;

                            return (
                                <div key={s.key} className={stepClass}>
                                    <div className="step-marker">
                                        {done ? (
                                            '✓'
                                        ) : (
                                            <div className="pulse-dot"></div>
                                        )}
                                    </div>
                                    <div className="step-label">{s.title}</div>
                                    <div className="step-detail">{s.desc}</div>
                                    {ev && (
                                        <div className="step-detail step-sub-detail" style={{ marginTop: '4px' }}>
                                            ⏱ {ev.time} {ev.note ? `| ${ev.note}` : ''}
                                        </div>
                                    )}
                                    
                                    {/* Receiver info pills */}
                                    {s.key === 'registered' && check.receiverName && (
                                        <div className="receiver-info-pills">
                                            <span className="info-pill">المندوب: {check.receiverName}</span>
                                        </div>
                                    )}
                                    {s.key === 'delivered' && check.finalReceiverName && (
                                        <div className="receiver-info-pills">
                                            <span className="info-pill">المستلم: {check.finalReceiverName}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Notes Box if any */}
                    {check.notes && (
                        <div className="tracking-notes-section">
                            <h4 className="section-title">ملاحظات إضافية</h4>
                            <div className="notes-box">{check.notes}</div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="tracking-footer">
                    <button className="tracking-done-btn" onClick={onClose}>
                        إغلاق التتبع
                    </button>
                </div>
            </div>
        </div>
    );
}
