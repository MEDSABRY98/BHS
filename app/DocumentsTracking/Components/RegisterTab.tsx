'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Plus, Save, Download, Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
    toDisplayDate,
    applyDateMask,
    normalizeDate,
    getNextDocIds
} from './types';
import { getDocumentsTracking, addDocumentsTrackingRecords, getCustomers, getDeliveryPersonnel } from '../Service/documents_tracking_service';
import { exportDebitExcelTable } from '../../Debit/Export/ExcelExport';

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

    const [customers, setCustomers] = useState<{ id: string, name: string }[]>([]);
    const [receivedFromHistory, setReceivedFromHistory] = useState<string[]>([]);
    const [focusedClientRow, setFocusedClientRow] = useState<number | null>(null);
    const [focusedBankRow, setFocusedBankRow] = useState<number | null>(null);
    const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0, width: 0 });
    const [showExcelMenu, setShowExcelMenu] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            const res = await getCustomers();
            if (res.customers) {
                setCustomers(res.customers);
            }
            const personnelData = await getDeliveryPersonnel();
            if (personnelData && personnelData.receivedFromList) {
                setReceivedFromHistory(personnelData.receivedFromList);
            }
        };
        fetchData();
    }, []);

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

    const downloadTemplate = async () => {
        const headers = ['صاحب الشيك', 'تاريخ الاستلام', 'تاريخ الشيك', 'رقم الشيك', 'مبلغ الشيك', 'مستلم من مين؟', 'ملاحظات'];
        const rows = [['', '', '', '', '', '', '']];

        await exportDebitExcelTable(
            headers,
            rows,
            "Checks_Template.xlsx",
            { sheetName: 'Template', columnWidth: 20 }
        );
        setShowExcelMenu(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: true });

                const parseExcelDate = (val: any) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        // Excel serial date to JS Date
                        const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
                        return dateObj.toISOString().split('T')[0];
                    }
                    return normalizeDate(String(val));
                };

                if (jsonData.length > 0) {
                    const newDrafts = jsonData.map((row, index) => {
                        let amount = row['مبلغ الشيك'];
                        if (amount === undefined) amount = '';
                        return {
                            id: Date.now() + index,
                            client: row['صاحب الشيك'] || '',
                            date: parseExcelDate(row['تاريخ الاستلام']) || new Date().toISOString().split('T')[0],
                            checkDate: parseExcelDate(row['تاريخ الشيك']) || '',
                            num: String(row['رقم الشيك'] || '').padStart(6, '0'),
                            amount: String(amount).replace(/,/g, ''), // remove commas if formatted
                            bank: row['مستلم من مين؟'] || '',
                            notes: row['ملاحظات'] || ''
                        };
                    });

                    if (drafts.length === 1 && !drafts[0].client && !drafts[0].num && !drafts[0].amount) {
                        setDrafts(newDrafts);
                    } else {
                        setDrafts([...drafts, ...newDrafts]);
                    }
                    showNotify(`تم استيراد ${newDrafts.length} شيك بنجاح`, 'success');
                }
            } catch (error) {
                console.error("Error parsing excel:", error);
                showNotify("حدث خطأ أثناء قراءة الملف، تأكد من الصيغة", 'error');
            }
        };
        reader.readAsArrayBuffer(file);

        if (fileInputRef.current) fileInputRef.current.value = '';
        setShowExcelMenu(false);
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
            const currentData = await getDocumentsTracking();
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

            const result = await addDocumentsTrackingRecords(recordsToSave);

            if (result && result.success) {
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
            <div className="drafts-container" style={{ overflow: 'visible' }}>
                {drafts.map(draft => (
                    <div className="form-row-inputs" key={draft.id}>
                        <div className="field no-label">
                            <input
                                type="text"
                                value={draft.client}
                                onChange={e => updateDraft(draft.id, 'client', e.target.value)}
                                onFocus={(e) => {
                                    const rect = e.target.getBoundingClientRect();
                                    setDropdownCoords({
                                        top: rect.bottom + window.scrollY,
                                        left: rect.left + window.scrollX,
                                        width: rect.width
                                    });
                                    setFocusedClientRow(draft.id);
                                }}
                                onBlur={() => {
                                    setTimeout(() => setFocusedClientRow(null), 200);
                                }}
                                placeholder="اسم صاحب الشيك"
                            />
                            {focusedClientRow === draft.id && draft.client && typeof document !== 'undefined' && createPortal(
                                <div dir="rtl" style={{
                                    position: 'absolute',
                                    top: `${dropdownCoords.top}px`,
                                    left: `${dropdownCoords.left}px`,
                                    width: `${dropdownCoords.width}px`,
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                    zIndex: 999999,
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                                    marginTop: '4px',
                                    padding: '4px'
                                }}>
                                    {customers
                                        .filter(c => c.name.toLowerCase().includes(draft.client.toLowerCase()))
                                        .slice(0, 10)
                                        .map(c => (
                                            <div
                                                key={c.id}
                                                style={{
                                                    padding: '10px 12px',
                                                    cursor: 'pointer',
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: 600,
                                                    color: '#1e293b',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    updateDraft(draft.id, 'client', c.name);
                                                    setFocusedClientRow(null);
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                {c.name}
                                            </div>
                                        ))}
                                    {customers.filter(c => c.name.toLowerCase().includes(draft.client.toLowerCase())).length === 0 && (
                                        <div style={{ padding: '10px 12px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                                            لا يوجد عميل بهذا الاسم
                                        </div>
                                    )}
                                </div>,
                                document.body
                            )}
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
                                onFocus={(e) => {
                                    const rect = e.target.getBoundingClientRect();
                                    setDropdownCoords({
                                        top: rect.bottom + window.scrollY,
                                        left: rect.left + window.scrollX,
                                        width: rect.width
                                    });
                                    setFocusedBankRow(draft.id);
                                }}
                                onBlur={() => {
                                    setTimeout(() => setFocusedBankRow(null), 200);
                                }}
                                placeholder="اسم المستلم"
                            />
                            {focusedBankRow === draft.id && draft.bank && typeof document !== 'undefined' && createPortal(
                                <div dir="rtl" style={{
                                    position: 'absolute',
                                    top: `${dropdownCoords.top}px`,
                                    left: `${dropdownCoords.left}px`,
                                    width: `${dropdownCoords.width}px`,
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                    zIndex: 999999,
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                                    marginTop: '4px',
                                    padding: '4px'
                                }}>
                                    {receivedFromHistory
                                        .filter(name => name.toLowerCase().includes(draft.bank.toLowerCase()))
                                        .slice(0, 10)
                                        .map((name, i) => (
                                            <div
                                                key={`bank-${i}`}
                                                style={{
                                                    padding: '10px 12px',
                                                    cursor: 'pointer',
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: 600,
                                                    color: '#1e293b',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    updateDraft(draft.id, 'bank', name);
                                                    setFocusedBankRow(null);
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                {name}
                                            </div>
                                        ))}
                                    {receivedFromHistory.filter(name => name.toLowerCase().includes(draft.bank.toLowerCase())).length === 0 && (
                                        <div style={{ padding: '10px 12px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                                            لا يوجد اسم مطابق
                                        </div>
                                    )}
                                </div>,
                                document.body
                            )}
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
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-add-row" onClick={addDraftRow} disabled={isLoading}>
                        <Plus size={18} className="icon" /> إضافة صف جديد
                    </button>

                    <button
                        className="btn-add-row"
                        style={{ backgroundColor: '#217346', color: 'white' }}
                        onClick={() => setShowExcelMenu(true)}
                        disabled={isLoading}
                    >
                        <FileSpreadsheet size={18} className="icon" /> إكسيل
                    </button>

                    {showExcelMenu && typeof document !== 'undefined' && createPortal(
                        <div style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 9999999
                        }}>
                            <div dir="rtl" style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '24px',
                                width: '400px',
                                maxWidth: '90%',
                                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                                position: 'relative'
                            }}>
                                <button
                                    onClick={() => setShowExcelMenu(false)}
                                    style={{ position: 'absolute', top: '16px', left: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px' }}
                                >
                                    ✕
                                </button>
                                <h3 style={{ margin: '0 0 24px 0', color: '#0f172a', fontSize: '18px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <FileSpreadsheet color="#217346" /> خيارات استيراد الإكسيل
                                </h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <button
                                        onClick={downloadTemplate}
                                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', color: '#1e293b', fontWeight: 600, fontSize: '15px', transition: 'all 0.2s', textAlign: 'right' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#217346'; e.currentTarget.style.background = '#f0fdf4'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
                                    >
                                        <div style={{ background: '#dcfce7', color: '#166534', padding: '8px', borderRadius: '6px' }}><Download size={20} /></div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span>تحميل قالب الإكسيل</span>
                                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal', marginTop: '4px' }}>قم بتنزيل ملف فارغ بالأعمدة المطلوبة</span>
                                        </div>
                                    </button>

                                    <label
                                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', color: '#1e293b', fontWeight: 600, fontSize: '15px', transition: 'all 0.2s', margin: 0 }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#217346'; e.currentTarget.style.background = '#f0fdf4'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
                                    >
                                        <div style={{ background: '#dcfce7', color: '#166534', padding: '8px', borderRadius: '6px' }}><Upload size={20} /></div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span>رفع ملف الشيكات</span>
                                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal', marginTop: '4px' }}>ارفع الملف بعد تعبئته لإضافته للبرنامج</span>
                                        </div>
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            style={{ display: 'none' }}
                                            ref={fileInputRef}
                                            onChange={handleFileUpload}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </div>

                <button className="btn-save-all" onClick={saveAllDrafts} disabled={isLoading}>
                    <Save size={18} className="icon" /> حفظ الكل
                </button>
            </div>
        </div>
    );
}
