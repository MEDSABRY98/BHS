export interface DeliveryEntry {
    id: string;
    lpoId: string;
    lpo: string;
    date: string;
    deliveryDate?: string;
    customer: string;
    lpoVal: number;
    invoiceVal: number;
    invoiceDate: string;
    invoiceNumber: string;
    status: 'delivered' | 'pending' | 'postponed' | 'canceled';
    missing: string[];
    shippedItems?: string[];
    canceledItems?: string[];
    reship: boolean;
    notes: string;
    createdAt?: string;
    updatedAt?: string;
    postponedDate?: string;
    customerId?: string;
}

export interface Customer {
    customerId: string;
    customerName: string;
    customerCity: string;
}

export interface LpoRow {
    lpoNumber: string;
    lpoDate: string;
    lpoDeliveryDate: string;
    customerName: string;
    customerId: string;
    lpoValue: string;
    customerSearch: string;
    showDropdown: boolean;
}

export const STATUS_CONFIG = {
    delivered: { label: 'Delivered', color: 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]/10', dot: 'bg-[#6366F1]', icon: '✅' },
    pending: { label: 'Pending', color: 'bg-[#FEF6E8] text-[#9B6000] border-[#F5A623]/10', dot: 'bg-[#F5A623]', icon: '⏳' },
    postponed: { label: 'Postponed', color: 'bg-[#F3E8FF] text-[#7C3AED] border-[#7C3AED]/10', dot: 'bg-[#8B5CF6]', icon: '📅' },
    canceled: { label: 'Canceled', color: 'bg-[#FEF2F2] text-[#EF4444] border-[#EF4444]/10', dot: 'bg-[#EF4444]', icon: '❌' },
};
