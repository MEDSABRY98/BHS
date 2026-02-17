import React from 'react';
import Wh20ItemsTab from '@/components/Wh20ItemsTab';

export const metadata = {
    title: 'WH/20 ITEMS System',
    description: 'Management system for WH/20 items dispensing',
};

export default function Wh20ItemsPage() {
    return (
        <div className="bg-slate-50 min-h-screen">
            <Wh20ItemsTab />
        </div>
    );
}
