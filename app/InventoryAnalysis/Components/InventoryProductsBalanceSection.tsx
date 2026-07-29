'use client';

import React, { useEffect, useState, type ReactNode } from 'react';
import { Package, ArrowLeftRight } from 'lucide-react';
import InventoryProductsBalanceTab from './InventoryProductsBalanceTab';
import InventoryLocationMovementsTab from './InventoryLocationMovementsTab';

type ProductsBalanceSubTab = 'balance' | 'location_movements';

const SUB_TABS: { id: ProductsBalanceSubTab; label: string; icon: typeof Package }[] = [
  { id: 'balance', label: 'Products Balance', icon: Package },
  { id: 'location_movements', label: 'Location Movements In/Out', icon: ArrowLeftRight },
];

function SubTabPanel({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div className={active ? undefined : 'hidden'} aria-hidden={!active}>
      {children}
    </div>
  );
}

export default function InventoryProductsBalanceSection() {
  const [activeSubTab, setActiveSubTab] = useState<ProductsBalanceSubTab>('balance');
  const [mountedSubTabs, setMountedSubTabs] = useState<Set<ProductsBalanceSubTab>>(
    () => new Set(['balance']),
  );

  useEffect(() => {
    setMountedSubTabs((prev) => {
      if (prev.has(activeSubTab)) return prev;
      const next = new Set(prev);
      next.add(activeSubTab);
      return next;
    });
  }, [activeSubTab]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-2">
        <div className="flex flex-wrap gap-2">
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {mountedSubTabs.has('balance') && (
        <SubTabPanel active={activeSubTab === 'balance'}>
          <InventoryProductsBalanceTab />
        </SubTabPanel>
      )}
      {mountedSubTabs.has('location_movements') && (
        <SubTabPanel active={activeSubTab === 'location_movements'}>
          <InventoryLocationMovementsTab />
        </SubTabPanel>
      )}
    </div>
  );
}
