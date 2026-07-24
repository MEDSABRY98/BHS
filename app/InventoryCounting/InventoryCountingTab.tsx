'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardList, History, AlertTriangle, Layers, Users } from 'lucide-react';
import TabPanel from '@/app/Components/TabPanel';
import TotalCountTab from './TotalCountTab';
import UserComparisonTab from './UserComparisonTab';
import NormalCountTab from './NormalCountTab';
import DamageExpireCountTab from './DamageExpireCountTab';
import RecordTab from './RecordTab';
import { InventoryCountingFiltersProvider } from './InventoryCountingFiltersContext';
import UserWarehouseDropdowns from './Utils/UserWarehouseDropdowns';

type SubTab = 'total_count' | 'user_comparison' | 'normal_total' | 'damage_total' | 'record';

function isCountingTabAllowed(tabId: string): boolean {
    try {
        const savedUser = localStorage.getItem('currentUser');
        const currentUser = savedUser ? JSON.parse(savedUser) : null;
        if (currentUser?.name === 'MED Sabry') return true;

        const perms = JSON.parse(currentUser?.role || '{}');
        const countingTabs = perms['inventory-counting'];
        if (Array.isArray(countingTabs)) {
            if (countingTabs.includes(tabId)) return true;
            if (
                tabId === 'record' &&
                (countingTabs.includes('normal_record') || countingTabs.includes('damage_record'))
            ) {
                return true;
            }
        }

        const inventoryTabs = perms.inventory;
        if (Array.isArray(inventoryTabs)) {
            if (inventoryTabs.includes('counting')) return true;
            if (inventoryTabs.includes(tabId)) return true;
            if (
                tabId === 'record' &&
                (inventoryTabs.includes('normal_record') || inventoryTabs.includes('damage_record'))
            ) {
                return true;
            }
        }

        return true;
    } catch {
        return true;
    }
}

export default function InventoryCountingTab() {
    const subTabs = [
        { id: 'total_count', label: 'Total Count', icon: Layers, color: 'indigo' },
        { id: 'user_comparison', label: 'User Comparison', icon: Users, color: 'violet' },
        { id: 'normal_total', label: 'Normal Count', icon: ClipboardList, color: 'blue' },
        { id: 'damage_total', label: 'Damage & Expire Count', icon: AlertTriangle, color: 'red' },
        { id: 'record', label: 'Record', icon: History, color: 'slate' },
    ].filter(tab => isCountingTabAllowed(tab.id));

    const [activeSubTab, setActiveSubTab] = useState<SubTab>(
        subTabs.length > 0 ? subTabs[0].id as SubTab : 'total_count'
    );
    const [visitedTabs, setVisitedTabs] = useState<Set<SubTab>>(
        new Set(subTabs.length > 0 ? [subTabs[0].id as SubTab] : ['total_count'])
    );

    const handleTabChange = (tabId: SubTab) => {
        setActiveSubTab(tabId);
    };

    useEffect(() => {
        setVisitedTabs(prev => new Set([...prev, activeSubTab]));
    }, [activeSubTab]);

    return (
        <InventoryCountingFiltersProvider>
            <div className="flex flex-col gap-6">
                <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xl shadow-slate-200/50">
                    <UserWarehouseDropdowns />
                </div>

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

                <div className="min-h-[400px]">
                    <TabPanel tabId="total_count" activeTab={activeSubTab} isVisited={visitedTabs.has('total_count')}>
                        <TotalCountTab />
                    </TabPanel>
                    <TabPanel tabId="user_comparison" activeTab={activeSubTab} isVisited={visitedTabs.has('user_comparison')}>
                        <UserComparisonTab />
                    </TabPanel>
                    <TabPanel tabId="normal_total" activeTab={activeSubTab} isVisited={visitedTabs.has('normal_total')}>
                        <NormalCountTab />
                    </TabPanel>
                    <TabPanel tabId="damage_total" activeTab={activeSubTab} isVisited={visitedTabs.has('damage_total')}>
                        <DamageExpireCountTab />
                    </TabPanel>
                    <TabPanel tabId="record" activeTab={activeSubTab} isVisited={visitedTabs.has('record')}>
                        <RecordTab />
                    </TabPanel>
                </div>
            </div>
        </InventoryCountingFiltersProvider>
    );
}
