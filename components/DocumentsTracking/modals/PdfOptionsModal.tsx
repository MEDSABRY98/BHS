'use client';

import React, { useState, useEffect } from 'react';
import { FileCheck } from 'lucide-react';

interface PdfOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (type: 'received' | 'delivered', personName: string) => void;
}

export default function PdfOptionsModal({
    isOpen,
    onClose,
    onGenerate
}: PdfOptionsModalProps) {
    const [pdfType, setPdfType] = useState<'received' | 'delivered'>('delivered');
    const [pdfPersonName, setPdfPersonName] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPdfPersonName('');
            setPdfType('delivered');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pdfPersonName.trim()) {
            onGenerate(pdfType, pdfPersonName);
        }
    };

    return (
        <div className="modal-overlay open" onClick={onClose}>
            <div
                className="modal pdf-options-modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '450px' }}
            >
                <div className="modal-title">
                    <span>خيارات تقرير الـ PDF</span>
                    <button className="modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="pdf-options-content" style={{ padding: '20px 0' }}>
                    <div className="option-group" style={{ marginBottom: '25px' }}>
                        <label
                            className="group-label"
                            style={{
                                display: 'block',
                                fontWeight: 700,
                                color: 'var(--gray-400)',
                                marginBottom: '12px'
                            }}
                        >
                            نوع العملية:
                        </label>
                        <div className="pdf-type-selector" style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="button"
                                className={`type-btn ${pdfType === 'received' ? 'active' : ''}`}
                                style={{
                                    flex: 1,
                                    padding: '15px',
                                    borderRadius: '12px',
                                    border: '2px solid #e2e8f0',
                                    background: pdfType === 'received' ? '#f0fdf4' : '#f8fafc',
                                    borderColor: pdfType === 'received' ? '#22c55e' : '#e2e8f0',
                                    color: pdfType === 'received' ? '#15803d' : '#64748b',
                                    fontWeight: 700
                                }}
                                onClick={() => setPdfType('received')}
                            >
                                📥 استلام شيكات
                            </button>
                            <button
                                type="button"
                                className={`type-btn ${pdfType === 'delivered' ? 'active' : ''}`}
                                style={{
                                    flex: 1,
                                    padding: '15px',
                                    borderRadius: '12px',
                                    border: '2px solid #e2e8f0',
                                    background: pdfType === 'delivered' ? '#f0fdf4' : '#f8fafc',
                                    borderColor: pdfType === 'delivered' ? '#22c55e' : '#e2e8f0',
                                    color: pdfType === 'delivered' ? '#15803d' : '#64748b',
                                    fontWeight: 700
                                }}
                                onClick={() => setPdfType('delivered')}
                            >
                                📤 تسليم شيكات
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="field">
                            <label style={{ marginBottom: '8px', display: 'block', fontWeight: 700 }}>
                                {pdfType === 'received' ? 'مستلم من من؟' : 'مسلم إلى من؟'}
                            </label>
                            <input
                                type="text"
                                value={pdfPersonName}
                                onChange={e => setPdfPersonName(e.target.value)}
                                placeholder="اكتب الاسم هنا..."
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: '2px solid #e2e8f0',
                                    fontSize: '15px',
                                    color: 'black'
                                }}
                                autoFocus
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="pdf-final-generate-btn"
                            disabled={!pdfPersonName.trim()}
                            style={{
                                width: '100%',
                                marginTop: '25px',
                                padding: '15px',
                                background: '#4f46e5',
                                color: 'white',
                                borderRadius: '12px',
                                border: 'none',
                                fontWeight: 800,
                                fontSize: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                opacity: pdfPersonName.trim() ? 1 : 0.6,
                                cursor: pdfPersonName.trim() ? 'pointer' : 'not-allowed'
                            }}
                        >
                            <FileCheck size={20} />
                            إصدار التقرير الآن
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
