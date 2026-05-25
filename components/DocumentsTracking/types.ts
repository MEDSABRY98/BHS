'use client';

export interface TimelineEvent {
    event: string;
    time: string;
    note?: string;
}

export interface Check {
    id: string; // Internal id (becomes documentId in sheet)
    num: string; // DOCUMENT NUMBER
    client: string; // DOCUMENT NAME
    amount: number; // DOCUMENT AMOUNT
    date: string; // RECEIVED DATE
    checkDate: string; // DOCUMENT DATE
    bank: string; // RECEIVED FROM
    notes: string; // DOCUMENT NOTES
    status: 'received' | 'registered' | 'delivered';
    timeline: TimelineEvent[];
    receiverName?: string;
    finalReceiverName?: string;
    rowIndex?: number; // Row index from sheet
}

export const STATUS_LABELS = {
    received: 'مستلمة',
    registered: 'مسجلة في السيستم',
    delivered: 'مسلّمة للمكتب الرئيسي'
};

export const STATUS_NEXT: Record<string, 'received' | 'registered' | 'delivered' | null> = {
    received: 'registered',
    registered: 'delivered',
    delivered: null
};

export const STATUS_NEXT_LABEL: Record<string, string | null> = {
    received: 'تأكيد التسجيل في السيستم',
    registered: 'تأكيد التسليم للمكتب الرئيسي',
    delivered: null
};

export const genDocId = (index: number) => {
    return `DOC-${(index + 1).toString().padStart(4, '0')}`;
};

// Convert any date format (dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd) to ISO yyyy-mm-dd
export const normalizeDate = (val: string): string => {
    if (!val) return '';
    // Already ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
    const parts = val.split(/[\/\-\.\s]/);
    if (parts.length === 3) {
        const [a, b, c] = parts;
        if (c.length === 4) {
            // dd/mm/yyyy
            return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
        } else if (a.length === 4) {
            // yyyy/mm/dd
            return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
        }
    }
    return val;
};

// Format ISO date to dd/mm/yyyy for display
export const toDisplayDate = (isoVal: string): string => {
    if (!isoVal) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoVal)) {
        const [y, m, d] = isoVal.split('-');
        return `${d}/${m}/${y}`;
    }
    return isoVal;
};

// Auto-mask: يضيف / تلقائياً أثناء الكتابة بتنسيق dd/mm/yyyy
export const applyDateMask = (raw: string, prev: string): string => {
    const isDeleting = raw.length < prev.length;
    if (isDeleting) return raw;

    const digits = raw.replace(/\D/g, '');

    let masked = '';
    if (digits.length <= 2) {
        masked = digits;
    } else if (digits.length <= 4) {
        masked = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
        masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    }
    return masked;
};

export const formatDate = (d: string) => {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};
