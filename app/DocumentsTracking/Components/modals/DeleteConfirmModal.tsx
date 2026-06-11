'use client';

import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isLoading: boolean;
}

export default function DeleteConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    isLoading
}: DeleteConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay open delete-confirm-overlay" onClick={onClose}>
            <div className="modal delete-modal" onClick={e => e.stopPropagation()}>
                <div className="delete-modal-header">
                    <div className="delete-icon-wrapper">
                        <AlertTriangle className="delete-warning-icon" />
                    </div>
                    <h3>حذف الشيك نهائياً؟</h3>
                </div>
                <div className="delete-modal-body">
                    <p>هل أنت متأكد من رغبتك في حذف هذا الشيك؟</p>
                    <p className="delete-warning-text">هذا الإجراء لا يمكن التراجع عنه.</p>
                </div>
                <div className="delete-modal-footer">
                    <button className="btn-cancel-delete" onClick={onClose} disabled={isLoading}>
                        إلغاء
                    </button>
                    <button className="btn-confirm-delete" onClick={onConfirm} disabled={isLoading}>
                        {isLoading ? 'جاري الحذف...' : <><Trash2 size={16} /> تأكيد الحذف</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
