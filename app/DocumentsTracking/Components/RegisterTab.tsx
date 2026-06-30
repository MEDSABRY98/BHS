'use client';

import React, { useState } from 'react';
import { Calendar, Plus, Save } from 'lucide-react';
import {
    toDisplayDate,
    applyDateMask,
    normalizeDate,
    getNextDocIds
} from './types';

interface RegisterTabProps {
    onSaveSuccess: () => void;
    isLoading: boolean;
    setIsLoading: (val: boolean) => void;
    showNotify: (msg: string, type?: 'success' | 'error') => void;
}

export default function RegisterTab({
    onSaveSuccess,
    isLoading,
    setIsLoading,
    showNotify
}: RegisterTabProps) {
    // Drafts for bulk registration
    const [drafts, setDrafts] = useState<any[]>([
        {
            id: Date.now(),
            num: '',
            client: '',
            amount: '',
            date: new Date().toISOString().split('T')[0],
            checkDate: '',
            bank: '',
            notes: ''
        }
    ]);

    const addDraftRow = () => {
        setDrafts([
            ...drafts,
            {
                id: Date.now(),
                num: '',
                client: '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                checkDate: '',
                bank: '',
                notes: ''
            }
        ]);
    };

    const updateDraft = (id: number, field: string, value: any) => {
        setDrafts(drafts.map(d => (d.id === id ? { ...d, [field]: value } : d)));
    };

    const removeDraft = (id: number) => {
        if (drafts.length === 1) {
            setDrafts([
                {
                    id: Date.now(),
                    num: '',
                    client: '',
                    amount: '',
                    date: new Date().toISOString().split('T')[0],
                    checkDate: '',
                    bank: '',
                    notes: ''
                }
            ]);
            return;
        }
        setDrafts(drafts.filter(d => d.id !== id));
    };

    const saveAllDrafts = async () => {
        const activeDrafts = drafts.filter(
            d => d.num || d.client || d.amount || d.checkDate || d.bank || d.notes
        );
        const validDrafts = activeDrafts.filter(
            d => d.num && d.client && d.amount && d.date && d.checkDate && d.bank
        );

        if (activeDrafts.length === 0) {
            showNotify('No data to save', 'error');
            return;
        }

        if (validDrafts.length < activeDrafts.length) {
            showNotify(
                'Please complete all six required fields for each drafted row',
                'error'
            );
            return;
        }

        setIsLoading(true);
        try {
            // Get current count from database first to generate correct DOC IDs
            const res = await fetch('/api/DocumentsTracking');
            if (!res.ok) {
                throw new Error('Failed to load existing documents');
            }
            const currentData = await res.json();
            const existingRecords = currentData.records || [];
            const nextDocIds = getNextDocIds(existingRecords, validDrafts.length);

            const recordsToSave = validDrafts.map((draft, idx) => ({
                documentId: nextDocIds[idx],
                receivedDate: normalizeDate(draft.date) || draft.date,
                documentDate: normalizeDate(draft.checkDate) || draft.checkDate,
                documentNumber: draft.num,
                documentName: draft.client,
                receivedFrom: draft.bank,
                documentAmount: parseFloat(draft.amount),
                documentNotes: draft.notes,
                documentStatus: 'registered',
                datedSendToOffice: '',
                whoDeliveryForOffice: '',
                whoTakeFromOffice: ''
            }));

            const response = await fetch('/api/DocumentsTracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', records: recordsToSave })
            });

            if (response.ok) {
                showNotify(`Successfully saved ${validDrafts.length} checks`);
                setDrafts([
                    {
                        id: Date.now(),
                        num: '',
                        client: '',
                        amount: '',
                        date: new Date().toISOString().split('T')[0],
                        checkDate: '',
                        bank: '',
                        notes: ''
                    }
                ]);
                onSaveSuccess();
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to save');
            }
        } catch (error) {
            console.error('Error saving drafts:', error);
            const message = error instanceof Error ? error.message : 'Error saving data to Supabase';
            showNotify(message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="form-section row-mode">
            <div className="form-row-header">
                <div className="rh-cell">صاحب الشيك</div>
                <div className="rh-cell">تاريخ الاستلام</div>
                <div className="rh-cell">تاريخ الشيك</div>
                <div className="rh-cell">رقم الشيك</div>
                <div className="rh-cell">مبلغ الشيك (د.إ)</div>
                <div className="rh-cell">مستلم من مين؟</div>
                <div className="rh-cell">ملاحظات</div>
                <div className="rh-cell action">الإجراء</div>
            </div>
            <div className="drafts-container">
                {drafts.map(draft => (
                    <div className="form-row-inputs" key={draft.id}>
                        <div className="field no-label">
                            <input
                                type="text"
                                value={draft.client}
                                onChange={e => updateDraft(draft.id, 'client', e.target.value)}
                                placeholder="اسم صاحب الشيك"
                            />
                        </div>
                        <div className="field no-label">
                            <div className="date-input-wrapper">
                                <input
                                    type="text"
                                    value={toDisplayDate(draft.date)}
                                    onChange={e => {
                                        const masked = applyDateMask(e.target.value, toDisplayDate(draft.date));
                                        updateDraft(draft.id, 'date', masked);
                                    }}
                                    onBlur={e => {
                                        const normalized = normalizeDate(e.target.value);
                                        if (normalized) updateDraft(draft.id, 'date', normalized);
                                    }}
                                    placeholder="dd/mm/yyyy"
                                    maxLength={10}
                                    style={{ letterSpacing: '0.5px', paddingRight: '34px' }}
                                />
                                <label
                                    htmlFor={`date-picker-${draft.id}`}
                                    title="اختر من التقويم"
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                >
                                    <Calendar className="date-icon" size={14} />
                                </label>
                                <input
                                    id={`date-picker-${draft.id}`}
                                    type="date"
                                    value={/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : ''}
                                    onChange={e => updateDraft(draft.id, 'date', e.target.value)}
                                    style={{
                                        position: 'absolute',
                                        opacity: 0,
                                        width: '28px',
                                        height: '28px',
                                        right: '6px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        cursor: 'pointer',
                                        zIndex: 3
                                    }}
                                    tabIndex={-1}
                                />
                            </div>
                        </div>
                        <div className="field no-label">
                            <div className="date-input-wrapper">
                                <input
                                    type="text"
                                    value={toDisplayDate(draft.checkDate)}
                                    onChange={e => {
                                        const masked = applyDateMask(
                                            e.target.value,
                                            toDisplayDate(draft.checkDate)
                                        );
                                        updateDraft(draft.id, 'checkDate', masked);
                                    }}
                                    onBlur={e => {
                                        const normalized = normalizeDate(e.target.value);
                                        if (normalized) updateDraft(draft.id, 'checkDate', normalized);
                                    }}
                                    placeholder="dd/mm/yyyy"
                                    maxLength={10}
                                    style={{ letterSpacing: '0.5px', paddingRight: '34px' }}
                                />
                                <label
                                    htmlFor={`checkdate-picker-${draft.id}`}
                                    title="اختر من التقويم"
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                >
                                    <Calendar className="date-icon" size={14} />
                                </label>
                                <input
                                    id={`checkdate-picker-${draft.id}`}
                                    type="date"
                                    value={
                                        /^\d{4}-\d{2}-\d{2}$/.test(draft.checkDate)
                                            ? draft.checkDate
                                            : ''
                                    }
                                    onChange={e => updateDraft(draft.id, 'checkDate', e.target.value)}
                                    style={{
                                        position: 'absolute',
                                        opacity: 0,
                                        width: '28px',
                                        height: '28px',
                                        right: '6px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        cursor: 'pointer',
                                        zIndex: 3
                                    }}
                                    tabIndex={-1}
                                />
                            </div>
                        </div>
                        <div className="field no-label">
                            <input
                                type="text"
                                value={draft.num}
                                onChange={e => updateDraft(draft.id, 'num', e.target.value)}
                                placeholder="رقم الشيك"
                            />
                        </div>
                        <div className="field no-label">
                            <input
                                type="number"
                                value={draft.amount}
                                onChange={e => updateDraft(draft.id, 'amount', e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="field no-label">
                            <input
                                type="text"
                                value={draft.bank}
                                onChange={e => updateDraft(draft.id, 'bank', e.target.value)}
                                placeholder="اسم المستلم"
                            />
                        </div>
                        <div className="field no-label">
                            <input
                                type="text"
                                value={draft.notes}
                                onChange={e => updateDraft(draft.id, 'notes', e.target.value)}
                                placeholder="ملاحظات..."
                            />
                        </div>
                        <div className="field no-label action">
                            <div className="draft-actions">
                                <button
                                    className="btn-remove-draft"
                                    onClick={() => removeDraft(draft.id)}
                                    title="حذف الصف"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="form-footer-actions">
                <button className="btn-add-row" onClick={addDraftRow} disabled={isLoading}>
                    <Plus size={18} className="icon" /> إضافة صف جديد
                </button>
                <button className="btn-save-all" onClick={saveAllDrafts} disabled={isLoading}>
                    <Save size={18} className="icon" /> حفظ الكل
                </button>
            </div>
        </div>
    );
}
