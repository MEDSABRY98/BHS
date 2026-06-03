'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, RefreshCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { toast } from '@/components/01-Unified/Notification';
import './DocumentsTrackingTab.css';

import {
    Check,
    STATUS_LABELS,
    STATUS_NEXT,
    formatDate,
    normalizeDate,
    toDisplayDate,
    genDocId
} from './types';

// Tab imports
import RegisterTab from './RegisterTab';
import ListTab from './ListTab';
import ReceiversTab from './ReceiversTab';

// Modal imports
import DetailsModal from './modals/DetailsModal';
import ActionsModal from './modals/ActionsModal';
import DeleteConfirmModal from './modals/DeleteConfirmModal';
import EditCheckModal from './modals/EditCheckModal';
import PdfOptionsModal from './modals/PdfOptionsModal';
import TrackingModal from './modals/TrackingModal';
import BulkDeliverModal from './modals/BulkDeliverModal';
import ReceiverExcelModal from './modals/ReceiverExcelModal';

export default function DocumentsTrackingTab() {
    const router = useRouter();
    const [checks, setChecks] = useState<Check[]>([]);
    const [currentFilter, setCurrentFilter] = useState<'all' | 'received' | 'registered' | 'delivered'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
    const [headerDate, setHeaderDate] = useState('');
    const [activeSubTab, setActiveSubTab] = useState<'register' | 'list' | 'receivers'>('register');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Tracking and Edit check references
    const [trackingCheck, setTrackingCheck] = useState<Check | null>(null);
    const [activeActionModalCheck, setActiveActionModalCheck] = useState<Check | null>(null);
    const [confirmDeleteCheckId, setConfirmDeleteCheckId] = useState<string | null>(null);
    const [editCheck, setEditCheck] = useState<Check | null>(null);

    // Modal view states
    const [isBulkDeliverModalOpen, setIsBulkDeliverModalOpen] = useState(false);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [exportReceiverModalData, setExportReceiverModalData] = useState<any | null>(null);

    // Global loading state
    const [isLoading, setIsLoading] = useState(false);

    const showNotify = (msg: string, type: 'success' | 'error' = 'success') => {
        if (type === 'success') {
            toast.success(msg);
        } else {
            toast.error(msg);
        }
    };

    const fetchChecks = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/DocumentsTracking');
            const data = await response.json();
            if (data.records) {
                const mappedChecks: Check[] = data.records.map((r: any) => {
                    const timeline = [];
                    if (r.datedReceived) timeline.push({ event: 'تم الاستلام', time: r.datedReceived });
                    if (r.datedRecord) timeline.push({ event: 'مسجلة في السيستم', time: r.datedRecord });
                    if (r.datedSendToOffice) timeline.push({ event: 'مسلّمة للمكتب الرئيسي', time: r.datedSendToOffice });

                    let status: 'received' | 'registered' | 'delivered' = 'received';
                    const s = (r.documentStatus || '').toString().trim();
                    if (s === 'مسلّمة للمكتب الرئيسي') status = 'delivered';
                    else if (s === 'مسجلة في السيستم') status = 'registered';
                    else if (s === 'مستلمة') status = 'received';
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
            showNotify('Error loading data from server', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchChecks();
        setHeaderDate(
            new Date().toLocaleDateString('ar-AE', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        );
    }, []);

    // Main Check Actions
    const saveEdit = async (formData: any) => {
        if (!editCheck || !editCheck.rowIndex) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/DocumentsTracking', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex: editCheck.rowIndex,
                    documentNumber: formData.num,
                    documentName: formData.client,
                    receivedDate: formData.date,
                    documentDate: formData.checkDate,
                    documentAmount: parseFloat(formData.amount || '0'),
                    receivedFrom: formData.bank,
                    documentNotes: formData.notes,
                    whoDeliveryForOffice: formData.receiverName,
                    whoTakeFromOffice: formData.finalReceiverName
                })
            });

            if (response.ok) {
                showNotify('Check updated successfully');
                setEditCheck(null);
                await fetchChecks();
            } else {
                throw new Error('Failed to update');
            }
        } catch (error) {
            console.error('Error updating check:', error);
            showNotify('Failed to update check details', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const deleteCheck = async () => {
        if (!confirmDeleteCheckId) return;
        const check = checks.find(c => c.id === confirmDeleteCheckId);
        if (!check || !check.rowIndex) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/DocumentsTracking', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex: check.rowIndex })
            });

            if (response.ok) {
                showNotify('Check deleted successfully', 'success');
                setConfirmDeleteCheckId(null);
                await fetchChecks();
            }
        } catch (error) {
            console.error('Error deleting check:', error);
            showNotify('Failed to delete check from Google Sheets', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const advanceStatus = async (
        checkId: string,
        currentStatus: string,
        details: { receiverName: string; finalReceiverName: string }
    ) => {
        const currentCheck = checks.find(c => c.id === checkId);
        if (!currentCheck || !currentCheck.rowIndex) return;

        const next = STATUS_NEXT[currentStatus];
        if (!next) return;

        if (next === 'delivered') {
            if (!details.receiverName.trim() || !details.finalReceiverName.trim()) {
                showNotify('Please enter recipient name and final receiver', 'error');
                return;
            }
        }

        setIsLoading(true);
        try {
            const now = new Date().toLocaleString('ar-AE');
            const updateFields: any = {
                documentStatus: STATUS_LABELS[next],
                datedRecord:
                    currentStatus === 'received'
                        ? now
                        : currentCheck.timeline.find(t => t.event === 'مسجلة في السيستم')?.time || '',
                datedSendToOffice: next === 'delivered' ? now : ''
            };

            if (next === 'delivered') {
                updateFields.whoDeliveryForOffice = details.receiverName;
                updateFields.whoTakeFromOffice = details.finalReceiverName;
            }

            const response = await fetch('/api/DocumentsTracking', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex: currentCheck.rowIndex, ...updateFields })
            });

            if (response.ok) {
                showNotify('Status updated successfully');
                await fetchChecks();
                setSelectedCheckId(checkId);
            }
        } catch (error) {
            console.error('Error advancing status:', error);
            showNotify('Failed to update status', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const bulkRegister = async () => {
        const receivedChecks = checks.filter(c => selectedIds.includes(c.id) && c.status === 'received');
        if (receivedChecks.length === 0) {
            showNotify('No "Received" checks to register', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const now = new Date().toLocaleString('ar-AE');
            const updates = receivedChecks.map(c => ({
                rowIndex: c.rowIndex,
                data: {
                    documentStatus: STATUS_LABELS.registered,
                    datedRecord: now
                }
            }));

            const response = await fetch('/api/DocumentsTracking', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bulk: true, updates })
            });

            if (response.ok) {
                showNotify(`Successfully registered ${receivedChecks.length} checks in the system`);
                setSelectedIds([]);
                await fetchChecks();
            }
        } catch (error) {
            console.error('Error bulk registering checks:', error);
            showNotify('Failed to bulk register checks', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const bulkDeliver = async (details: { receiverName: string; finalReceiverName: string }) => {
        const registeredChecks = checks.filter(c => selectedIds.includes(c.id) && c.status === 'registered');
        if (registeredChecks.length === 0) {
            showNotify('No "Registered" checks to deliver', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const now = new Date().toLocaleString('ar-AE');
            const updates = registeredChecks.map(c => ({
                rowIndex: c.rowIndex,
                data: {
                    documentStatus: STATUS_LABELS.delivered,
                    datedSendToOffice: now,
                    whoDeliveryForOffice: details.receiverName,
                    whoTakeFromOffice: details.finalReceiverName
                }
            }));

            const response = await fetch('/api/DocumentsTracking', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bulk: true, updates })
            });

            if (response.ok) {
                showNotify(`Successfully delivered ${registeredChecks.length} checks`);
                setIsBulkDeliverModalOpen(false);
                setSelectedIds([]);
                await fetchChecks();
            }
        } catch (error) {
            console.error('Error bulk delivering checks:', error);
            showNotify('Failed to bulk deliver checks', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // PDF Handover Receipt
    const generateHandoverReceipt = async (type: 'received' | 'delivered', personName: string) => {
        const selectedCheques = checks.filter(c => selectedIds.includes(c.id));
        if (selectedCheques.length === 0) return;

        setIsLoading(true);
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;
            const today = new Date().toLocaleDateString('en-GB');
            const labelText = type === 'received' ? 'Received From:' : 'Delivered To:';

            // 1. Full Page Gold Border (A4)
            doc.setDrawColor(201, 162, 39); // #c9a227
            doc.setLineWidth(1.5);
            doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

            // 2. Title
            const titleText = type === 'received' ? 'CHEQUE RECEIPT' : 'CHEQUE HANDOVER';
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(0, 0, 0);
            doc.text(titleText, pageWidth / 2, 25, { align: 'center' });

            // 3. Simplified Header
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
            doc.text(personName, (receiverLineStart + receiverLineEnd) / 2, 39, { align: 'center' });

            // 4. Cheque Table (Columns: #, Drawer Name, Cheque Date, Cheque Number, Amount)
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
            showNotify('Report generated successfully');
            setSelectedIds([]);
            setIsPdfModalOpen(false);
        } catch (error) {
            console.error('PDF Generation failed:', error);
            showNotify('Failed to generate PDF report', 'error');
        } finally {
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 500);
        }
    };

    // Excel Export for Receivers
    const exportReceiverToExcel = (fileName: string, items: Check[]) => {
        const headers = ['تاريخ التسليم', 'اسم صاحب الشيك', 'تاريخ الشيك', 'رقم الشيك', 'قيمة الشيك (د.إ)'];
        const rows = items.map(c => {
            const deliveryDate =
                c.timeline.find(t => t.event === 'مسلّمة للمكتب الرئيسي')?.time.split(',')[0] ||
                formatDate(c.date);
            return [deliveryDate, c.client, formatDate(c.checkDate) || '', c.num, c.amount];
        });

        const totalAmount = items.reduce((sum, c) => sum + c.amount, 0);
        rows.push(['الإجمالي', '', '', '', totalAmount as any]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'شيكات المستلم');

        worksheet['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    };

    // Excel Handlers for All Data
    const exportAllToExcel = () => {
        const headers = [
            'اسم العميل',
            'تاريخ الاستلام',
            'تاريخ الشيك',
            'رقم الشيك',
            'المبلغ',
            'مستلم من مين',
            'الملاحظات',
            'الحالة'
        ];
        const rows = checks.map(c => [
            c.client,
            c.date,
            c.checkDate || '',
            `="${c.num}"`, // formula to prevent leading zeros truncation
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

    // Filters and Groupings for List Tab
    const filteredChecks = useMemo(() => {
        return checks.filter(c => {
            const matchFilter = currentFilter === 'all' || c.status === currentFilter;
            const matchSearch =
                !searchQuery ||
                c.num.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.client.toLowerCase().includes(searchQuery.toLowerCase());
            return matchFilter && matchSearch;
        });
    }, [checks, currentFilter, searchQuery]);

    const groupedChecks = useMemo(() => {
        const getDateKey = (c: Check): string => {
            const rawDate = c.date || '';
            if (!rawDate) return 'غير محدد';

            if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                    return d.toISOString().split('T')[0];
                }
            }
            const slash = rawDate.split('/');
            if (slash.length === 3) {
                const [day, month, year] = slash;
                const clean = year.split(',')[0].split('،')[0].trim();
                return `${clean}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            return rawDate.split('،')[0].split(',')[0].trim();
        };

        const formatGroupLabel = (key: string): string => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
                return toDisplayDate(key);
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

        return Array.from(map.entries()).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
    }, [filteredChecks]);

    // Statistics counts
    const totalAmount = useMemo(() => checks.reduce((sum, c) => sum + c.amount, 0), [checks]);
    const receivedCount = useMemo(() => checks.filter(c => c.status === 'received').length, [checks]);
    const registeredCount = useMemo(() => checks.filter(c => c.status === 'registered').length, [checks]);
    const deliveredCount = useMemo(() => checks.filter(c => c.status === 'delivered').length, [checks]);

    // Multi-Select callbacks
    const handleToggleSelectAll = () => {
        if (selectedIds.length === filteredChecks.length && filteredChecks.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredChecks.map(c => c.id));
        }
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    };

    // Details selected check reference
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
            <link
                href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap"
                rel="stylesheet"
            />

            <header className="header">
                <div className="logo cursor-pointer" onClick={() => router.push('/')} title="العودة للرئيسية">
                    <div className="logo-icon">
                        <ArrowRight className="w-6 h-6" />
                    </div>
                    <div className="logo-text">
                        تتبع <span>المستندات</span>
                    </div>
                </div>
                <button
                    onClick={e => {
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
                    <span className="stat-value gold">
                        {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} د.إ
                    </span>
                </div>
            </div>

            <div className={`main ${activeSubTab === 'register' ? 'wide' : ''}`}>
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
                    <RegisterTab
                        onSaveSuccess={fetchChecks}
                        isLoading={isLoading}
                        setIsLoading={setIsLoading}
                        showNotify={showNotify}
                    />
                )}

                {activeSubTab === 'list' && (
                    <ListTab
                        checks={checks}
                        selectedIds={selectedIds}
                        setSelectedIds={setSelectedIds}
                        onActionModal={setActiveActionModalCheck}
                        onTrackingModal={setTrackingCheck}
                        onBulkRegister={bulkRegister}
                        onBulkDeliverTrigger={() => setIsBulkDeliverModalOpen(true)}
                        onPdfOptionsTrigger={() => setIsPdfModalOpen(true)}
                        onExcelExport={exportAllToExcel}
                        isLoading={isLoading}
                    />
                )}

                {activeSubTab === 'receivers' && (
                    <ReceiversTab
                        checks={checks}
                        onExportExcelTrigger={setExportReceiverModalData}
                        onTrackingModal={setTrackingCheck}
                    />
                )}
            </div>

            {/* MODALS RENDERING */}
            <DetailsModal
                isOpen={!!selectedCheck}
                onClose={() => setSelectedCheckId(null)}
                check={selectedCheck || null}
                onAdvanceStatus={advanceStatus}
                isAdvancing={isLoading}
            />

            <ActionsModal
                isOpen={!!activeActionModalCheck}
                onClose={() => setActiveActionModalCheck(null)}
                check={activeActionModalCheck}
                onViewDetails={setSelectedCheckId}
                onEdit={setEditCheck}
                onDelete={setConfirmDeleteCheckId}
            />

            <DeleteConfirmModal
                isOpen={!!confirmDeleteCheckId}
                onClose={() => setConfirmDeleteCheckId(null)}
                onConfirm={deleteCheck}
                isLoading={isLoading}
            />

            <EditCheckModal
                isOpen={!!editCheck}
                onClose={() => setEditCheck(null)}
                check={editCheck}
                onSave={saveEdit}
                isLoading={isLoading}
            />

            <PdfOptionsModal
                isOpen={isPdfModalOpen}
                onClose={() => setIsPdfModalOpen(false)}
                onGenerate={generateHandoverReceipt}
            />

            <TrackingModal
                isOpen={!!trackingCheck}
                onClose={() => setTrackingCheck(null)}
                check={trackingCheck}
            />

            <BulkDeliverModal
                isOpen={isBulkDeliverModalOpen}
                onClose={() => setIsBulkDeliverModalOpen(false)}
                selectedIds={selectedIds}
                checks={checks}
                onConfirm={async (whoDelivery, whoTake) => {
                    await bulkDeliver({ receiverName: whoDelivery, finalReceiverName: whoTake });
                }}
                isLoading={isLoading}
            />

            <ReceiverExcelModal
                isOpen={!!exportReceiverModalData}
                onClose={() => setExportReceiverModalData(null)}
                receiverName={exportReceiverModalData ? exportReceiverModalData.name : ''}
                onExport={(type, selectedDate) => {
                    if (!exportReceiverModalData) return;
                    const name = exportReceiverModalData.name;
                    let filteredItems = exportReceiverModalData.items;
                    if (type === 'custom' && selectedDate) {
                        const formattedSelectedDate = toDisplayDate(selectedDate);
                        filteredItems = exportReceiverModalData.items.filter((c: Check) => {
                            const receiptTime = c.timeline?.find(t => t.event === 'مسلّمة للمكتب الرئيسي')?.time || c.date;

                            const getCleanDate = (str: string) => {
                                if (!str) return '—';
                                let part = str.replace('،', ',').split(',')[0].trim();
                                if (part.includes(' ')) {
                                    part = part.split(' ')[0].trim();
                                }
                                const arDigits = '٠١٢٣٤٥٦٧٨٩';
                                let clean = part
                                    .split('')
                                    .map(char => {
                                        const idx = arDigits.indexOf(char);
                                        return idx !== -1 ? idx.toString() : char;
                                    })
                                    .join('');
                                clean = clean.replace(/[^\d/\-.]/g, '');
                                const parts = clean.split(/[/.\-]/).filter(p => p.length > 0);
                                if (parts.length === 3) {
                                    let d, m, y;
                                    if (parts[0].length === 4) {
                                        [y, m, d] = parts;
                                    } else if (parts[2].length === 4) {
                                        [d, m, y] = parts;
                                    } else {
                                        return clean;
                                    }
                                    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
                                }
                                return clean || '—';
                            };
                            return getCleanDate(receiptTime) === formattedSelectedDate;
                        });
                    }
                    exportReceiverToExcel(name, filteredItems);
                    setExportReceiverModalData(null);
                }}
            />
        </div>
    );
}
