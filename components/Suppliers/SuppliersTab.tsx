'use client';

import { useState, useMemo } from 'react';
import { SupplierTransaction, SupplierSummary } from './types';
import StatementsTab from './StatementsTab';
import MatchingTab from './MatchingTab';

interface SuppliersTabProps {
    data: SupplierTransaction[];
    activeTab: 'statements' | 'matching';
}

export default function SuppliersTab({ data, activeTab }: SuppliersTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');

    const processedData = useMemo(() => {
        let filteredTx = data;

        if (filterYear) {
            const y = filterYear.trim();
            if (y.length >= 2) {
                filteredTx = filteredTx.filter(tx => {
                    const d = new Date(tx.date);
                    if (isNaN(d.getTime())) return false;
                    const yearStr = d.getFullYear().toString();
                    return yearStr.includes(y) || yearStr.slice(-2) === y;
                });
            }
        }

        if (filterMonth) {
            const m = parseInt(filterMonth.trim());
            if (!isNaN(m) && m >= 1 && m <= 12) {
                filteredTx = filteredTx.filter(tx => {
                    const d = new Date(tx.date);
                    if (isNaN(d.getTime())) return false;
                    return (d.getMonth() + 1) === m;
                });
            }
        }

        const map = new Map<string, SupplierSummary>();
        filteredTx.forEach(tx => {
            const name = tx.supplierName;
            if (!map.has(name)) {
                map.set(name, {
                    supplierName: name,
                    totalPurchase: 0,
                    totalRefund: 0,
                    netAmount: 0,
                    transactions: []
                });
            }
            const summary = map.get(name)!;
            summary.transactions.push(tx);
            if (tx.type === 'Purchase') {
                summary.totalPurchase += tx.amount;
            } else {
                summary.totalRefund += tx.amount;
            }
            summary.netAmount = summary.totalPurchase - summary.totalRefund;
        });

        let summaries = Array.from(map.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName));

        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            summaries = summaries.filter(s => s.supplierName.toLowerCase().includes(lower));
        }

        return summaries;
    }, [data, filterYear, filterMonth, searchQuery]);

    return (
        <div className="p-6">
            {activeTab === 'statements' ? (
                <StatementsTab
                    processedData={processedData}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    filterYear={filterYear}
                    setFilterYear={setFilterYear}
                    filterMonth={filterMonth}
                    setFilterMonth={setFilterMonth}
                />
            ) : (
                <MatchingTab data={data} />
            )}
        </div>
    );
}
