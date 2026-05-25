'use client';

import React, { useState } from 'react';
import { ClipboardList, History, AlertTriangle, FileText } from 'lucide-react';
import NormalCountTab from './NormalCountTab';
import NormalRecordTab from './NormalRecordTab';
import DamageExpireCountTab from './DamageExpireCountTab';
import DamageExpireRecordTab from './DamageExpireRecordTab';

type SubTab = 'normal_total' | 'normal_record' | 'damage_total' | 'damage_record';

export default function InventoryCountingTab() {
    const subTabs = [
        { id: 'normal_total', label: 'Normal Count', icon: ClipboardList, color: 'blue' },
        { id: 'normal_record', label: 'Normal Record', icon: History, color: 'slate' },
        { id: 'damage_total', label: 'Damage & Expire Count', icon: AlertTriangle, color: 'red' },
        { id: 'damage_record', label: 'Damage & Expire Record', icon: FileText, color: 'rose' },
    ].filter(tab => {
        // Check permissions
        try {
            const savedUser = localStorage.getItem('currentUser');
            const currentUser = savedUser ? JSON.parse(savedUser) : null;
            if (currentUser?.name === 'MED Sabry') return true;
            const perms = JSON.parse(currentUser?.role || '{}');
            if (perms.inventory) {
                return perms.inventory.includes(tab.id);
            }
            return true; // Default to true if no specific permissions set
        } catch (e) {
            return true;
        }
    });

    // Adjust active tab if current one is not allowed
    const [activeSubTab, setActiveSubTab] = useState<SubTab>(
        subTabs.length > 0 ? subTabs[0].id as SubTab : 'normal_total'
    );
    // Keep track of which tabs have been visited to avoid fetching all at once
    const [visitedTabs, setVisitedTabs] = useState<Set<SubTab>>(
        new Set(subTabs.length > 0 ? [subTabs[0].id as SubTab] : ['normal_total'])
    );

    const handleTabChange = (tabId: SubTab) => {
        setActiveSubTab(tabId);
        if (!visitedTabs.has(tabId)) {
            setVisitedTabs(prev => new Set(prev).add(tabId));
        }
    };

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
                            onClick={() => handleTabChange(tab.id as SubTab)}
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

            {/* Content Area - Using hidden class for persistence */}
            <div className="min-h-[400px]">
                <div className={activeSubTab === 'normal_total' ? 'block' : 'hidden'}>
                    <NormalCountTab />
                </div>
                
                {visitedTabs.has('normal_record') && (
                    <div className={activeSubTab === 'normal_record' ? 'block' : 'hidden'}>
                        <NormalRecordTab />
                    </div>
                )}
                
                {visitedTabs.has('damage_total') && (
                    <div className={activeSubTab === 'damage_total' ? 'block' : 'hidden'}>
                        <DamageExpireCountTab />
                    </div>
                )}
                
                {visitedTabs.has('damage_record') && (
                    <div className={activeSubTab === 'damage_record' ? 'block' : 'hidden'}>
                        <DamageExpireRecordTab />
                    </div>
                )}
            </div>
        </div>
    );
}
