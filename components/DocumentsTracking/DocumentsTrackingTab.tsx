'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Calendar, Save, Plus, AlertTriangle, Trash2, Printer, FileText, MoreVertical, Eye } from 'lucide-react';
import './DocumentsTracking.css';

interface TimelineEvent {
    event: string;
    time: string;
    note?: string;
}

interface Check {
    id: string; // Internal id (becomes documentId in sheet)
    num: string; // DOCUMENT NUMBER
    client: string; // DOCUMENT NAME
    amount: number; // DOCUMENT AMOUNT
    date: string; // RECEIVED DATE
    checkDate: string; // DOCUMENT DATE
    bank: string; // RECEIVED FROM
    notes: string; // DOCUMENT NOTES
    status: 'received' | 'registered' | 'delivered';
    timeline: TimelineEvent[];
    receiverName?: string;
    finalReceiverName?: string;
    rowIndex?: number; // Row index from sheet
}

const STATUS_LABELS = {
    received: 'مستلمة',
    registered: 'مسجلة في السيستم',
    delivered: 'مسلّمة للمكتب الرئيسي'
};

const STATUS_NEXT: Record<string, 'received' | 'registered' | 'delivered' | null> = {
    received: 'registered',
    registered: 'delivered',
    delivered: null
};

const STATUS_NEXT_LABEL: Record<string, string | null> = {
    received: 'تأكيد التسجيل في السيستم',
    registered: 'تأكيد التسليم للمكتب الرئيسي',
    delivered: null
};

export default function DocumentsTrackingTab() {
    const router = useRouter();
    const [checks, setChecks] = useState<Check[]>([]);
    const [currentFilter, setCurrentFilter] = useState<'all' | 'received' | 'registered' | 'delivered'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
    const [headerDate, setHeaderDate] = useState('');
    const [activeSubTab, setActiveSubTab] = useState<'register' | 'list'>('register');

    // Delivery tracking inputs
    const [delReceiver, setDelReceiver] = useState('');
    const [delFinal, setDelFinal] = useState('');

    // Notification state
    const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Print Choice state
    const [printModal, setPrintModal] = useState<{ isOpen: boolean; check: Check | null }>({
        isOpen: false,
        check: null
    });

    // Confirmation state
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; checkId: string | null }>({
        isOpen: false,
        checkId: null
    });

    // Action modal state
    const [activeActionModal, setActiveActionModal] = useState<Check | null>(null);

    const showNotify = (msg: string, type: 'success' | 'error' = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // Drafts for bulk registration
    const [drafts, setDrafts] = useState<any[]>([
        { id: Date.now(), num: '', client: '', amount: '', date: new Date().toISOString().split('T')[0], checkDate: '', bank: '', notes: '' }
    ]);

    const fetchChecks = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/documents-tracking');
            const data = await response.json();
            if (data.records) {
                // Map sheet records back to Check interface
                const mappedChecks: Check[] = data.records.map((r: any) => {
                    const timeline: TimelineEvent[] = [];
                    if (r.datedReceived) timeline.push({ event: 'تم الاستلام', time: r.datedReceived });
                    if (r.datedRecord) timeline.push({ event: 'مسجلة في السيستم', time: r.datedRecord });
                    if (r.datedSendToOffice) timeline.push({ event: 'مسلّمة للمكتب الرئيسي', time: r.datedSendToOffice });

                    let status: 'received' | 'registered' | 'delivered' = 'received';
                    if (r.documentStatus === 'مسلّمة للمكتب الرئيسي' || r.datedSendToOffice) status = 'delivered';
                    else if (r.documentStatus === 'مسجلة في السيستم' || r.datedRecord) status = 'registered';

                    return {
                        id: r.documentId,
                        num: r.documentNumber,
                        client: r.documentName,
                        amount: r.documentAmount,
                        date: r.receivedDate,
                        checkDate: r.documentDate,
                        bank: r.receivedFrom,
                        notes: r.documentNotes,
                        status,
                        timeline,
                        rowIndex: r.rowIndex
                    };
                });
                setChecks(mappedChecks.reverse()); // Show newest first
            }
        } catch (error) {
            console.error('Error fetching checks:', error);
            showNotify('خطأ في تحميل البيانات من السيرفر', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchChecks();
        setHeaderDate(new Date().toLocaleDateString('ar-AE', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }));
    }, []);

    const genDocId = (index: number) => {
        return `DOC-${(index + 1).toString().padStart(4, '0')}`;
    };

    const addDraftRow = () => {
        setDrafts([...drafts, { id: Date.now(), num: '', client: '', amount: '', date: new Date().toISOString().split('T')[0], checkDate: '', bank: '', notes: '' }]);
    };

    const updateDraft = (id: number, field: string, value: any) => {
        setDrafts(drafts.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    const removeDraft = (id: number) => {
        if (drafts.length === 1) {
            setDrafts([{ id: Date.now(), num: '', client: '', amount: '', date: new Date().toISOString().split('T')[0], checkDate: '', bank: '', notes: '' }]);
            return;
        }
        setDrafts(drafts.filter(d => d.id !== id));
    };

    const saveAllDrafts = async () => {
        const activeDrafts = drafts.filter(d => d.num || d.client || d.amount || d.checkDate || d.bank || d.notes);
        const validDrafts = activeDrafts.filter(d => d.num && d.client && d.amount && d.date && d.checkDate && d.bank);

        if (activeDrafts.length === 0) {
            showNotify('لا توجد بيانات ليتم حفظها', 'error');
            return;
        }

        if (validDrafts.length < activeDrafts.length) {
            showNotify('يرجى إكمال كافة البيانات الستة المطلوبة لكل صف بدأت بتعبئته', 'error');
            return;
        }

        setIsLoading(true);
        try {
            // Get current count from sheet first to generate correct DOC IDs
            const res = await fetch('/api/documents-tracking');
            const currentData = await res.json();
            const currentCount = currentData.records ? currentData.records.length : 0;

            const now = new Date().toLocaleString('ar-AE');
            const recordsToSave = validDrafts.map((draft, idx) => ({
                documentId: genDocId(currentCount + idx),
                receivedDate: draft.date,
                documentDate: draft.checkDate,
                documentNumber: draft.num,
                documentName: draft.client,
                receivedFrom: draft.bank,
                documentAmount: parseFloat(draft.amount),
                documentNotes: draft.notes,
                documentStatus: 'مستلمة',
                datedReceived: now,
                datedRecord: '',
                datedSendToOffice: ''
            }));

            const response = await fetch('/api/documents-tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', records: recordsToSave })
            });

            if (response.ok) {
                showNotify(`تم حفظ ${validDrafts.length} شيك بنجاح`);
                setDrafts([{ id: Date.now(), num: '', client: '', amount: '', date: new Date().toISOString().split('T')[0], checkDate: '', bank: '', notes: '' }]);
                await fetchChecks();
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            console.error('Error saving drafts:', error);
            showNotify('خطأ أثناء حفظ البيانات في جوجل شيت', 'error');
        } finally {
            setIsLoading(false);
        }
    };



    const requestDelete = (id: string) => {
        setConfirmDelete({ isOpen: true, checkId: id });
    };

    const deleteCheck = async () => {
        const id = confirmDelete.checkId;
        if (!id) return;
        const check = checks.find(c => c.id === id);
        if (!check || !check.rowIndex) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/documents-tracking', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex: check.rowIndex })
            });

            if (response.ok) {
                showNotify('تم حذف الشيك من جوجل شيت', 'error');
                setConfirmDelete({ isOpen: false, checkId: null });
                await fetchChecks();
            }
        } catch (error) {
            console.error('Error deleting check:', error);
            showNotify('فشل في حذف الشيك من جوجل شيت', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const advanceStatus = async () => {
        if (!selectedCheckId) return;

        const currentCheck = checks.find(c => c.id === selectedCheckId);
        if (!currentCheck || !currentCheck.rowIndex) return;

        const next = STATUS_NEXT[currentCheck.status];
        if (!next) return;

        // Validation for mandatory names when delivering
        if (next === 'delivered') {
            if (!delReceiver.trim() || !delFinal.trim()) {
                showNotify('يرجى إدخال اسم المستلم والمستلم النهائي', 'error');
                return;
            }
        }

        setIsLoading(true);
        try {
            const now = new Date().toLocaleString('ar-AE');
            const updateFields: any = {
                documentStatus: STATUS_LABELS[next],
                datedRecord: currentCheck.status === 'received' ? now : (currentCheck.timeline.find(t => t.event === 'مسجلة في السيستم')?.time || ''),
                datedSendToOffice: next === 'delivered' ? now : '',
            };

            // If delivering, also update the documentNotes to include receivers if needed,
            // or just use existing notes. Let's append to notes for now.
            if (next === 'delivered') {
                updateFields.documentNotes = `${currentCheck.notes} (المستلم: ${delReceiver}, النهائي: ${delFinal})`.trim();
            }

            const response = await fetch('/api/documents-tracking', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex: currentCheck.rowIndex, ...updateFields })
            });

            if (response.ok) {
                showNotify('تم تحديث الحالة في جوجل شيت');
                setDelReceiver('');
                setDelFinal('');
                setSelectedCheckId(null);
                await fetchChecks();
            }
        } catch (error) {
            console.error('Error advancing status:', error);
            showNotify('فشل في تحديث الحالة', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // PRINTING LOGIC
    const handlePrint = (check: Check, type: 'reception' | 'delivery') => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const isReception = type === 'reception';
        const title = isReception ? 'RECEPTION RECEIPT' : 'DELIVERY RECEIPT';
        const dateStr = new Date().toLocaleDateString('en-GB');
        const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        const html = `
          <html>
            <head>
              <title>${title} - ${check.id}</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&display=swap');
                body { 
                    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                    padding: 40px; 
                    color: #1a1a1a; 
                    background: #fff;
                    line-height: 1.5;
                }
                .receipt-container { 
                    border: 4px solid #000; 
                    padding: 40px; 
                    max-width: 700px; 
                    margin: auto; 
                    position: relative;
                    box-shadow: 0 0 20px rgba(0,0,0,0.1);
                }
                .header { 
                    text-align: center; 
                    border-bottom: 2px solid #EEE; 
                    padding-bottom: 25px; 
                    margin-bottom: 35px; 
                }
                .header h1 { 
                    margin: 0; 
                    font-size: 32px; 
                    font-weight: 900; 
                    letter-spacing: 4px; 
                }
                .header p { 
                    margin: 8px 0 0; 
                    color: #555; 
                    font-size: 14px; 
                    font-weight: 700;
                    letter-spacing: 1px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 40px;
                }
                .info-row { 
                    display: flex; 
                    flex-direction: column;
                    border-bottom: 1px solid #eee; 
                    padding-bottom: 8px; 
                }
                .info-label { 
                    font-size: 11px;
                    font-weight: 800; 
                    color: #888; 
                    text-transform: uppercase;
                    margin-bottom: 2px;
                }
                .info-value { 
                    font-size: 16px;
                    font-weight: 700; 
                    color: #000; 
                    text-transform: uppercase; 
                }
                .full-row { grid-column: 1 / -1; }
                .amount-box { 
                    margin: 40px 0; 
                    background: #000; 
                    padding: 25px; 
                    color: #fff;
                    text-align: center; 
                    border-radius: 4px;
                }
                .amount-box .lbl { font-size: 12px; font-weight: 700; opacity: 0.7; margin-bottom: 5px; }
                .amount-box .val { font-size: 36px; font-weight: 900; }
                .footer { 
                    margin-top: 60px; 
                    display: flex; 
                    justify-content: space-between; 
                    gap: 40px;
                }
                .sig-box { 
                    flex: 1;
                    padding-top: 15px; 
                    border-top: 2px solid #000; 
                    text-align: center; 
                    font-size: 12px; 
                    font-weight: 700;
                }
                .watermark { 
                    position: absolute; 
                    top: 50%; 
                    left: 50%; 
                    transform: translate(-50%, -50%) rotate(-45deg); 
                    opacity: 0.03; 
                    font-size: 120px; 
                    font-weight: 900; 
                    pointer-events: none; 
                    white-space: nowrap; 
                }
                @media print {
                    body { padding: 0; }
                    .receipt-container { border: 2px solid #000; box-shadow: none; }
                }
              </style>
            </head>
            <body onload="window.print(); window.close();">
              <div class="receipt-container">
                <div class="watermark">${isReception ? 'RECEIVED' : 'DELIVERED'}</div>
                <div class="header">
                  <h1>${title}</h1>
                  <p>BH DOCUMENTS TRACKING SYSTEM</p>
                </div>
                
                <div class="info-grid">
                    <div class="info-row">
                      <span class="info-label">Reference ID</span>
                      <span class="info-value">${check.id}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Date / Time Generated</span>
                      <span class="info-value">${dateStr} ${timeStr}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Document Number</span>
                      <span class="info-value">${check.num}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Document Date</span>
                      <span class="info-value">${check.checkDate || 'N/A'}</span>
                    </div>
                    <div class="info-row full-row">
                      <span class="info-label">Document Name / Owner</span>
                      <span class="info-value">${check.client}</span>
                    </div>
                    
                    ${isReception ? `
                      <div class="info-row full-row">
                        <span class="info-label">Handed Over By</span>
                        <span class="info-value">${check.bank || '—'}</span>
                      </div>
                      <div class="info-row full-row">
                        <span class="info-label">Reception Date (System)</span>
                        <span class="info-value">${check.date}</span>
                      </div>
                    ` : `
                      <div class="info-row">
                        <span class="info-label">Delivered To</span>
                        <span class="info-value">${check.receiverName || 'Internal Staff'}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Final Office Receiver</span>
                        <span class="info-value">${check.finalReceiverName || 'N/A'}</span>
                      </div>
                    `}

                    ${check.notes ? `
                    <div class="info-row full-row">
                      <span class="info-label">Internal Remarks</span>
                      <span class="info-value">${check.notes}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="amount-box">
                  <div class="lbl">DOCUMENT TOTAL VALUE</div>
                  <div class="val">${check.amount.toLocaleString('en-US')} AED</div>
                </div>
                
                <div class="footer">
                  <div class="sig-box">ISSUED BY & STAMP</div>
                  <div class="sig-box">RECEIVER SIGNATURE</div>
                </div>

                <p style="text-align: center; margin-top: 40px; font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px;">
                    This document is an electronic receipt generated by BH BHS System
                </p>
              </div>
            </body>
          </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        setPrintModal({ isOpen: false, check: null });
    };

    const formatDate = (d: string) => {
        if (!d) return '—';
        const date = new Date(d);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const renderProgress = (status: string) => {
        const steps: ('received' | 'registered' | 'delivered')[] = ['received', 'registered', 'delivered'];
        const cur = steps.indexOf(status as any);
        return (
            <div className="progress-track">
                {steps.map((s, i) => (
                    <React.Fragment key={s}>
                        {i > 0 && <div className={`step-line ${i <= cur ? 'done' : ''}`}></div>}
                        <div className={`step ${i < cur ? 'done' : i === cur ? 'current' : ''}`} title={STATUS_LABELS[s]}>{i + 1}</div>
                    </React.Fragment>
                ))}
            </div>
        );
    };

    const exportData = () => {
        const headers = ['رقم الشيك', 'العميل', 'المبلغ', 'تاريخ الاستلام', 'تاريخ الشيك', 'البنك', 'الحالة', 'ملاحظات'];
        const rows = checks.map(c => [
            c.num, c.client, c.amount, c.date, c.checkDate || '', c.bank || '', STATUS_LABELS[c.status], c.notes || ''
        ]);

        const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `شيكات_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    const filteredChecks = checks.filter(c => {
        const matchFilter = currentFilter === 'all' || c.status === currentFilter;
        const matchSearch = !searchQuery ||
            c.num.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.client.toLowerCase().includes(searchQuery.toLowerCase());
        return matchFilter && matchSearch;
    });

    const totalAmount = checks.reduce((sum, c) => sum + c.amount, 0);
    const receivedCount = checks.filter(c => c.status === 'received').length;
    const registeredCount = checks.filter(c => c.status === 'registered').length;
    const deliveredCount = checks.filter(c => c.status === 'delivered').length;

    const selectedCheck = checks.find(c => c.id === selectedCheckId);

    return (
        <div className={`doc-tracking-container ${isLoading ? 'loading-state' : ''}`}>
            {isLoading && (
                <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-white/60 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-indigo-900 font-bold">جاري تحديث البيانات...</p>
                    </div>
                </div>
            )}
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap" rel="stylesheet" />

            <header className="header">
                <div className="logo cursor-pointer" onClick={() => router.push('/')} title="العودة للرئيسية">
                    <div className="logo-icon"><ArrowRight className="w-6 h-6" /></div>
                    <div className="logo-text">تتبع <span>الشيكات</span></div>
                </div>
            </header>

            <div className="stats-bar">
                <div className="stat">
                    <span className="stat-label">إجمالي الشيكات</span>
                    <span className="stat-value">{checks.length}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">مستلمة</span>
                    <span className="stat-value">{receivedCount}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">مسجلة</span>
                    <span className="stat-value">{registeredCount}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">مسلّمة للمكتب</span>
                    <span className="stat-value gold">{deliveredCount}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">إجمالي المبالغ</span>
                    <span className="stat-value gold">{totalAmount.toLocaleString('ar-AE')} د.إ</span>
                </div>
            </div>

            <div className={`main ${activeSubTab === 'register' ? 'wide' : ''}`}>
                {/* SUB-TABS SWITCHER */}
                <div className="sub-tabs">
                    <button
                        className={`sub-tab ${activeSubTab === 'register' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('register')}
                    >
                        <span>📝</span> تسجيل شيك جديد
                    </button>
                    <button
                        className={`sub-tab ${activeSubTab === 'list' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('list')}
                    >
                        <span>📋</span> استعراض الشيكات
                    </button>
                </div>

                {activeSubTab === 'register' && (
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
                            {drafts.map((draft) => (
                                <div className="form-row-inputs" key={draft.id}>
                                    <div className="field no-label">
                                        <input type="text" value={draft.client} onChange={(e) => updateDraft(draft.id, 'client', e.target.value)} placeholder="اسم صاحب الشيك" />
                                    </div>
                                    <div className="field no-label">
                                        <div className="date-input-wrapper">
                                            <input type="date" value={draft.date} onChange={(e) => updateDraft(draft.id, 'date', e.target.value)} />
                                            <Calendar className="date-icon" size={14} />
                                        </div>
                                    </div>
                                    <div className="field no-label">
                                        <div className="date-input-wrapper">
                                            <input type="date" value={draft.checkDate} onChange={(e) => updateDraft(draft.id, 'checkDate', e.target.value)} />
                                            <Calendar className="date-icon" size={14} />
                                        </div>
                                    </div>
                                    <div className="field no-label">
                                        <input type="text" value={draft.num} onChange={(e) => updateDraft(draft.id, 'num', e.target.value)} placeholder="رقم الشيك" />
                                    </div>
                                    <div className="field no-label">
                                        <input type="number" value={draft.amount} onChange={(e) => updateDraft(draft.id, 'amount', e.target.value)} placeholder="0.00" />
                                    </div>
                                    <div className="field no-label">
                                        <input type="text" value={draft.bank} onChange={(e) => updateDraft(draft.id, 'bank', e.target.value)} placeholder="اسم المستلم" />
                                    </div>
                                    <div className="field no-label">
                                        <input type="text" value={draft.notes} onChange={(e) => updateDraft(draft.id, 'notes', e.target.value)} placeholder="ملاحظات..." />
                                    </div>
                                    <div className="field no-label action">
                                        <div className="draft-actions">
                                            <button className="btn-remove-draft" onClick={() => removeDraft(draft.id)} title="حذف الصف">✕</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="form-footer-actions">
                            <button className="btn-add-row" onClick={addDraftRow}>
                                <Plus size={18} className="icon" /> إضافة صف جديد
                            </button>
                            <button className="btn-save-all" onClick={saveAllDrafts}>
                                <Save size={18} className="icon" /> حفظ الكل
                            </button>
                        </div>
                    </div>
                )}

                {activeSubTab === 'list' && (
                    <>
                        {/* FILTERS */}
                        <div className="filters">
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-400)' }}>عرض:</span>
                            <button className={`filter-btn ${currentFilter === 'all' ? 'active' : ''}`} onClick={() => setCurrentFilter('all')}>الكل</button>
                            <button className={`filter-btn ${currentFilter === 'received' ? 'active' : ''}`} onClick={() => setCurrentFilter('received')}>مستلمة</button>
                            <button className={`filter-btn ${currentFilter === 'registered' ? 'active' : ''}`} onClick={() => setCurrentFilter('registered')}>مسجلة</button>
                            <button className={`filter-btn ${currentFilter === 'delivered' ? 'gold-active' : ''}`} onClick={() => setCurrentFilter('delivered')}>مسلّمة للمكتب</button>
                            <input type="text" className="search-box" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="🔍 بحث باسم العميل أو رقم الشيك..." />
                            <button className="filter-btn" onClick={exportData} style={{ marginRight: 'auto', borderColor: 'var(--gold)', color: 'var(--gold-dark)' }}>⬇ تصدير CSV</button>
                        </div>

                        {/* TABLE */}
                        <div className="table-container">
                            <div className="table-header-row">
                                <div className="th">#</div>
                                <div className="th">تاريخ الاستلام</div>
                                <div className="th">تاريخ الشيك</div>
                                <div className="th">رقم الشيك</div>
                                <div className="th">صاحب الشيك</div>
                                <div className="th">المبلغ</div>
                                <div className="th">مستلم من مين</div>
                                <div className="th">التقدم</div>
                                <div className="th">الإجراء</div>
                            </div>
                            <div className="checks-list">
                                {filteredChecks.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-icon">📋</div>
                                        <div className="empty-text">لا توجد نتائج</div>
                                    </div>
                                ) : (
                                    filteredChecks.map((c, i) => (
                                        <div className="check-row" key={c.id}>
                                            <div className="td" style={{ color: 'var(--gray-400)', fontWeight: 700 }}>{i + 1}</div>
                                            <div className="td">{formatDate(c.date)}</div>
                                            <div className="td">{formatDate(c.checkDate) || '—'}</div>
                                            <div className="td check-num">{c.num}</div>
                                            <div className="td">{c.client}</div>
                                            <div className="td check-amount">{c.amount.toLocaleString('ar-AE')} د.إ</div>
                                            <div className="td">{c.bank || '—'}</div>
                                            <div className="td">{renderProgress(c.status)}</div>
                                            <div className="td">
                                                <button
                                                    className="btn-menu"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveActionModal(c);
                                                    }}
                                                    title="الإجراءات"
                                                >
                                                    <MoreVertical size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* MODAL */}
            {selectedCheck && (
                <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setSelectedCheckId(null); }}>
                    <div className="modal">
                        <div className="modal-title">
                            <span>شيك رقم: {selectedCheck.num}</span>
                            <button className="modal-close" onClick={() => setSelectedCheckId(null)}>✕</button>
                        </div>
                        <div className="modal-content">
                            <div className="detail-row"><span className="detail-label">الحالة الحالية</span><span className={`badge badge-${selectedCheck.status}`}>{STATUS_LABELS[selectedCheck.status]}</span></div>
                            <div className="detail-row"><span className="detail-label">تاريخ الاستلام</span><span className="detail-value">{formatDate(selectedCheck.date)}</span></div>
                            <div className="detail-row"><span className="detail-label">تاريخ الشيك</span><span className="detail-value">{formatDate(selectedCheck.checkDate) || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">رقم الشيك</span><span className="detail-value">{selectedCheck.num}</span></div>
                            <div className="detail-row"><span className="detail-label">صاحب الشيك</span><span className="detail-value">{selectedCheck.client}</span></div>
                            <div className="detail-row"><span className="detail-label">مبلغ الشيك</span><span className="detail-value" style={{ color: 'var(--gold-dark)', fontSize: '16px' }}>{selectedCheck.amount.toLocaleString('ar-AE')} د.إ</span></div>
                            <div className="detail-row"><span className="detail-label">مستلم من مين؟</span><span className="detail-value">{selectedCheck.bank || '—'}</span></div>

                            {selectedCheck.status === 'delivered' && (
                                <>
                                    <div className="detail-row"><span className="detail-label">استلم مني</span><span className="detail-value" style={{ color: 'var(--gold-dark)' }}>{selectedCheck.receiverName || '—'}</span></div>
                                    <div className="detail-row"><span className="detail-label">المستلم النهائي</span><span className="detail-value" style={{ color: 'var(--gold-dark)' }}>{selectedCheck.finalReceiverName || '—'}</span></div>
                                </>
                            )}

                            <div className="detail-row"><span className="detail-label">ملاحظات</span><span className="detail-value">{selectedCheck.notes || '—'}</span></div>

                            <div className="timeline">
                                <div className="timeline-title">سجل المراحل</div>
                                {selectedCheck.timeline.map((t, i) => (
                                    <div className="timeline-item" key={i}>
                                        <div className="timeline-dot"></div>
                                        <div className="timeline-content">
                                            <div className="timeline-event">{t.event}</div>
                                            <div className="timeline-time">{t.time}</div>
                                        </div>
                                    </div>
                                ))}
                                {STATUS_NEXT[selectedCheck.status] && (
                                    <div className="timeline-item" style={{ opacity: 0.4 }}>
                                        <div className="timeline-dot empty"></div>
                                        <div className="timeline-content">
                                            <div className="timeline-event">{STATUS_LABELS[STATUS_NEXT[selectedCheck.status]!]}</div>
                                            <div className="timeline-time">في الانتظار</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {STATUS_NEXT[selectedCheck.status] ? (
                                <div className="advance-form">
                                    {selectedCheck.status === 'registered' && (
                                        <div className="delivery-inputs">
                                            <div className="field no-label" style={{ marginBottom: '10px' }}>
                                                <input
                                                    type="text"
                                                    value={delReceiver}
                                                    onChange={(e) => setDelReceiver(e.target.value)}
                                                    placeholder="اسم الشخص اللي استلم منك"
                                                />
                                            </div>
                                            <div className="field no-label" style={{ marginBottom: '15px' }}>
                                                <input
                                                    type="text"
                                                    value={delFinal}
                                                    onChange={(e) => setDelFinal(e.target.value)}
                                                    placeholder="اسم المستلم النهائي في المكتب"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        className="btn-status btn-advance"
                                        onClick={advanceStatus}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'جاري التحديث...' : `✓ ${STATUS_NEXT_LABEL[selectedCheck.status]}`}
                                    </button>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '12px', color: 'var(--gold-dark)', fontWeight: 700, fontSize: '13px', background: '#FFFDE7', borderRadius: '8px', marginTop: '8px' }}>
                                    ✦ اكتملت جميع المراحل بنجاح
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ACTIONS MODAL */}
            {activeActionModal && (
                <div className="modal-overlay open" onClick={() => setActiveActionModal(null)}>
                    <div className="modal action-popup-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
                        <div className="modal-title">
                            <span>إجراءات الشيك: {activeActionModal.num}</span>
                            <button className="modal-close" onClick={() => setActiveActionModal(null)}>✕</button>
                        </div>
                        <div className="modal-content">
                            <div className="action-buttons-grid">
                                <button className="action-btn-large" onClick={() => { setSelectedCheckId(activeActionModal.id); setActiveActionModal(null); }}>
                                    <div className="btn-icon-circle blue"><Eye size={20} /></div>
                                    <div className="btn-text">
                                        <h4>عرض التفاصيل</h4>
                                        <p>بيانات الشيك والسجل الزمني</p>
                                    </div>
                                </button>


                                <button className="action-btn-large delete" onClick={() => { requestDelete(activeActionModal.id); setActiveActionModal(null); }}>
                                    <div className="btn-icon-circle red"><Trash2 size={20} /></div>
                                    <div className="btn-text">
                                        <h4>حذف الشيك</h4>
                                        <p>مسح السجل نهائياً من السيستم</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {confirmDelete.isOpen && (
                <div className="modal-overlay open delete-confirm-overlay" onClick={() => setConfirmDelete({ isOpen: false, checkId: null })}>
                    <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
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
                            <button className="btn-cancel-delete" onClick={() => setConfirmDelete({ isOpen: false, checkId: null })}>
                                إلغاء
                            </button>
                            <button className="btn-confirm-delete" onClick={deleteCheck}>
                                <Trash2 size={16} /> تأكيد الحذف
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINT CHOICE MODAL */}
            {printModal.isOpen && printModal.check && (
                <div className="modal-overlay open" onClick={() => setPrintModal({ isOpen: false, check: null })}>
                    <div className="modal print-choice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-title">
                            <span>اختيار نوع الريسيت للطباعة</span>
                            <button className="modal-close" onClick={() => setPrintModal({ isOpen: false, check: null })}>✕</button>
                        </div>
                        <div className="modal-content" style={{ textAlign: 'center', padding: '20px 0' }}>
                            <p style={{ marginBottom: '20px', color: 'var(--gray-600)' }}>
                                يرجى اختيار نوع الإيصال الذي ترغب في طباعته (باللغة الإنجليزية) للشيك رقم: <br />
                                <strong>{printModal.check.num}</strong>
                            </p>

                            <div className="print-options-grid">
                                <button className="btn-status btn-advance" onClick={() => handlePrint(printModal.check!, 'reception')} style={{ background: '#333', marginBottom: '10px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <FileText size={18} /> Receipt: Receiving Document
                                </button>

                                <button className="btn-status btn-advance" onClick={() => handlePrint(printModal.check!, 'delivery')} style={{ background: 'var(--gold-dark)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Printer size={18} /> Receipt: Delivering Document
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* NOTIFICATION TOAST */}
            {notification && (
                <div className={`toast-notification ${notification.type}`}>
                    <div className="toast-icon">{notification.type === 'success' ? '✓' : '✕'}</div>
                    <div className="toast-content">
                        <div className="toast-title">{notification.type === 'success' ? 'تمت العملية' : 'تنبيه'}</div>
                        <div className="toast-msg">{notification.msg}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
