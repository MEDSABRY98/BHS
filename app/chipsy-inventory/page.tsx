
import React from 'react';
import ChipsyInventoryTab from '@/components/ChipsyInventoryTab';

export const metadata = {
    title: 'Chipsy Inventory System',
};

export default function ChipsyInventoryPage() {
    return (
        <div className="bg-gray-50 min-h-screen">
            <ChipsyInventoryTab />
        </div>
    );
}
