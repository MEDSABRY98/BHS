'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Calendar, Save, Plus, AlertTriangle, Trash2, MoreVertical, Eye, RefreshCcw, FileCheck, Users, ChevronDown, ChevronUp } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
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
    const [activeSubTab, setActiveSubTab] = useState<'register' | 'list' | 'receivers'>('register');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [trackingCheck, setTrackingCheck] = useState<Check | null>(null);

    // Delivery tracking inputs
    const [delReceiver, setDelReceiver] = useState('');
    const [delFinal, setDelFinal] = useState('');

    // PDF Modal state
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfType, setPdfType] = useState<'received' | 'delivered'>('delivered');
    const [pdfPersonName, setPdfPersonName] = useState('');

    // Notification state
    const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [isLoading, setIsLoading] = useState(false);


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
                    const s = (r.documentStatus || '').toString().trim();
                    if (s === 'مسلّمة للمكتب الرئيسي') status = 'delivered';
                    else if (s === 'مسجلة في السيستم') status = 'registered';
                    else if (s === 'مستلمة') status = 'received';
                    // Fallback only if status is empty but dates exist
                    else if (r.datedSendToOffice) status = 'delivered';
                    else if (r.datedRecord) status = 'registered';

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
                        rowIndex: r.rowIndex,
                        receiverName: r.whoDeliveryForOffice || '',
                        finalReceiverName: r.whoTakeFromOffice || ''
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

    // Convert any date format (dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd) to ISO yyyy-mm-dd
    const normalizeDate = (val: string): string => {
        if (!val) return '';
        // Already ISO format
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
        const parts = val.split(/[\/\-\.\s]/);
        if (parts.length === 3) {
            const [a, b, c] = parts;
            if (c.length === 4) {
                // dd/mm/yyyy
                return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
            } else if (a.length === 4) {
                // yyyy/mm/dd
                return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
            }
        }
        return val;
    };

    // Format ISO date to dd/mm/yyyy for display
    const toDisplayDate = (isoVal: string): string => {
        if (!isoVal) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(isoVal)) {
            const [y, m, d] = isoVal.split('-');
            return `${d}/${m}/${y}`;
        }
        return isoVal;
    };

    // Auto-mask: يضيف / تلقائياً أثناء الكتابة بتنسيق dd/mm/yyyy
    const applyDateMask = (raw: string, prev: string): string => {
        // إذا المستخدم بيمسح (الإدخال الجديد أقصر من القديم) ابقى طبيعي
        const isDeleting = raw.length < prev.length;
        if (isDeleting) return raw;

        // خلي بس الأرقام
        const digits = raw.replace(/\D/g, '');

        // ابنِ الـ mask تدريجياً
        let masked = '';
        if (digits.length <= 2) {
            masked = digits;
        } else if (digits.length <= 4) {
            masked = `${digits.slice(0, 2)}/${digits.slice(2)}`;
        } else {
            masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
        }
        return masked;
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
                receivedDate: normalizeDate(draft.date) || draft.date,
                documentDate: normalizeDate(draft.checkDate) || draft.checkDate,
                documentNumber: draft.num,
                documentName: draft.client,
                receivedFrom: draft.bank,
                documentAmount: parseFloat(draft.amount),
                documentNotes: draft.notes,
                documentStatus: 'مستلمة',
                datedReceived: now,
                datedRecord: '',
                datedSendToOffice: '',
                whoDeliveryForOffice: '',
                whoTakeFromOffice: ''
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

            if (next === 'delivered') {
                updateFields.whoDeliveryForOffice = delReceiver;
                updateFields.whoTakeFromOffice = delFinal;
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

                // ✅ نحدث البيانات ونخلي المودال مفتوح على نفس الشيك
                const keepId = selectedCheckId;
                await fetchChecks();
                // بعد fetchChecks يعمل setChecks، نضمن المودال يفضل مفتوح
                setSelectedCheckId(keepId);
            }
        } catch (error) {
            console.error('Error advancing status:', error);
            showNotify('فشل في تحديث الحالة', 'error');
        } finally {
            setIsLoading(false);
        }
    };


    const toggleSelectAll = () => {
        if (selectedIds.length === filteredChecks.length && filteredChecks.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredChecks.map(c => c.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const generateHandoverReceipt = async () => {
        const selectedCheques = checks.filter(c => selectedIds.includes(c.id));
        if (selectedCheques.length === 0) return;

        setIsLoading(true);
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;
            const today = new Date().toLocaleDateString('en-GB');
            const labelText = pdfType === 'received' ? 'Received From:' : 'Delivered To:';

            // 1. Full Page Gold Border (A4)
            doc.setDrawColor(201, 162, 39); // #c9a227
            doc.setLineWidth(1.5);
            doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

            // 2. Title
            const titleText = pdfType === 'received' ? 'CHEQUE RECEIPT' : 'CHEQUE HANDOVER';
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(0, 0, 0);
            doc.text(titleText, pageWidth / 2, 25, { align: 'center' });

            // 3. Simplified Header (Date 25%, Person 75% of content area)
            doc.setDrawColor(201, 162, 39); // #c9a227
            doc.setLineWidth(1.2);

            // Date Segment
            doc.setFontSize(11);
            doc.setFont('Helvetica', 'bold');
            doc.text('Date:', 15, 39);
            const dateLineStart = 27;
            const dateLineEnd = 58;
            doc.line(dateLineStart, 41, dateLineEnd, 41);
            doc.setFont('Helvetica', 'normal');
            doc.text(today, (dateLineStart + dateLineEnd) / 2, 39, { align: 'center' });

            // Person Name Segment
            doc.setFont('Helvetica', 'bold');
            doc.text(labelText, 63, 39);
            const receiverLineStart = 90;
            const receiverLineEnd = 195;
            doc.line(receiverLineStart, 41, receiverLineEnd, 41);
            doc.setFontSize(13); // Larger font for the name
            doc.setFont('Helvetica', 'normal');
            doc.text(pdfPersonName, (receiverLineStart + receiverLineEnd) / 2, 39, { align: 'center' });

            // 4. Cheque Table (Columns: #, Drawer Name, Cheque Date, Cheque Number, Amount)
            // Sorting by client name (Cheque Name) as requested
            const sortedCheques = [...selectedCheques].sort((a, b) => a.client.localeCompare(b.client));

            const tableData = sortedCheques.map((c, i) => [
                i + 1,
                c.client,
                formatDate(c.checkDate),
                c.num,
                c.amount.toLocaleString('en-US')
            ]);

            autoTable(doc, {
                startY: 50,
                head: [['#', 'Cheque Name', 'Cheque Date', 'Cheque Number', 'Amount']],
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [201, 162, 39],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    halign: 'center',
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1
                },
                styles: {
                    fontSize: 10,
                    cellPadding: 4,
                    lineColor: [68, 68, 68],
                    lineWidth: 0.1,
                    textColor: [0, 0, 0],
                    halign: 'center',
                    valign: 'middle'
                },
                columnStyles: {
                    0: { cellWidth: 12 },
                    1: { halign: 'center' },
                    2: { halign: 'center' },
                    3: { halign: 'center' },
                    4: { halign: 'center' }
                }
            });

            // 5. Totals Footer
            const finalY = (doc as any).lastAutoTable.finalY + 10;
            const totalAmount = selectedCheques.reduce((sum, c) => sum + c.amount, 0);

            doc.setFont('Helvetica', 'bold');
            doc.text(`Total Cheques: ${selectedCheques.length}`, 15, finalY);
            doc.text(`Total Amount: ${totalAmount.toLocaleString('en-US')} AED`, pageWidth - 15, finalY, { align: 'right' });

            doc.save(`Cheque_${today.replace(/\//g, '-')}.pdf`);
            showNotify('تم إصدار التقرير بنجاح');
            setSelectedIds([]);
            setIsPdfModalOpen(false);
            setPdfPersonName('');
        } catch (error) {
            console.error('PDF Generation failed:', error);
            showNotify('فشل في إنشاء ملف PDF نوعي', 'error');
        } finally {
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 500);
        }
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
        const headers = ['اسم العميل', 'تاريخ الاستلام', 'تاريخ الشيك', 'رقم الشيك', 'المبلغ', 'مستلم من مين', 'الملاحظات', 'الحالة'];
        const rows = checks.map(c => [
            c.client,
            c.date,
            c.checkDate || '',
            // We use the ="000" formula trick to preserve leading zeros in Excel
            `="${c.num}"`,
            c.amount,
            c.bank || '',
            c.notes || '',
            STATUS_LABELS[c.status]
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

    // Group by registration date (c.date), newest group first
    // Within each group, sort by checkDate newest first
    const groupedChecks = (() => {
        // The date stored in c.date is RECEIVED DATE (ISO or dd/mm/yyyy)
        // We extract just the day part as group key
        const getDateKey = (c: Check): string => {
            const rawDate = c.date || '';
            if (!rawDate) return 'غير محدد';

            // Try ISO format (yyyy-mm-dd)
            if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                    // Use yyyy-mm-dd as key for sorting, display separately
                    return d.toISOString().split('T')[0];
                }
            }
            // Try dd/mm/yyyy format
            const slash = rawDate.split('/');
            if (slash.length === 3) {
                const [day, month, year] = slash;
                const clean = year.split(',')[0].split('،')[0].trim();
                return `${clean}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            return rawDate.split('،')[0].split(',')[0].trim();
        };

        const formatGroupLabel = (key: string): string => {
            // key is yyyy-mm-dd
            if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
                const d = new Date(key + 'T00:00:00');
                return d.toLocaleDateString('ar-EG', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
            return key;
        };

        const map = new Map<string, { checks: Check[]; label: string }>();
        [...filteredChecks]
            .sort((a, b) => {
                const da = new Date(b.checkDate || 0).getTime();
                const db = new Date(a.checkDate || 0).getTime();
                return da - db;
            })
            .forEach(c => {
                const key = getDateKey(c);
                if (!map.has(key)) map.set(key, { checks: [], label: formatGroupLabel(key) });
                map.get(key)!.checks.push(c);
            });

        return Array.from(map.entries())
            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
    })();

    const totalAmount = checks.reduce((sum, c) => sum + c.amount, 0);
    const receivedCount = checks.filter(c => c.status === 'received').length;
    const registeredCount = checks.filter(c => c.status === 'registered').length;
    const deliveredCount = checks.filter(c => c.status === 'delivered').length;

    // Calculate Stats for Receivers Tab
    const receiverStats = React.useMemo(() => {
        const stats: Record<string, { count: number; totalAmount: number; lastDate: string; items: Check[] }> = {};

        checks.forEach(c => {
            if (c.status === 'delivered' && c.finalReceiverName) {
                const name = c.finalReceiverName.trim();
                const receiptTime = c.timeline.find(t => t.event === 'مسلّمة للمكتب الرئيسي')?.time || c.date;

                if (!stats[name]) {
                    stats[name] = { count: 0, totalAmount: 0, lastDate: receiptTime, items: [] };
                }

                stats[name].count += 1;
                stats[name].totalAmount += c.amount;
                stats[name].items.push(c);

                // Track latest date
                if (new Date(receiptTime).getTime() > new Date(stats[name].lastDate).getTime()) {
                    stats[name].lastDate = receiptTime;
                }
            }
        });

        return Object.entries(stats).map(([name, data]) => ({
            name,
            ...data,
            items: data.items.sort((a, b) => (a.client || '').localeCompare(b.client || ''))
        })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [checks]);

    const [expandedReceiver, setExpandedReceiver] = useState<string | null>(null);

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
                    <div className="logo-text">تتبع <span>المستندات</span></div>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        fetchChecks();
                    }}
                    disabled={isLoading}
                    className={`refresh-btn-icon ${isLoading ? 'loading' : ''}`}
                    title="تحديث البيانات"
                >
                    <RefreshCcw size={18} />
                </button>
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
                    <button
                        className={`sub-tab ${activeSubTab === 'receivers' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('receivers')}
                    >
                        <span>🏢</span> مستلمي المكتب
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
                                            <input
                                                type="text"
                                                value={toDisplayDate(draft.date)}
                                                onChange={(e) => {
                                                    const masked = applyDateMask(e.target.value, toDisplayDate(draft.date));
                                                    updateDraft(draft.id, 'date', masked);
                                                }}
                                                onBlur={(e) => {
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
                                                onChange={(e) => updateDraft(draft.id, 'date', e.target.value)}
                                                style={{ position: 'absolute', opacity: 0, width: '28px', height: '28px', right: '6px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', zIndex: 3 }}
                                                tabIndex={-1}
                                            />
                                        </div>
                                    </div>
                                    <div className="field no-label">
                                        <div className="date-input-wrapper">
                                            <input
                                                type="text"
                                                value={toDisplayDate(draft.checkDate)}
                                                onChange={(e) => {
                                                    const masked = applyDateMask(e.target.value, toDisplayDate(draft.checkDate));
                                                    updateDraft(draft.id, 'checkDate', masked);
                                                }}
                                                onBlur={(e) => {
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
                                                value={/^\d{4}-\d{2}-\d{2}$/.test(draft.checkDate) ? draft.checkDate : ''}
                                                onChange={(e) => updateDraft(draft.id, 'checkDate', e.target.value)}
                                                style={{ position: 'absolute', opacity: 0, width: '28px', height: '28px', right: '6px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', zIndex: 3 }}
                                                tabIndex={-1}
                                            />
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

                            {selectedIds.length > 0 && (
                                <button className="pdf-icon-btn" onClick={() => setIsPdfModalOpen(true)} title={`إصدار تقرير لـ ${selectedIds.length} شيك`}>
                                    <span className="pdf-badge">{selectedIds.length}</span>
                                    <FileCheck size={24} />
                                </button>
                            )}

                            <button className="filter-btn" onClick={exportData} style={{ marginRight: 'auto', borderColor: 'var(--gold)', color: 'var(--gold-dark)' }}>⬇ تصدير CSV</button>
                        </div>

                        {/* TABLE */}
                        <div className="table-container">
                            <div className="table-header-row">
                                <div className="th">
                                    <input
                                        type="checkbox"
                                        className="row-checkbox"
                                        checked={selectedIds.length === filteredChecks.length && filteredChecks.length > 0}
                                        onChange={toggleSelectAll}
                                    />
                                </div>
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
                                    (() => {
                                        let rowNum = 0;
                                        return groupedChecks.map(([dateKey, group]) => (
                                            <React.Fragment key={dateKey}>
                                                {/* Group Header */}
                                                <div className="group-date-row">
                                                    <span className="group-date-label">📅 {group.label}</span>
                                                    <span className="group-count-badge">{group.checks.length} شيك</span>
                                                </div>
                                                {group.checks.map((c: Check) => {
                                                    rowNum++;
                                                    return (
                                                        <div className={`check-row ${selectedIds.includes(c.id) ? 'selected' : ''}`} key={c.id}>
                                                            <div className="td">
                                                                <input
                                                                    type="checkbox"
                                                                    className="row-checkbox"
                                                                    checked={selectedIds.includes(c.id)}
                                                                    onChange={() => toggleSelect(c.id)}
                                                                />
                                                            </div>
                                                            <div className="td" style={{ color: 'var(--gray-400)', fontWeight: 700 }}>{rowNum}</div>
                                                            <div className="td">{formatDate(c.date)}</div>
                                                            <div className="td">{formatDate(c.checkDate) || '—'}</div>
                                                            <div className="td">
                                                                <button
                                                                    className="check-num-btn"
                                                                    onClick={() => setTrackingCheck(c)}
                                                                >
                                                                    {c.num}
                                                                </button>
                                                            </div>
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
                                                    );
                                                })}
                                            </React.Fragment>
                                        ));
                                    })()
                                )}
                            </div>
                        </div>
                    </>
                )}

                {activeSubTab === 'receivers' && (
                    <div className="receivers-section">
                        <div className="receivers-grid">
                            {receiverStats.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon"><Users size={48} /></div>
                                    <div className="empty-text">لا توجد بيانات مستلمين حالياً</div>
                                    <p className="empty-subtext">تظهر البيانات هنا عندما يتم تسليم الشيكات للمكتب الرئيسي</p>
                                </div>
                            ) : (
                                receiverStats.map((rec) => (
                                    <div className={`receiver-card ${expandedReceiver === rec.name ? 'expanded' : ''}`} key={rec.name}>
                                        <div className="receiver-card-main" onClick={() => setExpandedReceiver(expandedReceiver === rec.name ? null : rec.name)}>
                                            <div className="receiver-card-info">
                                                <div className="receiver-avatar">
                                                    {rec.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="receiver-meta">
                                                    <h3>{rec.name}</h3>
                                                    <p>آخر استلام: {rec.lastDate.split(',')[0]}</p>
                                                </div>
                                            </div>
                                            <div className="receiver-card-stats">
                                                <div className="stat-pill count">
                                                    <FileCheck size={14} />
                                                    <span>{rec.count} شيك</span>
                                                </div>
                                                <div className="stat-pill amount">
                                                    <span>{rec.totalAmount.toLocaleString('ar-AE')} د.إ</span>
                                                </div>
                                                <div className="expand-trigger">
                                                    {expandedReceiver === rec.name ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </div>
                                            </div>
                                        </div>

                                        {expandedReceiver === rec.name && (
                                            <div className="receiver-details-expanded">
                                                <div className="details-header-row">
                                                    <span>تاريخ التسليم</span>
                                                    <span>رقم الشيك</span>
                                                    <span>العميل</span>
                                                    <span>المبلغ</span>
                                                </div>
                                                <div className="details-items-list">
                                                    {rec.items.map((item, idx) => (
                                                        <div className="detail-item-row" key={idx} onClick={() => setTrackingCheck(item)}>
                                                            <span className="d-date">{item.timeline.find(t => t.event === 'مسلّمة للمكتب الرئيسي')?.time.split(',')[0] || formatDate(item.date)}</span>
                                                            <span className="d-num gold-text">#{item.num}</span>
                                                            <span className="d-client">{item.client}</span>
                                                            <span className="d-amt">{item.amount.toLocaleString('ar-AE')} د.إ</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
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

            {/* PDF OPTIONS MODAL */}
            {isPdfModalOpen && (
                <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setIsPdfModalOpen(false); }}>
                    <div className="modal pdf-options-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-title">
                            <span>خيارات تقرير الـ PDF</span>
                            <button className="modal-close" onClick={() => setIsPdfModalOpen(false)}>✕</button>
                        </div>

                        <div className="pdf-options-content" style={{ padding: '20px 0' }}>
                            <div className="option-group" style={{ marginBottom: '25px' }}>
                                <label className="group-label" style={{ display: 'block', fontWeight: 700, color: 'var(--gray-400)', marginBottom: '12px' }}>نوع العملية:</label>
                                <div className="pdf-type-selector" style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        className={`type-btn ${pdfType === 'received' ? 'active' : ''}`}
                                        style={{
                                            flex: 1, padding: '15px', borderRadius: '12px', border: '2px solid #e2e8f0',
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
                                        className={`type-btn ${pdfType === 'delivered' ? 'active' : ''}`}
                                        style={{
                                            flex: 1, padding: '15px', borderRadius: '12px', border: '2px solid #e2e8f0',
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

                            <div className="field">
                                <label style={{ marginBottom: '8px', display: 'block', fontWeight: 700 }}>{pdfType === 'received' ? 'مستلم من من؟' : 'مسلم إلى من؟'}</label>
                                <input
                                    type="text"
                                    value={pdfPersonName}
                                    onChange={(e) => setPdfPersonName(e.target.value)}
                                    placeholder="اكتب الاسم هنا..."
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '15px', color: 'black' }}
                                    autoFocus
                                />
                            </div>

                            <button
                                className="pdf-final-generate-btn"
                                onClick={generateHandoverReceipt}
                                disabled={!pdfPersonName.trim()}
                                style={{
                                    width: '100%', marginTop: '25px', padding: '15px', background: '#4f46e5',
                                    color: 'white', borderRadius: '12px', border: 'none', fontWeight: 800, fontSize: '16px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                    opacity: pdfPersonName.trim() ? 1 : 0.6, cursor: pdfPersonName.trim() ? 'pointer' : 'not-allowed'
                                }}
                            >
                                <FileCheck size={20} />
                                إصدار التقرير الآن
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* PROFESSIONAL TRACKING MODAL */}
            {trackingCheck && (
                <div className="modal-overlay open tracking-overlay" onClick={() => setTrackingCheck(null)}>
                    <div className="modal tracking-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="tracking-header">
                            <div className="tracking-header-content">
                                <div className="tracking-id-badge">DOCUMENT TRACKING</div>
                                <h2 className="tracking-title">تتبع الشيك <span className="gold-text">#{trackingCheck.num}</span></h2>
                                <p className="tracking-subtitle">{trackingCheck.client}</p>
                            </div>
                            <button className="tracking-close" onClick={() => setTrackingCheck(null)}>✕</button>
                        </div>

                        <div className="tracking-body">
                            <div className="tracking-summary-grid">
                                <div className="summary-item">
                                    <span className="summary-label">المبلغ الإجمالي</span>
                                    <span className="summary-value gold">{trackingCheck.amount.toLocaleString('ar-AE')} د.إ</span>
                                </div>
                                <div className="summary-item border-x">
                                    <span className="summary-label">تاريخ الاستلام</span>
                                    <span className="summary-value">{formatDate(trackingCheck.date)}</span>
                                </div>
                                <div className="summary-item">
                                    <span className="summary-label">تاريخ الشيك</span>
                                    <span className="summary-value">{formatDate(trackingCheck.checkDate)}</span>
                                </div>
                            </div>

                            <div className="tracking-timeline-container">
                                <h3 className="timeline-section-title">محطات الشيك</h3>
                                <div className="modern-timeline">
                                    {/* Received Step */}
                                    <div className={`timeline-step ${['received', 'registered', 'delivered'].includes(trackingCheck.status) ? 'active' : ''}`}>
                                        <div className="step-marker">
                                            <div className="step-icon"><Plus size={16} /></div>
                                        </div>
                                        <div className="step-info">
                                            <div className="step-label">تم استلام الشيك</div>
                                            <div className="step-detail">
                                                {trackingCheck.timeline.find(t => t.event === 'تم الاستلام')?.time || formatDate(trackingCheck.date)}
                                                <span className="step-sub-detail"> {trackingCheck.bank ? ` - من ${trackingCheck.bank}` : ''}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Registered Step */}
                                    <div className={`timeline-step ${['registered', 'delivered'].includes(trackingCheck.status) ? 'active' : ''} ${trackingCheck.status === 'received' ? 'pending' : ''}`}>
                                        <div className="step-marker">
                                            <div className="step-icon"><Calendar size={16} /></div>
                                        </div>
                                        <div className="step-info">
                                            <div className="step-label">مسجل في النظام المحاسبي</div>
                                            <div className="step-detail">
                                                {trackingCheck.timeline.find(t => t.event === 'مسجلة في السيستم')?.time || (trackingCheck.status === 'received' ? 'بانتظار التسجيل' : '')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Delivered Step */}
                                    <div className={`timeline-step ${trackingCheck.status === 'delivered' ? 'active final' : ''} ${['received', 'registered'].includes(trackingCheck.status) ? 'pending' : ''}`}>
                                        <div className="step-marker">
                                            <div className="step-icon">
                                                {trackingCheck.status === 'delivered' ? <FileCheck size={16} /> : <div className="pulse-dot"></div>}
                                            </div>
                                        </div>
                                        <div className="step-info">
                                            <div className="step-label">تم التسليم للمكتب الرئيسي</div>
                                            <div className="step-detail">
                                                {trackingCheck.timeline.find(t => t.event === 'مسلّمة للمكتب الرئيسي')?.time || (trackingCheck.status !== 'delivered' ? 'بانتظار التسليم النهائي' : '')}
                                                {trackingCheck.status === 'delivered' && trackingCheck.receiverName && (
                                                    <div className="receiver-info-pills">
                                                        <span className="info-pill">برفقة: {trackingCheck.receiverName}</span>
                                                        <span className="info-pill">للمستلم: {trackingCheck.finalReceiverName}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {trackingCheck.notes && (
                                <div className="tracking-notes-section">
                                    <h3 className="section-title">ملاحظات إضافية</h3>
                                    <div className="notes-box">
                                        {trackingCheck.notes}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="tracking-footer">
                            <button className="tracking-done-btn" onClick={() => setTrackingCheck(null)}>إغلاق النافذة</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
