'use client';

import React, { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';

interface ReceiverExcelModalProps {
    isOpen: boolean;
    onClose: () => void;
    receiverName: string;
    onExport: (type: 'all' | 'custom', date: string) => void;
}

export default function ReceiverExcelModal({
    isOpen,
    onClose,
    receiverName,
    onExport
}: ReceiverExcelModalProps) {
    const [exportType, setExportType] = useState<'all' | 'custom'>('all');
    const [selectedDate, setSelectedDate] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onExport(exportType, selectedDate);
    };

    return (
        <div className="modal-overlay open" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '400px' }}
            >
                <div className="modal-title">
                    <span>تصدير شيكات المستلم: {receiverName}</span>
                    <button className="modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>
                <div className="modal-content">
                    <form onSubmit={handleSubmit}>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '15px',
                                marginBottom: '20px'
                            }}
                        >
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    cursor: 'pointer'
                                }}
                            >
                                <input
                                    type="radio"
                                    name="excel-export-type"
                                    checked={exportType === 'all'}
                                    onChange={() => setExportType('all')}
                                />
                                <span style={{ fontSize: '14px', color: '#000', fontWeight: 600 }}>
                                    تصدير كافة الشيكات المستلمة
                                </span>
                            </label>

                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    cursor: 'pointer'
                                }}
                            >
                                <input
                                    type="radio"
                                    name="excel-export-type"
                                    checked={exportType === 'custom'}
                                    onChange={() => setExportType('custom')}
                                />
                                <span style={{ fontSize: '14px', color: '#000', fontWeight: 600 }}>
                                    تصدير شيكات تاريخ تسليم معين
                                </span>
                            </label>

                            {exportType === 'custom' && (
                                <div className="field">
                                    <label style={{ color: '#000', fontWeight: 700, fontSize: '12px' }}>
                                        تاريخ التسليم المحدد
                                    </label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={e => setSelectedDate(e.target.value)}
                                        required
                                        style={{
                                            color: '#000',
                                            width: '100%',
                                            padding: '10px',
                                            border: '1px solid #ccc',
                                            borderRadius: '8px'
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                gap: '15px',
                                borderTop: '1px solid #e2e8f0',
                                paddingTop: '15px'
                            }}
                        >
                            <button
                                type="button"
                                className="btn-cancel-delete"
                                style={{ flex: 1, padding: '10px', borderRadius: '8px' }}
                                onClick={onClose}
                            >
                                إلغاء
                            </button>
                            <button
                                type="submit"
                                className="btn-confirm-delete"
                                style={{
                                    flex: 1,
                                    background: '#2e7d32',
                                    color: 'white',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    fontWeight: 700
                                }}
                            >
                                <FileSpreadsheet size={16} /> تصدير إكسيل
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
