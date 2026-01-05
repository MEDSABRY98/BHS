'use client';
import { useState } from 'react';
import YearsTab from './YearsTab';
import MonthsTab from './MonthsTab';
import { InvoiceRow } from '@/types';

interface HistoryTabProps {
    data: InvoiceRow[];
}

export default function HistoryTab({ data }: HistoryTabProps) {
    const [activeSubTab, setActiveSubTab] = useState<'years' | 'months'>('years');

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-center mt-4">
                <div className="bg-slate-100 p-1 rounded-lg inline-flex">
                    <button
                        onClick={() => setActiveSubTab('years')}
                        className={`px-6 py-2 rounded-md font-semibold transition-all ${activeSubTab === 'years'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Years
                    </button>
                    <button
                        onClick={() => setActiveSubTab('months')}
                        className={`px-6 py-2 rounded-md font-semibold transition-all ${activeSubTab === 'months'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Months
                    </button>
                </div>
            </div>

            <div className="flex-1">
                {activeSubTab === 'years' ? (
                    <YearsTab data={data} />
                ) : (
                    <MonthsTab data={data} />
                )}
            </div>
        </div>
    );
}
