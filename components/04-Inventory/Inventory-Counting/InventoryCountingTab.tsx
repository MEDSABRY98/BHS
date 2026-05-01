'use client';

import React, { useState } from 'react';
import { ClipboardList, History, AlertTriangle, FileText } from 'lucide-react';
import NormalCountTab from './NormalCountTab';
import NormalRecordTab from './NormalRecordTab';
import DamageExpireCountTab from './DamageExpireCountTab';
import DamageExpireRecordTab from './DamageExpireRecordTab';

type SubTab = 'normal_total' | 'normal_record' | 'damage_total' | 'damage_record';

export default function InventoryCountingTab() {
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('normal_total');

    const subTabs = [
        { id: 'normal_total', label: 'Normal Count', icon: ClipboardList, color: 'blue' },
        { id: 'normal_record', label: 'Normal Record', icon: History, color: 'slate' },
        { id: 'damage_total', label: 'Damage & Expire Count', icon: AlertTriangle, color: 'red' },
        { id: 'damage_record', label: 'Damage & Expire Record', icon: FileText, color: 'rose' },
    ];

    return (
        <div className="flex flex-col gap-8">
            {/* Sub-Tab Navigation */}
            <div className="bg-white p-3 rounded-3xl border border-gray-100 shadow-xl shadow-slate-200/50 flex flex-wrap gap-2">
                {subTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeSubTab === tab.id;
                    
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id as SubTab)}
                            className={`
                                flex-1 min-w-[140px] flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black text-sm transition-all duration-300
                                ${isActive 
                                    ? `bg-slate-900 text-white shadow-lg shadow-slate-200 scale-[1.02]` 
                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}
                            `}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-slate-300'}`} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {activeSubTab === 'normal_total' && <NormalCountTab />}
                {activeSubTab === 'normal_record' && <NormalRecordTab />}
                {activeSubTab === 'damage_total' && <DamageExpireCountTab />}
                {activeSubTab === 'damage_record' && <DamageExpireRecordTab />}
            </div>
        </div>
    );
}
