'use client';

import React, { useState, useMemo } from 'react';
import { Users, FileSpreadsheet, FileCheck, ArrowLeft, Calendar, ChevronRight } from 'lucide-react';
import { Check } from './types';

export type ReceiverDateGroup = {
    date: string;
    count: number;
    totalAmount: number;
    rawTimestamp: number;
    items: Check[];
};

export type ReceiverStat = {
    name: string;
    count: number;
    totalAmount: number;
    lastDate: string;
    dates: ReceiverDateGroup[];
    items: Check[];
};

interface ReceiversTabProps {
    checks: Check[];
    onExportExcelTrigger: (receiver: ReceiverStat) => void;
    onExportDateExcel: (receiverName: string, dateLabel: string, items: Check[]) => void;
}

function getCleanDate(str: string): string {
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
}

function formatAmount(amount: number): string {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

export default function ReceiversTab({
    checks,
    onExportExcelTrigger,
    onExportDateExcel,
}: ReceiversTabProps) {
    const [selectedReceiver, setSelectedReceiver] = useState<ReceiverStat | null>(null);

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
                const receiptDateStr = getCleanDate(receiptTime);
                const timestamp =
                    new Date(receiptTime).getTime() || new Date(c.date).getTime() || 0;

                if (!stats[name]) {
                    stats[name] = {
                        count: 0,
                        totalAmount: 0,
                        lastDate: receiptTime,
                        items: [],
                        datesMap: {},
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
                        rawTimestamp: timestamp,
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
                        items: dVal.items.sort((a, b) => (a.client || '').localeCompare(b.client || '')),
                    }))
                    .sort((a, b) => b.rawTimestamp - a.rawTimestamp);

                return {
                    name,
                    count: data.count,
                    totalAmount: data.totalAmount,
                    lastDate: data.lastDate,
                    dates: datesArray,
                    items: data.items.sort((a, b) => (a.client || '').localeCompare(b.client || '')),
                };
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [checks]);

    if (receiverStats.length === 0) {
        return (
            <div className="receivers-section">
                <div className="empty-state">
                    <div className="empty-icon">
                        <Users size={48} />
                    </div>
                    <div className="empty-text">لا توجد بيانات مستلمين حالياً</div>
                    <p className="empty-subtext">
                        تظهر البيانات هنا عندما يتم تسليم الشيكات للمكتب الرئيسي
                    </p>
                </div>
            </div>
        );
    }

    if (selectedReceiver) {
        return (
            <div className="receivers-section">
                <div className="receiver-detail-view">
                    <div className="receiver-detail-header">
                        <button
                            type="button"
                            className="receiver-back-btn"
                            onClick={() => setSelectedReceiver(null)}
                        >
                            <ArrowLeft size={20} />
                        </button>

                        <div className="receiver-detail-title">
                            <div className="receiver-avatar receiver-avatar-lg">
                                {selectedReceiver.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2>{selectedReceiver.name}</h2>
                                <p>
                                    {selectedReceiver.count} شيك · {formatAmount(selectedReceiver.totalAmount)} د.إ
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="receiver-excel-btn"
                            onClick={() => onExportExcelTrigger(selectedReceiver)}
                            title="تصدير كل شيكات المستلم"
                        >
                            <FileSpreadsheet size={18} />
                        </button>
                    </div>

                    <div className="receiver-dates-grid">
                        {selectedReceiver.dates.map(dateGroup => (
                            <div key={dateGroup.date} className="receiver-date-card">
                                <div className="receiver-date-card-top">
                                    <div className="receiver-date-icon">
                                        <Calendar size={18} />
                                    </div>
                                    <button
                                        type="button"
                                        className="receiver-excel-btn receiver-excel-btn-sm"
                                        onClick={() =>
                                            onExportDateExcel(
                                                selectedReceiver.name,
                                                dateGroup.date,
                                                dateGroup.items
                                            )
                                        }
                                        title={`تصدير شيكات ${dateGroup.date}`}
                                    >
                                        <FileSpreadsheet size={16} />
                                    </button>
                                </div>

                                <h3 className="receiver-date-label">{dateGroup.date}</h3>

                                <div className="receiver-date-stats">
                                    <div className="stat-pill count">
                                        <FileCheck size={14} />
                                        <span>{dateGroup.count} شيك</span>
                                    </div>
                                    <div className="stat-pill amount">
                                        <span>{formatAmount(dateGroup.totalAmount)} د.إ</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="receivers-section">
            <div className="receivers-grid">
                {receiverStats.map(rec => (
                    <button
                        type="button"
                        key={rec.name}
                        className="receiver-card receiver-card-clickable"
                        onClick={() => setSelectedReceiver(rec)}
                    >
                        <div className="receiver-card-body">
                            <div className="receiver-card-info">
                                <div className="receiver-avatar">
                                    {rec.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="receiver-meta">
                                    <h3>{rec.name}</h3>
                                    <p>{rec.dates.length} يوم تسليم</p>
                                </div>
                            </div>

                            <div className="receiver-card-metrics">
                                <div className="receiver-metric">
                                    <FileCheck size={15} className="receiver-metric-icon" />
                                    <span className="receiver-metric-value">{rec.count}</span>
                                    <span className="receiver-metric-label">شيك</span>
                                </div>
                                <div className="receiver-metric-divider" />
                                <div className="receiver-metric receiver-metric-amount">
                                    <span className="receiver-metric-value">{formatAmount(rec.totalAmount)}</span>
                                    <span className="receiver-metric-label">د.إ</span>
                                </div>
                            </div>

                            <div className="receiver-card-footer">
                                <ChevronRight size={20} className="receiver-card-arrow" />
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
