'use client';

import { useState, useMemo } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import {
    Calendar,
    ArrowRightLeft,
    TrendingUp,
    Users,
    FileText,
    DollarSign,
    ArrowDownLeft,
    ArrowUpRight,
    Download,
    FileDown,
    Printer,
    ChevronDown,
    Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { addArabicFont } from '@/lib/PdfUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SalesComparisonTabProps {
    data: SalesInvoice[];
    loading: boolean;
}

export default function SalesComparisonTab({ data, loading }: SalesComparisonTabProps) {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Period 1 Selection
    const [year1, setYear1] = useState(currentYear.toString());
    const [month1, setMonth1] = useState(currentMonth.toString());

    // Period 2 Selection
    const [year2, setYear2] = useState((currentYear - 1).toString());
    const [month2, setMonth2] = useState(currentMonth.toString());

    // Available Years from data
    const availableYears = useMemo(() => {
        const years = new Set<string>();
        data.forEach(item => {
            if (item.invoiceDate) {
                const date = new Date(item.invoiceDate);
                if (!isNaN(date.getTime())) {
                    years.add(date.getFullYear().toString());
                }
            }
        });
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [data]);

    const months = [
        { value: '1', label: 'January' },
        { value: '2', label: 'February' },
        { value: '3', label: 'March' },
        { value: '4', label: 'April' },
        { value: '5', label: 'May' },
        { value: '6', label: 'June' },
        { value: '7', label: 'July' },
        { value: '8', label: 'August' },
        { value: '9', label: 'September' },
        { value: '10', label: 'October' },
        { value: '11', label: 'November' },
        { value: '12', label: 'December' },
    ];

    const [openSelect, setOpenSelect] = useState<string | null>(null);

    const CustomSelect = ({
        value,
        onChange,
        options,
        label,
        id,
        direction = 'down'
    }: {
        value: string;
        onChange: (val: string) => void;
        options: { value: string; label: string }[];
        label: string;
        id: string;
        direction?: 'up' | 'down';
    }) => {
        const isOpen = openSelect === id;
        const selectedLabel = options.find(o => o.value === value)?.label || value;

        return (
            <div className="relative group">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">{label}</label>
                <button
                    onClick={() => setOpenSelect(isOpen ? null : id)}
                    onBlur={() => setTimeout(() => setOpenSelect(null), 200)}
                    className={`w-full px-6 py-4 bg-slate-50 border-2 rounded-2xl text-base font-[1000] text-slate-900 transition-all flex items-center justify-between outline-none ${isOpen ? 'bg-white border-green-600 shadow-lg shadow-green-100' : 'border-transparent hover:bg-slate-100'
                        }`}
                >
                    {selectedLabel}
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-green-600' : ''}`} />
                </button>

                {isOpen && (
                    <div className={`absolute z-[100] left-0 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200 overflow-hidden animate-in fade-in duration-200 ${direction === 'up' ? 'bottom-[calc(100%+8px)] slide-in-from-bottom-2' : 'top-[calc(100%+8px)] slide-in-from-top-2'
                        }`}>
                        <div className="max-h-[240px] overflow-y-auto py-2 custom-scrollbar">
                            {options.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setOpenSelect(null);
                                    }}
                                    className={`w-full px-6 py-3 text-left text-sm font-black transition-all flex items-center justify-between hover:bg-slate-50 ${opt.value === value ? 'text-green-600 bg-green-50/50' : 'text-slate-600'
                                        }`}
                                >
                                    {opt.label}
                                    {opt.value === value && <Check className="w-4 h-4" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const getStatsForPeriod = (year: string, month: string) => {
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);

        const periodData = data.filter(item => {
            if (!item.invoiceDate) return false;
            const date = new Date(item.invoiceDate);
            return date.getFullYear() === yearNum && (date.getMonth() + 1) === monthNum;
        });

        const netSales = periodData.reduce((sum, item) => sum + item.amount, 0);
        const grossSales = periodData
            .filter(item => item.invoiceNumber?.trim().toUpperCase().startsWith('SAL'))
            .reduce((sum, item) => sum + item.amount, 0);
        const returns = periodData
            .filter(item => item.invoiceNumber?.trim().toUpperCase().startsWith('RSAL'))
            .reduce((sum, item) => sum + item.amount, 0);

        const uniqueCustomers = new Set(periodData.map(item => item.customerId)).size;
        const uniqueInvoices = new Set(periodData.map(item => item.invoiceNumber)).size;

        // Calculate Avg Daily Sales: Gross Sales / Days in Month
        const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
        const averageDaily = daysInMonth > 0 ? grossSales / daysInMonth : 0;

        return {
            netSales,
            grossSales,
            returns,
            uniqueCustomers,
            uniqueInvoices,
            averageDaily,
            count: periodData.length
        };
    };

    const stats1 = useMemo(() => getStatsForPeriod(year1, month1), [data, year1, month1]);
    const stats2 = useMemo(() => getStatsForPeriod(year2, month2), [data, year2, month2]);

    const ComparisonRow = ({
        label,
        value1,
        value2,
        isCurrency = true,
        icon: Icon
    }: {
        label: string,
        value1: number,
        value2: number,
        isCurrency?: boolean,
        icon: any
    }) => {
        const diff = value1 - value2;
        const percentDiff = value2 !== 0 ? (diff / Math.abs(value2)) * 100 : 0;
        const isPositive = diff > 0;

        const formatValue = (val: number) => {
            if (isCurrency) {
                return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(val);
            }
            return new Intl.NumberFormat('en-AE').format(val);
        };

        return (
            <div className="group bg-white hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                <div className="grid grid-cols-12 items-center py-4 px-4 md:px-8">
                    {/* Label & Icon */}
                    <div className="col-span-12 md:col-span-4 flex items-center justify-start gap-4 mb-4 md:mb-0 pl-4 md:pl-12">
                        <div className={`p-2 rounded-xl ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} transition-colors shrink-0`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">{label}</p>
                        </div>
                    </div>

                    {/* Value 1 */}
                    <div className="col-span-12 md:col-span-3 text-center mb-2 md:mb-0">
                        <p className="text-lg font-black text-slate-900">{formatValue(value1)}</p>
                    </div>

                    {/* Value 2 */}
                    <div className="col-span-12 md:col-span-3 text-center mb-2 md:mb-0">
                        <p className="text-lg font-black text-slate-900">{formatValue(value2)}</p>
                    </div>

                    {/* Difference */}
                    <div className="col-span-12 md:col-span-2 flex justify-center">
                        <div className={`w-24 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black ${isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                            {Math.abs(percentDiff).toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const exportToExcel = () => {
        const rows = [
            { Metric: 'Net Sales', [`${month1}/${year1}`]: stats1.netSales, [`${month2}/${year2}`]: stats2.netSales, Diff: stats1.netSales - stats2.netSales, 'Diff %': stats2.netSales !== 0 ? ((stats1.netSales - stats2.netSales) / Math.abs(stats2.netSales) * 100).toFixed(2) + '%' : '0%' },
            { Metric: 'Sales Only', [`${month1}/${year1}`]: stats1.grossSales, [`${month2}/${year2}`]: stats2.grossSales, Diff: stats1.grossSales - stats2.grossSales, 'Diff %': stats2.grossSales !== 0 ? ((stats1.grossSales - stats2.grossSales) / Math.abs(stats2.grossSales) * 100).toFixed(2) + '%' : '0%' },
            { Metric: 'Returns Only', [`${month1}/${year1}`]: stats1.returns, [`${month2}/${year2}`]: stats2.returns, Diff: stats1.returns - stats2.returns, 'Diff %': stats2.returns !== 0 ? ((stats1.returns - stats2.returns) / Math.abs(stats2.returns) * 100).toFixed(2) + '%' : '0%' },
            { Metric: 'Avg Daily Sales', [`${month1}/${year1}`]: stats1.averageDaily, [`${month2}/${year2}`]: stats2.averageDaily, Diff: stats1.averageDaily - stats2.averageDaily, 'Diff %': stats2.averageDaily !== 0 ? ((stats1.averageDaily - stats2.averageDaily) / Math.abs(stats2.averageDaily) * 100).toFixed(2) + '%' : '0%' },
            { Metric: 'Count Customers', [`${month1}/${year1}`]: stats1.uniqueCustomers, [`${month2}/${year2}`]: stats2.uniqueCustomers, Diff: stats1.uniqueCustomers - stats2.uniqueCustomers, 'Diff %': stats2.uniqueCustomers !== 0 ? ((stats1.uniqueCustomers - stats2.uniqueCustomers) / Math.abs(stats2.uniqueCustomers) * 100).toFixed(2) + '%' : '0%' },
            { Metric: 'Count Invoices', [`${month1}/${year1}`]: stats1.uniqueInvoices, [`${month2}/${year2}`]: stats2.uniqueInvoices, Diff: stats1.uniqueInvoices - stats2.uniqueInvoices, 'Diff %': stats2.uniqueInvoices !== 0 ? ((stats1.uniqueInvoices - stats2.uniqueInvoices) / Math.abs(stats2.uniqueInvoices) * 100).toFixed(2) + '%' : '0%' },
        ];

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sales Comparison');
        XLSX.writeFile(wb, `Sales_Comparison_${year1}_${month1}_vs_${year2}_${month2}.xlsx`);
    };

    const exportToPDF = async () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        await addArabicFont(doc);
        const pageWidth = doc.internal.pageSize.getWidth();
        const colors = {
            dark: [15, 23, 42] as [number, number, number],
            primary: [5, 150, 105] as [number, number, number], // Emerald 600
            secondary: [79, 70, 229] as [number, number, number], // Indigo 600
            rose: [225, 29, 72] as [number, number, number],
            gray: [100, 116, 139] as [number, number, number],
            bg: [248, 250, 252] as [number, number, number]
        };

        // --- BACKGROUND & HEADER ---
        doc.setFillColor(colors.dark[0], colors.dark[1], colors.dark[2]);
        doc.rect(0, 0, pageWidth, 50, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text('PERFORMANCE ANALYTICS', 20, 25);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`COMPARISON REPORT: ${months.find(m => m.value === month1)?.label} ${year1} VS ${months.find(m => m.value === month2)?.label} ${year2}`, 20, 32);

        // --- DASHBOARD CARDS (Visual Stats) ---
        let y = 60;
        const cardW = (pageWidth - 50) / 2;
        const cardH = 35;

        const drawMetricCard = (title: string, val1: number, val2: number, x: number, y: number, isMoney: boolean) => {
            const diff = val1 - val2;
            const pct = val2 !== 0 ? (diff / Math.abs(val2) * 100).toFixed(1) : '0';
            const isUp = diff > 0;

            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(x, y, cardW, cardH, 4, 4, 'FD');

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
            doc.text(title.toUpperCase(), x + 10, y + 10);

            doc.setFontSize(14);
            doc.setTextColor(...colors.dark);
            const format = (v: number) => isMoney ? v.toLocaleString() + ' AED' : v.toLocaleString();
            doc.text(format(val1), x + 10, y + 20);

            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(`Prev: ${format(val2)}`, x + 10, y + 27);

            // Pct Badge
            const badgeBg = isUp ? [209, 250, 229] : [254, 226, 226];
            const badgeText = isUp ? [5, 150, 105] : [220, 38, 38];
            doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
            doc.roundedRect(x + cardW - 30, y + 7, 24, 9, 3, 3, 'F');
            doc.setTextColor(badgeText[0], badgeText[1], badgeText[2]);
            doc.setFontSize(10);
            doc.text(`${isUp ? '+' : ''}${pct}%`, x + cardW - 18, y + 13.5, { align: 'center' });
        };

        drawMetricCard("Net Sales", stats1.netSales, stats2.netSales, 20, y, true);
        drawMetricCard("Gross Sales", stats1.grossSales, stats2.grossSales, 30 + cardW, y, true);
        y += cardH + 10;
        drawMetricCard("Avg Daily Sales", stats1.averageDaily, stats2.averageDaily, 20, y, true);
        drawMetricCard("Customers", stats1.uniqueCustomers, stats2.uniqueCustomers, 30 + cardW, y, false);
        y += cardH + 15;

        // --- DETAILED TABLE ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.dark);
        doc.text('Detailed Breakdown', 20, y);
        y += 5;

        const tableData = [
            ['Net Sales', stats1.netSales.toLocaleString(), stats2.netSales.toLocaleString(), (stats1.netSales - stats2.netSales).toLocaleString(), (stats2.netSales !== 0 ? ((stats1.netSales - stats2.netSales) / Math.abs(stats2.netSales) * 100).toFixed(1) + '%' : '0%')],
            ['Gross Sales', stats1.grossSales.toLocaleString(), stats2.grossSales.toLocaleString(), (stats1.grossSales - stats2.grossSales).toLocaleString(), (stats2.grossSales !== 0 ? ((stats1.grossSales - stats2.grossSales) / Math.abs(stats2.grossSales) * 100).toFixed(1) + '%' : '0%')],
            ['Returns', stats1.returns.toLocaleString(), stats2.returns.toLocaleString(), (stats1.returns - stats2.returns).toLocaleString(), (stats2.returns !== 0 ? ((stats1.returns - stats2.returns) / Math.abs(stats2.returns) * 100).toFixed(1) + '%' : '0%')],
            ['Avg Daily Sales', stats1.averageDaily.toLocaleString(), stats2.averageDaily.toLocaleString(), (stats1.averageDaily - stats2.averageDaily).toLocaleString(), (stats2.averageDaily !== 0 ? ((stats1.averageDaily - stats2.averageDaily) / Math.abs(stats2.averageDaily) * 100).toFixed(1) + '%' : '0%')],
            ['Total Customers', stats1.uniqueCustomers.toString(), stats2.uniqueCustomers.toString(), (stats1.uniqueCustomers - stats2.uniqueCustomers).toString(), (stats2.uniqueCustomers !== 0 ? ((stats1.uniqueCustomers - stats2.uniqueCustomers) / Math.abs(stats2.uniqueCustomers) * 100).toFixed(1) + '%' : '0%')],
            ['Total Invoices', stats1.uniqueInvoices.toString(), stats2.uniqueInvoices.toString(), (stats1.uniqueInvoices - stats2.uniqueInvoices).toString(), (stats2.uniqueInvoices !== 0 ? ((stats1.uniqueInvoices - stats2.uniqueInvoices) / Math.abs(stats2.uniqueInvoices) * 100).toFixed(1) + '%' : '0%')],
        ];

        autoTable(doc, {
            startY: y,
            head: [['Indicator', 'Current Period', 'Comparison Period', 'Growth', 'Change %']],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: colors.dark,
                fontSize: 10,
                cellPadding: 4,
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 9,
                cellPadding: 3,
                halign: 'center'
            },
            columnStyles: {
                0: { halign: 'center', fontStyle: 'bold' }
            },
            margin: { left: 20, right: 20 },
            didParseCell: (hookData) => {
                if (hookData.column.index === 4 && hookData.section === 'body') {
                    const txt = hookData.cell.text[0];
                    if (txt.includes('-')) hookData.cell.styles.textColor = [220, 38, 38];
                    else if (!txt.startsWith('0')) hookData.cell.styles.textColor = [5, 150, 105];
                }
            }
        });

        // --- FOOTER ---
        const finalY = (doc as any).lastAutoTable.finalY + 20;
        doc.setDrawColor(226, 232, 240);
        doc.line(20, finalY, pageWidth - 20, finalY);
        doc.setFontSize(8);
        doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, finalY + 10);
        doc.text(`BH Systems - Sales Analytics`, pageWidth - 20, finalY + 10, { align: 'right' });

        doc.save(`Sales_Comparison_${year1}_${month1}_v_${year2}_${month2}.pdf`);
    };

    if (loading) return null;

    return (
        <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
            {/* Header with Export Buttons */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-3xl font-[1000] text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200">
                            <ArrowRightLeft className="w-6 h-6" />
                        </div>
                        Analytics Comparison
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={exportToExcel}
                        title="Export to Excel"
                        className="p-4 bg-white text-emerald-600 rounded-2xl hover:bg-emerald-50 transition-all hover:scale-110 active:scale-95 border border-slate-100 shadow-sm group"
                    >
                        <FileDown className="w-6 h-6" />
                    </button>
                    <button
                        onClick={exportToPDF}
                        title="Export to PDF"
                        className="p-4 bg-white text-rose-600 rounded-2xl hover:bg-rose-50 transition-all hover:scale-110 active:scale-95 border border-rose-200 shadow-sm group"
                    >
                        <FileText className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* SETTINGS SIDEBAR */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-[-20px] right-[-20px] opacity-[0.03]">
                            <Calendar className="w-48 h-48" />
                        </div>

                        <div className="relative z-10 space-y-10">
                            <div>
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    Compare Periods
                                </h3>

                                {/* Period 1 */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-black italic shadow-md">1</div>
                                        <span className="text-lg font-black text-slate-900">Current Period</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <CustomSelect
                                            id="year1"
                                            label="Choose Year"
                                            value={year1}
                                            onChange={setYear1}
                                            options={availableYears.map(y => ({ value: y, label: y }))}
                                        />
                                        <CustomSelect
                                            id="month1"
                                            label="Choose Month"
                                            value={month1}
                                            onChange={setMonth1}
                                            options={months}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-center my-6">
                                    <div className="p-3 bg-slate-50 rounded-full border-4 border-white shadow-inner">
                                        <TrendingUp className="w-5 h-5 text-slate-300" />
                                    </div>
                                </div>

                                {/* Period 2 */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black italic shadow-md">2</div>
                                        <span className="text-lg font-black text-slate-900">Comparison Period</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <CustomSelect
                                            id="year2"
                                            label="Choose Year"
                                            value={year2}
                                            onChange={setYear2}
                                            options={availableYears.map(y => ({ value: y, label: y }))}
                                            direction="up"
                                        />
                                        <CustomSelect
                                            id="month2"
                                            label="Choose Month"
                                            value={month2}
                                            onChange={setMonth2}
                                            options={months}
                                            direction="up"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CONTENT AREA */}
                <div className="lg:col-span-8">
                    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col h-full">
                        <div className="bg-slate-900 text-white p-7 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-green-600 rounded-xl shadow-lg shadow-green-900/20">
                                    <TrendingUp className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black tracking-tight">PERFORMANCE ANALYSIS</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{months.find(m => m.value === month1)?.label} {year1} vs {months.find(m => m.value === month2)?.label} {year2}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50/80 border-b border-slate-100 hidden md:block backdrop-blur-sm">
                            <div className="grid grid-cols-12 py-5 px-8 items-center">
                                <div className="col-span-4 text-center">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Metric</span>
                                </div>
                                <div className="col-span-3 text-center">
                                    <span className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] bg-emerald-50/50 px-5 py-2 rounded-xl border border-emerald-100/50">
                                        {months.find(m => m.value === month1)?.label} / {year1}
                                    </span>
                                </div>
                                <div className="col-span-3 text-center">
                                    <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] bg-indigo-50/50 px-5 py-2 rounded-xl border border-indigo-100/50">
                                        {months.find(m => m.value === month2)?.label} / {year2}
                                    </span>
                                </div>
                                <div className="col-span-2 text-center">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Growth</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col flex-grow">
                            <ComparisonRow
                                label="Net Sales"
                                value1={stats1.netSales}
                                value2={stats2.netSales}
                                icon={TrendingUp}
                            />
                            <ComparisonRow
                                label="Sales Only"
                                value1={stats1.grossSales}
                                value2={stats2.grossSales}
                                icon={DollarSign}
                            />
                            <ComparisonRow
                                label="Returns Only"
                                value1={stats1.returns}
                                value2={stats2.returns}
                                icon={ArrowDownLeft}
                            />
                            <ComparisonRow
                                label="Avg Daily Sales"
                                value1={stats1.averageDaily}
                                value2={stats2.averageDaily}
                                icon={FileText}
                            />
                            <ComparisonRow
                                label="Total Customers"
                                value1={stats1.uniqueCustomers}
                                value2={stats2.uniqueCustomers}
                                isCurrency={false}
                                icon={Users}
                            />
                            <ComparisonRow
                                label="Total Invoices"
                                value1={stats1.uniqueInvoices}
                                value2={stats2.uniqueInvoices}
                                isCurrency={false}
                                icon={FileText}
                            />
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 mt-auto">
                            <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                <span>Analysis for Period {year1}/{month1} vs {year2}/{month2}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
