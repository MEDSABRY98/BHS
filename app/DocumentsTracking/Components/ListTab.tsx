'use client';

import React, { useState, useMemo } from 'react';
import { Save, FileText, FileSpreadsheet, MoreVertical } from 'lucide-react';
import { Check, STATUS_LABELS, formatDate, toDisplayDate } from './types';

interface ListTabProps {
    checks: Check[];
    selectedIds: string[];
    setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
    onActionModal: (check: Check) => void;
    onTrackingModal: (check: Check) => void;
    onBulkRegister: () => Promise<void>;
    onBulkDeliverTrigger: () => void;
    onPdfOptionsTrigger: () => void;
    onExcelExport: () => void;
    isLoading: boolean;
}

export default function ListTab({
    checks,
    selectedIds,
    setSelectedIds,
    onActionModal,
    onTrackingModal,
    onBulkRegister,
    onBulkDeliverTrigger,
    onPdfOptionsTrigger,
    onExcelExport,
    isLoading
}: ListTabProps) {
    const [currentFilter, setCurrentFilter] = useState<'all' | 'received' | 'registered' | 'delivered'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredChecks = useMemo(() => {
        return checks.filter(c => {
            const matchesStatus = currentFilter === 'all' || c.status === currentFilter;
            const term = searchQuery.toLowerCase();
            const matchesSearch =
                c.num.toLowerCase().includes(term) ||
                c.client.toLowerCase().includes(term) ||
                c.bank.toLowerCase().includes(term) ||
                (c.notes || '').toLowerCase().includes(term) ||
                (c.receiverName || '').toLowerCase().includes(term) ||
                (c.finalReceiverName || '').toLowerCase().includes(term);
            return matchesStatus && matchesSearch;
        });
    }, [checks, currentFilter, searchQuery]);

    // Group by registration date (c.date), newest group first
    // Within each group, sort by checkDate newest first
    const groupedChecks = useMemo(() => {
        const getDateKey = (c: Check): string => {
            const rawDate = c.date || '';
            if (!rawDate) return 'غير محدد';

            // Try ISO format (yyyy-mm-dd)
            if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
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

        return Array.from(map.entries()).sort(([a], [b]) => {
            const ta = new Date(a).getTime();
            const tb = new Date(b).getTime();
            if (isNaN(ta) || isNaN(tb)) return b.localeCompare(a);
            return tb - ta;
        });
    }, [filteredChecks]);

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredChecks.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredChecks.map(c => c.id));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(x => x !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const renderProgress = (status: string) => {
        const steps: ('received' | 'registered' | 'delivered')[] = ['received', 'registered', 'delivered'];
        const cur = steps.indexOf(status as any);
        return (
            <div className="progress-track">
                {steps.map((s, i) => (
                    <React.Fragment key={s}>
                        {i > 0 && <div className={`step-line ${i <= cur ? 'done' : ''}`}></div>}
                        <div
                            className={`step ${i < cur ? 'done' : i === cur ? 'current' : ''}`}
                            title={STATUS_LABELS[s]}
                        >
                            {i + 1}
                        </div>
                    </React.Fragment>
                ))}
            </div>
        );
    };

    const hasReceivedSelected = useMemo(() => {
        return checks.some(c => selectedIds.includes(c.id) && c.status === 'received');
    }, [checks, selectedIds]);

    const hasRegisteredSelected = useMemo(() => {
        return checks.some(c => selectedIds.includes(c.id) && c.status === 'registered');
    }, [checks, selectedIds]);

    const receivedSelectedCount = useMemo(() => {
        return selectedIds.filter(id => checks.find(c => c.id === id && c.status === 'received')).length;
    }, [checks, selectedIds]);

    const registeredSelectedCount = useMemo(() => {
        return selectedIds.filter(id => checks.find(c => c.id === id && c.status === 'registered')).length;
    }, [checks, selectedIds]);

    return (
        <>
            {/* FILTERS */}
            <div className="filters">
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-400)' }}>عرض:</span>
                <button
                    className={`filter-btn ${currentFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('all')}
                >
                    الكل
                </button>
                <button
                    className={`filter-btn ${currentFilter === 'received' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('received')}
                >
                    مستلمة
                </button>
                <button
                    className={`filter-btn ${currentFilter === 'registered' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('registered')}
                >
                    مسجلة
                </button>
                <button
                    className={`filter-btn ${currentFilter === 'delivered' ? 'gold-active' : ''}`}
                    onClick={() => setCurrentFilter('delivered')}
                >
                    مسلّمة للمكتب
                </button>
                <input
                    type="text"
                    className="search-box"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="🔍 بحث باسم العميل أو رقم الشيك..."
                />

                {selectedIds.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {hasReceivedSelected && (
                            <button
                                className="filter-btn active"
                                onClick={onBulkRegister}
                                disabled={isLoading}
                                style={{
                                    background: '#3b82f6',
                                    borderColor: '#3b82f6',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Save size={14} /> تسجيل {receivedSelectedCount} شيك في السيستم
                            </button>
                        )}
                        {hasRegisteredSelected && (
                            <button
                                className="filter-btn active"
                                onClick={onBulkDeliverTrigger}
                                disabled={isLoading}
                                style={{
                                    background: 'var(--gold)',
                                    borderColor: 'var(--gold)',
                                    color: 'black',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                🚀 تسليم {registeredSelectedCount} شيك للمكتب
                            </button>
                        )}
                        <button
                            onClick={onPdfOptionsTrigger}
                            disabled={isLoading}
                            className="flex items-center justify-center h-10 w-10 bg-rose-600 text-white rounded-xl shadow-sm hover:bg-rose-700 transition-colors relative"
                            title={`إصدار تقرير PDF لـ ${selectedIds.length} شيك`}
                        >
                            <span
                                className="pdf-badge"
                                style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    right: '-8px',
                                    background: 'var(--gold)',
                                    color: 'black',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    fontSize: '11px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 900,
                                    border: '2px solid white',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                            >
                                {selectedIds.length}
                            </span>
                            <FileText className="h-5 w-5" />
                        </button>
                    </div>
                )}

                <button
                    onClick={onExcelExport}
                    disabled={isLoading}
                    className="flex items-center justify-center h-10 w-10 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors"
                    style={{ marginRight: 'auto' }}
                    title="تصدير Excel"
                >
                    <FileSpreadsheet className="h-5 w-5" />
                </button>
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
                                            <div
                                                className={`check-row ${selectedIds.includes(c.id) ? 'selected' : ''}`}
                                                key={c.id}
                                            >
                                                <div className="td">
                                                    <input
                                                        type="checkbox"
                                                        className="row-checkbox"
                                                        checked={selectedIds.includes(c.id)}
                                                        onChange={() => toggleSelect(c.id)}
                                                    />
                                                </div>
                                                <div
                                                    className="td"
                                                    style={{ color: 'var(--gray-400)', fontWeight: 700 }}
                                                >
                                                    {rowNum}
                                                </div>
                                                <div className="td">{formatDate(c.date)}</div>
                                                <div className="td">{formatDate(c.checkDate) || '—'}</div>
                                                <div className="td">
                                                    <button
                                                        className="check-num-btn"
                                                        onClick={() => onTrackingModal(c)}
                                                    >
                                                        {c.num}
                                                    </button>
                                                </div>
                                                <div className="td">{c.client}</div>
                                                <div className="td check-amount">
                                                    {c.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })} د.إ
                                                </div>
                                                <div className="td">{c.bank || '—'}</div>
                                                <div className="td">{renderProgress(c.status)}</div>
                                                <div className="td">
                                                    <button
                                                        className="btn-menu"
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            onActionModal(c);
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
    );
}
