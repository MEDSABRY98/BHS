import React, { useState } from 'react';
import { Search, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateBulkSupplierStatementsPDF } from '@/lib/pdf/PdfUtils';
import { SupplierSummary } from './types';
import NoData from '../01-Unified/NoDataTab';

interface StatementsTabProps {
    processedData: SupplierSummary[];
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    filterYear: string;
    setFilterYear: (y: string) => void;
    filterMonth: string;
    setFilterMonth: (m: string) => void;
}

export default function StatementsTab({
    processedData,
    searchQuery,
    setSearchQuery,
    filterYear,
    setFilterYear,
    filterMonth,
    setFilterMonth
}: StatementsTabProps) {
    const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
    const [isGenerating, setIsGenerating] = useState(false);

    const toggleSelectAll = () => {
        if (selectedSuppliers.size === processedData.length) {
            setSelectedSuppliers(new Set());
        } else {
            setSelectedSuppliers(new Set(processedData.map(s => s.supplierName)));
        }
    };

    const toggleSelect = (name: string) => {
        const next = new Set(selectedSuppliers);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setSelectedSuppliers(next);
    };

    const handleBulkPrint = async () => {
        if (selectedSuppliers.size === 0) return;
        setIsGenerating(true);
        try {
            const statements = [];
            for (const name of selectedSuppliers) {
                const summary = processedData.find(s => s.supplierName === name);
                if (summary) {
                    statements.push({
                        supplierName: name,
                        transactions: summary.transactions
                    });
                }
            }
            const pdfBlob = await generateBulkSupplierStatementsPDF(statements);
            const url = URL.createObjectURL(pdfBlob as Blob);
            window.open(url, '_blank');
        } catch (e) {
            console.error(e);
            alert('Error generating PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleBulkExcel = () => {
        if (selectedSuppliers.size === 0) return;
        setIsGenerating(true);
        try {
            const wb = XLSX.utils.book_new();
            const summaryRows = Array.from(selectedSuppliers).map(name => {
                const s = processedData.find(x => x.supplierName === name);
                return {
                    'Supplier Name': name,
                    'Total Purchase': s?.totalPurchase || 0,
                    'Total Refund': s?.totalRefund || 0,
                    'Net Balance': s?.netAmount || 0
                };
            });
            const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

            const detailRows: any[] = [];
            Array.from(selectedSuppliers).forEach(name => {
                const s = processedData.find(x => x.supplierName === name);
                if (s) {
                    s.transactions.forEach(tx => {
                        detailRows.push({
                            'Supplier Name': name,
                            'Date': tx.date,
                            'Type': tx.type,
                            'Number': tx.number,
                            'Purchase': tx.type === 'Purchase' ? tx.amount : 0,
                            'Refund': tx.type === 'Refund' ? tx.amount : 0
                        });
                    });
                }
            });
            const wsDetails = XLSX.utils.json_to_sheet(detailRows);
            XLSX.utils.book_append_sheet(wb, wsDetails, 'Details');
            XLSX.writeFile(wb, `Suppliers_Statement_${new Date().toISOString().split('T')[0]}.xlsx`);

        } catch (e) {
            console.error(e);
            alert('Error generating Excel');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-8 w-full max-w-4xl mx-auto">
                <div className="relative flex-1 w-full md:w-auto">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-center placeholder:text-gray-400 text-sm font-medium outline-none"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Year"
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="w-20 py-3 px-3 text-center border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder:text-gray-400 text-sm font-medium"
                    />
                    <input
                        type="text"
                        placeholder="Month"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="w-20 py-3 px-3 text-center border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder:text-gray-400 text-sm font-medium"
                    />
                </div>

                {selectedSuppliers.size > 0 && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                        <button
                            onClick={handleBulkPrint}
                            disabled={isGenerating}
                            className="flex items-center justify-center h-10 w-10 bg-rose-600 text-white rounded-xl shadow-sm hover:bg-rose-700 transition-colors disabled:opacity-70"
                            title="Export to PDF"
                        >
                            {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileText className="h-5 w-5" />}
                        </button>
                        <button
                            onClick={handleBulkExcel}
                            disabled={isGenerating}
                            className="flex items-center justify-center h-10 w-10 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-70"
                            title="Export to Excel"
                        >
                            <FileSpreadsheet className="h-5 w-5" />
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50/80 border-b border-gray-200 backdrop-blur-sm">
                        <tr>
                            <th className="px-6 py-4 w-16 text-center">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                                    checked={processedData.length > 0 && selectedSuppliers.size === processedData.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="px-6 py-4 font-bold text-gray-700 text-center uppercase tracking-wider text-xs">Supplier Name</th>
                            <th className="px-6 py-4 font-bold text-gray-700 text-center uppercase tracking-wider text-xs">Total Purchase</th>
                            <th className="px-6 py-4 font-bold text-gray-700 text-center uppercase tracking-wider text-xs">Total Refund</th>
                            <th className="px-6 py-4 font-bold text-gray-700 text-center uppercase tracking-wider text-xs">Net Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {processedData.map((supplier) => (
                            <tr
                                key={supplier.supplierName}
                                className={`group transition-colors ${selectedSuppliers.has(supplier.supplierName) ? 'bg-teal-50/30' : 'hover:bg-gray-50'}`}
                            >
                                <td className="px-6 py-4 text-center">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                                        checked={selectedSuppliers.has(supplier.supplierName)}
                                        onChange={() => toggleSelect(supplier.supplierName)}
                                    />
                                </td>
                                <td className="px-6 py-4 font-semibold text-gray-900 text-center">{supplier.supplierName}</td>
                                <td className="px-6 py-4 text-center text-gray-600">{supplier.totalPurchase.toLocaleString('en-US')} AED</td>
                                <td className="px-6 py-4 text-center text-red-500">{supplier.totalRefund.toLocaleString('en-US')} AED</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`font-bold px-3 py-1 rounded-full text-sm ${supplier.netAmount > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {supplier.netAmount.toLocaleString('en-US')} AED
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {processedData.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-10">
                                    <NoData />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
