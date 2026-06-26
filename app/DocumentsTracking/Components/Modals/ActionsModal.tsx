'use client';

import React from 'react';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { Check } from '../types';

interface ActionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    check: Check | null;
    onViewDetails: (checkId: string) => void;
    onEdit: (check: Check) => void;
    onDelete: (checkId: string) => void;
}

export default function ActionsModal({
    isOpen,
    onClose,
    check,
    onViewDetails,
    onEdit,
    onDelete
}: ActionsModalProps) {
    if (!isOpen || !check) return null;

    return (
        <div className="modal-overlay open" onClick={onClose}>
            <div
                className="modal action-popup-modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '380px' }}
            >
                <div className="modal-title">
                    <span>إجراءات الشيك: {check.num}</span>
                    <button className="modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>
                <div className="modal-content">
                    <div className="action-buttons-grid">
                        <button
                            className="action-btn-large"
                            onClick={() => {
                                onViewDetails(check.id);
                                onClose();
                            }}
                        >
                            <div className="btn-icon-circle blue">
                                <Eye size={20} />
                            </div>
                            <div className="btn-text">
                                <h4>عرض التفاصيل</h4>
                            </div>
                        </button>

                        <button
                            className="action-btn-large"
                            onClick={() => {
                                onEdit(check);
                                onClose();
                            }}
                        >
                            <div
                                className="btn-icon-circle"
                                style={{ backgroundColor: '#fff8eb', color: 'var(--gold-dark)' }}
                            >
                                <Edit size={20} />
                            </div>
                            <div className="btn-text">
                                <h4>تعديل الشيك</h4>
                            </div>
                        </button>

                        <button
                            className="action-btn-large delete"
                            onClick={() => {
                                onDelete(check.id);
                                onClose();
                            }}
                        >
                            <div className="btn-icon-circle red">
                                <Trash2 size={20} />
                            </div>
                            <div className="btn-text">
                                <h4>حذف الشيك</h4>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
