'use client';

import { useState, useMemo, useRef } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, Download, FileSpreadsheet, Calendar, User, Hash, Package, BarChart3, Receipt, PlusCircle, Trash2, MapPin, ShoppingBag, CheckCircle2, AlertCircle, Info, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface SalesInvoiceDetailsTabProps {
    data: SalesInvoice[];
    loading: boolean;
}

export default function SalesInvoiceDetailsTab({ data, loading }: SalesInvoiceDetailsTabProps) {
    const [activeSubTab, setActiveSubTab] = useState<'details' | 'lpo'>('details');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // LPO Check State
    interface LpoResultItem {
        invoiceNumber: string;
        date: string;
        customer: string;
        amountExcl: number;
        amountWithVat: number;
        targetValue: number;
        diff: number;
        status: 'match' | 'higher' | 'lower';
    }

    interface LpoRowData {
        id: string;
        lpoNumber: string;
        lpoValue: string;
        isVerified: boolean;
        found: boolean;
        results: LpoResultItem[];
    }

    const [lpoRows, setLpoRows] = useState<LpoRowData[]>([
        { id: Math.random().toString(36).substr(2, 9), lpoNumber: '', lpoValue: '', isVerified: false, found: false, results: [] }
    ]);

    // --- Invoice Details Logic ---
    const invoiceDetails = useMemo(() => {
        if (!searchQuery.trim() || activeSubTab !== 'details') return null;

        const query = searchQuery.trim().toUpperCase();
        const items = data.filter(item =>
            item.invoiceNumber && item.invoiceNumber.trim().toUpperCase() === query
        );

        if (items.length === 0) return null;

        const firstItem = items[0];
        const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
        const totalCost = items.reduce((sum, item) => sum + ((item.productCost || 0) * (item.qty || 0)), 0);
        const totalProfit = totalAmount - totalCost;

        return {
            invoiceNumber: firstItem.invoiceNumber,
            invoiceDate: firstItem.invoiceDate,
            customerName: firstItem.customerName,
            customerMainName: firstItem.customerMainName,
            area: firstItem.area,
            market: firstItem.market,
            salesRep: firstItem.salesRep,
            merchandiser: firstItem.merchandiser,
            items: items,
            totalAmount,
            totalCost,
            totalProfit
        };
    }, [data, searchQuery, activeSubTab]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchQuery(invoiceNumber);
    };

    // --- LPO Check Logic (Manual Trigger) ---
    const verifySingleLpo = (lpoNo: string, lpoVal: string, sourceData: SalesInvoice[]) => {
        if (!lpoNo.trim()) return { found: false, results: [] };

        const query = lpoNo.trim().toUpperCase();

        // STRICT MATCH: The LPO number must appear inside parentheses in the invoice number
        // Example: Invoice "SAL/24/001 (2598)" matches LPO "2598"
        // It searches for "(2598)" literally.
        const targetPattern = `(${query})`;

        const matchedItems = sourceData.filter(item => {
            if (!item.invoiceNumber) return false;
            // Check if the invoice number contains the LPO number wrapped in parentheses
            return item.invoiceNumber.includes(targetPattern);
        });

        if (matchedItems.length === 0) return { found: false, results: [] };

        // Group by invoice number to get totals per invoice
        const invoiceGroups = new Map<string, any>();
        matchedItems.forEach(item => {
            if (!invoiceGroups.has(item.invoiceNumber)) {
                invoiceGroups.set(item.invoiceNumber, {
                    invoiceNumber: item.invoiceNumber,
                    date: item.invoiceDate,
                    customer: item.customerName,
                    amountExcl: 0
                });
            }
            const group = invoiceGroups.get(item.invoiceNumber);
            group.amountExcl += (item.amount || 0);
        });

        const results = Array.from(invoiceGroups.values()).map(inv => {
            const amountWithVat = inv.amountExcl * 1.05;
            const targetValue = parseFloat(lpoVal) || 0;
            const diff = amountWithVat - targetValue;

            let status: 'match' | 'higher' | 'lower' = 'match';
            if (Math.abs(diff) < 0.01) status = 'match';
            else if (diff > 0) status = 'higher';
            else status = 'lower';

            return { ...inv, amountWithVat, targetValue, diff, status };
        });

        return { found: true, results };
    };

    const triggerLpoCheck = (id: string) => {
        setLpoRows(prev => prev.map(row => {
            if (row.id !== id) return row;
            const verification = verifySingleLpo(row.lpoNumber, row.lpoValue, data);
            return { ...row, ...verification, isVerified: true };
        }));
    };

    // Re-verify if data updates (keep results in sync without manual re-trigger if dataset changes)
    // We only re-verify rows that have been "verified" at least once or have content, 
    // but to avoid auto-triggering on typing, we check if it WAS verified.
    // However, simplest is to just re-calc all rows that have content using their CURRENT values IF data changes.
    // But since data changes are rare (mount), this is fine.
    /* 
       Actually, `data` prop might change if user navigates away and back? 
       If `data` is stable, this effect runs once.
    */
    /*
    useEffect(() => {
        setLpoRows(prev => prev.map(row => {
            if (!row.isVerified && !row.lpoNumber) return row; // Skip empty unverified
            // If it was verified OR has content, we could re-verify against new data?
            // User asked for manual trigger. Let's respect that STRICTLY.
            // Only re-verify if `isVerified` is true.
            if (row.isVerified) {
                const verification = verifySingleLpo(row.lpoNumber, row.lpoValue, data);
                return { ...row, ...verification };
            }
            return row;
        }));
    }, [data]);
    */
    // Commented out to ensure absolute manual control as requested, unless strictly needed.
    // If user refreshes or data reloads, the state resets anyway.

    const addLpoRow = () => {
        setLpoRows([...lpoRows, { id: Math.random().toString(36).substr(2, 9), lpoNumber: '', lpoValue: '', isVerified: false, found: false, results: [] }]);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const sheetData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Ensure data has rows
            if (sheetData.length === 0) return;

            // New rows to add
            const newRows: LpoRowData[] = [];

            sheetData.forEach((row) => {
                if (row.length >= 2) {
                    const lpoNum = String(row[0]).trim();
                    const lpoVal = String(row[1]).replace(/,/g, '').trim();

                    // Skip headers if found (simple check if value is not number-ish and not empty)
                    if (lpoNum && lpoVal && !isNaN(parseFloat(lpoVal))) {
                        // Immediately verify the row against current data
                        const verification = verifySingleLpo(lpoNum, lpoVal, data);

                        newRows.push({
                            id: Math.random().toString(36).substr(2, 9),
                            lpoNumber: lpoNum,
                            lpoValue: lpoVal,
                            isVerified: true, // Mark as verified immediately
                            ...verification
                        });
                    }
                }
            });

            if (newRows.length > 0) {
                // Determine if we append or replace. User might want to replace empty rows if they haven't done anything yet.
                // If only 1 empty row exists, replace it.
                if (lpoRows.length === 1 && !lpoRows[0].lpoNumber) {
                    setLpoRows(newRows);
                } else {
                    setLpoRows([...lpoRows, ...newRows]);
                }
            }
        };
        reader.readAsBinaryString(file);

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const updateLpoRow = (id: string, field: 'lpoNumber' | 'lpoValue', value: string) => {
        // When editing, we mark as unverified (optional, or just keep old results until Enter)
        // User experience: typing invalidates old result visually? 
        // Let's keep old result but maybe dim it? Or just keep it. 
        // Simplest: Just update value.
        setLpoRows(lpoRows.map(r => r.id === id ? { ...r, [field]: value, isVerified: false } : r));
    };

    const removeLpoRow = (id: string) => {
        if (lpoRows.length > 1) {
            setLpoRows(lpoRows.filter(r => r.id !== id));
        }
    };

    // --- Export Logic ---
    const exportInvoiceDetails = () => {
        if (!invoiceDetails) return;
        const workbook = XLSX.utils.book_new();
        const headerData = [
            ['Invoice Details Report'],
            ['Invoice Number', invoiceDetails.invoiceNumber],
            ['Date', invoiceDetails.invoiceDate],
            ['Customer', invoiceDetails.customerName],
            ['Main Customer', invoiceDetails.customerMainName],
            ['Area', invoiceDetails.area],
            ['Market', invoiceDetails.market],
            ['Sales Rep', invoiceDetails.salesRep],
            ['Merchandiser', invoiceDetails.merchandiser],
            [],
            ['#', 'Barcode', 'Product Name', 'Qty', 'Price', 'Cost', 'Total Price', 'Total Cost', 'Margin']
        ];

        const productRows = invoiceDetails.items.map((item, index) => {
            const totalPrice = item.amount || 0;
            const totalCost = (item.productCost || 0) * (item.qty || 0);
            return [
                index + 1,
                item.barcode || item.productId,
                item.product,
                item.qty,
                item.productPrice,
                item.productCost,
                totalPrice.toFixed(2),
                totalCost.toFixed(2),
                (totalPrice - totalCost).toFixed(2)
            ];
        });

        productRows.push([
            '', '', 'TOTAL',
            invoiceDetails.items.reduce((sum, item) => sum + (item.qty || 0), 0),
            '', '',
            invoiceDetails.totalAmount.toFixed(2),
            invoiceDetails.totalCost.toFixed(2),
            invoiceDetails.totalProfit.toFixed(2)
        ]);

        const sheet = XLSX.utils.aoa_to_sheet([...headerData, ...productRows]);
        sheet['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 40 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(workbook, sheet, 'Details');
        XLSX.writeFile(workbook, `Invoice_${invoiceDetails.invoiceNumber}.xlsx`);
    };

    const exportLpoReport = () => {
        const workbook = XLSX.utils.book_new();
        const exportData: any[] = [['LPO Suffix/Number', 'Expected Value', 'Found Invoice', 'Date', 'Customer', 'Inv Amount (Excl)', 'Inv Amount (Incl 5% VAT)', 'Difference', 'Status']];

        lpoRows.forEach(row => {
            if (row.found) {
                row.results.forEach((res: any) => {
                    exportData.push([
                        row.lpoNumber,
                        row.lpoValue,
                        res.invoiceNumber,
                        res.date,
                        res.customer,
                        res.amountExcl.toFixed(2),
                        res.amountWithVat.toFixed(2),
                        res.diff.toFixed(2),
                        res.status.toUpperCase()
                    ]);
                });
            } else if (row.lpoNumber) {
                exportData.push([row.lpoNumber, row.lpoValue, 'NOT FOUND', '-', '-', '-', '-', '-', '-']);
            }
        });

        const sheet = XLSX.utils.aoa_to_sheet(exportData);
        XLSX.utils.book_append_sheet(workbook, sheet, 'LPO Results');
        XLSX.writeFile(workbook, `LPO_Check_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-[98%] mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-8">
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                                    <Receipt className="w-6 h-6" />
                                </div>
                                Sales & Logistics Tool
                            </h1>
                        </div>

                        {/* Sub Tabs Toggle */}
                        <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200">
                            <button
                                onClick={() => setActiveSubTab('details')}
                                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'details'
                                    ? 'bg-white text-green-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Info className="w-4 h-4" />
                                Invoice Details
                            </button>
                            <button
                                onClick={() => setActiveSubTab('lpo')}
                                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'lpo'
                                    ? 'bg-white text-green-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                Check LPOs
                            </button>
                        </div>
                    </div>

                    {/* Header Controls for Details Tab (Search bar) */}
                    {activeSubTab === 'details' && (
                        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:w-96">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Enter Invoice Number (e.g. SAL0/2026/...)"
                                    value={invoiceNumber}
                                    onChange={(e) => setInvoiceNumber(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all font-medium text-slate-700 shadow-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-md active:scale-95 flex items-center gap-2"
                            >
                                <Search className="w-4 h-4" />
                                <span>Find</span>
                            </button>
                        </form>
                    )}

                    {/* Header Controls for LPO Tab (Export button) */}
                    {activeSubTab === 'lpo' && (
                        <button
                            onClick={exportLpoReport}
                            className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-md active:scale-95"
                            title="Export Results to Excel"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* --- RENDER CONTENT --- */}
                {activeSubTab === 'details' ? (
                    <div className="animate-in fade-in duration-500">
                        {!searchQuery && !loading && (
                            <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-slate-200">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                    <Search className="w-10 h-10" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-700">Ready to Search</h3>
                                <p className="text-slate-500 max-w-sm mx-auto mt-2">Enter any valid invoice number above to pull up all product items and financial calculations.</p>
                            </div>
                        )}

                        {loading && (
                            <div className="flex flex-col items-center justify-center py-24">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
                                <p className="text-slate-600 font-medium">Fetching invoice data...</p>
                            </div>
                        )}

                        {searchQuery && !invoiceDetails && !loading && (
                            <div className="bg-white rounded-3xl p-16 text-center border-2 border-slate-100 shadow-sm">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                                    <Receipt className="w-10 h-10" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-700">Invoice Not Found</h3>
                                <p className="text-slate-500 mt-2">We couldn't find any records matching "{searchQuery}".</p>
                            </div>
                        )}

                        {invoiceDetails && (
                            <div className="space-y-6">
                                {/* Details Header Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User className="w-5 h-5" /></div>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer</span>
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-lg leading-tight">{invoiceDetails.customerName}</h4>
                                        <p className="text-slate-500 text-sm mt-1">{invoiceDetails.customerMainName}</p>
                                        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-4 text-xs font-medium text-slate-500">
                                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {invoiceDetails.area}</span>
                                            <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {invoiceDetails.market}</span>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Calendar className="w-5 h-5" /></div>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-2xl font-black text-slate-800">#{invoiceDetails.invoiceNumber}</span>
                                            <span className="text-slate-500 font-medium">Issued: {invoiceDetails.invoiceDate}</span>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-slate-50 flex gap-4 text-xs">
                                            <div><span className="text-slate-400 block">Sales Rep</span><span className="text-slate-700 font-bold">{invoiceDetails.salesRep}</span></div>
                                            <div><span className="text-slate-400 block">Merch</span><span className="text-slate-700 font-bold">{invoiceDetails.merchandiser}</span></div>
                                        </div>
                                    </div>

                                    <div className="bg-green-600 p-6 rounded-2xl border border-green-700 shadow-xl shadow-green-100 text-white relative overflow-hidden">
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 bg-white/20 text-white rounded-lg"><BarChart3 className="w-5 h-5" /></div>
                                                <span className="text-xs font-bold text-green-100 uppercase tracking-wider">Finance</span>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-green-100 text-sm">Value (Incl)</span>
                                                    <span className="text-3xl font-black">{invoiceDetails.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs py-1 px-2 bg-white/10 rounded">
                                                    <span className="text-green-100">Margin Est.</span>
                                                    <span className="font-bold">+{invoiceDetails.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                            <button onClick={exportInvoiceDetails} className="mt-4 w-full py-2 bg-white text-green-700 rounded-xl font-bold text-sm hover:bg-green-50 transition-colors flex items-center justify-center gap-2">
                                                <Download className="w-4 h-4" /> Export Excel
                                            </button>
                                        </div>
                                        <Receipt className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 rotate-12" />
                                    </div>
                                </div>

                                {/* Details Breakdown Table */}
                                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                                    <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <Package className="w-5 h-5 text-green-600" />
                                            Product Composition
                                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] rounded-full ml-1 font-bold">
                                                {invoiceDetails.items.length} Lines
                                            </span>
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-center">
                                            <thead className="bg-slate-50/50 text-slate-500 font-bold uppercase text-xs tracking-widest">
                                                <tr className="border-b border-slate-100">
                                                    <th className="px-6 py-4">#</th>
                                                    <th className="px-6 py-4">Barcode</th>
                                                    <th className="px-6 py-4">Product Name</th>
                                                    <th className="px-6 py-4">Qty</th>
                                                    <th className="px-6 py-4">Price</th>
                                                    <th className="px-6 py-4">Cost</th>
                                                    <th className="px-6 py-4">Total Price</th>
                                                    <th className="px-6 py-4">Margin</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {invoiceDetails.items.map((item, index) => {
                                                    const totalPr = item.amount || 0;
                                                    const totalCo = (item.productCost || 0) * (item.qty || 0);
                                                    const margin = totalPr - totalCo;
                                                    return (
                                                        <tr key={index} className="hover:bg-green-50/30 transition-colors group">
                                                            <td className="px-6 py-4 text-slate-400 font-medium">{index + 1}</td>
                                                            <td className="px-6 py-4 font-mono text-xs text-slate-500">{item.barcode || item.productId}</td>
                                                            <td className="px-6 py-4 font-bold text-slate-800">{item.product}</td>
                                                            <td className="px-6 py-4 font-bold text-slate-700 bg-slate-50/30">{item.qty}</td>
                                                            <td className="px-6 py-4 text-slate-600">{item.productPrice.toLocaleString()}</td>
                                                            <td className="px-6 py-4 text-slate-400 italic font-mono text-[11px]">{item.productCost.toLocaleString()}</td>
                                                            <td className="px-6 py-4 font-black text-slate-800">{totalPr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                            <td className={`px-6 py-4 font-bold ${margin >= 0 ? 'text-green-600 text-xs' : 'text-red-500 text-xs'}`}>
                                                                {margin >= 0 ? '+' : ''}{margin.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="bg-slate-800 text-white">
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-5 font-black uppercase text-xs tracking-widest text-left">Aggregate Summary</td>
                                                    <td className="px-6 py-5 font-black text-lg">{invoiceDetails.items.reduce((sum, item) => sum + (item.qty || 0), 0)}</td>
                                                    <td colSpan={2} className="px-6 py-5 text-slate-400 text-[10px] font-bold uppercase italic">Calculated Values</td>
                                                    <td className="px-6 py-5 font-black text-xl">{invoiceDetails.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-5 font-black text-lg text-green-400">+{invoiceDetails.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    // --- LPO TOOL UI ---
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                                <div>
                                    <h3 className="font-black text-slate-800 flex items-center gap-2 text-lg">
                                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                                        Batch LPO Verification
                                    </h3>
                                    <p className="text-slate-400 text-xs font-medium mt-1">Cross-check LPO values against System Invoices (Includes +5% VAT automatic calculation)</p>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        ref={fileInputRef}
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-100"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Upload Excel
                                    </button>
                                    <button
                                        onClick={addLpoRow}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all active:scale-95 shadow-md shadow-green-100"
                                    >
                                        <PlusCircle className="w-4 h-4" />
                                        Add New LPO
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 space-y-8 bg-slate-50/30">
                                {lpoRows.map((row) => (
                                    <div key={row.id} className="relative bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden p-6 animate-in zoom-in-95 duration-200">
                                        {/* Inputs Group */}
                                        <div className="flex flex-col md:flex-row items-end gap-6 mb-6">
                                            <div className="flex-1 space-y-2">
                                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
                                                    <Hash className="w-3 h-3" /> LPO Number / Suffix
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Enter LPO part (e.g. 4800...)"
                                                        value={row.lpoNumber}
                                                        onChange={(e) => updateLpoRow(row.id, 'lpoNumber', e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && triggerLpoCheck(row.id)}
                                                        className="w-full pl-5 pr-12 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 font-bold text-slate-700 transition-all"
                                                    />
                                                    <button
                                                        onClick={() => triggerLpoCheck(row.id)}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                                        title="Check LPO"
                                                    >
                                                        <Search className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
                                                    <BarChart3 className="w-3 h-3" /> Expected LPO Value (AED)
                                                </label>
                                                <input
                                                    type="number"
                                                    placeholder="Target amount..."
                                                    value={row.lpoValue}
                                                    onChange={(e) => updateLpoRow(row.id, 'lpoValue', e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && triggerLpoCheck(row.id)}
                                                    className="w-full px-5 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 font-bold text-slate-700 transition-all"
                                                />
                                            </div>
                                            <button
                                                onClick={() => removeLpoRow(row.id)}
                                                disabled={lpoRows.length === 1}
                                                className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-20 mb-px"
                                                title="Remove this check"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Result Display for this Row */}
                                        {row.found ? (
                                            <div className="mt-8 border-t border-slate-100 pt-6">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm text-center">
                                                        <thead>
                                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                                                <th className="pb-3 px-4">Date</th>
                                                                <th className="pb-3 px-4">Customer</th>
                                                                <th className="pb-3 px-4">System Invoice #</th>
                                                                <th className="pb-3 px-4">Base Amount</th>
                                                                <th className="pb-3 px-4">Amount + 5% VAT</th>
                                                                <th className="pb-3 px-4">Difference</th>
                                                                <th className="pb-3 px-4">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {row.results.map((res: any, i: number) => (
                                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="py-4 px-4 font-medium text-slate-500">{res.date}</td>
                                                                    <td className="py-4 px-4 font-bold text-slate-800 text-xs truncate max-w-[180px]">{res.customer}</td>
                                                                    <td className="py-4 px-4 font-black text-blue-600 bg-blue-50/30 rounded-lg">{res.invoiceNumber}</td>
                                                                    <td className="py-4 px-4 font-medium text-slate-600">{res.amountExcl.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                                    <td className="py-4 px-4 font-black text-slate-800 text-base">{res.amountWithVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                                    <td className={`py-4 px-4 font-black ${res.status === 'match' ? 'text-slate-300' : res.status === 'higher' ? 'text-red-500' : 'text-blue-500'}`}>
                                                                        {res.diff > 0 ? '+' : ''}{res.diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                    </td>
                                                                    <td className="py-4 px-4">
                                                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight ${res.status === 'match' ? 'bg-green-100 text-green-700' :
                                                                            res.status === 'higher' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                                                            }`}>
                                                                            {res.status === 'match' ? <CheckCircle2 className="w-3 h-3" /> : res.status === 'higher' ? <AlertCircle className="w-3 h-3" /> : <PlusCircle className="w-3 h-3" />}
                                                                            {res.status === 'match' ? 'Correct Match' : res.status === 'higher' ? `Inv > LPO (+${res.diff.toFixed(2)})` : `Inv < LPO (${res.diff.toFixed(2)})`}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ) : row.lpoNumber && row.isVerified ? (
                                            <div className="mt-4 flex items-center justify-center gap-2 p-4 bg-red-50/50 text-red-600 rounded-xl border border-red-100">
                                                <AlertCircle className="w-4 h-4" />
                                                <span className="text-xs font-bold uppercase tracking-wide">No system invoice contains the sequence "{row.lpoNumber}"</span>
                                            </div>
                                        ) : (
                                            <div className="mt-4 p-8 border-2 border-dashed border-slate-100 bg-slate-50/20 rounded-xl flex flex-col items-center justify-center text-slate-300">
                                                <Info className="w-8 h-8 mb-2" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">
                                                    {row.lpoNumber ? 'Press Enter to Verify' : 'Awaiting Input...'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div className="pt-8 text-center">
                                    <p className="text-slate-400 text-[10px] font-medium italic">Verification uses precise floating point math. Small differences (&lt; 0.01) are treated as matches.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

