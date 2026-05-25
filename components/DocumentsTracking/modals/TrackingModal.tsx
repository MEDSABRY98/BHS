'use client';

import React from 'react';
import { Check } from '../types';

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
        <div className="modal-overlay open" onClick={onClose}>
            <div className="modal timeline-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-title">
                    <span>مسار وتتبع المستند: {check.num}</span>
                    <button className="modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>
                <div className="modal-content text-center">
                    <div className="tracking-timeline">
                        {steps.map((s, index) => {
                            const done = isStepDone(s.key);
                            const ev = findEvent(s.eventKey);
                            return (
                                <div key={s.key} className={`tracking-step ${done ? 'active' : ''}`}>
                                    <div className="step-circle">{index + 1}</div>
                                    <div className="step-content">
                                        <h4>{s.title}</h4>
                                        <p>{s.desc}</p>
                                        {ev ? (
                                            <span className="step-time">
                                                ⏱ {ev.time} {ev.note ? `| ${ev.note}` : ''}
                                            </span>
                                        ) : (
                                            <span className="step-pending">بانتظار الإجراء...</span>
                                        )}
                                    </div>
                                    {index < steps.length - 1 && <div className="step-connector"></div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
