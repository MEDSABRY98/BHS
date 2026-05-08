import React from 'react';
import InventoryWh20ItemsTab from '@/components/InventoryWarehouseSTab';

export const metadata = {
    title: 'WarehouseS - Items System',
    description: 'Management system for WarehouseS items dispensing',
};

export default function Wh20ItemsPage() {
    return (
        <div className="bg-slate-50 min-h-screen">
            <InventoryWh20ItemsTab />
        </div>
    );
}
