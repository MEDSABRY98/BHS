'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar,
    User,
    Users,
    FileText,
    PlusCircle,
    BarChart3,
    Search,
    ChevronLeft,
    CheckCircle2,
    ChevronDown,
    XCircle,
    DollarSign,
    ArrowLeft,
    LayoutGrid,
    Filter,
    Download,
    Printer,
    TrendingUp,
    Wallet,
    Clock,
    Activity,
    ArrowRight,
    FileDown,
    FileSpreadsheet,
    AlertTriangle,
    Info,
    CircleDollarSign
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    LineChart,
    Line,
    Legend,
    Cell
} from 'recharts';
import * as XLSX from 'xlsx';

const parseInvoiceDate = (dateStr?: string | null): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.trim().split(/[\/\-]/);
    if (parts.length === 3) {
        const p1 = parseInt(parts[0], 10);
        const p2 = parseInt(parts[1], 10);
        const p3 = parseInt(parts[2], 10);
        if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
            if (p3 > 1000) {
                const parsed = new Date(p3, p2 - 1, p1);
                if (!isNaN(parsed.getTime())) return parsed;
            } else if (p1 > 1000) {
                const parsed = new Date(p1, p2 - 1, p3);
                if (!isNaN(parsed.getTime())) return parsed;
            }
        }
    }
    const direct = new Date(dateStr);
    if (!isNaN(direct.getTime())) return direct;
    return null;
};

function SearchableSelect({
    value,
    onChange,
    options,
    placeholder,
    className = ""
}: {
    value: string;
    onChange: (val: string) => void;
    options: string[];
    placeholder: string;
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(value.toLowerCase())
    );

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className="relative group">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none"
                />
                <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-all pointer-events-none ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (filteredOptions.length > 0) && (
                <div className="absolute z-[100] w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-52 overflow-y-auto custom-scrollbar">
                        {filteredOptions.map((opt, i) => (
                            <div
                                key={i}
                                onClick={() => {
                                    onChange(opt);
                                    setIsOpen(false);
                                }}
                                className={`px-4 py-3 text-sm font-bold cursor-pointer transition-colors ${value === opt ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {opt}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

import { VisitCustomerEntry } from '@/types';

export default function VisitCustomersTab() {
    const [activeTab, setActiveTab] = useState<'registration' | 'customer-reports' | 'rep-reports'>('registration');
    const [viewMode, setViewMode] = useState<'details' | 'summary'>('details');
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<VisitCustomerEntry[]>([]);
    const [customers, setCustomers] = useState<string[]>([]);
    const [salesReps, setSalesReps] = useState<string[]>([]);
    const [cities, setCities] = useState<string[]>([]);
    const [selectedRep, setSelectedRep] = useState<string | null>(null);
    const [customerBalances, setCustomerBalances] = useState<Record<string, number>>({});
    const [notification, setNotification] = useState<{ message: string, type: 'error' | 'success' | 'info' } | null>(null);
    const [editingVisit, setEditingVisit] = useState<VisitCustomerEntry | null>(null);
    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
    const [allInvoices, setAllInvoices] = useState<any[]>([]);

    const showNotification = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
        setNotification({ message, type });
        // Auto hide success/info after 5s, errors stay until closed
        if (type !== 'error') {
            setTimeout(() => setNotification(null), 5000);
        }
    };

    const getTodayDate = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Registration State (Multiple Entries)
    const [entries, setEntries] = useState<any[]>([
        {
            date: getTodayDate(),
            customerName: '',
            city: '',
            salesRepName: '',
            collectMoney: 'No',
            howMuchCollectMoney: '',
            notes: ''
        }
    ]);

    // List Filters
    const [customerFilter, setCustomerFilter] = useState('');
    const [repFilter, setRepFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [fromDateFilter, setFromDateFilter] = useState('');
    const [toDateFilter, setToDateFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showVisitedOnly, setShowVisitedOnly] = useState<boolean | null>(null); // null = all, true = visited, false = not visited
    const [cityFilter, setCityFilter] = useState('');
    const [customerToCity, setCustomerToCity] = useState<Record<string, string>>({});
    const [debtDaysFilter, setDebtDaysFilter] = useState('');
    const [debtAmountFilter, setDebtAmountFilter] = useState('');

    useEffect(() => {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                setCurrentUser(JSON.parse(savedUser));
            } catch (e) { }
        }
        fetchData();
        fetchMetadata();
    }, []);

    const fetchData = async () => {
        try {
            const response = await fetch('/api/visit-customers');
            if (response.ok) {
                const result = await response.json();
                setData(result);

                // Fetch Sales Reps directly from visit history as requested
                const uniqueReps = Array.from(new Set(result.map((row: any) => row.salesRepName))).filter(Boolean).sort() as string[];
                setSalesReps(uniqueReps);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const fetchMetadata = async () => {
        try {
            const [sheetsResponse, closedResponse] = await Promise.all([
                fetch('/api/sheets'),
                fetch('/api/closed-customers'),
            ]);

            if (sheetsResponse.ok) {
                const result = await sheetsResponse.json();
                const sheetData = result.data || [];

                // Build set of excluded customers (CLOSED only)
                const excludedNames = new Set<string>();
                if (closedResponse.ok) {
                    const closedData = await closedResponse.json();
                    (closedData.closedCustomers || []).forEach((name: string) => excludedNames.add(name.toLowerCase().trim().replace(/\s+/g, ' ')));
                }

                // Filter out closed customers only
                const allCustomers = Array.from(new Set(sheetData.map((row: any) => row.customerName))).sort() as string[];
                const uniqueCustomers = allCustomers.filter(
                    (name: string) => !excludedNames.has(name.toLowerCase().trim().replace(/\s+/g, ' '))
                );
                setCustomers(uniqueCustomers);
                setAllInvoices(sheetData);

                // Calculate balances and city mapping
                const balances: Record<string, number> = {};
                const custToCity: Record<string, string> = {};
                sheetData.forEach((row: any) => {
                    if (row.customerName) {
                        const debit = row.debit || 0;
                        const credit = row.credit || 0;
                        balances[row.customerName] = (balances[row.customerName] || 0) + (debit - credit);
                        if (row.salesRep) {
                            custToCity[row.customerName] = row.salesRep;
                        }
                    }
                });
                setCustomerBalances(balances);
                setCustomerToCity(custToCity);

                const uniqueCities = Array.from(new Set(sheetData.map((row: any) => row.salesRep))).filter(Boolean).sort() as string[];
                setCities(uniqueCities);

                // Reps are now handled in fetchData from the visit history
            }
        } catch (error) {
            console.error('Error fetching metadata:', error);
        }
    };

    const handleBack = () => {
        window.location.href = '/';
    };

    const addRow = () => {
        setEntries([
            ...entries,
            {
                date: entries.length > 0 ? entries[entries.length - 1].date : getTodayDate(),
                customerName: '',
                city: '',
                salesRepName: entries.length > 0 ? entries[entries.length - 1].salesRepName : '',
                collectMoney: 'No',
                howMuchCollectMoney: '',
                notes: ''
            }
        ]);
    };

    const removeRow = (index: number) => {
        if (entries.length > 1) {
            setEntries(entries.filter((_, i) => i !== index));
        }
    };

    const handleEntryChange = (index: number, field: string, value: any) => {
        setEntries(prev => prev.map((entry, i) =>
            i === index ? { ...entry, [field]: value } : entry
        ));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        const incompleteRows = entries.some(e => !e.customerName || !e.salesRepName || !e.city);
        if (incompleteRows) {
            showNotification('Please ensure all rows have a Customer, Sales Representative, and City selected.', 'error');
            return;
        }

        const missingAmounts = entries.some(e =>
            e.collectMoney === 'Yes' && (!e.howMuchCollectMoney || parseFloat(e.howMuchCollectMoney) <= 0)
        );
        if (missingAmounts) {
            showNotification('Please enter a collection amount for all rows where "Collect Money" is Yes.', 'error');
            return;
        }

        const invalidCustomers = entries.some(e => e.customerName && !customers.includes(e.customerName));
        if (invalidCustomers) {
            showNotification('One or more selected customers are not in the valid list. Please select from the dropdown.', 'error');
            return;
        }

        const invalidCities = entries.some(e => e.city && !cities.includes(e.city));
        if (invalidCities) {
            showNotification('One or more selected cities are not in the valid list. Please select from the dropdown.', 'error');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/visit-customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entries.map(e => ({
                    ...e,
                    howMuchCollectMoney: e.collectMoney === 'Yes' ? parseFloat(e.howMuchCollectMoney) || 0 : 0
                })))
            });

            if (response.ok) {
                showNotification('Records saved successfully!', 'success');
                setEntries([
                    {
                        date: getTodayDate(),
                        customerName: '',
                        city: '',
                        salesRepName: '',
                        collectMoney: 'No',
                        howMuchCollectMoney: '',
                        notes: ''
                    }
                ]);
                fetchData();
            } else {
                showNotification('Failed to save records. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error saving records:', error);
            showNotification('Error saving records. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVisit || !editingVisit.rowIndex) return;

        if (editingVisit.customerName && !customers.includes(editingVisit.customerName)) {
            showNotification('The selected customer is not in the valid list. Please select from the dropdown.', 'error');
            return;
        }

        if (editingVisit.city && !cities.includes(editingVisit.city)) {
            showNotification('The selected city is not in the valid list. Please select from the dropdown.', 'error');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/visit-customers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingVisit)
            });

            if (response.ok) {
                showNotification('Record updated successfully!', 'success');
                setIsEditPopupOpen(false);
                setEditingVisit(null);
                fetchData();
            } else {
                showNotification('Failed to update record.', 'error');
            }
        } catch (error) {
            console.error('Error updating record:', error);
            showNotification('Error updating record.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadRepReport = async (repName: string) => {
        const repVisits = filteredData.filter(v => v.salesRepName === repName);
        if (repVisits.length === 0) {
            showNotification('No data available for this representative in the selected period.', 'info');
            return;
        }

        const totalVisits = repVisits.length;
        const totalCollected = repVisits.reduce((sum, v) => sum + (v.howMuchCollectMoney || 0), 0);
        const collectedVisits = repVisits.filter(v => v.collectMoney === 'Yes').length;
        const noCollectionVisits = totalVisits - collectedVisits;

        const uniqueDays = new Set(repVisits.map(v => v.date)).size;
        const avgPerDay = uniqueDays > 0 ? (totalVisits / uniqueDays).toFixed(1) : '0';

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const chartData = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            const dayVisits = repVisits.filter(v => v.date === dateStr);
            chartData.push({
                date: dateStr,
                visits: dayVisits.length,
                amount: dayVisits.reduce((sum, v) => sum + (v.howMuchCollectMoney || 0), 0)
            });
        }

        // Determine filter period string
        let period = 'All Time';
        if (fromDateFilter && toDateFilter) period = `${fromDateFilter} to ${toDateFilter}`;
        else if (yearFilter && monthFilter) period = `${monthFilter}/${yearFilter}`;
        else if (yearFilter) period = `Year ${yearFilter}`;
        else if (monthFilter) period = `Month ${monthFilter}`;

        try {
            const { generateSalesRepReportPDF } = await import('@/lib/PdfUtils');
            const pdfBlob = await generateSalesRepReportPDF({
                repName,
                period,
                totalVisits,
                totalCollected,
                collectedVisits,
                noCollectionVisits,
                avgPerDay,
                chartData,
                visits: [...repVisits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                customerBalances: customerBalances
            });

            const url = window.URL.createObjectURL(pdfBlob as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${repName.replace(/\s+/g, '_')}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF report.');
        }
    };

    const handleExportExcel = () => {
        if (summaryData.length === 0) {
            showNotification('No data to export', 'info');
            return;
        }

        const exportRows = summaryData.map((row: any, idx: number) => {
            const city = activeTab === 'customer-reports' ? (customerToCity[row.name] || 'Unknown') : '---';
            const base: any = {
                '#': idx + 1,
                'Name': row.name,
                'City': city,
                'Total Visits': row.totalVisits,
                'Collections': row.visitsWithCollection,
                'Total Collected (AED)': row.totalCollected,
                'Last Visit': row.lastVisit
            };
            if (activeTab === 'customer-reports') {
                base['Total Debit (AED)'] = row.totalCustomerDebt;
                base['Oldest Debt (Days)'] = row.oldestDebtDays;
            }
            return base;
        });

        const workbook = XLSX.utils.book_new();

        // 1. Combined Sheet
        const allSheetName = activeTab === 'customer-reports' ? 'All Customers' : 'Summary';
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        XLSX.utils.book_append_sheet(workbook, worksheet, allSheetName);

        // 2. City Sheets (Only for customer reports)
        if (activeTab === 'customer-reports') {
            const citiesInReport = Array.from(new Set(exportRows.map(r => r.City))).filter(c => c && c !== '---').sort();

            citiesInReport.forEach(city => {
                const cityRows = exportRows
                    .filter(r => r.City === city)
                    .map((r, i) => ({ ...r, '#': i + 1 }));

                if (cityRows.length > 0) {
                    const citySheet = XLSX.utils.json_to_sheet(cityRows);
                    // Sheet names must be <= 31 characters and no special chars
                    const safeSheetName = city.replace(/[\[\]\*\?\/\\\:]/g, '').substring(0, 31);
                    XLSX.utils.book_append_sheet(workbook, citySheet, safeSheetName || 'City');
                }
            });
        }

        const fileName = `${activeTab === 'customer-reports' ? 'Customer' : 'SalesRep'}_Summary_${getTodayDate()}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const filteredData = useMemo(() => {
        return data.filter(entry => {
            const matchesSearch = !searchQuery ||
                entry.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                entry.salesRepName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                entry.notes.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCustomer = !customerFilter || entry.customerName.toLowerCase().includes(customerFilter.toLowerCase());
            const matchesRep = !repFilter || entry.salesRepName.toLowerCase().includes(repFilter.toLowerCase());

            const entryDate = new Date(entry.date);
            const matchesYear = !yearFilter || entryDate.getFullYear().toString() === yearFilter;
            const matchesMonth = !monthFilter || (entryDate.getMonth() + 1).toString() === monthFilter;

            const parseInputDate = (input: string) => {
                const parts = input.split('-');
                if (parts.length === 3 && parts[0].length <= 2) {
                    // Assume DD-MM-YYYY
                    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
                return input; // Fallback to original
            };

            const formattedFrom = parseInputDate(fromDateFilter);
            const formattedTo = parseInputDate(toDateFilter);

            const matchesFromDate = !fromDateFilter || entry.date >= formattedFrom;
            const matchesToDate = !toDateFilter || entry.date <= formattedTo;

            const matchesCity = !cityFilter || (entry.city || customerToCity[entry.customerName]) === cityFilter;

            return matchesSearch && matchesCustomer && matchesRep && matchesYear && matchesMonth && matchesFromDate && matchesToDate && matchesCity;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [data, searchQuery, customerFilter, repFilter, yearFilter, monthFilter, fromDateFilter, toDateFilter, cityFilter, customerToCity]);

    // Helper for parsing DD-MM-YYYY or YYYY-MM-DD to Date object
    const parseInvoiceDate = (dateStr: string) => {
        if (!dateStr) return new Date(0);
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            if (parts[0].length === 4) return new Date(dateStr); // YYYY-MM-DD
            return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`); // DD-MM-YYYY
        }
        return new Date(dateStr);
    };

    const stats = useMemo(() => {
        const totalVisits = filteredData.length;
        const totalCollected = filteredData.reduce((sum, entry) => sum + (entry.howMuchCollectMoney || 0), 0);
        const moneyCollectionVisits = filteredData.filter(entry => entry.collectMoney === 'Yes').length;

        return { totalVisits, totalCollected, moneyCollectionVisits };
    }, [filteredData]);

    const summaryData = useMemo(() => {
        const groupField = activeTab === 'customer-reports' ? 'customerName' : 'salesRepName';

        // Base grouping from filteredData (actual visits)
        const grouped = filteredData.reduce((acc: any, curr: any) => {
            const key = curr[groupField] || 'Unknown';
            if (!acc[key]) {
                acc[key] = {
                    name: key,
                    totalVisits: 0,
                    totalCollected: 0,
                    lastVisit: '0000-00-00',
                    visitsWithCollection: 0,
                    uniqueCustomers: new Set<string>()
                };
            }
            acc[key].totalVisits += 1;
            acc[key].totalCollected += curr.howMuchCollectMoney || 0;
            if (curr.date > acc[key].lastVisit) acc[key].lastVisit = curr.date;
            if (curr.collectMoney === 'Yes') acc[key].visitsWithCollection += 1;
            if (curr.customerName) acc[key].uniqueCustomers.add(curr.customerName);
            return acc;
        }, {});

        let result = Object.values(grouped);

        // If in Customer Reports, we might want to show all customers
        if (activeTab === 'customer-reports') {
            const currentResults = new Set(result.map((r: any) => r.name));

            // Add customers who haven't been visited but match current filters
            customers.forEach(custName => {
                if (!currentResults.has(custName)) {
                    // Check city
                    const matchesCity = !cityFilter || customerToCity[custName] === cityFilter;
                    // Check customer filter (partial match)
                    const matchesCustomer = !customerFilter || custName.toLowerCase().includes(customerFilter.toLowerCase());
                    // Check search query
                    const matchesSearch = !searchQuery || custName.toLowerCase().includes(searchQuery.toLowerCase());

                    if (matchesCity && matchesCustomer && matchesSearch) {
                        currentResults.add(custName);
                        result.push({
                            name: custName,
                            totalVisits: 0,
                            totalCollected: 0,
                            lastVisit: '---',
                            visitsWithCollection: 0,
                            uniqueCustomers: new Set([custName])
                        });
                    }
                }
            });

            // Apply Visited/Not Visited toggle filter
            if (showVisitedOnly === true) {
                result = result.filter((r: any) => r.totalVisits > 0);
            } else if (showVisitedOnly === false) {
                result = result.filter((r: any) => r.totalVisits === 0);
            }

            // Ensure the final results strictly adhere to the main filters (City, Customer, Global Search)
            result = result.filter((r: any) => {
                const matchesCity = !cityFilter || customerToCity[r.name] === cityFilter;
                const matchesCustomer = !customerFilter || r.name.toLowerCase().includes(customerFilter.toLowerCase());
                const matchesSearch = !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesCity && matchesCustomer && matchesSearch;
            });
        }

        return result.map((row: any) => {
            let totalDebt = 0;
            row.uniqueCustomers.forEach((c: string) => {
                totalDebt += (customerBalances[c] || 0);
            });

            // Calculate Oldest Debt Days for this customer
            let oldestDays = 0;
            if (activeTab === 'customer-reports') {
                const customerInvoices = allInvoices.filter(inv => inv.customerName === row.name);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // FIFO Aging: find oldest invoice not covered by total payments
                // Total payments/credits = Total Debits - Current Positive Balance
                const allDebits = customerInvoices
                    .filter(inv => (inv.debit || 0) > 0)
                    .sort((a, b) => parseInvoiceDate(a.date).getTime() - parseInvoiceDate(b.date).getTime());

                const totalDebitSum = allDebits.reduce((s, inv) => s + (inv.debit || 0), 0);
                // Only act if there's actual debt. If balance is <= 0, oldest is 0.
                if (totalDebt > 0) {
                    let creditsToApply = totalDebitSum - totalDebt;
                    let oldestUnpaidDate: Date | null = null;

                    for (const inv of allDebits) {
                        if (creditsToApply >= inv.debit) {
                            creditsToApply -= inv.debit;
                        } else {
                            oldestUnpaidDate = parseInvoiceDate(inv.date);
                            break;
                        }
                    }

                    if (oldestUnpaidDate) {
                        const diffTime = today.getTime() - oldestUnpaidDate.getTime();
                        oldestDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    }
                }
            }

            return {
                ...row,
                totalCustomerDebt: totalDebt,
                oldestDebtDays: oldestDays
            };
        }).filter((row: any) => {
            // Apply new filters
            const minAmount = parseFloat(debtAmountFilter) || 0;
            const minDays = parseInt(debtDaysFilter) || 0;

            if (minAmount > 0 && row.totalCustomerDebt < minAmount) return false;
            if (minDays > 0 && row.oldestDebtDays < minDays) return false;

            return true;
        }).sort((a: any, b: any) => b.totalVisits - a.totalVisits);
    }, [filteredData, activeTab, customerBalances, customers, showVisitedOnly, cityFilter, customerToCity, customerFilter, searchQuery, debtDaysFilter, debtAmountFilter, allInvoices]);

    const repDetails = useMemo(() => {
        if (!selectedRep) return null;

        const repVisits = filteredData.filter(v => v.salesRepName === selectedRep);
        const sortedVisits = [...repVisits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const totalVisits = repVisits.length;
        const totalCollected = repVisits.reduce((sum, v) => sum + (v.howMuchCollectMoney || 0), 0);
        const collectedVisits = repVisits.filter(v => v.collectMoney === 'Yes').length;
        const noCollectionVisits = totalVisits - collectedVisits;

        // Calculate Average Customers Per Day (Active Days only)
        const uniqueDays = new Set(repVisits.map(v => v.date)).size;
        const avgPerDay = uniqueDays > 0 ? (totalVisits / uniqueDays).toFixed(1) : '0';

        // Last 7 Days Chart Data (Calendar days ending Today)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset to start of day
        const chartData = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);

            // Format date as YYYY-MM-DD in local timezone
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const dayVisits = repVisits.filter(v => v.date === dateStr);
            const dayCollected = dayVisits.reduce((sum, v) => sum + (v.howMuchCollectMoney || 0), 0);

            chartData.push({
                name: d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' }), // Mon 10/02
                date: dateStr, // Add date for PDF
                visits: dayVisits.length,
                amount: dayCollected
            });
        }

        const uniqueCustomersInRepDetail = new Set(repVisits.map(v => v.customerName).filter(Boolean));
        let repTotalCustomerDebt = 0;
        uniqueCustomersInRepDetail.forEach((c: any) => {
            repTotalCustomerDebt += (customerBalances[c] || 0);
        });

        return {
            name: selectedRep,
            totalVisits,
            totalCollected,
            collectedVisits,
            noCollectionVisits,
            avgPerDay,
            chartData,
            visits: sortedVisits,
            totalCustomerDebt: repTotalCustomerDebt
        };
    }, [selectedRep, filteredData, customerBalances]);

    const customerDetails = useMemo(() => {
        if (!selectedCustomer) return null;

        const customerVisits = data.filter(v => v.customerName === selectedCustomer);
        const sortedVisits = [...customerVisits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const totalVisits = customerVisits.length;
        const totalCollected = customerVisits.reduce((sum, v) => sum + (v.howMuchCollectMoney || 0), 0);
        const visitsWithCollection = customerVisits.filter(v => v.collectMoney === 'Yes').length;
        const lastVisit = sortedVisits.length > 0 ? sortedVisits[0].date : '---';
        const netOutstanding = customerBalances[selectedCustomer] || 0;

        // Aging Calculation
        const customerInvoices = allInvoices.filter(inv => inv.customerName === selectedCustomer);
        const aging = {
            atDate: 0,
            oneToThirty: 0,
            thirtyOneToSixty: 0,
            sixtyOneToNinety: 0,
            ninetyOneToOneTwenty: 0,
            older: 0
        };

        const matchingTotals = new Map<string, number>();
        const maxDebits = new Map<string, number>();
        const mainInvoiceIndices = new Map<string, number>();

        // Pass 1: Analyze Matchings
        customerInvoices.forEach((inv, idx) => {
            if (inv.matching) {
                const net = (inv.debit || 0) - (inv.credit || 0);
                matchingTotals.set(inv.matching, (matchingTotals.get(inv.matching) || 0) + net);

                const currentMax = maxDebits.get(inv.matching) ?? -1;
                if (inv.debit > currentMax) {
                    maxDebits.set(inv.matching, inv.debit);
                    mainInvoiceIndices.set(inv.matching, idx);
                } else if (!mainInvoiceIndices.has(inv.matching)) {
                    maxDebits.set(inv.matching, inv.debit);
                    mainInvoiceIndices.set(inv.matching, idx);
                }
            }
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Pass 2: Aging Calculation
        customerInvoices.forEach((inv, idx) => {
            let amountToAge = 0;
            let shouldAge = false;

            if (!inv.matching) {
                const net = (inv.debit || 0) - (inv.credit || 0);
                if (Math.abs(net) > 0.01) {
                    amountToAge = net;
                    shouldAge = true;
                }
            } else if (mainInvoiceIndices.get(inv.matching) === idx) {
                const residual = matchingTotals.get(inv.matching) || 0;
                if (Math.abs(residual) > 0.01) {
                    amountToAge = residual;
                    shouldAge = true;
                }
            }

            if (shouldAge) {
                const targetDate = parseInvoiceDate(inv.dueDate) || parseInvoiceDate(inv.date);
                if (targetDate && !isNaN(targetDate.getTime())) {
                    targetDate.setHours(0, 0, 0, 0);
                    const diffTime = today.getTime() - targetDate.getTime();
                    const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (daysOverdue <= 0) aging.atDate += amountToAge;
                    else if (daysOverdue <= 30) aging.oneToThirty += amountToAge;
                    else if (daysOverdue <= 60) aging.thirtyOneToSixty += amountToAge;
                    else if (daysOverdue <= 90) aging.sixtyOneToNinety += amountToAge;
                    else if (daysOverdue <= 120) aging.ninetyOneToOneTwenty += amountToAge;
                    else aging.older += amountToAge;
                }
            }
        });

        return {
            name: selectedCustomer,
            totalVisits,
            totalCollected,
            visitsWithCollection,
            lastVisit,
            netOutstanding,
            aging,
            visits: sortedVisits
        };
    }, [selectedCustomer, data, customerBalances, allInvoices]);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top Header - Sticky */}
            <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm no-print">
                <div className="max-w-[1600px] mx-auto px-4 h-20 flex items-center justify-between gap-8">
                    {/* Left: Brand & Back */}
                    <div className="flex items-center gap-6">
                        <button
                            onClick={handleBack}
                            className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                                <Users className="w-5 h-5 text-pink-600" />
                            </div>
                            <h1 className="text-xl font-black text-slate-900 hidden md:block">Visit Customers</h1>
                        </div>
                    </div>

                    {/* Center: Tabs */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-2xl w-full max-w-2xl">
                        {[
                            { id: 'registration', label: 'Registration', icon: PlusCircle },
                            { id: 'customer-reports', label: 'Customer Reports', icon: LayoutGrid },
                            { id: 'rep-reports', label: 'SalesRep Reports', icon: BarChart3 }
                        ].filter(tab => {
                            if (!currentUser || currentUser.name === 'MED Sabry') return true;
                            try {
                                const perms = JSON.parse(currentUser.role || '{}');
                                if (perms['visit-customers']) {
                                    return perms['visit-customers'].includes(tab.id);
                                }
                            } catch (e) { }
                            return true;
                        }).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id as any);
                                    setCustomerFilter('');
                                    setRepFilter('');
                                    setYearFilter('');
                                    setMonthFilter('');
                                    setFromDateFilter('');
                                    setToDateFilter('');
                                    setSelectedRep(null);
                                    setShowVisitedOnly(null);
                                    setCityFilter('');
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${activeTab === tab.id
                                    ? 'bg-white text-slate-900 shadow-md scale-105'
                                    : 'text-slate-500 hover:text-slate-900'
                                    }`}
                            >
                                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-pink-600' : ''}`} />
                                <span className="hidden sm:inline whitespace-nowrap">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Right: Spacer to keep tabs centered */}
                    <div className="hidden lg:block w-48"></div>
                </div>
            </header>

            {/* Sub-Header / Filters & Stats (Scrolling) */}
            {activeTab !== 'registration' && (
                <div className="bg-slate-50 border-b border-slate-200 py-2 animate-in slide-in-from-top-2 duration-300 no-print">
                    <div className="max-w-[1800px] mx-auto px-6 flex flex-wrap items-center justify-center gap-8">

                        {/* 1. View Mode Switcher (Tabs) */}
                        <div className="flex items-center bg-white p-1 rounded-xl shadow-sm border border-slate-100 min-w-[400px]">
                            <button
                                onClick={() => setViewMode('details')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode === 'details' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <BarChart3 className="w-3.5 h-3.5" />
                                Detailed Visits
                            </button>
                            <button
                                onClick={() => setViewMode('summary')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode === 'summary' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                Summary Numbers
                            </button>
                        </div>

                        <div className="w-px h-6 bg-slate-200 hidden md:block" />

                        {/* 2. Filters */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                                <Filter className="w-3.5 h-3.5" /> Filters:
                            </div>
                            {activeTab === 'customer-reports' && (
                                <SearchableSelect
                                    value={customerFilter}
                                    onChange={setCustomerFilter}
                                    options={customers}
                                    placeholder="All Customers"
                                    className="min-w-[280px]"
                                />
                            )}
                            {activeTab === 'rep-reports' && (
                                <SearchableSelect
                                    value={repFilter}
                                    onChange={setRepFilter}
                                    options={salesReps}
                                    placeholder="All Representatives"
                                    className="min-w-[280px]"
                                />
                            )}

                            {activeTab === 'customer-reports' && (
                                <div className="flex items-center gap-4 border-l border-slate-200 pl-4">
                                    <SearchableSelect
                                        value={cityFilter}
                                        onChange={setCityFilter}
                                        options={cities}
                                        placeholder="All Cities"
                                        className="min-w-[200px]"
                                    />

                                    <div className="flex bg-white rounded-xl p-1 border border-slate-100 shadow-sm">
                                        <button
                                            onClick={() => setShowVisitedOnly(null)}
                                            className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${showVisitedOnly === null ? 'bg-slate-900 text-white' : 'text-slate-400'}`}
                                        >
                                            All
                                        </button>
                                        <button
                                            onClick={() => setShowVisitedOnly(true)}
                                            className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${showVisitedOnly === true ? 'bg-slate-900 text-white' : 'text-slate-400'}`}
                                        >
                                            Visited
                                        </button>
                                        <button
                                            onClick={() => setShowVisitedOnly(false)}
                                            className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${showVisitedOnly === false ? 'bg-slate-900 text-white' : 'text-slate-400'}`}
                                        >
                                            Not Visited
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="w-px h-6 bg-slate-200 hidden md:block" />

                            <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Year</p>
                                    <input
                                        type="number"
                                        value={yearFilter}
                                        onChange={(e) => setYearFilter(e.target.value)}
                                        placeholder="YYYY"
                                        className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-slate-900 outline-none transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Month</p>
                                    <input
                                        type="number"
                                        value={monthFilter}
                                        onChange={(e) => setMonthFilter(e.target.value)}
                                        placeholder="MM"
                                        className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-slate-900 outline-none transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">From</p>
                                    <input
                                        type="text"
                                        value={fromDateFilter}
                                        onChange={(e) => setFromDateFilter(e.target.value)}
                                        placeholder="DD-MM-YYYY"
                                        className="w-32 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-slate-900 outline-none transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">To</p>
                                    <input
                                        type="text"
                                        value={toDateFilter}
                                        onChange={(e) => setToDateFilter(e.target.value)}
                                        placeholder="DD-MM-YYYY"
                                        className="w-32 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-slate-900 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="w-px h-6 bg-slate-200 hidden md:block" />

                        {/* 3. Stats */}
                        <div className="flex items-center gap-8 bg-white/50 px-6 py-1.5 rounded-2xl border border-slate-100">
                            <div className="text-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Visits</p>
                                <p className="text-lg font-black text-slate-900 leading-none">{stats.totalVisits}</p>
                            </div>
                            <div className="w-px h-6 bg-slate-200" />
                            <div className="text-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Collected</p>
                                <p className="text-lg font-black text-pink-600 leading-none">AED {stats.totalCollected.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="md:p-8 custom-scrollbar">
                <div className="max-w-[1800px] mx-auto space-y-8 pb-10">


                    {activeTab === 'registration' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-backwards">
                            <form onSubmit={handleSubmit} className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 space-y-6 overflow-hidden">
                                <div className="overflow-x-auto min-h-[400px]">
                                    <table className="w-full border-separate border-spacing-y-3">
                                        <thead>
                                            <tr className="text-slate-900 text-[11px] font-black uppercase tracking-wider border-b border-slate-100 text-center">
                                                <th className="px-4 pb-2 text-left">#</th>
                                                <th className="px-4 pb-2 w-48">Date</th>
                                                <th className="px-4 pb-2 w-48">Sales Rep</th>
                                                <th className="px-4 pb-2 w-64">Customer</th>
                                                <th className="px-4 pb-2 w-40">City</th>
                                                <th className="px-4 pb-2 w-32">Collect?</th>
                                                <th className="px-4 pb-2 w-40">Amount</th>
                                                <th className="px-4 pb-2">Notes</th>
                                                <th className="px-4 pb-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {entries.map((entry, idx) => (
                                                <tr key={idx} className="group animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                                    <td className="px-4 py-2 text-slate-400 text-xs font-black">{idx + 1}</td>
                                                    <td className="px-2">
                                                        <input
                                                            type="text"
                                                            value={entry.date}
                                                            placeholder="YYYY-MM-DD"
                                                            onChange={(e) => handleEntryChange(idx, 'date', e.target.value)}
                                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-2">
                                                        <SearchableSelect
                                                            value={entry.salesRepName}
                                                            onChange={(val) => handleEntryChange(idx, 'salesRepName', val)}
                                                            options={salesReps}
                                                            placeholder="Rep"
                                                        />
                                                    </td>
                                                    <td className="px-2">
                                                        <SearchableSelect
                                                            value={entry.customerName}
                                                            onChange={(val) => handleEntryChange(idx, 'customerName', val)}
                                                            options={customers}
                                                            placeholder="Customer"
                                                        />
                                                    </td>
                                                    <td className="px-2">
                                                        <SearchableSelect
                                                            value={entry.city}
                                                            onChange={(val) => handleEntryChange(idx, 'city', val)}
                                                            options={cities}
                                                            placeholder="City"
                                                        />
                                                    </td>
                                                    <td className="px-2">
                                                        <div className="flex bg-slate-50 rounded-xl p-1 gap-1">
                                                            {['Yes', 'No'].map(opt => (
                                                                <button
                                                                    key={opt}
                                                                    type="button"
                                                                    onClick={() => handleEntryChange(idx, 'collectMoney', opt)}
                                                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${entry.collectMoney === opt
                                                                        ? 'bg-slate-900 text-white shadow-md'
                                                                        : 'text-slate-400 hover:text-slate-600'
                                                                        }`}
                                                                >
                                                                    {opt}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-2">
                                                        <div className={`relative transition-all duration-300 ${entry.collectMoney === 'Yes' ? 'opacity-100 scale-100' : 'opacity-30 scale-95 pointer-events-none'}`}>
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">AED</span>
                                                            <input
                                                                type="number"
                                                                value={entry.howMuchCollectMoney}
                                                                placeholder="0.00"
                                                                onChange={(e) => handleEntryChange(idx, 'howMuchCollectMoney', e.target.value)}
                                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-2">
                                                        <input
                                                            type="text"
                                                            value={entry.notes}
                                                            placeholder="Notes..."
                                                            onChange={(e) => handleEntryChange(idx, 'notes', e.target.value)}
                                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRow(idx)}
                                                            disabled={entries.length === 1}
                                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-0"
                                                        >
                                                            <XCircle className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={addRow}
                                        className="flex items-center gap-3 px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all group"
                                    >
                                        <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                                        Add Another Visit
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`flex-1 md:flex-none md:min-w-[300px] py-4 rounded-2xl font-black text-lg transition-all shadow-xl shadow-slate-200 relative overflow-hidden ${loading
                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                            : 'bg-slate-900 text-white hover:bg-black hover:translate-y-[-2px]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center gap-3">
                                            {loading ? (
                                                <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="w-6 h-6" />
                                            )}
                                            <span>Save</span>
                                        </div>
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : selectedRep ? (
                        <SalesRepDetailView
                            details={repDetails}
                            period={
                                fromDateFilter && toDateFilter ? `${fromDateFilter} to ${toDateFilter}` :
                                    fromDateFilter ? `From ${fromDateFilter}` :
                                        toDateFilter ? `Until ${toDateFilter}` :
                                            yearFilter && monthFilter ? `${monthFilter}/${yearFilter}` :
                                                yearFilter ? yearFilter : "All Time"
                            }
                            onBack={() => setSelectedRep(null)}
                            showNotification={showNotification}
                            customerBalances={customerBalances}
                            setEditingVisit={setEditingVisit}
                            setIsEditPopupOpen={setIsEditPopupOpen}
                        />
                    ) : selectedCustomer ? (
                        <CustomerVisitDetailView
                            details={customerDetails}
                            onBack={() => setSelectedCustomer(null)}
                            setEditingVisit={setEditingVisit}
                            setIsEditPopupOpen={setIsEditPopupOpen}
                        />
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {/* Persistent Summary Filters Section */}
                            {viewMode === 'summary' && activeTab === 'customer-reports' && (
                                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 flex flex-wrap items-center justify-center gap-8">
                                    <div className="flex flex-col gap-2 min-w-[240px]">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                                            Debt Older Than (Days)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={debtDaysFilter}
                                                onChange={(e) => setDebtDaysFilter(e.target.value)}
                                                placeholder="e.g. 90"
                                                className="w-full pl-4 pr-12 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-black text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">DAYS</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 min-w-[240px]">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                                            <CircleDollarSign className="w-3.5 h-3.5 text-emerald-500" />
                                            Total Debit Greater Than
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={debtAmountFilter}
                                                onChange={(e) => setDebtAmountFilter(e.target.value)}
                                                placeholder="e.g. 5000"
                                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-black text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">AED</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 mt-6">
                                        {(debtDaysFilter || debtAmountFilter) && (
                                            <button
                                                onClick={() => { setDebtDaysFilter(''); setDebtAmountFilter(''); }}
                                                className="px-6 py-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-black hover:bg-rose-100 transition-all flex items-center gap-2"
                                            >
                                                <XCircle className="w-4 h-4" /> Reset
                                            </button>
                                        )}

                                        <button
                                            onClick={handleExportExcel}
                                            title="Export to Excel"
                                            className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center shadow-lg shadow-emerald-100 group"
                                        >
                                            <FileSpreadsheet className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {(viewMode === 'details' ? filteredData.length > 0 : summaryData.length > 0) ? (
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            {viewMode === 'details' ? (
                                                <table className="w-full text-center border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-900 text-white">
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-[150px]">Date</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-[250px]">Customer</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-[120px]">City</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-[200px]">Representative</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-[120px]">Collect?</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-[150px]">Amount</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-auto">Notes</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {filteredData.map((entry, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingVisit({ ...entry });
                                                                            setIsEditPopupOpen(true);
                                                                        }}
                                                                        className="text-sm font-black text-slate-900 hover:text-pink-600 transition-colors"
                                                                    >
                                                                        {entry.date}
                                                                    </button>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{entry.customerName}</span>
                                                                        {customerBalances[entry.customerName] !== undefined && (
                                                                            <span className={`text-xs font-black ${customerBalances[entry.customerName] > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                                                Balance: AED {customerBalances[entry.customerName].toLocaleString()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <span className="text-sm font-black text-slate-600">{entry.city || '---'}</span>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <span className="text-sm font-black text-slate-500">{entry.salesRepName}</span>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase ${entry.collectMoney === 'Yes'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : 'bg-slate-100 text-slate-500'
                                                                        }`}>
                                                                        {entry.collectMoney}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    {entry.howMuchCollectMoney > 0 ? (
                                                                        <span className="text-sm font-black text-pink-600">AED {entry.howMuchCollectMoney.toLocaleString()}</span>
                                                                    ) : (
                                                                        <span className="text-sm font-bold text-slate-300">---</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-5">
                                                                    <p className="text-sm font-bold text-slate-600 line-clamp-2 max-w-xs mx-auto">{entry.notes || '---'}</p>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <table className="w-full text-center border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-900 text-white">
                                                                <th className="px-4 py-5 text-xs font-black uppercase tracking-wider w-[60px]">#</th>
                                                                <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-[300px]">
                                                                    {activeTab === 'customer-reports' ? 'Customer Name' : 'Sales Representative'}
                                                                </th>
                                                                {activeTab === 'customer-reports' && (
                                                                    <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-[200px]">Total Debit</th>
                                                                )}
                                                                <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-[150px]">Total Visits</th>
                                                                <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-[200px]">Collections</th>
                                                                <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-[200px]">Total Amount</th>
                                                                <th className="px-6 py-5 text-xs font-black uppercase tracking-wider w-[200px]">Last Visit</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {summaryData.map((row: any, idx: number) => (
                                                                <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                                    <td className="px-4 py-5 whitespace-nowrap text-slate-400 text-xs font-black">{idx + 1}</td>
                                                                    <td className="px-6 py-5 whitespace-nowrap text-center">
                                                                        <div className="flex justify-center">
                                                                            {activeTab === 'rep-reports' ? (
                                                                                <button
                                                                                    onClick={() => setSelectedRep(row.name)}
                                                                                    className="text-sm font-black text-slate-900 hover:text-pink-600 transition-colors flex items-center justify-center gap-2 group/btn"
                                                                                >
                                                                                    {row.name}
                                                                                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all text-pink-500" />
                                                                                </button>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => setSelectedCustomer(row.name)}
                                                                                    className="text-sm font-black text-slate-900 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 group/btn"
                                                                                >
                                                                                    {row.name}
                                                                                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all text-blue-500" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    {activeTab === 'customer-reports' && (
                                                                        <td className="px-6 py-5 whitespace-nowrap text-center">
                                                                            <span className={`text-lg font-black ${row.totalCustomerDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                                                AED {row.totalCustomerDebt.toLocaleString()}
                                                                            </span>
                                                                        </td>
                                                                    )}
                                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <span className="text-lg font-black text-slate-900">{row.totalVisits}</span>
                                                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">visits</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                                        <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black ${row.visitsWithCollection > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                                                            {row.visitsWithCollection} / {row.totalVisits} Collected
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                                        <span className="text-lg font-black text-pink-600">AED {row.totalCollected.toLocaleString()}</span>
                                                                    </td>
                                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                                        <span className="text-sm font-bold text-slate-500">{row.lastVisit}</span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-[32px] p-20 flex flex-col items-center justify-center text-center shadow-sm border border-slate-100">
                                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                                        <Search className="w-12 h-12 text-slate-300" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">No Records Found</h3>
                                    <p className="text-slate-500 font-bold max-w-sm">No visits were found matching your current search or filters.</p>
                                    <button
                                        onClick={() => { setSearchQuery(''); setCustomerFilter(''); setRepFilter(''); }}
                                        className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all"
                                    >
                                        Clear All Filters
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>


            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                
                @media print {
                  .no-print { display: none !important; }
                  body { background: white !important; }
                }
            `}</style>

            {/* Visit Edit Popup */}
            {
                isEditPopupOpen && editingVisit && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 max-w-2xl w-full space-y-6 animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h3 className="text-xl font-black text-slate-900 leading-tight">Edit Visit Details</h3>
                                <button onClick={() => setIsEditPopupOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                                    <XCircle className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleUpdateVisit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Date</label>
                                        <input
                                            type="text"
                                            value={editingVisit.date}
                                            onChange={(e) => setEditingVisit({ ...editingVisit, date: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">City</label>
                                        <SearchableSelect
                                            value={editingVisit.city || ''}
                                            onChange={(val) => setEditingVisit({ ...editingVisit, city: val })}
                                            options={cities}
                                            placeholder="City"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Customer Name</label>
                                    <SearchableSelect
                                        value={editingVisit.customerName}
                                        onChange={(val) => setEditingVisit({ ...editingVisit, customerName: val })}
                                        options={customers}
                                        placeholder="Customer"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Sales Representative</label>
                                    <SearchableSelect
                                        value={editingVisit.salesRepName}
                                        onChange={(val) => setEditingVisit({ ...editingVisit, salesRepName: val })}
                                        options={salesReps}
                                        placeholder="Representative"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Collect Money?</label>
                                        <div className="flex bg-slate-50 rounded-xl p-1 gap-1">
                                            {['Yes', 'No'].map(opt => (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    onClick={() => setEditingVisit({ ...editingVisit, collectMoney: opt })}
                                                    className={`flex-1 py-3 rounded-lg text-xs font-black transition-all ${editingVisit.collectMoney === opt
                                                        ? 'bg-slate-900 text-white shadow-md'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                        }`}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Amount (AED)</label>
                                        <input
                                            type="number"
                                            value={editingVisit.howMuchCollectMoney}
                                            onChange={(e) => setEditingVisit({ ...editingVisit, howMuchCollectMoney: parseFloat(e.target.value) || 0 })}
                                            disabled={editingVisit.collectMoney === 'No'}
                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none disabled:opacity-30"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Notes</label>
                                    <textarea
                                        value={editingVisit.notes || ''}
                                        onChange={(e) => setEditingVisit({ ...editingVisit, notes: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none resize-none"
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditPopupOpen(false)}
                                        className="flex-1 py-4 rounded-2xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 py-4 rounded-2xl font-black text-white bg-slate-900 hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
                                    >
                                        {loading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Custom Premium Notification */}
            {
                notification && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
                            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${notification.type === 'error' ? 'bg-rose-50 text-rose-500' :
                                notification.type === 'success' ? 'bg-emerald-50 text-emerald-500' :
                                    'bg-blue-50 text-blue-500'
                                }`}>
                                {notification.type === 'error' && <AlertTriangle className="w-10 h-10" />}
                                {notification.type === 'success' && <CheckCircle2 className="w-10 h-10" />}
                                {notification.type === 'info' && <Info className="w-10 h-10" />}
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-slate-900 leading-tight">
                                    {notification.type === 'error' ? 'Something went wrong' :
                                        notification.type === 'success' ? 'Perfect!' : 'Notice'}
                                </h3>
                                <p className="text-slate-500 font-bold text-sm leading-relaxed">
                                    {notification.message}
                                </p>
                            </div>

                            <button
                                onClick={() => setNotification(null)}
                                className={`w-full py-4 rounded-2xl font-black text-white transition-all transform active:scale-95 shadow-lg ${notification.type === 'error' ? 'bg-rose-500 shadow-rose-200' :
                                    notification.type === 'success' ? 'bg-emerald-500 shadow-emerald-200' :
                                        'bg-slate-900 shadow-slate-200'
                                    }`}
                            >
                                Understood
                            </button>
                        </div>
                    </div>
                )
            }
        </div>
    );
}

function CustomerVisitDetailView({
    details,
    onBack,
    setEditingVisit,
    setIsEditPopupOpen
}: {
    details: any;
    onBack: () => void;
    setEditingVisit: (v: VisitCustomerEntry | null) => void;
    setIsEditPopupOpen: (o: boolean) => void;
}) {
    if (!details) return null;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <button
                        onClick={onBack}
                        className="w-fit flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-xl font-bold text-sm shadow-sm border border-slate-100 hover:text-slate-900 transition-all group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Summary
                    </button>
                    <div className="w-px h-8 bg-slate-200 hidden md:block" />
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-slate-900">Customer Analysis: <span className="text-blue-600">{details.name}</span></h2>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { label: 'Net Outstanding', value: `AED ${details.netOutstanding.toLocaleString()}`, icon: DollarSign, color: details.netOutstanding > 0 ? 'text-rose-600' : 'text-emerald-600', bg: details.netOutstanding > 0 ? 'bg-rose-50' : 'bg-emerald-50' },
                    { label: 'Total Visits', value: details.totalVisits, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'With Collection', value: details.visitsWithCollection, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Total Amount', value: `AED ${details.totalCollected.toLocaleString()}`, icon: Wallet, color: 'text-pink-600', bg: 'bg-pink-50' },
                    { label: 'Last Visit', value: details.lastVisit, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
                        <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                            <p className="text-xl font-black text-slate-900">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Aging Section */}
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-pink-100 rounded-2xl flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-pink-600" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900">Debt Aging Analysis</h3>
                            <p className="text-sm font-bold text-slate-400">Aging breakdown of outstanding balance</p>
                        </div>
                    </div>
                    <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Outstanding</p>
                        <p className="text-3xl font-black text-slate-900">AED {details.netOutstanding.toLocaleString()}</p>
                    </div>
                </div>

                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={[
                                { name: 'AT DATE', value: details.aging.atDate, color: '#10b981' },
                                { name: '1 - 30', value: details.aging.oneToThirty, color: '#64748b' },
                                { name: '31 - 60', value: details.aging.thirtyOneToSixty, color: '#64748b' },
                                { name: '61 - 90', value: details.aging.sixtyOneToNinety, color: '#f59e0b' },
                                { name: '91 - 120', value: details.aging.ninetyOneToOneTwenty, color: '#f59e0b' },
                                { name: 'OLDER', value: details.aging.older, color: '#ef4444' }
                            ]}
                            margin={{ top: 40, right: 30, left: 20, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 13, fontWeight: 900 }}
                                dy={10}
                            />
                            <YAxis hide />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: any) => [`AED ${value.toLocaleString()}`, 'Balance']}
                            />
                            <Bar
                                dataKey="value"
                                radius={[12, 12, 0, 0]}
                                barSize={80}
                                label={{
                                    position: 'top',
                                    formatter: (val: any) => val > 0 ? val.toLocaleString() : '',
                                    fontSize: 20,
                                    fontWeight: 900,
                                    fill: '#1e293b',
                                    offset: 15
                                }}
                            >
                                {[
                                    { color: '#10b981' },
                                    { color: '#94a3b8' },
                                    { color: '#64748b' },
                                    { color: '#f59e0b' },
                                    { color: '#f97316' },
                                    { color: '#ef4444' }
                                ].map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Visit History Section */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-900">Visits History</h3>
                </div>
                <div className="overflow-x-auto">
                    {details.visits.length > 0 ? (
                        <table className="w-full text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Date</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Collected?</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Amount</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Note</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {details.visits.map((v: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => {
                                                    setEditingVisit({ ...v });
                                                    setIsEditPopupOpen(true);
                                                }}
                                                className="text-sm font-black text-slate-900 hover:text-blue-600 transition-colors"
                                            >
                                                {v.date}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${v.collectMoney === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                                {v.collectMoney === 'Yes' ? 'Yes' : 'No'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-pink-600">
                                            {v.howMuchCollectMoney > 0 ? `AED ${v.howMuchCollectMoney.toLocaleString()}` : '---'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-slate-600 max-w-lg mx-auto">{v.notes || '---'}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-20 text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Info className="w-10 h-10 text-slate-300" />
                            </div>
                            <p className="text-lg font-black text-slate-400">No previous visits for this customer</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SalesRepDetailView({
    details,
    onBack,
    period,
    showNotification,
    customerBalances,
    setEditingVisit,
    setIsEditPopupOpen
}: {
    details: any;
    onBack: () => void;
    period: string;
    showNotification: (m: string, t?: any) => void;
    customerBalances: Record<string, number>;
    setEditingVisit: (v: VisitCustomerEntry | null) => void;
    setIsEditPopupOpen: (o: boolean) => void;
}) {
    const [subTab, setSubTab] = useState<'visits' | 'daily'>('visits');
    if (!details) return null;

    const dailySummary = useMemo(() => {
        const grouped = details.visits.reduce((acc: any, curr: any) => {
            const date = curr.date;
            if (!acc[date]) {
                acc[date] = {
                    date,
                    visitCount: 0,
                    uniqueCustomers: new Set(),
                    collectionCount: 0,
                    totalAmount: 0
                };
            }
            acc[date].visitCount += 1;
            acc[date].uniqueCustomers.add(curr.customerName);
            if (curr.collectMoney === 'Yes') acc[date].collectionCount += 1;
            acc[date].totalAmount += (curr.howMuchCollectMoney || 0);
            return acc;
        }, {});

        return Object.values(grouped).map((day: any) => {
            const [y, m, d] = day.date.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long' });
            return {
                ...day,
                dayName,
                customerCount: day.uniqueCustomers.size
            };
        }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [details.visits]);

    const handleDownloadPDF = async (details: any) => {
        try {
            const { generateSalesRepReportPDF } = await import('@/lib/PdfUtils');
            const pdfBlob = await generateSalesRepReportPDF({
                repName: details.name,
                period: period,
                totalVisits: details.totalVisits,
                totalCollected: details.totalCollected,
                collectedVisits: details.collectedVisits,
                noCollectionVisits: details.noCollectionVisits,
                avgPerDay: details.avgPerDay,
                chartData: details.chartData,
                visits: details.visits,
                customerBalances: customerBalances
            });

            const url = window.URL.createObjectURL(pdfBlob as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${details.name.replace(/\s+/g, '_')}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generating PDF:', error);
            showNotification('Failed to generate PDF report.', 'error');
        }
    };

    const handleDownloadExcel = (details: any) => {
        try {
            // Prepare data for Excel
            const excelData = details.visits.map((v: any) => ({
                'Date': v.date,
                'Customer Name': v.customerName,
                'City': v.city || '',
                'Collected?': v.collectMoney === 'Yes' ? 'Yes' : 'No',
                'Amount': v.howMuchCollectMoney > 0 ? v.howMuchCollectMoney : '',
                'Notes': v.notes || ''
            }));

            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            // Set column widths
            ws['!cols'] = [
                { wch: 12 },  // Date
                { wch: 35 },  // Customer Name
                { wch: 15 },  // City
                { wch: 12 },  // Collected?
                { wch: 12 },  // Amount
                { wch: 40 }   // Notes
            ];

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Visits');

            // Generate file and download
            XLSX.writeFile(wb, `${details.name.replace(/\s+/g, '_')}_Visits.xlsx`);
        } catch (error) {
            console.error('Error generating Excel:', error);
            alert('Failed to generate Excel report.');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <button
                        onClick={onBack}
                        className="w-fit flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-xl font-bold text-sm shadow-sm border border-slate-100 hover:text-slate-900 transition-all group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Summary
                    </button>
                    <div className="w-px h-8 bg-slate-200 hidden md:block" />
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-slate-900">SalesRep Stats: <span className="text-pink-600">{details.name}</span></h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleDownloadPDF(details)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-red-600 transition-all"
                    >
                        <FileDown className="w-4 h-4" />
                        PDF Report
                    </button>
                    <button
                        onClick={() => handleDownloadExcel(details)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-green-700 transition-all"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Excel Report
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                    { label: 'Unique Customers', value: new Set(details.visits.map((v: any) => v.customerName)).size, icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
                    { label: 'Total Visits', value: details.totalVisits, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'With Collection', value: details.collectedVisits, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'No Collection', value: details.noCollectionVisits, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-50' },
                    { label: 'Total Amount', value: `AED ${details.totalCollected.toLocaleString()}`, icon: Wallet, color: 'text-pink-600', bg: 'bg-pink-50' },
                    { label: 'Avg Visits/Day', value: details.avgPerDay, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
                        <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm min-h-[400px]">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-900">Last 7 Days Trend</h3>
                            <p className="text-sm font-bold text-slate-400">Visits and collection amounts</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full" />
                                <span className="text-xs font-black text-slate-500 uppercase">Amount</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-slate-900 rounded-full" />
                                <span className="text-xs font-black text-slate-500 uppercase">Visits</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={details.chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 13, fontWeight: 900 }}
                                    dy={10}
                                />
                                <YAxis yAxisId="amount" hide domain={[0, (dataMax: number) => dataMax]} />
                                <YAxis yAxisId="visits" hide domain={[0, (dataMax: number) => dataMax * 2]} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                    itemStyle={{ fontSize: '14px', fontWeight: '900' }}
                                />
                                <Bar
                                    dataKey="amount"
                                    fill="#ef4444"
                                    radius={[4, 4, 0, 0]}
                                    name="Collection (AED)"
                                    minPointSize={5}
                                    yAxisId="amount"
                                    label={{ position: 'top', fontSize: 14, fontWeight: 900, fill: '#ef4444', formatter: (val: any) => val > 0 ? val.toLocaleString() : '' }}
                                />
                                <Bar
                                    dataKey="visits"
                                    fill="#0f172a"
                                    radius={[4, 4, 0, 0]}
                                    name="Visits Count"
                                    minPointSize={10}
                                    yAxisId="visits"
                                    label={{ position: 'top', fontSize: 14, fontWeight: 900, fill: '#0f172a', formatter: (val: any) => val > 0 ? val : '' }}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-900 p-8 rounded-[32px] text-white flex flex-col justify-between overflow-hidden relative">
                    <div className="relative z-10">
                        <TrendingUp className="w-12 h-12 text-pink-500 mb-6" />
                        <h3 className="text-2xl font-black mb-2">Collection Rate</h3>
                        <p className="text-slate-400 font-bold mb-8">Performance based on total visits and collections.</p>

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm font-black uppercase text-slate-500">Efficiency</span>
                                    <span className="text-2xl font-black text-white">{((details.collectedVisits / (details.totalVisits || 1)) * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-pink-500 transition-all duration-1000"
                                        style={{ width: `${(details.collectedVisits / (details.totalVisits || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl" />
                </div>
            </div>

            {/* Detailed Table Section */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900">Visits History</h3>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setSubTab('visits')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${subTab === 'visits' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Detailed Visits
                        </button>
                        <button
                            onClick={() => setSubTab('daily')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${subTab === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Daily History
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    {subTab === 'visits' ? (
                        <table className="w-full text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Date</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Customer</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">City</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Status</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Amount</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {details.visits.map((v: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => {
                                                    setEditingVisit({ ...v });
                                                    setIsEditPopupOpen(true);
                                                }}
                                                className="text-sm font-black text-slate-900 hover:text-pink-600 transition-colors"
                                            >
                                                {v.date}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm font-black text-slate-900">{v.customerName}</span>
                                                {customerBalances[v.customerName] !== undefined && (
                                                    <span className={`text-xs font-black ${customerBalances[v.customerName] > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                        Balance: AED {customerBalances[v.customerName].toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-500">{v.city || '---'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${v.collectMoney === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                                {v.collectMoney === 'Yes' ? 'Collected' : 'No Collection'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-pink-600">
                                            {v.howMuchCollectMoney > 0 ? `AED ${v.howMuchCollectMoney.toLocaleString()}` : '---'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-slate-700 max-w-xs mx-auto">{v.notes || '---'}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Date</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Day</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Visits</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Unique Customers</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Collections</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Total Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {dailySummary.map((day: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-900">{day.date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-500">{day.dayName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-900">{day.visitCount}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-900">{day.customerCount}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-green-50 text-green-600">
                                                {day.collectionCount} Collections
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-pink-600">
                                            AED {day.totalAmount.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
