'use client';

import React, { useState, useMemo } from 'react';
import { Users, FileSpreadsheet, FileCheck, ChevronUp, ChevronDown } from 'lucide-react';
import { Check } from './types';

interface ReceiversTabProps {
    checks: Check[];
    onExportExcelTrigger: (receiver: any) => void;
    onTrackingModal: (check: Check) => void;
}

export default function ReceiversTab({
    checks,
    onExportExcelTrigger,
    onTrackingModal
}: ReceiversTabProps) {
    const [expandedReceiver, setExpandedReceiver] = useState<string | null>(null);
    const [expandedDate, setExpandedDate] = useState<string | null>(null);

    const receiverStats = useMemo(() => {
        const stats: Record<
            string,
            {
                count: number;
                totalAmount: number;
                lastDate: string;
                items: Check[];
                datesMap: Record<
                    string,
                    { count: number; totalAmount: number; items: Check[]; rawTimestamp: number }
                >;
            }
        > = {};

        checks.forEach(c => {
            if (c.status === 'delivered' && c.finalReceiverName) {
                const name = c.finalReceiverName.trim();
                const receiptTime =
                    c.timeline?.find(t => t.event === 'مسلّمة للمكتب الرئيسي')?.time || c.date;

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

                const receiptDateStr = getCleanDate(receiptTime);
                const timestamp =
                    new Date(receiptTime).getTime() || new Date(c.date).getTime() || 0;

                if (!stats[name]) {
                    stats[name] = {
                        count: 0,
                        totalAmount: 0,
                        lastDate: receiptTime,
                        items: [],
                        datesMap: {}
                    };
                }

                stats[name].count += 1;
                stats[name].totalAmount += c.amount;
                stats[name].items.push(c);

                if (!stats[name].datesMap[receiptDateStr]) {
                    stats[name].datesMap[receiptDateStr] = {
                        count: 0,
                        totalAmount: 0,
                        items: [],
                        rawTimestamp: timestamp
                    };
                }

                stats[name].datesMap[receiptDateStr].count += 1;
                stats[name].datesMap[receiptDateStr].totalAmount += c.amount;
                stats[name].datesMap[receiptDateStr].items.push(c);

                if (timestamp > new Date(stats[name].lastDate).getTime()) {
                    stats[name].lastDate = receiptTime;
                }
            }
        });

        return Object.entries(stats)
            .map(([name, data]) => {
                const datesArray = Object.entries(data.datesMap)
                    .map(([dateStr, dVal]) => ({
                        date: dateStr,
                        count: dVal.count,
                        totalAmount: dVal.totalAmount,
                        rawTimestamp: dVal.rawTimestamp,
                        items: dVal.items.sort((a, b) => (a.client || '').localeCompare(b.client || ''))
                    }))
                    .sort((a, b) => b.rawTimestamp - a.rawTimestamp);

                return {
                    name,
                    count: data.count,
                    totalAmount: data.totalAmount,
                    lastDate: data.lastDate,
                    dates: datesArray,
                    items: data.items.sort((a, b) => (a.client || '').localeCompare(b.client || ''))
                };
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [checks]);

    return (
        <div className="receivers-section">
            <div className="receivers-grid">
                {receiverStats.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <Users size={48} />
                        </div>
                        <div className="empty-text">لا توجد بيانات مستلمين حالياً</div>
                        <p className="empty-subtext">
                            تظهر البيانات هنا عندما يتم تسليم الشيكات للمكتب الرئيسي
                        </p>
                    </div>
                ) : (
                    receiverStats.map(rec => (
                        <div
                            className={`receiver-card ${expandedReceiver === rec.name ? 'expanded' : ''}`}
                            key={rec.name}
                        >
                            <div
                                className="receiver-card-main"
                                onClick={() => {
                                    setExpandedReceiver(expandedReceiver === rec.name ? null : rec.name);
                                    setExpandedDate(null);
                                }}
                            >
                                <div className="receiver-card-info">
                                    <div className="receiver-avatar">
                                        {rec.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="receiver-meta">
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                marginBottom: '4px'
                                            }}
                                        >
                                            <h3 style={{ margin: 0 }}>{rec.name}</h3>
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    onExportExcelTrigger(rec);
                                                }}
                                                className="flex items-center justify-center h-7 w-7 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-600 hover:text-white transition-colors"
                                                title="تصدير شيكات المستلم إلى إكسيل"
                                            >
                                                <FileSpreadsheet size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="receiver-card-stats">
                                    <div className="stat-pill count">
                                        <FileCheck size={14} />
                                        <span>{rec.count} شيك</span>
                                    </div>
                                    <div className="stat-pill amount">
                                        <span>
                                            {rec.totalAmount?.toLocaleString('en-US', { minimumFractionDigits: 2 })} د.إ
                                        </span>
                                    </div>
                                    <div className="expand-trigger">
                                        {expandedReceiver === rec.name ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </div>
                            </div>

                            {expandedReceiver === rec.name && (
                                <div
                                    className="receiver-details-expanded"
                                    style={{ padding: '0', background: 'transparent' }}
                                >
                                    {rec.dates.map((dateGroup, dIdx) => {
                                        const isDateExpanded = expandedDate === `${rec.name}-${dateGroup.date}`;
                                        return (
                                            <div
                                                key={dIdx}
                                                className="date-group-block"
                                                style={{
                                                    background: '#f8fafc',
                                                    borderRadius: '12px',
                                                    padding: '0',
                                                    marginBottom: '12px',
                                                    border: '1px solid #e2e8f0',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                <div
                                                    className="date-group-header"
                                                    onClick={() =>
                                                        setExpandedDate(
                                                            isDateExpanded ? null : `${rec.name}-${dateGroup.date}`
                                                        )
                                                    }
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '12px 16px',
                                                        cursor: 'pointer',
                                                        background: isDateExpanded ? '#eff6ff' : 'transparent',
                                                        transition: 'background 0.2s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {isDateExpanded ? (
                                                            <ChevronUp size={16} className="text-blue-600" />
                                                        ) : (
                                                            <ChevronDown size={16} className="text-slate-400" />
                                                        )}
                                                        <span style={{ fontWeight: 800, color: '#1e293b' }}>
                                                            📅 {dateGroup.date}
                                                        </span>
                                                    </div>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            gap: '16px',
                                                            fontSize: '13px',
                                                            fontWeight: 700,
                                                            color: '#64748b'
                                                        }}
                                                    >
                                                        <span style={{ width: '60px', textAlign: 'left' }}>{dateGroup.count} شيك</span>
                                                        <span style={{ color: 'var(--gold-dark)', width: '130px', textAlign: 'left' }}>
                                                            {dateGroup.totalAmount?.toLocaleString('en-US', { minimumFractionDigits: 2 })} د.إ
                                                        </span>
                                                    </div>
                                                </div>

                                                {isDateExpanded && (
                                                    <div
                                                        className="date-group-content"
                                                        style={{ padding: '0 16px 16px' }}
                                                    >
                                                        <div
                                                            className="details-header-row"
                                                            style={{
                                                                background: 'transparent',
                                                                padding: '8px 12px',
                                                                border: 'none',
                                                                display: 'flex',
                                                                borderBottom: '1px solid #f1f5f9',
                                                                marginBottom: '8px'
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    width: '25%',
                                                                    textAlign: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '11px',
                                                                    fontWeight: 700,
                                                                    color: '#94a3b8'
                                                                }}
                                                            >
                                                                رقم الشيك
                                                            </span>
                                                            <span
                                                                style={{
                                                                    width: '50%',
                                                                    textAlign: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '11px',
                                                                    fontWeight: 700,
                                                                    color: '#94a3b8'
                                                                }}
                                                            >
                                                                العميل
                                                            </span>
                                                            <span
                                                                style={{
                                                                    width: '25%',
                                                                    textAlign: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '11px',
                                                                    fontWeight: 700,
                                                                    color: '#94a3b8'
                                                                }}
                                                            >
                                                                المبلغ
                                                            </span>
                                                        </div>
                                                        <div className="details-items-list">
                                                            {dateGroup.items.map((item, idx) => (
                                                                <div
                                                                    className="detail-item-row"
                                                                    key={idx}
                                                                    onClick={() => onTrackingModal(item)}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        marginBottom: '4px',
                                                                        borderRadius: '8px',
                                                                        border: '1px solid #f1f5f9',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    <span
                                                                        className="d-num gold-text"
                                                                        style={{
                                                                            width: '25%',
                                                                            textAlign: 'center',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                    >
                                                                        #{item.num}
                                                                    </span>
                                                                    <span
                                                                        className="d-client"
                                                                        style={{
                                                                            width: '50%',
                                                                            textAlign: 'center',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                    >
                                                                        {item.client}
                                                                    </span>
                                                                    <span
                                                                        className="d-amt"
                                                                        style={{
                                                                            width: '25%',
                                                                            textAlign: 'center',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                    >
                                                                        {item.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })} د.إ
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
