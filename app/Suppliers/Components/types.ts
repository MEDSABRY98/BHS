export interface SupplierTransaction {
    date: string;
    number: string;
    supplierName: string;
    amount: number;
    type: 'Purchase' | 'Refund';
}

export interface SupplierSummary {
    supplierName: string;
    totalPurchase: number;
    totalRefund: number;
    netAmount: number;
    transactions: SupplierTransaction[];
}

export const MONTH_MAP: Record<string, string> = {
    '01': 'JAN', '02': 'FEB', '03': 'MAR', '04': 'APR', '05': 'MAY', '06': 'JUN',
    '07': 'JUL', '08': 'AUG', '09': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DEC',
    '1': 'JAN', '2': 'FEB', '3': 'MAR', '4': 'APR', '5': 'MAY', '6': 'JUN',
    '7': 'JUL', '8': 'AUG', '9': 'SEP', 'JAN': 'JAN', 'FEB': 'FEB', 'MAR': 'MAR',
    'APR': 'APR', 'MAY': 'MAY', 'JUN': 'JUN', 'JUL': 'JUL', 'AUG': 'AUG',
    'SEP': 'SEP', 'OCT': 'OCT', 'NOV': 'NOV', 'DEC': 'DEC'
};

/**
 * Standardizes any month string (e.g. "Jan 25", "01/25", "JAN-25") to "JAN25"
 */
export const standardizeToken = (raw: string): string => {
    if (!raw) return '';
    const clean = raw.trim().toUpperCase();

    // Extract Month (Name or Number) and Year (2 or 4 digits)
    // Matches: JAN 25, JAN-25, 01/25, 1-2025, etc.
    const match = clean.match(/([A-Z]{3}|[0-9]{1,2})[^A-Z0-9]*([0-9]{2,4})/);
    if (!match) return clean.replace(/[^A-Z0-9]/g, '');

    const m = match[1];
    const y = match[2];

    // Convert month number to name
    const monthName = MONTH_MAP[m] || m;

    // Convert year to 2 digits
    const yearYY = y.length === 4 ? y.slice(-2) : y;

    return `${monthName}${yearYY}`;
};
