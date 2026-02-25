import React from 'react';
import InventoryWh20ItemsTab from '@/components/InventoryWh20ItemsTab';

export const metadata = {
    title: 'WH/20 ITEMS System',
    description: 'Management system for WH/20 items dispensing',
};

export default function Wh20ItemsPage() {
    return (
        <div className="bg-slate-50 min-h-screen">
            <InventoryWh20ItemsTab />
        </div>
    );
}
