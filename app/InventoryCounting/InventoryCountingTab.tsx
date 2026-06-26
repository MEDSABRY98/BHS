'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardList, History, AlertTriangle, FileText } from 'lucide-react';
import TabPanel from '@/app/Components/TabPanel';
import NormalCountTab from './NormalCountTab';
import NormalRecordTab from './NormalRecordTab';
import DamageExpireCountTab from './DamageExpireCountTab';
import DamageExpireRecordTab from './DamageExpireRecordTab';

type SubTab = 'normal_total' | 'normal_record' | 'damage_total' | 'damage_record';

function isCountingTabAllowed(tabId: string): boolean {
    try {
        const savedUser = localStorage.getItem('currentUser');
        const currentUser = savedUser ? JSON.parse(savedUser) : null;
        if (currentUser?.name === 'MED Sabry') return true;

        const perms = JSON.parse(currentUser?.role || '{}');
        const countingTabs = perms['inventory-counting'];
        if (Array.isArray(countingTabs)) {
            return countingTabs.includes(tabId);
        }

        const inventoryTabs = perms.inventory;
        if (Array.isArray(inventoryTabs)) {
            if (inventoryTabs.includes('counting')) return true;
            return inventoryTabs.includes(tabId);
        }

        return true;
    } catch {
        return true;
    }
}

export default function InventoryCountingTab() {
    const subTabs = [
        { id: 'normal_total', label: 'Normal Count', icon: ClipboardList, color: 'blue' },
        { id: 'normal_record', label: 'Normal Record', icon: History, color: 'slate' },
        { id: 'damage_total', label: 'Damage & Expire Count', icon: AlertTriangle, color: 'red' },
        { id: 'damage_record', label: 'Damage & Expire Record', icon: FileText, color: 'rose' },
    ].filter(tab => isCountingTabAllowed(tab.id));

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
    };

    useEffect(() => {
        setVisitedTabs(prev => new Set([...prev, activeSubTab]));
    }, [activeSubTab]);

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

            {/* Content Area */}
            <div className="min-h-[400px]">
                <TabPanel tabId="normal_total" activeTab={activeSubTab} isVisited={visitedTabs.has('normal_total')}>
                    <NormalCountTab />
                </TabPanel>
                <TabPanel tabId="normal_record" activeTab={activeSubTab} isVisited={visitedTabs.has('normal_record')}>
                    <NormalRecordTab />
                </TabPanel>
                <TabPanel tabId="damage_total" activeTab={activeSubTab} isVisited={visitedTabs.has('damage_total')}>
                    <DamageExpireCountTab />
                </TabPanel>
                <TabPanel tabId="damage_record" activeTab={activeSubTab} isVisited={visitedTabs.has('damage_record')}>
                    <DamageExpireRecordTab />
                </TabPanel>
            </div>
        </div>
    );
}
