'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Package,
    CheckCircle2,
    Clock,
    AlertTriangle,
    RefreshCcw,
    Plus,
    Search,
    Bell,
    Edit2,
    Eye,
    Trash2,
    X,
    XCircle,
    TrendingUp,
    LayoutGrid,
    FileText,
    Truck,
    BarChart3,
    ChevronLeft,
    ArrowRight,
    Filter,
    Download,
    ShieldCheck,
    SearchCode,
    Activity,
    History,
    Upload,
    Users
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface DeliveryEntry {
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
    status: 'delivered' | 'pending' | 'partial' | 'canceled';
    missing: string[];
    shippedItems?: string[];
    canceledItems?: string[];
    reship: boolean;
    notes: string;
    createdAt?: string;
    updatedAt?: string;
}

const STATUS_CONFIG = {
    delivered: { label: 'Delivered', color: 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]/10', dot: 'bg-[#6366F1]', icon: '✅' },
    pending: { label: 'Pending', color: 'bg-[#FEF6E8] text-[#9B6000] border-[#F5A623]/10', dot: 'bg-[#F5A623]', icon: '⏳' },
    partial: { label: 'Partial', color: 'bg-[#FEF0E7] text-[#7D4000] border-[#E67E22]/10', dot: 'bg-[#E67E22]', icon: '⚠️' },
    canceled: { label: 'Canceled', color: 'bg-[#FEF2F2] text-[#EF4444] border-[#EF4444]/10', dot: 'bg-[#EF4444]', icon: '❌' },
};

export default function DeliveryTrackingTab() {
    const [activeTab, setActiveTab] = useState('stats');
    const [statsSubTab, setStatsSubTab] = useState<'kpis' | 'daily' | 'customers' | 'cities' | 'products'>('kpis');

    const formatStat = (val: number, prefix: string = '') => {
        if (val === 0) return '-';
        return `${prefix}${val.toLocaleString()}`;
    };
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<DeliveryEntry | null>(null);
    const [missingItemInput, setMissingItemInput] = useState('');
    const [showMissingPopup, setShowMissingPopup] = useState(false);
    const [popupItems, setPopupItems] = useState<{ name: string, type: 'missing' | 'shipped' | 'canceled' }[]>([]);
    const [isReshipPopupOpen, setIsReshipPopupOpen] = useState(false);
    const [selectedReshipOrder, setSelectedReshipOrder] = useState<DeliveryEntry | null>(null);
    const [reshipAmounts, setReshipAmounts] = useState<{ [key: number]: string }>({});
    const [shippingIdx, setShippingIdx] = useState<number | null>(null);
    const [customers, setCustomers] = useState<{ customerId: string, customerName: string, customerCity: string }[]>([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [checkingSearchQuery, setCheckingSearchQuery] = useState('');
    const [checkingSubmittedQuery, setCheckingSubmittedQuery] = useState('');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // New LPO Form State (Multiple Rows)
    const [lpoRows, setLpoRows] = useState([{
        lpoNumber: '',
        lpoDate: new Date().toISOString().split('T')[0],
        lpoDeliveryDate: '',
        customerName: '',
        customerId: '',
        lpoValue: '',
        customerSearch: '',
        showDropdown: false
    }]);

    // Loading / saving states
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Date filters for All Orders tab
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterCity, setFilterCity] = useState('');

    // ── User Action Permissions ─────────────────────────────
    const deliveryActions: string[] = useMemo(() => {
        try {
            const saved = localStorage.getItem('currentUser');
            if (!saved) return [];
            const user = JSON.parse(saved);

            // Normalize name and role for comparison
            const userName = user.name?.toLowerCase() || '';
            const userRole = user.role || '';

            // FULL ACCESS for MED Sabry or Admin role
            if (userRole === 'Admin' || userName === 'med sabry') {
                return ['add', 'edit', 'delete', 'download', 'reship'];
            }

            // Attempt to parse JSON role
            let perms: any = {};
            try {
                perms = JSON.parse(userRole);
            } catch (e) {
                // Not JSON, return empty actions
                return [];
            }

            return perms['delivery-tracking-actions'] || [];
        } catch { return []; }
    }, [isLoading]); // Added isLoading as a dependency to re-check after data fetches if needed, but primarily to fix the empty array issue if it was a mounting race.
    // ────────────────────────────────────────────────────────
    const canAdd = deliveryActions.includes('add');
    const canEdit = deliveryActions.includes('edit');
    const canDelete = deliveryActions.includes('delete');
    const canDownload = deliveryActions.includes('download');
    const canReship = deliveryActions.includes('reship');
    // ────────────────────────────────────────────────────────

    // --- NOTIFICATION & CONFIRMATION SYSTEM ---
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'danger' | 'warning' | 'info' | 'success';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => { }
    });

    const [toast, setToast] = useState<{
        show: boolean;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({ show: false, message: '', type: 'info' });

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const triggerConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' | 'success' = 'danger') => {
        setConfirmConfig({ isOpen: true, title, message, onConfirm, type });
    };
    // ------------------------------------------

    const openEditModal = (order: DeliveryEntry) => {
        setEditingOrder({
            ...order,
            invoiceDate: order.invoiceDate || '',
            invoiceNumber: order.invoiceNumber || '',
            invoiceVal: order.invoiceVal ?? 0,
            missing: order.missing || [],
            notes: order.notes || '',
            reship: order.reship ?? true,
            status: order.status || 'pending'
        });
        setIsEditModalOpen(true);
    };

    const addMissingItem = () => {
        if (!missingItemInput.trim() || !editingOrder) return;
        setEditingOrder({
            ...editingOrder,
            missing: [...editingOrder.missing, missingItemInput.trim()]
        });
        setMissingItemInput('');
    };

    const removeMissingItem = (idx: number) => {
        if (!editingOrder) return;
        setEditingOrder({
            ...editingOrder,
            missing: editingOrder.missing.filter((_, i) => i !== idx)
        });
    };

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const bstr = event.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                if (data.length === 0) {
                    showToast('Excel file is empty', 'error');
                    return;
                }

                setIsSaving(true);
                showToast(`Reading ${data.length} records...`, 'info');

                const lposToAdd: any[] = [];

                for (const row of data) {
                    // Normalize keys (handle spaces or casing)
                    const lpoNumber = row['LPO Number'] || row['lpo number'] || row['LPO_Number'];
                    const lpoDateRaw = row['LPO Date'] || row['lpo date'] || row['LPO_Date'];
                    const customerName = row['Customer Name'] || row['customer name'] || row['Customer_Name'];
                    const lpoValue = row['LPO Value'] || row['lpo value'] || row['LPO_Value'];

                    if (lpoNumber && lpoDateRaw && customerName && lpoValue) {
                        const lpoDate = typeof lpoDateRaw === 'string' ? lpoDateRaw : new Date((lpoDateRaw - 25569) * 86400 * 1000).toISOString().split('T')[0];
                        // Look up the customerId from the loaded customers list
                        const matchedCustomer = customers.find(c =>
                            c.customerName.toLowerCase().trim() === customerName.toString().toLowerCase().trim()
                        );
                        lposToAdd.push({
                            lpoNumber: lpoNumber.toString(),
                            lpoDate,
                            customerName: matchedCustomer ? matchedCustomer.customerId : customerName.toString(),
                            lpoValue: parseFloat(lpoValue)
                        });
                    }
                }

                if (lposToAdd.length === 0) {
                    showToast('No valid LPO records found in Excel', 'error');
                    return;
                }

                const res = await fetch('/api/delivery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'add_lpo',
                        lpos: lposToAdd
                    })
                });

                if (res.ok) {
                    await refreshOrders();
                    showToast(`Successfully uploaded ${lposToAdd.length} records`, 'success');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    setActiveTab('stats');
                } else {
                    showToast('Failed to upload records to database', 'error');
                }

            } catch (error) {
                console.error('Excel parse error:', error);
                showToast('Failed to parse Excel file', 'error');
            } finally {
                setIsSaving(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSaveOrder = async () => {
        if (!editingOrder) return;

        // ── Validation ──────────────────────────────────────
        // 1. The three required invoice fields
        if (editingOrder.status !== 'canceled') {
            if (!editingOrder.invoiceDate) {
                showToast('Please enter the Invoice Date', 'error');
                return;
            }
            if (!editingOrder.invoiceNumber || !editingOrder.invoiceNumber.trim()) {
                showToast('Please enter the Invoice Number', 'error');
                return;
            }
            if (!editingOrder.invoiceNumber.toUpperCase().startsWith('SAL')) {
                showToast('Invoice Number must start with SAL', 'error');
                return;
            }
            if (!editingOrder.invoiceVal || editingOrder.invoiceVal <= 0) {
                showToast('Please enter a valid Invoice Value', 'error');
                return;
            }
            if (editingOrder.status === 'partial' && editingOrder.missing.length === 0) {
                showToast('Please add missing products for Partial Delivery', 'error');
                return;
            }

            // 2. If there are missing items → reship choice + notes required
            if (editingOrder.missing.length > 0) {
                if (!editingOrder.notes || !editingOrder.notes.trim()) {
                    showToast('Please add a Note for the missing items', 'error');
                    return;
                }
            }
        } else {
            // If canceled, a note is mandatory
            if (!editingOrder.notes || !editingOrder.notes.trim()) {
                showToast('Please add a Note for the canceled LPO', 'error');
                return;
            }
            // Ensure no incorrect invoice validation disrupts cancellation save
            editingOrder.invoiceVal = editingOrder.invoiceVal || 0;
            editingOrder.invoiceNumber = editingOrder.invoiceNumber || '';
            editingOrder.invoiceDate = editingOrder.invoiceDate || '';
        }
        // ────────────────────────────────────────────────────

        setIsSaving(true);
        try {
            const rowIndex = (editingOrder as any)._rowIndex;
            // If LPO value is 0, update it to match Invoice value
            const finalLpoVal = editingOrder.lpoVal === 0 ? editingOrder.invoiceVal : editingOrder.lpoVal;

            // 1) Update the LPO record fields in LPO Records sheet
            await fetch('/api/delivery', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex,
                    invoiceDate: editingOrder.invoiceDate,
                    invoiceNumber: editingOrder.invoiceNumber,
                    invoiceValue: editingOrder.invoiceVal,
                    lpoValue: finalLpoVal,
                    status: editingOrder.status,
                    reship: editingOrder.reship,
                    notes: editingOrder.notes,
                }),
            });

            // 2) Log any NEW missing items to LPO Items Logs
            const originalOrder = orders.find(o => o.id === editingOrder.id);
            const originalMissing = originalOrder?.missing || [];
            const newMissingItems = editingOrder.missing.filter(
                item => !originalMissing.includes(item)
            );

            if (newMissingItems.length > 0) {
                await Promise.all(newMissingItems.map(item =>
                    fetch('/api/delivery', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'add_item',
                            lpoId: editingOrder.lpoId,
                            itemName: item,
                            status: editingOrder.reship ? 'missing' : 'canceled',
                            shipmentValue: 0,
                        }),
                    })
                ));
            }

            // 3) If reship = false → cancel all still-missing items in the sheet
            if (!editingOrder.reship && originalMissing.length > 0) {
                await Promise.all(originalMissing.map(item =>
                    fetch('/api/delivery', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'cancel_item',
                            lpoId: editingOrder.lpoId,
                            itemName: item,
                            shipmentValue: 0,
                        }),
                    }).catch(() => {/* ignore if item was already updated */ })
                ));
            }

            // 4) Update local state — if reship=false, move all current missing items → canceledItems
            const finalOrder = !editingOrder.reship
                ? {
                    ...editingOrder,
                    lpoVal: finalLpoVal,
                    missing: [],
                    canceledItems: [...new Set([
                        ...(editingOrder.canceledItems || []),
                        ...originalMissing,
                        ...editingOrder.missing
                    ])],
                }
                : { ...editingOrder, lpoVal: finalLpoVal };

            setOrders(prev => prev.map(o => o.id === editingOrder.id ? finalOrder : o));
            setIsEditModalOpen(false);
            showToast('Saved to Sheets successfully', 'success');
        } catch {
            showToast('Failed to save changes', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const openReshipPopup = (order: DeliveryEntry) => {
        setSelectedReshipOrder({ ...order });
        setIsReshipPopupOpen(true);
    };

    // ── CSV Export helpers ────────────────────────────────────
    const downloadCSV = (filename: string, rows: string[][]) => {
        const csv = rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportOrdersCSV = () => {
        const header = ['LPO ID', 'LPO Number', 'LPO Date', 'Delivery Date', 'Customer Name', 'LPO Value', 'Invoice Date', 'Invoice Number', 'Invoice Value', 'Difference', 'Status', 'Missing Items', 'Re-ship?', 'Notes'];
        const rows: string[][] = filteredOrders.map(o => {
            const diff = o.invoiceVal > 0 ? o.invoiceVal - o.lpoVal : 0;
            return [
                o.lpoId, o.lpo, o.date, o.deliveryDate || '', o.customer,
                String(o.lpoVal), o.invoiceDate || '', o.invoiceNumber || '', o.invoiceVal > 0 ? String(o.invoiceVal) : '',
                o.invoiceVal > 0 ? String(diff) : '',
                o.status, o.missing.join(' | '), o.reship ? 'YES' : 'NO', o.notes || ''
            ];
        });
        downloadCSV(`LPO_Orders_${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
        showToast(`Exported ${filteredOrders.length} records`, 'success');
    };

    const exportMissingItemsCSV = () => {
        const header = ['LPO ID', 'LPO Number', 'Date', 'Customer', 'Item Name', 'Status'];
        const rows: string[][] = orders.flatMap(o => [
            ...o.missing.map(m => [o.lpoId, o.lpo, o.date, o.customer, m, 'Pending Re-ship']),
            ...(o.canceledItems || []).map(m => [o.lpoId, o.lpo, o.date, o.customer, m, 'Canceled']),
        ]);
        downloadCSV(`Missing_Items_${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
        showToast(`Exported ${rows.length} item records`, 'success');
    };

    const exportCustomerStatsExcel = () => {
        const data = customerStats.map((c: any) => ({
            'Customer Name': c.name,
            'Total Orders': c.total,
            'Delivered': c.delivered,
            'Partial': c.partial,
            'Pending': c.pending,
            'Canceled Orders': c.canceledOrders,
            'Pending Items': c.missingCount,
            'Reshipped Items': c.reshippedCount,
            'Canceled Items': c.canceledCount
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Customer Stats');
        XLSX.writeFile(wb, `Customer_Stats_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Customer stats exported successfully', 'success');
    };

    const exportProductStatsExcel = () => {
        const data = productStats.map((p: any) => ({
            'Product Name': p.name,
            'Pending Re-ship': p.pending,
            'Total Shipped': p.shipped,
            'Total Canceled': p.canceled,
            'Total Operation Logs': (p.pending || 0) + (p.shipped || 0) + (p.canceled || 0)
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Product Stats');
        XLSX.writeFile(wb, `Product_Stats_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Product stats exported successfully', 'success');
    };

    const exportCityStatsExcel = () => {
        const data = cityStats.map((c: any) => ({
            'City Name': c.name,
            'LPO Value': c.lpoValue,
            'Invoice Value': c.invoiceValue,
            'Difference': c.invoiceValue - c.lpoValue,
            'Orders': c.orders,
            'Delivered': c.delivered,
            'Partial': c.partial,
            'Pending': c.pending,
            'Canceled': c.canceled
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'City Stats');
        XLSX.writeFile(wb, `City_Stats_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('City stats exported successfully', 'success');
    };

    const handleStatsExport = () => {
        if (statsSubTab === 'cities') exportCityStatsExcel();
        else if (statsSubTab === 'customers') exportCustomerStatsExcel();
        else if (statsSubTab === 'products') exportProductStatsExcel();
        else if (statsSubTab === 'kpis') {
            showToast('KPIs export not implemented yet', 'info');
        }
    };
    // ─────────────────────────────────────────────────────────

    const handleReshipItem = async (orderId: string, itemIdx: number, action: 'ship' | 'cancel', amount: number = 0) => {
        const o = orders.find(ord => ord.id === orderId);
        if (!o) return;

        const item = o.missing[itemIdx];
        const newMissing = o.missing.filter((_, i) => i !== itemIdx);
        const isFinished = newMissing.length === 0;

        const shippedItems = [...(o.shippedItems || [])];
        const canceledItems = [...(o.canceledItems || [])];

        if (action === 'ship') shippedItems.push(item);
        else canceledItems.push(item);

        const newInvoiceVal = o.invoiceVal + amount;

        let finalStatus = o.status;
        if (isFinished) {
            if (newInvoiceVal > 0) {
                finalStatus = 'delivered';
            } else {
                finalStatus = 'pending';
            }
        }

        const updatedOrder: DeliveryEntry = {
            ...o,
            invoiceVal: newInvoiceVal,
            missing: newMissing,
            shippedItems,
            canceledItems,
            reship: !isFinished,
            status: finalStatus
        };

        try {
            // 1) Update Main Record in Sheets
            const rowIndex = (o as any)._rowIndex;
            await fetch('/api/delivery', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex,
                    invoiceValue: newInvoiceVal,
                    status: finalStatus,
                    reship: !isFinished
                })
            });

            // 2) Log Item Action in Sheets
            await fetch('/api/delivery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: action === 'ship' ? 'ship_item' : 'cancel_item',
                    lpoId: o.lpoId,
                    itemName: item,
                    status: action === 'ship' ? 'shipped' : 'canceled',
                    shipmentValue: amount
                })
            });

            // Update local state
            setOrders(prev => prev.map(ord => ord.id === orderId ? updatedOrder : ord));

            if (selectedReshipOrder && selectedReshipOrder.id === orderId) {
                if (isFinished) {
                    setIsReshipPopupOpen(false);
                    setSelectedReshipOrder(null);
                } else {
                    setSelectedReshipOrder(updatedOrder);
                }
            }
        } catch (error) {
            console.error('Failed to update Reshipment:', error);
            showToast('Failed to save changes to Sheets', 'error');
        }
    };

    // Font imports via style tag to ensure they match mockup exactly
    const fontStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
    .font-inter { font-family: 'Inter', sans-serif; }
    .font-mono-dm { font-family: 'DM Mono', monospace; }
  `;

    const [orders, setOrders] = useState<DeliveryEntry[]>([]);

    const customerToCity = useMemo(() => {
        const map: Record<string, string> = {};
        if (customers) {
            customers.forEach(c => {
                if (c && c.customerName) {
                    map[c.customerName] = c.customerCity || 'Unknown';
                }
            });
        }
        return map;
    }, [customers]);

    const uniqueCities = useMemo(() => {
        const cities = new Set<string>();
        customers.forEach(c => {
            if (c.customerCity) cities.add(c.customerCity);
        });
        return Array.from(cities).sort();
    }, [customers]);

    const filteredOrders = useMemo(() => {
        if (!orders) return [];
        return orders
            .filter(o => {
                const lpo = o.lpo || '';
                const lpoId = o.lpoId || '';
                const invoiceNumber = o.invoiceNumber || '';
                const customer = o.customer || '';

                // Text search
                const matchesSearch = lpo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    lpoId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    customer.toLowerCase().includes(searchQuery.toLowerCase());

                // Status filter - normalize status for filtering
                const normalizedStatus = (o.status || 'pending').toLowerCase();
                const matchesFilter = filterStatus === 'all' || normalizedStatus === filterStatus;

                // Date filters (applied to LPO date)
                const oDateStr = o.date || '';
                const oDate = oDateStr ? new Date(oDateStr) : null;
                const matchesYear = !filterYear || (oDate && !isNaN(oDate.getTime()) && oDate.getFullYear().toString() === filterYear);
                const matchesMonth = !filterMonth || (oDate && !isNaN(oDate.getTime()) && (oDate.getMonth() + 1).toString().padStart(2, '0') === filterMonth);
                const matchesFrom = !filterDateFrom || (oDateStr && oDateStr >= filterDateFrom);
                const matchesTo = !filterDateTo || (oDateStr && oDateStr <= filterDateTo);

                // City filter
                const orderCity = customerToCity[customer] || 'Unknown';
                const matchesCity = !filterCity || orderCity === filterCity;

                return matchesSearch && matchesFilter && matchesYear && matchesMonth && matchesFrom && matchesTo && matchesCity;
            })
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, [orders, searchQuery, filterStatus, filterYear, filterMonth, filterDateFrom, filterDateTo, filterCity, customerToCity]);

    const stats = useMemo(() => {
        const total = filteredOrders.length;
        const delivered = filteredOrders.filter(o => o.status === 'delivered').length;
        const pending = filteredOrders.filter(o => o.status === 'pending').length;
        const reship = filteredOrders.filter(o => o.reship).length;
        const missingCount = filteredOrders.reduce((acc, o) => acc + o.missing.length, 0);
        const discCount = filteredOrders.filter(o => o.invoiceVal > 0 && o.invoiceVal !== o.lpoVal).length;
        const partial = filteredOrders.filter(o => o.status === 'partial').length;
        const canceledOrders = filteredOrders.filter(o => o.status === 'canceled').length;

        let favor = 0, against = 0;
        let favorCount = 0, againstCount = 0;

        let deliveredLPO = 0, deliveredInvoice = 0;
        let partialLPO = 0, partialInvoice = 0;
        let pendingLPO = 0, pendingInvoice = 0;
        let canceledLPO = 0, canceledInvoice = 0;

        let totalLPO = 0, totalInvoice = 0;

        filteredOrders.forEach(o => {
            totalLPO += (o.lpoVal || 0);
            totalInvoice += (o.invoiceVal || 0);

            // Finance diff
            if (o.status !== 'pending' || o.invoiceVal > 0) {
                const diff = (o.invoiceVal || 0) - (o.lpoVal || 0);
                if (diff < 0) {
                    favor += Math.abs(diff);
                    favorCount++;
                } else if (diff > 0) {
                    against += diff;
                    againstCount++;
                }
            }

            // Category Totals
            if (o.status === 'delivered') {
                deliveredLPO += (o.lpoVal || 0);
                deliveredInvoice += (o.invoiceVal || 0);
            } else if (o.status === 'partial') {
                partialLPO += (o.lpoVal || 0);
                partialInvoice += (o.invoiceVal || 0);
            } else if (o.status === 'pending') {
                pendingLPO += (o.lpoVal || 0);
                pendingInvoice += (o.invoiceVal || 0);
            } else if (o.status === 'canceled') {
                canceledLPO += (o.lpoVal || 0);
                canceledInvoice += (o.invoiceVal || 0);
            }
        });

        const shippedCount = filteredOrders.reduce((acc, o) => acc + (o.shippedItems?.length || 0), 0);
        const canceledCount = filteredOrders.reduce((acc, o) => acc + (o.canceledItems?.length || 0), 0);

        const totalTracked = missingCount + canceledCount;

        return {
            total, delivered, pending, reship, missingCount, discCount, partial, canceledOrders,
            favor, against, favorCount, againstCount, net: against - favor,
            shippedCount, canceledCount, totalTracked,
            deliveredLPO, deliveredInvoice,
            partialLPO, partialInvoice,
            pendingLPO, pendingInvoice,
            canceledLPO, canceledInvoice,
            totalLPO, totalInvoice
        };
    }, [filteredOrders]);


    const cityStats = useMemo(() => {
        const grouped = filteredOrders.reduce((acc: any, o) => {
            const city = customerToCity[o.customer] || 'Unknown';
            if (!acc[city]) {
                acc[city] = {
                    name: city,
                    lpoValue: 0,
                    invoiceValue: 0,
                    orders: 0,
                    delivered: 0,
                    partial: 0,
                    pending: 0,
                    canceled: 0,
                    favs: 0,
                    against: 0
                };
            }
            const c = acc[city];
            c.lpoValue += (o.lpoVal || 0);
            c.invoiceValue += (o.invoiceVal || 0);
            c.orders += 1;
            if (o.status === 'delivered') c.delivered += 1;
            if (o.status === 'partial') c.partial += 1;
            if (o.status === 'pending') c.pending += 1;
            if (o.status === 'canceled') c.canceled += 1;

            return acc;
        }, {});
        return Object.values(grouped).sort((a: any, b: any) => b.lpoValue - a.lpoValue);
    }, [filteredOrders, customerToCity]);

    const dailyStats = useMemo(() => {
        const grouped = filteredOrders.reduce((acc: any, o) => {
            const date = o.date || 'No Date';
            if (!acc[date]) {
                acc[date] = {
                    date,
                    lpoValue: 0,
                    invoiceValue: 0,
                    orders: 0,
                    delivered: 0,
                    partial: 0,
                    pending: 0,
                    canceled: 0
                };
            }
            const d = acc[date];
            d.lpoValue += (o.lpoVal || 0);
            d.invoiceValue += (o.invoiceVal || 0);
            d.orders += 1;
            if (o.status === 'delivered') d.delivered += 1;
            else if (o.status === 'partial') d.partial += 1;
            else if (o.status === 'pending') d.pending += 1;
            else if (o.status === 'canceled') d.canceled += 1;

            return acc;
        }, {});
        return Object.values(grouped).sort((a: any, b: any) => b.date.localeCompare(a.date));
    }, [filteredOrders]);

    const dailyTotals = useMemo(() => {
        return (dailyStats as any[]).reduce((acc: any, d: any) => ({
            lpoValue: acc.lpoValue + (d.lpoValue || 0),
            invoiceValue: acc.invoiceValue + (d.invoiceValue || 0),
            orders: acc.orders + (d.orders || 0),
            delivered: acc.delivered + (d.delivered || 0),
            partial: acc.partial + (d.partial || 0),
            canceled: acc.canceled + (d.canceled || 0),
            pending: acc.pending + (d.pending || 0),
        }), { lpoValue: 0, invoiceValue: 0, orders: 0, delivered: 0, partial: 0, canceled: 0, pending: 0 });
    }, [dailyStats]);

    const customerStats = useMemo(() => {
        const grouped = filteredOrders.reduce((acc: any, o) => {
            if (!acc[o.customer]) {
                acc[o.customer] = {
                    name: o.customer,
                    total: 0,
                    delivered: 0,
                    partial: 0,
                    pending: 0,
                    canceledOrders: 0,
                    missingCount: 0,
                    reshippedCount: 0,
                    canceledCount: 0
                };
            }
            const c = acc[o.customer];
            c.total += 1;
            if (o.status === 'delivered') c.delivered += 1;
            if (o.status === 'partial') c.partial += 1;
            if (o.status === 'pending') c.pending += 1;
            if (o.status === 'canceled') c.canceledOrders += 1;
            c.missingCount += (o.missing?.length || 0);
            c.reshippedCount += (o.shippedItems?.length || 0);
            c.canceledCount += (o.canceledItems?.length || 0);
            return acc;
        }, {});
        return Object.values(grouped).sort((a: any, b: any) => b.total - a.total);
    }, [filteredOrders]);

    const productStats = useMemo(() => {
        const products: any = {};
        filteredOrders.forEach(o => {
            o.missing?.forEach(item => {
                if (!products[item]) products[item] = { name: item, pending: 0, canceled: 0, shipped: 0 };
                products[item].pending += 1;
            });
            o.shippedItems?.forEach(item => {
                if (!products[item]) products[item] = { name: item, pending: 0, canceled: 0, shipped: 0 };
                products[item].shipped += 1;
            });
            o.canceledItems?.forEach(item => {
                if (!products[item]) products[item] = { name: item, pending: 0, canceled: 0, shipped: 0 };
                products[item].canceled += 1;
            });
        });
        return Object.values(products).sort((a: any, b: any) =>
            (a.name || '').localeCompare(b.name || '')
        );
    }, [filteredOrders]);

    const cityTotals = useMemo(() => {
        return (cityStats as any[]).reduce((acc: any, c: any) => ({
            lpoValue: (acc.lpoValue || 0) + (c.lpoValue || 0),
            invoiceValue: (acc.invoiceValue || 0) + (c.invoiceValue || 0),
            orders: (acc.orders || 0) + (c.orders || 0),
            delivered: (acc.delivered || 0) + (c.delivered || 0),
            partial: (acc.partial || 0) + (c.partial || 0),
            pending: (acc.pending || 0) + (c.pending || 0),
            canceled: (acc.canceled || 0) + (c.canceled || 0),
        }), { lpoValue: 0, invoiceValue: 0, orders: 0, delivered: 0, partial: 0, pending: 0, canceled: 0 });
    }, [cityStats]);

    const customerTotals = useMemo(() => {
        return (customerStats as any[]).reduce((acc: any, c: any) => ({
            total: (acc.total || 0) + (c.total || 0),
            delivered: (acc.delivered || 0) + (c.delivered || 0),
            partial: (acc.partial || 0) + (c.partial || 0),
            pending: (acc.pending || 0) + (c.pending || 0),
            canceledOrders: (acc.canceledOrders || 0) + (c.canceledOrders || 0),
            withCancel: (acc.withCancel || 0) + (c.withCancel || 0),
            missingCount: (acc.missingCount || 0) + (c.missingCount || 0),
            reshippedCount: (acc.reshippedCount || 0) + (c.reshippedCount || 0),
            canceledCount: (acc.canceledCount || 0) + (c.canceledCount || 0),
        }), {
            total: 0, delivered: 0, partial: 0, pending: 0, canceledOrders: 0, withCancel: 0,
            missingCount: 0, reshippedCount: 0, canceledCount: 0
        });
    }, [customerStats]);

    const productTotals = useMemo(() => {
        return (productStats as any[]).reduce((acc: any, p: any) => ({
            pending: acc.pending + p.pending,
            shipped: acc.shipped + p.shipped,
            canceled: acc.canceled + p.canceled,
            totalLogs: acc.totalLogs + (p.pending + p.shipped + p.canceled)
        }), { pending: 0, shipped: 0, canceled: 0, totalLogs: 0 });
    }, [productStats]);

    // Fetch from Google Sheets on mount
    useEffect(() => {
        setIsLoading(true);
        fetch('/api/delivery')
            .then(res => res.json())
            .then(data => {
                if (data.orders) {
                    const normalized = data.orders.map((o: any) => ({
                        ...o,
                        lpo: o.lpo || '',
                        lpoId: o.lpoId || '',
                        customer: o.customer || '',
                        date: o.date || '',
                        status: (o.status || 'pending').toLowerCase(),
                        missing: Array.isArray(o.missing) ? o.missing : [],
                        shippedItems: Array.isArray(o.shippedItems) ? o.shippedItems : [],
                        canceledItems: Array.isArray(o.canceledItems) ? o.canceledItems : [],
                        lpoVal: Number(o.lpoVal) || 0,
                        invoiceVal: Number(o.invoiceVal) || 0,
                    }));
                    setOrders(normalized);
                }
                if (data.customers) {
                    const normalizedCustomers = data.customers.map((c: any) => ({
                        ...c,
                        customerId: c.customerId || '',
                        customerName: c.customerName || '',
                        customerCity: c.customerCity || 'Unknown'
                    }));
                    setCustomers(normalizedCustomers);
                }
            })
            .catch(err => {
                console.error('Failed to fetch orders:', err);
                showToast('Failed to load data from Sheets', 'error');
            })
            .finally(() => setIsLoading(false));
    }, []);

    const refreshOrders = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/delivery');
            const data = await res.json();
            if (data.orders) {
                const normalized = data.orders.map((o: any) => ({
                    ...o,
                    lpo: o.lpo || '',
                    lpoId: o.lpoId || '',
                    customer: o.customer || '',
                    date: o.date || '',
                    status: (o.status || 'pending').toLowerCase(),
                    missing: Array.isArray(o.missing) ? o.missing : [],
                    shippedItems: Array.isArray(o.shippedItems) ? o.shippedItems : [],
                    canceledItems: Array.isArray(o.canceledItems) ? o.canceledItems : [],
                    lpoVal: Number(o.lpoVal) || 0,
                    invoiceVal: Number(o.invoiceVal) || 0,
                }));
                setOrders(normalized);
            }
            if (data.customers) {
                const normalizedCustomers = data.customers.map((c: any) => ({
                    ...c,
                    customerId: c.customerId || '',
                    customerName: c.customerName || '',
                    customerCity: c.customerCity || 'Unknown'
                }));
                setCustomers(normalizedCustomers);
            }
        } catch {
            showToast('Failed to refresh data', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredCustomers = useMemo(() => {
        const q = (customerSearch || '').toLowerCase().trim();
        if (!q) return customers || [];
        if (!customers) return [];
        return customers.filter(c => {
            const name = c.customerName || '';
            const id = c.customerId || '';
            return name.toLowerCase().includes(q) || id.toLowerCase().includes(q);
        });
    }, [customers, customerSearch]);

    const deleteOrder = (id: string) => {
        const target = orders.find(o => o.id === id);
        if (!target) return;
        triggerConfirm(
            'Delete LPO Record',
            'Are you sure you want to permanently delete this LPO? This action cannot be undone.',
            async () => {
                try {
                    const rowIndex = (target as any)._rowIndex;
                    await fetch('/api/delivery', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rowIndex }),
                    });
                    setOrders(prev => prev.filter(o => o.id !== id));
                    showToast('LPO record deleted successfully', 'info');
                } catch {
                    showToast('Failed to delete record', 'error');
                }
            },
            'danger'
        );
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-inter text-[#0F172A]">
            <style dangerouslySetInnerHTML={{ __html: fontStyles }} />

            {/* HEADER */}
            <header className="bg-[#312E81] text-white sticky top-0 z-50 shadow-[0_4px_25px_rgba(49,46,129,0.25)]">
                <div className={`${activeTab === 'orders' ? 'max-w-[1850px]' : 'max-w-[1600px]'} mx-auto px-8 h-[64px] flex items-center relative border-b border-white/10 transition-all duration-500`}>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.history.back()}
                            className="w-[36px] h-[36px] rounded-[10px] bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-all hover:-translate-x-0.5"
                            title="Back"
                        >
                            <ArrowRight className="w-4 h-4 text-white rotate-180" />
                        </button>
                        <div className="w-[40px] h-[40px] bg-[#4F46E5] rounded-[12px] flex items-center justify-center text-[20px] shadow-[0_4px_15px_rgba(79,70,229,0.5)] border border-white/20">
                            🚚
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-[17px] font-[900] tracking-tight leading-none">Delivery Tracking</span>
                                <button
                                    onClick={refreshOrders}
                                    disabled={isLoading}
                                    className={`p-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/10 transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'}`}
                                    title="Refresh Data"
                                >
                                    <RefreshCcw className={`w-3.5 h-3.5 text-white ${isLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
                        <div className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-[14px] px-5 py-2.5 focus-within:bg-white/20 focus-within:border-white/30 focus-within:ring-2 focus-within:ring-white/10 transition-all w-[450px] shadow-inner">
                            <Search className="w-4 h-4 text-white/40" />
                            <input
                                type="text"
                                placeholder="Search by LPO, customer..."
                                className="bg-transparent border-none text-white text-[14px] w-full outline-none placeholder:text-white/30 font-medium"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* TAB NAVIGATION */}
                <div className={`${activeTab === 'orders' ? 'max-w-[1850px]' : 'max-w-[1600px]'} mx-auto px-8 h-[48px] flex items-end justify-center gap-4 transition-all duration-500`}>
                    {[
                        ...(canAdd ? [{ id: 'new_order', label: 'New LPO', icon: Plus }] : []),
                        { id: 'stats', label: 'Statistics', icon: BarChart3 },
                        { id: 'checking', label: 'Checking', icon: ShieldCheck },
                        { id: 'orders', label: 'All Orders', count: stats.total },
                        { id: 'reship', label: 'Re-Shipments', count: stats.reship },
                        { id: 'missing_items', label: 'Missing Items', count: stats.totalTracked, isAlert: stats.missingCount > 0 },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                relative h-full px-6 flex items-center justify-center gap-2.5 text-[14px] transition-all
                ${activeTab === tab.id
                                    ? 'text-white font-[800]'
                                    : 'text-white/50 font-[600] hover:text-white/80'
                                }
              `}
                        >
                            {tab.icon && <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-indigo-300' : ''}`} />}
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={`
                  px-2 py-0.5 rounded-lg text-[10px] font-bold min-w-[20px] text-center
                  ${tab.isAlert ? 'bg-rose-500 text-white shadow-[0_4px_10px_rgba(244,63,94,0.4)]' : (activeTab === tab.id ? 'bg-[#4F46E5] text-white shadow-lg' : 'bg-white/10 text-white/60')}
                `}>
                                    {tab.count}
                                </span>
                            )}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-white rounded-t-full shadow-[0_-2px_10px_rgba(255,255,255,0.5)]"></div>
                            )}
                        </button>
                    ))}
                </div>
            </header>

            <div className={`${activeTab === 'orders' ? 'max-w-[1850px]' : 'max-w-[1600px]'} mx-auto p-8 transition-all duration-500`}>
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-700">
                        <div className="relative flex flex-col items-center gap-6">
                            <div className="relative w-20 h-20">
                                {/* Spinner Track */}
                                <div className="absolute inset-0 border-[3px] border-indigo-100 rounded-full" />
                                {/* Active Spinner */}
                                <div className="absolute inset-0 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(79,70,229,0.4)]" />
                                {/* Center Icon */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-12">
                                        <div className="animate-bounce">🚚</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-2">
                                <h3 className="text-[18px] font-[900] text-indigo-950 tracking-tight">Syncing Database</h3>
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" />
                                    </div>
                                    <p className="text-[14px] font-[700] text-indigo-600/70 uppercase tracking-[0.2em] ml-2">Loading Data</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {!isLoading && activeTab === 'new_order' && canAdd && (

                    <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="bg-white rounded-[24px] border-[1.5px] border-[#E2E8F0] shadow-[0_10px_40px_rgba(0,0,0,0.04)] relative">
                            <div className="p-8 bg-[#312E81] flex items-center justify-between rounded-t-[22px]">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-[24px]">📦</div>
                                    <div>
                                        <h3 className="text-white text-[20px] font-[900] tracking-tight">Record New LPOs</h3>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            const lastDate = lpoRows[lpoRows.length - 1]?.lpoDate || new Date().toISOString().split('T')[0];
                                            setLpoRows(prev => [...prev, {
                                                lpoNumber: '',
                                                lpoDate: lastDate,
                                                lpoDeliveryDate: '',
                                                customerName: '',
                                                customerId: '',
                                                lpoValue: '',
                                                customerSearch: '',
                                                showDropdown: false
                                            }]);
                                        }}
                                        className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl border border-white/20 text-[13px] font-bold flex items-center gap-2 transition-all"
                                    >
                                        <Plus className="w-4 h-4" /> Add Row
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 min-h-[300px]">
                                <div className="space-y-4">
                                    {lpoRows.map((row, idx) => (
                                        <div key={idx} className="flex items-start gap-4 p-5 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] group animate-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                            <div className="flex-none pt-2 font-black text-indigo-300 text-[16px] w-6">#{idx + 1}</div>

                                            {/* LPO Date */}
                                            <div className="w-[180px]">
                                                <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-1.5 block">LPO Date <span className="text-rose-500">*</span></label>
                                                <input
                                                    type="date"
                                                    value={row.lpoDate}
                                                    onChange={(e) => {
                                                        const newRows = [...lpoRows];
                                                        newRows[idx].lpoDate = e.target.value;
                                                        setLpoRows(newRows);
                                                    }}
                                                    className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-[14px] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                                                />
                                            </div>

                                            {/* LPO Delivery Date */}
                                            <div className="w-[180px]">
                                                <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-1.5 block">Delivery Date</label>
                                                <input
                                                    type="date"
                                                    value={row.lpoDeliveryDate}
                                                    onChange={(e) => {
                                                        const newRows = [...lpoRows];
                                                        newRows[idx].lpoDeliveryDate = e.target.value;
                                                        setLpoRows(newRows);
                                                    }}
                                                    className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-[14px] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold appearance-none"
                                                />
                                            </div>

                                            {/* LPO Number */}
                                            <div className="flex-1 min-w-[180px]">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider block">LPO Number <span className="text-rose-500">*</span></label>
                                                    <button
                                                        onClick={() => {
                                                            const newRows = [...lpoRows];
                                                            newRows[idx].lpoNumber = 'No Number';
                                                            setLpoRows(newRows);
                                                        }}
                                                        className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-tighter bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                                                    >
                                                        No Number
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. LPO-2025-01"
                                                    value={row.lpoNumber}
                                                    onChange={(e) => {
                                                        const newRows = [...lpoRows];
                                                        newRows[idx].lpoNumber = e.target.value;
                                                        setLpoRows(newRows);
                                                    }}
                                                    className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-[14px] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                                                />
                                            </div>

                                            {/* Customer Name */}
                                            <div className="flex-[2] min-w-[280px] relative">
                                                <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-1.5 block">Customer Name <span className="text-rose-500">*</span></label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Search Customer..."
                                                        value={row.customerName || row.customerSearch}
                                                        onChange={(e) => {
                                                            const newRows = [...lpoRows];
                                                            newRows[idx].customerSearch = e.target.value;
                                                            newRows[idx].showDropdown = true;
                                                            newRows[idx].customerName = '';
                                                            setLpoRows(newRows);
                                                        }}
                                                        onFocus={() => {
                                                            const newRows = [...lpoRows];
                                                            newRows[idx].showDropdown = true;
                                                            setLpoRows(newRows);
                                                        }}
                                                        className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 pr-10 text-[14px] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                                                    />
                                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                                                    {row.showDropdown && (
                                                        <>
                                                            <div className="fixed inset-0 z-10" onClick={() => {
                                                                const newRows = [...lpoRows];
                                                                newRows[idx].showDropdown = false;
                                                                setLpoRows(newRows);
                                                            }} />
                                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-[250px] overflow-y-auto p-1.5">
                                                                {customers
                                                                    .filter(c => c.customerName.toLowerCase().includes(row.customerSearch.toLowerCase()))
                                                                    .map((c, ci) => (
                                                                        <button
                                                                            key={`${ci}-${c.customerId}`}
                                                                            onClick={() => {
                                                                                const newRows = [...lpoRows];
                                                                                newRows[idx].customerName = c.customerName;
                                                                                newRows[idx].customerId = c.customerId;
                                                                                newRows[idx].customerSearch = '';
                                                                                newRows[idx].showDropdown = false;
                                                                                setLpoRows(newRows);
                                                                            }}
                                                                            className="w-full text-left p-3 hover:bg-indigo-50 rounded-lg transition-colors group/item"
                                                                        >
                                                                            <span className="text-[13px] font-bold text-slate-700 group-hover/item:text-indigo-600">{c.customerName}</span>
                                                                        </button>
                                                                    ))
                                                                }
                                                                {customers.filter(c => c.customerName.toLowerCase().includes(row.customerSearch.toLowerCase())).length === 0 && (
                                                                    <div className="p-4 text-center text-slate-400 text-[12px] italic">No results</div>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* LPO Value */}
                                            <div className="w-[160px]">
                                                <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-1.5 block">LPO Value <span className="text-rose-500">*</span></label>
                                                <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={row.lpoValue}
                                                    onChange={(e) => {
                                                        const newRows = [...lpoRows];
                                                        newRows[idx].lpoValue = e.target.value;
                                                        setLpoRows(newRows);
                                                    }}
                                                    className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-[14px] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-mono-dm font-bold"
                                                />
                                            </div>

                                            {/* Actions */}
                                            <div className="flex-none pt-7">
                                                <button
                                                    onClick={() => {
                                                        if (lpoRows.length === 1) return;
                                                        setLpoRows(prev => prev.filter((_, i) => i !== idx));
                                                    }}
                                                    disabled={lpoRows.length === 1}
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-0"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-between rounded-b-[22px]">
                                <div className="flex items-center gap-4">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleExcelUpload}
                                        accept=".xlsx, .xls"
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isSaving}
                                        className="bg-white text-indigo-900 border border-slate-200 font-bold h-[52px] px-8 rounded-xl text-[14px] flex items-center gap-2 transition-all hover:bg-slate-100 disabled:opacity-50"
                                    >
                                        <Upload className="w-4 h-4" /> Import Excel
                                    </button>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={async () => {
                                            const incompleteIdx = lpoRows.findIndex(r => !r.lpoNumber || !r.lpoDate || !r.customerName || !r.lpoValue);

                                            if (incompleteIdx !== -1) {
                                                showToast(`Please fill all required fields in Row #${incompleteIdx + 1}`, 'error');
                                                return;
                                            }

                                            setIsSaving(true);
                                            try {
                                                const res = await fetch('/api/delivery', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        action: 'add_lpo',
                                                        lpos: lpoRows.map(r => ({
                                                            lpoNumber: r.lpoNumber,
                                                            lpoDate: r.lpoDate,
                                                            lpoDeliveryDate: r.lpoDeliveryDate,
                                                            customerName: r.customerId || r.customerName,
                                                            lpoValue: parseFloat(r.lpoValue),
                                                        }))
                                                    }),
                                                });

                                                if (!res.ok) {
                                                    const errorData = await res.json();
                                                    throw new Error(errorData.error || 'Failed to save');
                                                }

                                                await refreshOrders();
                                                const rowCount = lpoRows.length;
                                                setLpoRows([{
                                                    lpoNumber: '',
                                                    lpoDate: new Date().toISOString().split('T')[0],
                                                    lpoDeliveryDate: '',
                                                    customerName: '',
                                                    customerId: '',
                                                    lpoValue: '',
                                                    customerSearch: '',
                                                    showDropdown: false
                                                }]);
                                                setActiveTab('stats');
                                                showToast(`${rowCount} LPO(s) recorded successfully`, 'success');
                                            } catch (error: any) {
                                                console.error('Save error:', error);
                                                showToast(error.message || 'Failed to save LPOs', 'error');
                                            } finally {
                                                setIsSaving(false);
                                            }
                                        }}
                                        disabled={isSaving}
                                        className="bg-indigo-600 text-white font-black h-[52px] min-w-[220px] px-8 rounded-xl text-[15px] flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                                    >
                                        {isSaving ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-5 h-5" />
                                                <span>Save Records</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!isLoading && activeTab === 'stats' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 text-center">
                        {/* GLOBAL DATE FILTER BAR */}
                        <div className="flex flex-wrap items-center justify-center gap-3 mb-[24px] bg-white border-[1.5px] border-[#E4EDE8] rounded-[20px] px-8 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] w-fit mx-auto relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#4F46E5]" />
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-[900] text-indigo-600 uppercase tracking-[0.2em] whitespace-nowrap">📅 Statistics Scope</span>
                                <div className="w-px h-6 bg-slate-200" />
                            </div>

                            {/* City Filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-[800] text-slate-500 uppercase tracking-wider">City</span>
                                <select
                                    value={filterCity}
                                    onChange={e => setFilterCity(e.target.value)}
                                    className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[10px] px-3 py-2 text-[13px] font-[700] text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all w-[240px] appearance-none cursor-pointer"
                                >
                                    <option value="">All Cities</option>
                                    {uniqueCities.map(city => (
                                        <option key={city} value={city}>{city}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-px h-6 bg-slate-200" />

                            {/* Year */}
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-[800] text-slate-500 uppercase tracking-wider">Year</span>
                                <input
                                    type="text"
                                    placeholder="2025"
                                    value={filterYear}
                                    onChange={e => setFilterYear(e.target.value)}
                                    maxLength={4}
                                    className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[10px] px-3 py-2 text-[13px] font-[700] text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all w-[85px] text-center"
                                />
                            </div>

                            {/* Month */}
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-[800] text-slate-500 uppercase tracking-wider">Month</span>
                                <input
                                    type="text"
                                    placeholder="MM"
                                    value={filterMonth}
                                    onChange={e => setFilterMonth(e.target.value)}
                                    maxLength={2}
                                    className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[10px] px-3 py-2 text-[13px] font-[700] text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all w-[75px] text-center"
                                />
                            </div>

                            <div className="w-px h-6 bg-slate-200" />

                            {/* From */}
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-[800] text-slate-500 uppercase tracking-wider">From</span>
                                <input
                                    type="date"
                                    value={filterDateFrom}
                                    onChange={e => setFilterDateFrom(e.target.value)}
                                    className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[10px] px-4 py-2 text-[13px] font-[700] text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all w-[160px] cursor-pointer"
                                />
                            </div>

                            {/* To */}
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-[800] text-slate-500 uppercase tracking-wider">To</span>
                                <input
                                    type="date"
                                    value={filterDateTo}
                                    onChange={e => setFilterDateTo(e.target.value)}
                                    className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[10px] px-4 py-2 text-[13px] font-[700] text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all w-[160px] cursor-pointer"
                                />
                            </div>

                            {/* Clear */}
                            {(filterYear || filterMonth || filterDateFrom || filterDateTo || filterCity) && (
                                <>
                                    <div className="w-px h-6 bg-slate-200" />
                                    <button
                                        onClick={() => { setFilterYear(''); setFilterMonth(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterCity(''); }}
                                        className="text-[11px] font-[900] text-red-500 hover:text-red-600 flex items-center gap-1.5 transition-all active:scale-95 bg-red-50 px-3 py-2 rounded-lg"
                                    >
                                        <X className="w-3.5 h-3.5" /> RESET
                                    </button>
                                </>
                            )}
                        </div>

                        {/* STATS SUB-NAV */}
                        <div className="flex items-center gap-4 mb-8 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-fit mx-auto relative group/nav">
                            <div className="flex items-center gap-1">
                                {[
                                    { id: 'kpis', label: 'General KPIs', icon: Activity },
                                    { id: 'daily', label: 'Daily Stats', icon: History },
                                    { id: 'cities', label: 'City Stats', icon: LayoutGrid },
                                    { id: 'customers', label: 'Customer Stats', icon: Users },
                                    { id: 'products', label: 'Product Stats', icon: Package },
                                ].map((sub) => (
                                    <button
                                        key={sub.id}
                                        onClick={() => setStatsSubTab(sub.id as any)}
                                        className={`
                                            flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-[800] transition-all w-[180px]
                                            ${statsSubTab === sub.id
                                                ? 'bg-indigo-600 text-white shadow-lg scale-105'
                                                : 'text-slate-500 hover:bg-slate-50'
                                            }
                                        `}
                                    >
                                        <sub.icon className="w-4 h-4" />
                                        {sub.label}
                                    </button>
                                ))}
                            </div>

                            {statsSubTab !== 'kpis' && (
                                <>
                                    <div className="w-px h-8 bg-slate-200 mx-1" />
                                    <button
                                        onClick={handleStatsExport}
                                        title="Export Excel"
                                        className="bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white w-10 h-10 rounded-xl border border-emerald-600/20 flex items-center justify-center transition-all group/btn"
                                    >
                                        <Download className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                    </button>
                                </>
                            )}
                        </div>

                        {statsSubTab === 'kpis' && (
                            <>

                                {/* KPI GRID */}
                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-[14px] mb-[26px]">
                                    {[
                                        { label: 'Total Orders', value: stats.total, trend: `${stats.total} orders`, colorClass: 'green', icon: '📦' },
                                        { label: 'Delivered', value: stats.delivered, trend: `${Math.round(stats.delivered / stats.total * 100)}%`, colorClass: 'blue', icon: '✅' },
                                        { label: 'Partial', value: stats.partial, trend: `${Math.round(stats.partial / stats.total * 100)}%`, colorClass: 'orange', icon: '⚠️' },
                                        { label: 'Canceled Orders', value: stats.canceledOrders, trend: `${Math.round(stats.canceledOrders / stats.total * 100)}%`, colorClass: 'red', icon: '❌' },
                                        { label: 'Pending', value: stats.pending, trend: `${Math.round(stats.pending / stats.total * 100)}%`, colorClass: 'gold', icon: '⏳' },
                                        { label: 'Pending Re-ship', value: stats.reship, trend: `${stats.reship} customers`, colorClass: 'orange', icon: '🔄' },
                                        { label: 'Items Re-Shipped', value: stats.shippedCount, trend: `Success`, colorClass: 'green', icon: '🚚' },
                                        { label: 'Items Canceled', value: stats.canceledCount, trend: `Final`, colorClass: 'red', icon: '🚫' },
                                    ].map((kpi, i) => (
                                        <div key={i} className={`
                  bg-white rounded-[14px] p-[18px_20px] shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-[1.5px] border-[#E4EDE8]
                  flex flex-col gap-[10px] relative overflow-hidden transition-all hover:translate-y-[-2px] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]
                  kpi-${kpi.colorClass}
                `}>
                                            <div className={`absolute top-0 left-0 right-0 h-[3px] 
                    ${kpi.colorClass === 'green' ? 'bg-[#2DBE6C]' :
                                                    kpi.colorClass === 'blue' ? 'bg-[#2980B9]' :
                                                        kpi.colorClass === 'gold' ? 'bg-[#F5A623]' :
                                                            kpi.colorClass === 'red' ? 'bg-[#E74C3C]' : 'bg-[#E67E22]'}
                  `} />
                                            <div className="flex items-center justify-between">
                                                <div className={`w-[36px] h-[36px] rounded-[9px] flex items-center justify-center text-[18px]
                      ${kpi.colorClass === 'green' ? 'bg-[#E8F7EF]' :
                                                        kpi.colorClass === 'blue' ? 'bg-[#EBF5FB]' :
                                                            kpi.colorClass === 'gold' ? 'bg-[#FEF6E8]' :
                                                                kpi.colorClass === 'red' ? 'bg-[#FDEDEC]' : 'bg-[#FEF0E7]'}
                    `}>{kpi.icon}</div>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[6px]
                      ${kpi.colorClass === 'green' ? 'bg-[#E8F7EF] text-[#1A8A47]' :
                                                        kpi.colorClass === 'blue' ? 'bg-[#EBF5FB] text-[#2980B9]' :
                                                            kpi.colorClass === 'gold' ? 'bg-[#FEF6E8] text-[#9B6000]' :
                                                                kpi.colorClass === 'red' ? 'bg-[#FDEDEC] text-[#E74C3C]' : 'bg-[#FEF0E7] text-[#E67E22]'}
                    `}>{kpi.trend}</span>
                                            </div>
                                            <div>
                                                <div className="text-[28px] font-[900] tracking-[-1px] leading-none mb-1">{kpi.value}</div>
                                                <div className="text-[11px] text-[#5A7266] font-[500]">{kpi.label}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* BOTTOM SECTION */}
                                <div className="space-y-[24px] mb-[24px]">
                                    {/* Order Status Breakdown - FULL WIDTH */}
                                    <div className="bg-white rounded-[16px] border-[1.5px] border-[#E4EDE8] shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-8">
                                        <div className="flex items-center gap-3 text-[18px] font-[900] text-[#0F1A14] mb-8">
                                            <div className="w-[44px] h-[44px] bg-[#E8F7EF] rounded-[12px] flex items-center justify-center text-[22px] text-[#1A8A47] shadow-sm">📊</div>
                                            Order Status Breakdown
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            {[
                                                { label: 'Delivered', count: stats.delivered, lpo: stats.deliveredLPO, invoice: stats.deliveredInvoice, color: '#2DBE6C', icon: '✅' },
                                                { label: 'Partial', count: stats.partial, lpo: stats.partialLPO, invoice: stats.partialInvoice, color: '#E67E22', icon: '⚠️' },
                                                { label: 'Pending', count: stats.pending, lpo: stats.pendingLPO, invoice: stats.pendingInvoice, color: '#F5A623', icon: '⏳' },
                                                { label: 'Canceled', count: stats.canceledOrders, lpo: stats.canceledLPO, invoice: stats.canceledInvoice, color: '#E74C3C', icon: '❌' },
                                            ].map((s, i) => {
                                                const pct = stats.total > 0 ? Math.round(s.count / stats.total * 100) : 0;
                                                return (
                                                    <div key={i} className="bg-[#F8FAFC] rounded-[22px] p-6 border border-slate-100 flex flex-col gap-6 hover:shadow-md transition-all group hover:-translate-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[20px] shadow-sm">{s.icon}</div>
                                                                <div className="text-[13px] font-[900] text-[#5A7266] uppercase tracking-wider">{s.label}</div>
                                                            </div>
                                                            <div className="text-[17px] font-[950] font-mono-dm text-[#0F1A14] bg-white px-3 py-1 rounded-xl shadow-sm border border-slate-100">
                                                                {pct}%
                                                            </div>
                                                        </div>

                                                        <div className="flex items-baseline gap-2">
                                                            <div className="text-[42px] font-[950] tracking-tighter leading-none" style={{ color: s.color }}>
                                                                {s.count}
                                                            </div>
                                                            <div className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Orders</div>
                                                        </div>

                                                        <div className="space-y-4">
                                                            <div className="w-full h-[10px] bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                                                <div
                                                                    className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                                                                    style={{ width: `${pct}%`, backgroundColor: s.color }}
                                                                />
                                                            </div>

                                                            <div className="grid grid-cols-1 gap-3 pt-2">
                                                                <div className="flex items-center justify-between bg-white/60 p-3 rounded-xl border border-slate-100">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">LPO Value</span>
                                                                    </div>
                                                                    <span className="text-[13px] font-[900] text-slate-700">AED {s.lpo.toLocaleString()}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/50">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">Invoice Value</span>
                                                                    </div>
                                                                    <span className="text-[13px] font-[900] text-indigo-600">AED {s.invoice.toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Financial Summary - FULL WIDTH */}
                                    <div className="bg-white rounded-[16px] border-[1.5px] border-[#E4EDE8] shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-8">
                                        <div className="flex items-center gap-3 text-[18px] font-[800] text-[#0F1A14] mb-[24px]">
                                            <div className="w-[40px] h-[40px] bg-[#EBF5FB] rounded-[10px] flex items-center justify-center text-[20px] text-[#2980B9] shadow-sm">💰</div>
                                            Financial Summary
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-[24px]">
                                            <div className="bg-[#F8FAFC] rounded-[18px] p-[24px_20px] text-center border border-slate-200 shadow-[0_8px_20px_rgba(0,0,0,0.02)] transition-transform hover:scale-[1.02]">
                                                <div className="text-[11px] text-[#64748B] font-black uppercase mb-[10px] tracking-[0.1em]">Total LPO Value</div>
                                                <div className="text-[12px] text-[#475569] font-bold mb-[12px] bg-white/60 rounded-full py-1 px-3 inline-block shadow-sm">All selected orders</div>
                                                <div className="text-[32px] font-[950] font-mono-dm text-[#0F172A] tracking-tighter leading-none mb-2">{stats.totalLPO.toLocaleString()}</div>
                                                <div className="text-[14px] font-[800] text-[#64748B] bg-white/80 border border-slate-100 rounded-lg py-1 px-3 inline-block">AED</div>
                                            </div>
                                            <div className="bg-[#F5F3FF] rounded-[18px] p-[24px_20px] text-center border border-[#DDD6FE] shadow-[0_8px_20px_rgba(139,92,246,0.04)] transition-transform hover:scale-[1.02]">
                                                <div className="text-[11px] text-[#7C3AED] font-black uppercase mb-[10px] tracking-[0.1em]">Total Invoice Value</div>
                                                <div className="text-[12px] text-[#7C3AED] font-bold mb-[12px] bg-white/60 rounded-full py-1 px-3 inline-block shadow-sm">Realized Revenue</div>
                                                <div className="text-[32px] font-[950] font-mono-dm text-[#4C1D95] tracking-tighter leading-none mb-2">{stats.totalInvoice.toLocaleString()}</div>
                                                <div className="text-[14px] font-[800] text-[#7C3AED] bg-white/80 border border-[#DDD6FE] rounded-lg py-1 px-3 inline-block">AED</div>
                                            </div>
                                            <div className="bg-[#FDEDEC] rounded-[18px] p-[24px_20px] text-center border border-[#E74C3C]/20 shadow-[0_8px_20px_rgba(231,76,60,0.06)] transition-transform hover:scale-[1.02]">
                                                <div className="text-[11px] text-[#5A7266] font-black uppercase mb-[10px] tracking-[0.1em]">Invoice Under LPO</div>
                                                <div className="text-[12px] text-[#A93226] font-bold mb-[12px] bg-white/60 rounded-full py-1 px-3 inline-block shadow-sm">We take less 📉</div>
                                                <div className="text-[32px] font-[950] font-mono-dm text-[#E74C3C] tracking-tighter leading-none mb-2">{stats.favor.toLocaleString()}</div>
                                                <div className="text-[14px] font-[800] text-[#A93226] bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-lg py-1 px-3 inline-block">{stats.favorCount} <span className="text-[11px] opacity-70">Orders</span></div>
                                            </div>
                                            <div className="bg-[#EEF2FF] rounded-[18px] p-[24px_20px] text-center border border-[#4F46E5]/20 shadow-[0_8px_20px_rgba(79,70,229,0.06)] transition-transform hover:scale-[1.02]">
                                                <div className="text-[11px] text-[#64748B] font-black uppercase mb-[10px] tracking-[0.1em]">Invoice Over LPO</div>
                                                <div className="text-[12px] text-[#4F46E5] font-bold mb-[12px] bg-white/60 rounded-full py-1 px-3 inline-block shadow-sm">We take more 📈</div>
                                                <div className="text-[32px] font-[950] font-mono-dm text-[#312E81] tracking-tighter leading-none mb-2">{stats.against.toLocaleString()}</div>
                                                <div className="text-[14px] font-[800] text-[#4F46E5] bg-[#EEF2FF] border border-[#4F46E5]/20 rounded-lg py-1 px-3 inline-block">{stats.againstCount} <span className="text-[11px] opacity-70">Orders</span></div>
                                            </div>
                                            <div className="bg-[#F6F9F7] rounded-[18px] p-[24px_20px] text-center border border-[#B2C4BB]/40 shadow-[0_8px_20px_rgba(0,0,0,0.04)] transition-transform hover:scale-[1.02]">
                                                <div className="text-[11px] text-[#5A7266] font-black uppercase mb-[10px] tracking-[0.1em]">Net Difference</div>
                                                <div className="text-[12px] text-[#5A7266] font-bold mb-[12px] bg-white/60 rounded-full py-1 px-3 inline-block shadow-sm">Overall balance</div>
                                                <div className={`text-[32px] font-[950] font-mono-dm tracking-tighter leading-none mb-2 ${stats.net >= 0 ? 'text-[#4F46E5]' : 'text-[#E74C3C]'}`}>
                                                    {stats.net >= 0 ? '+' : '-'}{Math.abs(stats.net).toLocaleString()}
                                                </div>
                                                <div className="text-[14px] font-[800] text-[#5A7266] bg-white/80 border border-[#B2C4BB]/30 rounded-lg py-1 px-3 inline-block">{stats.favorCount + stats.againstCount} <span className="text-[11px] opacity-70">Issues</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {statsSubTab === 'daily' && (
                            <div className="bg-white rounded-[16px] border-[1.5px] border-[#E4EDE8] shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-8 mb-[24px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="overflow-x-auto rounded-xl border border-slate-100">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Date</th>
                                                <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Day</th>
                                                <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">LPO Value</th>
                                                <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Invoice Value</th>
                                                <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Orders</th>
                                                <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Delivered</th>
                                                <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Partial</th>
                                                <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Canceled</th>
                                                <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Pending</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dailyStats.map((d: any, idx) => {
                                                const dayName = d.date && d.date !== 'No Date'
                                                    ? new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(d.date))
                                                    : '-';
                                                return (
                                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-6 py-4 font-bold text-[#0F1A14] text-center font-mono-dm">{d.date}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-[900] uppercase tracking-wider">
                                                                {dayName}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 font-black text-slate-700 text-center">{formatStat(d.lpoValue)}</td>
                                                        <td className="px-6 py-4 font-black text-indigo-600 text-center">{formatStat(d.invoiceValue)}</td>
                                                        <td className="px-6 py-4 font-black text-slate-600 text-center">{formatStat(d.orders)}</td>
                                                        <td className="px-6 py-4 font-black text-[#2DBE6C] text-center">{formatStat(d.delivered)}</td>
                                                        <td className="px-6 py-4 font-black text-orange-500 text-center">{formatStat(d.partial)}</td>
                                                        <td className="px-6 py-4 font-black text-red-500 text-center">{formatStat(d.canceled)}</td>
                                                        <td className="px-6 py-4 font-black text-amber-500 text-center">{formatStat(d.pending)}</td>
                                                    </tr>
                                                );
                                            })}
                                            {/* TOTAL ROW */}
                                            <tr className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                                <td className="px-6 py-4 text-center text-[14px] font-[950] text-[#1E293B] uppercase tracking-wider" colSpan={2}>TOTAL</td>
                                                <td className="px-6 py-4 font-[950] text-slate-900 text-center bg-slate-100/50">{formatStat(dailyTotals.lpoValue)}</td>
                                                <td className="px-6 py-4 font-[950] text-indigo-700 text-center bg-indigo-50/50">{formatStat(dailyTotals.invoiceValue)}</td>
                                                <td className="px-6 py-4 font-[950] text-slate-900 text-center">{formatStat(dailyTotals.orders)}</td>
                                                <td className="px-6 py-4 font-[950] text-[#2DBE6C] text-center bg-green-50/30">{formatStat(dailyTotals.delivered)}</td>
                                                <td className="px-6 py-4 font-[950] text-orange-700 text-center bg-orange-50/30">{formatStat(dailyTotals.partial)}</td>
                                                <td className="px-6 py-4 font-[950] text-red-700 text-center bg-red-50/30">{formatStat(dailyTotals.canceled)}</td>
                                                <td className="px-6 py-4 font-[950] text-amber-700 text-center bg-amber-50/30">{formatStat(dailyTotals.pending)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {statsSubTab === 'cities' && (
                            <div className="bg-white rounded-[24px] border-[1.5px] border-[#E4EDE8] shadow-sm overflow-hidden animate-in fade-in duration-500">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#F1F5F9]">
                                                <th className="px-4 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider w-[50px]">#</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">City Name</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">LPO Value</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">Invoice Value</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">Difference</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">Orders</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-[#059669]">Delivered</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-[#D97706]">Partial</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-amber-500">Pending</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-red-500">Canceled</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {cityStats.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="px-6 py-20 text-center text-[15px] font-bold text-slate-400">
                                                        No data yet
                                                    </td>
                                                </tr>
                                            ) : (
                                                <>
                                                    {cityStats.map((c: any, i) => {
                                                        const diff = c.invoiceValue - c.lpoValue;
                                                        return (
                                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-4 py-4 text-center text-[13px] font-[800] text-slate-400 bg-slate-50/50">{i + 1}</td>
                                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-[#1E293B]">{c.name}</td>
                                                                <td className="px-6 py-4 text-center text-[14px] font-[900] text-slate-800">{formatStat(c.lpoValue, 'AED ')}</td>
                                                                <td className="px-6 py-4 text-center text-[14px] font-[900] text-indigo-600">{formatStat(c.invoiceValue, 'AED ')}</td>
                                                                <td className={`px-6 py-4 text-center text-[14px] font-[900] ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                    {diff === 0 ? '-' : (diff > 0 ? '+' : '') + diff.toLocaleString()}
                                                                </td>
                                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-slate-600">{formatStat(c.orders)}</td>
                                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-green-600 bg-green-50/30">{formatStat(c.delivered)}</td>
                                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-orange-600 bg-orange-50/30">{formatStat(c.partial)}</td>
                                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-amber-600 bg-amber-50/30">{formatStat(c.pending)}</td>
                                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-red-600 bg-red-50/30">{formatStat(c.canceled)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* TOTAL ROW */}
                                                    <tr className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                                        <td className="px-6 py-4 text-center text-[15px] font-[950] text-[#1E293B] uppercase tracking-wider"></td>
                                                        <td className="px-6 py-4 text-center text-[15px] font-[950] text-[#1E293B] uppercase tracking-wider">TOTAL</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-slate-900 bg-slate-100/50">{formatStat(cityTotals.lpoValue, 'AED ')}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-[#312E81] bg-slate-100/50">{formatStat(cityTotals.invoiceValue, 'AED ')}</td>
                                                        <td className={`px-6 py-4 text-center text-[14px] font-[950] bg-slate-100/50 ${(cityTotals.invoiceValue - cityTotals.lpoValue) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                            {(cityTotals.invoiceValue - cityTotals.lpoValue) === 0 ? '-' : ((cityTotals.invoiceValue - cityTotals.lpoValue) > 0 ? '+' : '') + (cityTotals.invoiceValue - cityTotals.lpoValue).toLocaleString()}
                                                        </td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-slate-900">{formatStat(cityTotals.orders)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-green-700 bg-green-100/30">{formatStat(cityTotals.delivered)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-orange-700 bg-orange-100/30">{formatStat(cityTotals.partial)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-amber-700 bg-amber-100/30">{formatStat(cityTotals.pending)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-red-700 bg-red-100/30">{formatStat(cityTotals.canceled)}</td>
                                                    </tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {statsSubTab === 'customers' && (
                            <div className="bg-white rounded-[24px] border-[1.5px] border-[#E4EDE8] shadow-sm overflow-hidden animate-in fade-in duration-500">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#F1F5F9]">
                                                <th className="px-4 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider w-[50px]">#</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">Customer Name</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">Total Orders</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-[#059669]">Delivered</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-[#D97706]">Partial</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-amber-500">Pending</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-red-500">Canceled</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-orange-600">Pending Items</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-green-600">Reshipped Items</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-red-600">Canceled Items</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {customerStats.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="px-6 py-20 text-center text-[15px] font-bold text-slate-400">
                                                        No data yet
                                                    </td>
                                                </tr>
                                            ) : (
                                                <>
                                                    {customerStats.map((c: any, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-4 py-4 text-center text-[13px] font-[800] text-slate-400 bg-slate-50/50">{i + 1}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-[#1E293B]">{c.name}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-slate-600">{formatStat(c.total)}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-green-600 bg-green-50/30">{formatStat(c.delivered)}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-orange-600 bg-orange-50/30">{formatStat(c.partial)}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-amber-600 bg-amber-50/30">{formatStat(c.pending)}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-red-600 bg-red-50/30">{formatStat(c.canceledOrders)}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-orange-500">{formatStat(c.missingCount)}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-green-500">{formatStat(c.reshippedCount)}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-red-500">{formatStat(c.canceledCount)}</td>
                                                        </tr>
                                                    ))}
                                                    {/* TOTAL ROW */}
                                                    <tr className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                                        <td className="px-6 py-4 text-center text-[15px] font-[950] text-[#1E293B] uppercase tracking-wider"></td>
                                                        <td className="px-6 py-4 text-center text-[15px] font-[950] text-[#1E293B] uppercase tracking-wider">TOTAL</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-slate-900 bg-slate-100/50">{formatStat(customerTotals.total)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-green-700 bg-green-100/30">{formatStat(customerTotals.delivered)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-orange-700 bg-orange-100/30">{formatStat(customerTotals.partial)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-amber-700 bg-amber-100/30">{formatStat(customerTotals.pending)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-red-700 bg-red-100/30">{formatStat(customerTotals.canceledOrders)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-orange-800">{formatStat(customerTotals.missingCount)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-green-800">{formatStat(customerTotals.reshippedCount)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-red-800">{formatStat(customerTotals.canceledCount)}</td>
                                                    </tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {statsSubTab === 'products' && (
                            <div className="bg-white rounded-[24px] border-[1.5px] border-[#E4EDE8] shadow-sm overflow-hidden animate-in fade-in duration-500">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#F1F5F9]">
                                                <th className="px-4 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider w-[50px]">#</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">Product Name</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-red-600">Total Canceled</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-orange-600">Pending Re-ship</th>
                                                <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-green-600">Total Shipped</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {productStats.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-20 text-center text-[15px] font-bold text-slate-400">
                                                        No data yet
                                                    </td>
                                                </tr>
                                            ) : (
                                                <>
                                                    {productStats.map((p: any, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-4 py-4 text-center text-[13px] font-[800] text-slate-400 bg-slate-50/50">{i + 1}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-[#1E293B]">{p.name}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-red-600 bg-red-50/30">{formatStat(p.canceled)}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-orange-600 bg-orange-50/30">{formatStat(p.pending)}</td>
                                                            <td className="px-6 py-4 text-center text-[14px] font-[800] text-green-600 bg-green-50/30">{formatStat(p.shipped)}</td>
                                                        </tr>
                                                    ))}
                                                    {/* TOTAL ROW */}
                                                    <tr className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                                        <td className="px-6 py-4 text-center text-[15px] font-[950] text-[#1E293B] uppercase tracking-wider"></td>
                                                        <td className="px-6 py-4 text-center text-[15px] font-[950] text-[#1E293B] uppercase tracking-wider">TOTAL</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-red-700 bg-red-100/30">{formatStat(productTotals.canceled)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-orange-700 bg-orange-100/30">{formatStat(productTotals.pending)}</td>
                                                        <td className="px-6 py-4 text-center text-[14px] font-[950] text-green-700 bg-green-100/30">{formatStat(productTotals.shipped)}</td>
                                                    </tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!isLoading && activeTab === 'checking' && (
                    <div className="max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* SEARCH BOX */}
                        <div className="bg-white rounded-[24px] p-8 shadow-[0_15px_50px_rgba(0,0,0,0.05)] border-[1.5px] border-[#E4EDE8] mb-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#4F46E5]/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700" />
                            <div className="relative z-10 flex flex-col items-center gap-6">
                                <div className="text-center space-y-2">
                                    <h2 className="text-[24px] font-[900] text-[#0F172A] tracking-tight">Full LPO Audit & Tracking</h2>
                                </div>
                                <div className="flex items-center gap-3 w-full max-w-[600px] bg-[#F8FAFC] border-[2px] border-[#E2E8F0] focus-within:border-[#4F46E5] focus-within:ring-4 focus-within:ring-[#4F46E5]/10 rounded-[18px] px-6 py-4 transition-all shadow-sm">
                                    <SearchCode className="w-5 h-5 text-[#94A3B8]" />
                                    <input
                                        type="text"
                                        placeholder="Type LPO & press Enter... ↵"
                                        className="bg-transparent border-none text-[16px] w-full outline-none placeholder:text-[#94A3B8] font-bold text-[#0F172A]"
                                        value={checkingSearchQuery}
                                        onChange={(e) => setCheckingSearchQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') setCheckingSubmittedQuery(checkingSearchQuery);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {(() => {
                            const query = checkingSubmittedQuery.trim().toLowerCase();
                            if (!query) return (
                                <div className="flex flex-col items-center justify-center py-24 opacity-40">
                                    <ShieldCheck className="w-20 h-20 text-[#94A3B8] mb-4" />
                                    <p className="text-[16px] font-bold text-[#64748B]">Type an LPO identifier to begin audit</p>
                                </div>
                            );

                            const found = orders.find(o =>
                                o.lpo.toLowerCase().includes(query) ||
                                o.id.toLowerCase() === query ||
                                o.lpoId.toLowerCase() === query
                            );

                            if (!found) return (
                                <div className="bg-white rounded-[24px] p-16 text-center border-[2px] border-dashed border-[#E2E8F0] animate-in zoom-in-95">
                                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <AlertTriangle className="w-8 h-8 text-rose-500" />
                                    </div>
                                    <h3 className="text-[18px] font-black text-[#0F172A] mb-2">LPO Not Found</h3>
                                    <p className="text-[#64748B] font-medium">No record matches "{checkingSearchQuery}". Please check the number and try again.</p>
                                </div>
                            );

                            const foundStatus = (found.status || 'pending').toLowerCase();
                            const s = STATUS_CONFIG[foundStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                            const diff = found.invoiceVal - found.lpoVal;
                            const diffPct = found.lpoVal > 0 ? (diff / found.lpoVal) * 100 : 0;
                            const totalResolved = (found.shippedItems?.length || 0) + (found.canceledItems?.length || 0);
                            const totalItems = totalResolved + found.missing.length;
                            const progress = totalItems > 0 ? Math.round((totalResolved / totalItems) * 100) : (found.status === 'delivered' ? 100 : 0);

                            return (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 pb-12">
                                    {/* MAIN HEADER GRID */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* INFO CARD */}
                                        <div className="lg:col-span-2 bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] flex flex-col justify-between">
                                            <div className="flex items-start justify-between mb-8">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[11px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider">{found.lpoId}</span>
                                                        <span className="text-[14px] text-[#64748B] font-bold">LPO Record Audit</span>
                                                    </div>
                                                    <h2 className="text-[36px] font-[950] text-[#0F172A] leading-tight">{found.lpo}</h2>
                                                    <p className="text-[18px] font-bold text-[#4F46E5]">{found.customer}</p>
                                                </div>
                                                <div className={`p-4 rounded-[20px] border shadow-sm ${s.color} text-center min-w-[140px]`}>
                                                    <div className="text-[20px] mb-1">{s.icon}</div>
                                                    <div className="text-[14px] font-black uppercase tracking-tight">{s.label}</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-[#F1F5F9]">
                                                <div>
                                                    <div className="text-[10px] text-[#94A3B8] font-black uppercase tracking-widest mb-1">LPO Date</div>
                                                    <div className="text-[15px] font-bold text-[#0F172A]">{found.date || 'N/A'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-[#94A3B8] font-black uppercase tracking-widest mb-1">Invoice Date</div>
                                                    <div className="text-[15px] font-bold text-[#0F172A]">{found.invoiceDate || 'Pending'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-[#94A3B8] font-black uppercase tracking-widest mb-1">Invoice Number</div>
                                                    <div className="text-[15px] font-bold text-[#0F172A]">{found.invoiceNumber || 'Not Issued'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* FINANCIAL AUDIT */}
                                        <div className="bg-[#1e1b4b] rounded-[24px] p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
                                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                                <History className="w-24 h-24 text-white" />
                                            </div>
                                            <div className="relative z-10">
                                                <h3 className="text-[13px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-6">Financial Comparison</h3>
                                                <div className="space-y-6">
                                                    <div>
                                                        <div className="text-[11px] text-indigo-300 font-bold uppercase mb-1 opacity-60">LPO Value</div>
                                                        <div className="text-[28px] font-black font-mono-dm tracking-tighter">{found.lpoVal.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[11px] text-indigo-300 font-bold uppercase mb-1 opacity-60">Invoice Value</div>
                                                        <div className="text-[28px] font-black font-mono-dm tracking-tighter text-emerald-400">{found.invoiceVal.toLocaleString()}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`mt-8 p-5 rounded-[18px] flex items-center justify-between ${diff < 0 ? 'bg-rose-500/20 border border-rose-500/30' : diff > 0 ? 'bg-indigo-500/20 border border-indigo-500/30' : 'bg-white/5 border border-white/10'}`}>
                                                <div>
                                                    <div className="text-[10px] font-black uppercase text-white/50 tracking-widest mb-0.5">Variance</div>
                                                    <div className="text-[18px] font-black font-mono-dm">{diff >= 0 ? '+' : ''}{diff.toLocaleString()}</div>
                                                </div>
                                                <div className={`text-[12px] font-extrabold px-3 py-1 rounded-full ${diff < 0 ? 'bg-rose-500 text-white' : diff > 0 ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/50'}`}>
                                                    {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* MIDDLE CONTENT GRID */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* DELIVERY PROGRESS / MOVEMENTS */}
                                        <div className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
                                            <div className="flex items-center gap-3 mb-8">
                                                <div className="w-10 h-10 bg-emerald-50 rounded-[12px] flex items-center justify-center">
                                                    <Activity className="w-5 h-5 text-emerald-600" />
                                                </div>
                                                <h3 className="text-[18px] font-black text-[#0F172A]">Delivery Movement Analytics</h3>
                                            </div>

                                            {/* PROGRESS BAR */}
                                            <div className="mb-10">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-[13px] font-black text-[#0F172A] uppercase tracking-wider">Completion Status</span>
                                                    <span className="text-[20px] font-black text-indigo-600 font-mono-dm">{progress}%</span>
                                                </div>
                                                <div className="w-full h-[14px] bg-[#F1F5F9] rounded-full overflow-hidden shadow-inner">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-lg"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* TIMELINE SIMULATION / MOVEMENTS */}
                                            <div className="space-y-6">
                                                <div className="flex gap-4">
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg z-10">
                                                            <Plus className="w-4 h-4" />
                                                        </div>
                                                        <div className="w-1 h-full bg-[#F1F5F9] -mt-1" />
                                                    </div>
                                                    <div className="pb-6">
                                                        <div className="text-[14px] font-black text-[#0F172A]">LPO Recorded</div>
                                                        <div className="text-[12px] text-[#64748B] font-medium mt-1">
                                                            Order issued on {found.date}
                                                            {found.createdAt && <span className="block text-[10px] text-[#94A3B8] mt-0.5 italic">System Entry: {found.createdAt}</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                {found.invoiceNumber && (
                                                    <div className="flex gap-4">
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-lg z-10">
                                                                <FileText className="w-4 h-4" />
                                                            </div>
                                                            <div className="w-1 h-full bg-[#F1F5F9] -mt-1" />
                                                        </div>
                                                        <div className="pb-6">
                                                            <div className="text-[14px] font-black text-[#0F172A]">Invoice Linked</div>
                                                            <div className="text-[12px] text-[#64748B] font-medium mt-1">Inv #{found.invoiceNumber} recorded with value {found.invoiceVal.toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                )}

                                                {totalResolved > 0 && (
                                                    <div className="flex gap-4">
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-lg z-10">
                                                                <Truck className="w-4 h-4" />
                                                            </div>
                                                            <div className="w-1 h-full bg-[#F1F5F9] -mt-1" />
                                                        </div>
                                                        <div className="pb-6">
                                                            <div className="text-[14px] font-black text-[#0F172A]">Delivery Adjustments</div>
                                                            <div className="text-[12px] text-[#64748B] font-medium mt-1">{found.shippedItems?.length || 0} items re-shipped, {found.canceledItems?.length || 0} items canceled.</div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex gap-4">
                                                    <div className="flex flex-col items-center">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-lg z-10 ${progress === 100 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className={`text-[14px] font-black ${progress === 100 ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>Final Handover</div>
                                                        <div className="text-[12px] text-[#64748B] font-medium mt-1">
                                                            {progress === 100 ? 'Fully delivered and closed.' : 'Awaiting missing items resolution.'}
                                                            {found.updatedAt && <span className="block text-[10px] text-[#94A3B8] mt-0.5 italic">Last Synced: {found.updatedAt}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* MISSING & PENDING ITEMS */}
                                        <div className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] flex flex-col">
                                            <div className="flex items-center gap-3 mb-6 shrink-0">
                                                <div className="w-10 h-10 bg-rose-50 rounded-[12px] flex items-center justify-center">
                                                    <Package className="w-5 h-5 text-rose-600" />
                                                </div>
                                                <h3 className="text-[18px] font-black text-[#0F172A]">Items Status Log</h3>
                                            </div>

                                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                                {found.missing.length === 0 && (found.shippedItems?.length || 0) === 0 && (found.canceledItems?.length || 0) === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-20 text-[#94A3B8]">
                                                        <CheckCircle2 className="w-12 h-12 mb-3 opacity-20" />
                                                        <p className="font-bold">No specific item issues reported.</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {found.missing.map((item, i) => (
                                                            <div key={`m-${i}`} className="flex items-center justify-between p-4 bg-rose-50/50 rounded-[14px] border border-rose-100">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                                                    <span className="text-[13px] font-black text-rose-700">{item}</span>
                                                                </div>
                                                                <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full uppercase">Missing</span>
                                                            </div>
                                                        ))}
                                                        {(found.shippedItems || []).map((item, i) => (
                                                            <div key={`s-${i}`} className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-[14px] border border-emerald-100">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                                    <span className="text-[13px] font-bold text-emerald-700">{item}</span>
                                                                </div>
                                                                <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase">Shipped</span>
                                                            </div>
                                                        ))}
                                                        {(found.canceledItems || []).map((item, i) => (
                                                            <div key={`c-${i}`} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-[14px] border border-slate-200">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                                                                    <span className="text-[13px] font-bold text-slate-500 line-through decoration-slate-300">{item}</span>
                                                                </div>
                                                                <span className="text-[10px] font-black bg-slate-400 text-white px-2 py-0.5 rounded-full uppercase">Canceled</span>
                                                            </div>
                                                        ))}
                                                    </>
                                                )}
                                            </div>

                                            {found.notes && (
                                                <div className="mt-6 p-5 bg-[#F8FAFC] rounded-[18px] border border-[#E2E8F0] shrink-0">
                                                    <div className="text-[10px] text-[#94A3B8] font-black uppercase tracking-widest mb-2">Delivery Notes</div>
                                                    <p className="text-[13px] text-[#475569] leading-relaxed font-medium italic">"{found.notes}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {!isLoading && activeTab === 'orders' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center justify-between mb-[14px]">
                            <div className="flex items-center gap-2 text-[15px] font-[700] text-[#0F1A14]">
                                <div className="w-[3px] h-[16px] bg-[#4F46E5] rounded-[3px]"></div>
                                All Orders Register
                            </div>
                            <div className="flex items-center gap-[6px]">
                                {['all', 'delivered', 'partial', 'pending', 'canceled'].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setFilterStatus(s)}
                                        className={`
                      px-[12px] py-[4px] rounded-[20px] text-[11px] font-[600] capitalize border-[1.5px] transition-all
                      ${filterStatus === s
                                                ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]'
                                                : 'bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#4F46E5]'
                                            }
                    `}
                                    >
                                        {s === 'all' ? 'All' : (STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label || s)}
                                    </button>
                                ))}
                                <div className="w-px h-4 bg-[#B2C4BB] mx-1"></div>
                                {canDownload && (
                                    <button onClick={exportOrdersCSV} className="flex items-center gap-1.5 text-[11px] font-[600] text-[#5A7266] bg-white border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 hover:border-[#4F46E5] hover:text-[#4F46E5] transition-all">
                                        <Download className="w-3 h-3" /> Export List
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* DATE FILTER BAR */}
                        <div className="flex flex-wrap items-center justify-center gap-3 mb-[14px] bg-white border-[1.5px] border-[#E4EDE8] rounded-[12px] px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                            <span className="text-[11px] font-[800] text-[#5A7266] uppercase tracking-widest whitespace-nowrap">📅 Filter by Date</span>
                            <div className="w-px h-4 bg-[#E4EDE8]" />

                            {/* Year */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-[700] text-[#5A7266]">Year</span>
                                <input
                                    type="text"
                                    placeholder="e.g. 2025"
                                    value={filterYear}
                                    onChange={e => setFilterYear(e.target.value)}
                                    maxLength={4}
                                    className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all w-[90px]"
                                />
                            </div>

                            {/* Month */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-[700] text-[#5A7266]">Month</span>
                                <input
                                    type="text"
                                    placeholder="e.g. 02"
                                    value={filterMonth}
                                    onChange={e => setFilterMonth(e.target.value)}
                                    maxLength={2}
                                    className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all w-[90px]"
                                />
                            </div>

                            <div className="w-px h-4 bg-[#E4EDE8]" />

                            {/* From */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-[700] text-[#5A7266]">From</span>
                                <input
                                    type="date"
                                    value={filterDateFrom}
                                    onChange={e => setFilterDateFrom(e.target.value)}
                                    className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all appearance-none"
                                />
                            </div>

                            {/* To */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-[700] text-[#5A7266]">To</span>
                                <input
                                    type="date"
                                    value={filterDateTo}
                                    onChange={e => setFilterDateTo(e.target.value)}
                                    className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all appearance-none"
                                />
                            </div>

                            {/* Clear */}
                            {(filterYear || filterMonth || filterDateFrom || filterDateTo) && (
                                <>
                                    <div className="w-px h-4 bg-[#E4EDE8]" />
                                    <button
                                        onClick={() => { setFilterYear(''); setFilterMonth(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                                        className="text-[11px] font-[700] text-[#E74C3C] hover:text-[#A93226] flex items-center gap-1 transition-colors"
                                    >
                                        <X className="w-3 h-3" /> Clear
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="bg-white rounded-[14px] border-[1.5px] border-[#E4EDE8] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-center">
                                    <thead>
                                        <tr className="bg-[#4F46E5]">
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center min-w-[110px]">LPO ID</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">LPO Number</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center min-w-[130px]">LPO Date</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center min-w-[130px]">Delivery Date</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Customer Name</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">LPO Value</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Invoice DATE</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Invoice Number</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Invoice Value</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Difference</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Status</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Missing Items</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Re-ship?</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E0E7FF]">
                                        {filteredOrders.length === 0 ? (
                                            <tr><td colSpan={14} className="text-center py-20 text-[#B2C4BB] font-medium">No orders matching your filters</td></tr>
                                        ) : (
                                            filteredOrders.map((o, index) => {
                                                const diff = o.invoiceVal > 0 ? o.invoiceVal - o.lpoVal : 0;
                                                const s = STATUS_CONFIG[o.status];
                                                const showHeader = index === 0 || o.date !== filteredOrders[index - 1].date;
                                                return (
                                                    <React.Fragment key={o.id}>
                                                        {showHeader && (
                                                            <tr className="bg-[#F8FAFC]">
                                                                <td colSpan={14} className="p-[10px_16px] text-left">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-8 h-8 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center">
                                                                            <Clock className="w-4 h-4 text-[#4F46E5]" />
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[14px] font-[900] text-[#1e1b4b] tracking-tight">{o.date}</span>
                                                                            <span className="ml-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-l border-slate-200 pl-3">
                                                                                {filteredOrders.filter(ord => ord.date === o.date).length} Orders
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                        <tr className="hover:bg-[#F0FAF4] transition-colors group">
                                                            <td className="p-[12px_16px] text-center"><span className="font-mono-dm text-[12px] font-[500] text-[#5A7266] bg-[#F6F9F7] px-[9px] py-[3px] rounded-[5px] border border-[#E4EDE8]">{o.lpoId || '—'}</span></td>
                                                            <td className="p-[12px_16px] text-center"><span className="font-mono-dm text-[12px] font-[500] text-[#4F46E5] bg-[#EEF2FF] px-[9px] py-[3px] rounded-[5px] border border-[#4F46E5]/12">{o.lpo || '—'}</span></td>
                                                            <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#2C3E35]">{o.date || '—'}</td>
                                                            <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#2980B9]">
                                                                {o.deliveryDate
                                                                    ? <span className="bg-[#EBF8FF] text-[#2980B9] px-[9px] py-[3px] rounded-[5px] border border-[#2980B9]/12 text-[12px] font-[600]">{o.deliveryDate}</span>
                                                                    : <span className="text-[#B2C4BB]">&mdash;</span>
                                                                }
                                                            </td>
                                                            <td className="p-[12px_16px] text-center font-[600] text-[12.5px] text-[#0F1A14]">{o.customer || '—'}</td>
                                                            <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#5A7266]">{(o.lpoVal || 0).toLocaleString()}</td>
                                                            <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#2C3E35]">{o.invoiceDate || '—'}</td>
                                                            <td className="p-[12px_16px] text-center"><span className="font-mono-dm text-[12px] font-[500] text-[#2980B9] bg-[#EBF5FB] px-[9px] py-[3px] rounded-[5px] border border-[#2980B9]/12">{o.invoiceNumber || '—'}</span></td>
                                                            <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#5A7266]">{o.invoiceVal && o.invoiceVal > 0 ? o.invoiceVal.toLocaleString() : '—'}</td>
                                                            <td className="p-[12px_16px] text-center">
                                                                {!o.invoiceVal || o.invoiceVal === 0 ? '—' :
                                                                    <span className={`text-[12px] font-[700] font-mono-dm ${diff < 0 ? 'text-[#E74C3C]' : diff > 0 ? 'text-[#1A8A47]' : 'text-[#B2C4BB]'}`}>
                                                                        {diff === 0 ? '0' : (diff > 0 ? `+${diff.toLocaleString()}` : `-${Math.abs(diff).toLocaleString()}`)}
                                                                    </span>
                                                                }
                                                            </td>
                                                            <td className="p-[12px_16px] text-center">
                                                                {(() => {
                                                                    const normalizedStatus = (o.status || 'pending').toLowerCase();
                                                                    const statusConf = STATUS_CONFIG[normalizedStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                                                                    return (
                                                                        <div className={`inline-flex items-center gap-[5px] px-[10px] py-[3px] rounded-[20px] text-[11px] font-[600] border border-transparent ${statusConf.color}`}>
                                                                            <div className={`w-[5px] h-[5px] rounded-full ${statusConf.dot}`}></div>
                                                                            {statusConf.label}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </td>
                                                            <td className="p-[12px_16px] text-center">
                                                                {(() => {
                                                                    const mCount = o.missing?.length || 0;
                                                                    const sCount = (o.shippedItems || []).length;
                                                                    const cCount = (o.canceledItems || []).length;
                                                                    const total = mCount + sCount + cCount;

                                                                    if (total === 0) return '—';

                                                                    const allItems = [
                                                                        ...(o.missing || []).map(m => ({ name: m, type: 'missing' as const })),
                                                                        ...(o.shippedItems || []).map(m => ({ name: m, type: 'shipped' as const })),
                                                                        ...(o.canceledItems || []).map(m => ({ name: m, type: 'canceled' as const })),
                                                                    ];

                                                                    return (
                                                                        <button
                                                                            onClick={() => { setPopupItems(allItems); setShowMissingPopup(true); }}
                                                                            className="bg-[#FDEDEC] text-[#A93226] text-[11px] font-bold px-3 py-1 rounded-full hover:bg-[#FADBD8] transition-colors shadow-sm"
                                                                        >
                                                                            {total} Items
                                                                        </button>
                                                                    );
                                                                })()}
                                                            </td>
                                                            <td className="p-[12px_16px] text-center">
                                                                {o.reship ? <span className="bg-[#EBF5FB] text-[#2980B9] text-[10px] font-bold px-2 py-0.5 rounded-full">YES</span> : (o.missing && o.missing.length > 0) ? <span className="text-[#A93226] font-bold text-[10px]">NO</span> : '—'}
                                                            </td>
                                                            <td className="p-[12px_16px] text-center">
                                                                {canEdit && o.status === 'pending' && (
                                                                    <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => openEditModal(o)}
                                                                            className="w-7 h-7 bg-[#EBF5FB] text-[#2980B9] rounded-md flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                                                                        >
                                                                            <Edit2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {!isLoading && activeTab === 'missing_items' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center justify-between mb-[14px]">
                            <div className="flex items-center gap-2 text-[15px] font-[700] text-[#0F1A14]">
                                <div className="w-[3px] h-[16px] bg-[#4F46E5] rounded-[3px]"></div>
                                Missing & Canceled Items Track
                            </div>
                            {canDownload && (
                                <button onClick={exportMissingItemsCSV} className="flex items-center gap-1.5 text-[11px] font-[600] text-[#5A7266] bg-white border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 hover:border-[#2980B9] transition-all">
                                    <Download className="w-3 h-3" /> Export List
                                </button>
                            )}
                        </div>

                        {/* DATE FILTER BAR */}
                        <div className="flex flex-wrap items-center justify-center gap-3 mb-[14px] bg-white border-[1.5px] border-[#E4EDE8] rounded-[12px] px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                            <span className="text-[11px] font-[800] text-[#5A7266] uppercase tracking-widest whitespace-nowrap">📅 Filter by Date</span>
                            <div className="w-px h-4 bg-[#E4EDE8]" />

                            {/* Year */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-[700] text-[#5A7266]">Year</span>
                                <input
                                    type="text"
                                    placeholder="e.g. 2025"
                                    value={filterYear}
                                    onChange={e => setFilterYear(e.target.value)}
                                    maxLength={4}
                                    className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all w-[90px]"
                                />
                            </div>

                            {/* Month */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-[700] text-[#5A7266]">Month</span>
                                <input
                                    type="text"
                                    placeholder="e.g. 02"
                                    value={filterMonth}
                                    onChange={e => setFilterMonth(e.target.value)}
                                    maxLength={2}
                                    className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all w-[90px]"
                                />
                            </div>

                            <div className="w-px h-4 bg-[#E4EDE8]" />

                            {/* From */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-[700] text-[#5A7266]">From</span>
                                <input
                                    type="date"
                                    value={filterDateFrom}
                                    onChange={e => setFilterDateFrom(e.target.value)}
                                    className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all appearance-none"
                                />
                            </div>

                            {/* To */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-[700] text-[#5A7266]">To</span>
                                <input
                                    type="date"
                                    value={filterDateTo}
                                    onChange={e => setFilterDateTo(e.target.value)}
                                    className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all appearance-none"
                                />
                            </div>

                            {/* Clear */}
                            {(filterYear || filterMonth || filterDateFrom || filterDateTo) && (
                                <>
                                    <div className="w-px h-4 bg-[#E4EDE8]" />
                                    <button
                                        onClick={() => { setFilterYear(''); setFilterMonth(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                                        className="text-[11px] font-[700] text-[#E74C3C] hover:text-[#A93226] flex items-center gap-1 transition-colors"
                                    >
                                        <X className="w-3 h-3" /> Clear
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="bg-white rounded-[14px] border-[1.5px] border-[#E4EDE8] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-center">
                                    <thead>
                                        <tr className="bg-[#4F46E5]">
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px]">LPO ID</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px]">LPO Number</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px]">Date</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px]">Customer</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px]">Missing Items</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px]">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E0E7FF]">
                                        {/* Combine both lists */}
                                        {filteredOrders.flatMap(o => [
                                            ...o.missing.map((m, i) => ({ item: m, status: 'pending', id: `${o.id}-m-${i}`, order: o })),
                                            ...(o.canceledItems || []).map((m, i) => ({ item: m, status: 'canceled', id: `${o.id}-c-${i}`, order: o }))
                                        ]).length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-20 text-center text-[#B2C4BB] font-medium">
                                                    No items found in the log
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredOrders.flatMap(o => [
                                                ...o.missing.map((m, i) => ({ item: m, status: 'pending', id: `${o.id}-m-${i}`, order: o })),
                                                ...(o.canceledItems || []).map((m, i) => ({ item: m, status: 'canceled', id: `${o.id}-c-${i}`, order: o }))
                                            ]).map((entry) => (
                                                <tr key={entry.id} className="hover:bg-[#F0FAF4] transition-colors group">
                                                    <td className="p-[12px_16px]">
                                                        <span className="font-mono-dm text-[12px] font-[500] text-[#5A7266] bg-[#F6F9F7] px-[9px] py-[3px] rounded-[5px] border border-[#E4EDE8]">
                                                            {entry.order.lpoId}
                                                        </span>
                                                    </td>
                                                    <td className="p-[12px_16px]">
                                                        <span className="font-mono-dm text-[12px] font-[500] text-[#4F46E5] bg-[#EEF2FF] px-[9px] py-[3px] rounded-[5px] border border-[#4F46E5]/15">
                                                            {entry.order.lpo}
                                                        </span>
                                                    </td>
                                                    <td className="p-[12px_16px] font-mono-dm text-[12.5px] text-[#2C3E35]">
                                                        {entry.order.date}
                                                    </td>
                                                    <td className="p-[12px_16px] font-[600] text-[12.5px] text-[#0F1A14]">
                                                        {entry.order.customer}
                                                    </td>
                                                    <td className="p-[12px_16px] text-[13px] font-[700] text-[#2C3E35]">
                                                        {entry.item}
                                                    </td>
                                                    <td className="p-[12px_16px]">
                                                        {entry.status === 'pending' ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F7EF] text-[#10B981] text-[10px] font-bold border border-[#10B981]/20">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></div>
                                                                PENDING RE-SHIP
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF2F2] text-[#EF4444] text-[10px] font-bold border border-[#EF4444]/20">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></div>
                                                                CANCELED
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {!isLoading && activeTab === 'reship' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center gap-2 text-[15px] font-[700] text-[#0F1A14] mb-[14px]">
                            <div className="w-[3px] h-[16px] bg-[#4F46E5] rounded-[3px]"></div>
                            Re-Shipments Management
                        </div>

                        {/* DATE FILTER BAR */}
                        <div className="flex flex-wrap items-center justify-center gap-3 mb-[14px] bg-white border-[1.5px] border-[#E4EDE8] rounded-[12px] px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                            <span className="text-[11px] font-[800] text-[#5A7266] uppercase tracking-widest whitespace-nowrap">📅 Filter by Date</span>
                            <div className="w-px h-4 bg-[#E4EDE8]" />

                            {/* Year */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-[700] text-[#5A7266]">Year</span>
                                <input
                                    type="text"
                                    placeholder="e.g. 2025"
                                    value={filterYear}
                                    onChange={e => setFilterYear(e.target.value)}
                                    maxLength={4}
                                    className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all w-[90px]"
                                />
                            </div>

                            {/* Month */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-[700] text-[#5A7266]">Month</span>
                                <input
                                    type="text"
                                    placeholder="e.g. 02"
                                    value={filterMonth}
                                    onChange={e => setFilterMonth(e.target.value)}
                                    maxLength={2}
                                    className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all w-[90px]"
                                />
                            </div>

                            <div className="w-px h-4 bg-[#E4EDE8]" />

                            {/* From */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-[700] text-[#5A7266]">From</span>
                                <input
                                    type="date"
                                    value={filterDateFrom}
                                    onChange={e => setFilterDateFrom(e.target.value)}
                                    className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all appearance-none"
                                />
                            </div>

                            {/* To */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-[700] text-[#5A7266]">To</span>
                                <input
                                    type="date"
                                    value={filterDateTo}
                                    onChange={e => setFilterDateTo(e.target.value)}
                                    className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 text-[12px] font-[600] text-[#0F1A14] outline-none focus:border-[#4F46E5] transition-all appearance-none"
                                />
                            </div>

                            {/* Clear */}
                            {(filterYear || filterMonth || filterDateFrom || filterDateTo) && (
                                <>
                                    <div className="w-px h-4 bg-[#E4EDE8]" />
                                    <button
                                        onClick={() => { setFilterYear(''); setFilterMonth(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                                        className="text-[11px] font-[700] text-[#E74C3C] hover:text-[#A93226] flex items-center gap-1 transition-colors"
                                    >
                                        <X className="w-3 h-3" /> Clear
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="bg-white rounded-[14px] border-[1.5px] border-[#E4EDE8] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-center">
                                    <thead>
                                        <tr className="bg-[#4F46E5]">
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">LPO ID</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">LPO Number</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Date</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Customer</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Missing Items</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E0E7FF]">
                                        {filteredOrders.filter(o => o.reship).map((o) => (
                                            <tr key={o.id} className="hover:bg-[#F0FAF4] transition-colors group">
                                                <td className="p-[12px_16px] text-center">
                                                    <span className="font-mono-dm text-[12px] font-[500] text-[#2980B9] bg-[#EBF5FB] px-[9px] py-[3px] rounded-[5px] border border-[#2980B9]/15">
                                                        #{o.lpoId}
                                                    </span>
                                                </td>
                                                <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#0F1A14] font-bold">{o.lpo}</td>
                                                <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#5A7266]">
                                                    {o.date}
                                                </td>
                                                <td className="p-[12px_16px] text-center font-[700] text-[12.5px] text-[#0F1A14]">{o.customer}</td>
                                                <td className="p-[12px_16px] text-center">
                                                    <button
                                                        onClick={() => openReshipPopup(o)}
                                                        className="bg-[#FDEDEC] text-[#A93226] text-[11px] font-bold px-3 py-1 rounded-full hover:bg-[#FADBD8] transition-colors shadow-sm flex items-center gap-1.5 mx-auto"
                                                    >
                                                        {o.missing.length} Items
                                                    </button>
                                                </td>
                                                <td className="p-[12px_16px] text-center font-[500] text-[12px] text-[#5A7266] italic max-w-[200px] truncate">
                                                    {o.notes || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                        {!filteredOrders.some(o => o.reship) && (
                                            <tr>
                                                <td colSpan={6} className="py-20 text-center text-[#B2C4BB] font-medium">
                                                    No re-shipments matching filters
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                )
                }
            </div >

            {/* UPDATE DELIVERY MODAL */}
            {
                isEditModalOpen && editingOrder && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[6px] animate-in fade-in duration-300" onClick={() => setIsEditModalOpen(false)}></div>
                        <div className="bg-[#F8FAFC] rounded-[28px] w-full max-w-[680px] max-h-[92vh] overflow-hidden flex flex-col shadow-[0_40px_100px_rgba(0,0,0,0.35)] relative z-10 animate-in zoom-in-95 duration-200">

                            {/* HEADER */}
                            <div className="relative bg-gradient-to-br from-[#1a1f5e] via-[#2d3494] to-[#3b4fd8] p-6 rounded-t-[28px] sticky top-0 z-20 overflow-hidden">
                                <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3 pointer-events-none" />
                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl border border-white/20">
                                            🚚
                                        </div>
                                        <div>
                                            <h3 className="text-white text-[18px] font-[900] tracking-tight">Update Delivery Progress</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-white/60 text-[11px] font-[600]">{editingOrder.customer}</span>
                                                <span className="text-white/30">·</span>
                                                <span className="bg-white/15 text-white/80 text-[10px] font-[800] px-2 py-0.5 rounded-full border border-white/20">{editingOrder.lpo}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="w-9 h-9 rounded-xl bg-white/10 text-white hover:bg-white/25 transition-all flex items-center justify-center border border-white/15"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* BODY */}
                            <div className="p-6 space-y-5 flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>

                                {/* SECTION 1 — Delivery Status */}
                                <div className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                                    <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
                                        <div className="w-1 h-4 bg-[#6366F1] rounded-full" />
                                        <span className="text-[11px] font-[800] text-[#475569] uppercase tracking-widest">Delivery Status</span>
                                    </div>
                                    <div className="p-4 grid grid-cols-3 gap-3">
                                        {([
                                            { value: 'delivered', label: 'Fully Delivered', icon: '✅', selectedBg: 'bg-emerald-50 border-emerald-400 text-emerald-700', dot: 'bg-emerald-500' },
                                            { value: 'partial', label: 'Partial Delivery', icon: '⚠️', selectedBg: 'bg-amber-50 border-amber-400 text-amber-700', dot: 'bg-amber-500' },
                                            { value: 'canceled', label: 'Canceled', icon: '❌', selectedBg: 'bg-rose-50 border-rose-400 text-rose-700', dot: 'bg-rose-500' },
                                        ] as const).map(opt => {
                                            const hasMissing = editingOrder.missing.length > 0;
                                            const isInsufficientValue = opt.value === 'delivered' && editingOrder.invoiceVal > 0 && editingOrder.invoiceVal < editingOrder.lpoVal;
                                            const isDisabled = (opt.value === 'delivered' && hasMissing) || isInsufficientValue;
                                            const isSelected = editingOrder.status === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    disabled={isDisabled}
                                                    title={isDisabled ? (hasMissing ? 'Cannot select Fully Delivered when there are missing products' : 'Invoice value must match or exceed LPO value for Full Delivery') : undefined}
                                                    onClick={() => { if (!isDisabled) setEditingOrder({ ...editingOrder, status: opt.value }); }}
                                                    className={`relative flex items-center gap-3 p-4 rounded-[14px] border-2 transition-all text-left
                                                        ${isDisabled
                                                            ? 'border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed opacity-50'
                                                            : isSelected
                                                                ? opt.selectedBg + ' shadow-sm'
                                                                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#CBD5E1] hover:bg-white'
                                                        }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isDisabled ? 'border-[#CBD5E1]' : isSelected ? 'border-current' : 'border-[#CBD5E1]'}`}>
                                                        {isSelected && !isDisabled && <div className={`w-2.5 h-2.5 rounded-full ${opt.dot}`} />}
                                                    </div>
                                                    <div>
                                                        <div className="text-[13px] font-[800] leading-tight">{opt.icon} {opt.label}</div>
                                                    </div>
                                                    {isSelected && !isDisabled && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-current opacity-60" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* SECTION 2 — Invoice Info */}
                                {editingOrder.status !== 'canceled' && (
                                    <div className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                                        <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
                                            <div className="w-1 h-4 bg-[#0EA5E9] rounded-full" />
                                            <span className="text-[11px] font-[800] text-[#475569] uppercase tracking-widest">Invoice Details</span>
                                        </div>
                                        <div className="p-4 grid grid-cols-3 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-[700] text-[#94A3B8] uppercase tracking-wider">Invoice Date</label>
                                                <input
                                                    type="date"
                                                    value={editingOrder.invoiceDate ?? ''}
                                                    onChange={(e) => setEditingOrder({ ...editingOrder, invoiceDate: e.target.value })}
                                                    className="w-full border-[1.5px] rounded-[10px] p-[10px_12px] text-[13px] font-medium outline-none transition-all appearance-none bg-[#F8FAFC] border-[#E2E8F0] focus:border-[#6366F1] focus:bg-white"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-[700] text-[#94A3B8] uppercase tracking-wider">Invoice Number</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. SAL-001"
                                                    className="w-full bg-[#F8FAFC] border-[1.5px] border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] outline-none focus:border-[#6366F1] focus:bg-white transition-all font-bold"
                                                    value={editingOrder.invoiceNumber ?? ''}
                                                    onChange={(e) => setEditingOrder({ ...editingOrder, invoiceNumber: e.target.value.toUpperCase() })}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-[700] text-[#94A3B8] uppercase tracking-wider">Invoice Value</label>
                                                <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={editingOrder.invoiceVal ?? ''}
                                                    onChange={(e) => {
                                                        const valStr = e.target.value;
                                                        const newVal = valStr === '' ? 0 : Number(valStr);
                                                        const isInsufficient = newVal > 0 && newVal < editingOrder.lpoVal;
                                                        let nextStatus = editingOrder.status;
                                                        if (nextStatus === 'delivered' && isInsufficient) {
                                                            nextStatus = 'partial';
                                                        }
                                                        setEditingOrder({ ...editingOrder, invoiceVal: newVal, status: nextStatus });
                                                    }}
                                                    className="w-full border-[1.5px] rounded-[10px] p-[10px_12px] text-[13px] font-[700] outline-none transition-all font-mono-dm bg-[#F8FAFC] border-[#E2E8F0] focus:border-[#6366F1] focus:bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SECTION 3 — Missing Products */}
                                {editingOrder.status !== 'canceled' && editingOrder.status !== 'delivered' && (
                                    <div className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                                        <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1 h-4 bg-rose-400 rounded-full" />
                                                <span className="text-[11px] font-[800] text-[#475569] uppercase tracking-widest">Missing Products</span>
                                            </div>
                                            {editingOrder.missing.length > 0 && (
                                                <span className="bg-rose-100 text-rose-600 text-[10px] font-[800] px-2 py-0.5 rounded-full border border-rose-200">
                                                    {editingOrder.missing.length} item{editingOrder.missing.length !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-4 space-y-3">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Add specific missing item title..."
                                                    value={missingItemInput}
                                                    onChange={(e) => setMissingItemInput(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && addMissingItem()}
                                                    className="flex-1 bg-[#F8FAFC] border-[1.5px] border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] outline-none focus:border-[#6366F1] focus:bg-white transition-all"
                                                />
                                                <button
                                                    onClick={addMissingItem}
                                                    className="bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-[10px] px-5 text-[12px] font-[800] transition-all shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:-translate-y-0.5"
                                                >
                                                    + Add
                                                </button>
                                            </div>
                                            <div className="min-h-[44px] flex flex-wrap gap-2">
                                                {editingOrder.missing.length > 0 ? (
                                                    editingOrder.missing.map((m, i) => (
                                                        <span key={i} className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-[700] px-3 py-1.5 rounded-full shadow-sm hover:bg-rose-100 transition-colors">
                                                            <Package className="w-3 h-3" />
                                                            {m}
                                                            <button onClick={() => removeMissingItem(i)} className="ml-1 hover:text-rose-900 transition-colors">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[12px] text-[#94A3B8] italic py-2">No missing items reported.</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SECTION 4 — Re-ship + Notes (only shown if missing items exist) */}
                                {editingOrder.status !== 'canceled' && editingOrder.missing.length > 0 && (
                                    <div className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                                        <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
                                            <div className="w-1 h-4 bg-amber-400 rounded-full" />
                                            <span className="text-[11px] font-[800] text-[#475569] uppercase tracking-widest">Re-shipment & Notes</span>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingOrder({ ...editingOrder, reship: true, status: 'partial' })}
                                                    className={`flex items-center justify-center gap-2 py-3 rounded-[12px] border-2 text-[13px] font-[800] transition-all
                                                        ${editingOrder.reship === true
                                                            ? 'bg-[#6366F1] border-[#6366F1] text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)]'
                                                            : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#6366F1] hover:text-[#6366F1]'}`}
                                                >
                                                    🔄 Yes, Re-ship
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingOrder({ ...editingOrder, reship: false, status: 'partial' })}
                                                    className={`flex items-center justify-center gap-2 py-3 rounded-[12px] border-2 text-[13px] font-[800] transition-all
                                                        ${editingOrder.reship === false && editingOrder.missing.length > 0
                                                            ? 'bg-rose-500 border-rose-500 text-white shadow-[0_4px_14px_rgba(239,68,68,0.4)]'
                                                            : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-rose-400 hover:text-rose-500'}`}
                                                >
                                                    🚫 No, Cancel
                                                </button>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-[700] text-[#94A3B8] uppercase tracking-wider flex items-center gap-1">
                                                    Delivery Notes
                                                </label>
                                                <textarea
                                                    rows={2}
                                                    value={editingOrder.notes}
                                                    onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                                                    placeholder="explain missing items situation..."
                                                    className="w-full border-[1.5px] rounded-[10px] p-[10px_14px] text-[13px] outline-none transition-all resize-none bg-[#F8FAFC] border-[#E2E8F0] focus:border-[#6366F1] focus:bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* notes when no missing items or canceled */}
                                {(editingOrder.status === 'canceled' || editingOrder.missing.length === 0) && (
                                    <div className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                                        <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
                                            <div className={`w-1 h-4 ${editingOrder.status === 'canceled' ? 'bg-rose-500' : 'bg-slate-300'} rounded-full`} />
                                            <span className="text-[11px] font-[800] text-[#475569] uppercase tracking-widest">
                                                Delivery Notes
                                            </span>
                                        </div>
                                        <div className="p-4 flex flex-col gap-1.5">
                                            {editingOrder.status === 'canceled' && (
                                                <label className="text-[10px] font-[700] text-[#94A3B8] uppercase tracking-wider flex items-center gap-1">
                                                    Cancellation Reason
                                                </label>
                                            )}
                                            <textarea
                                                rows={2}
                                                value={editingOrder.notes}
                                                onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                                                placeholder={editingOrder.status === 'canceled' ? "specify the reason for cancellation..." : "Notes regarding delivery issues, discrepancies, etc..."}
                                                className="w-full border-[1.5px] rounded-[10px] p-[10px_14px] text-[13px] outline-none transition-all resize-none bg-[#F8FAFC] border-[#E2E8F0] focus:border-[#6366F1] focus:bg-white"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* SYSTEM STAMPS */}
                                {(editingOrder.createdAt || editingOrder.updatedAt) && (
                                    <div className="flex items-center justify-between px-2 pt-2 pb-1 opacity-50">
                                        {editingOrder.createdAt && (
                                            <div className="flex items-center gap-1.5">
                                                <Plus className="w-3 h-3" />
                                                <span className="text-[10px] font-bold uppercase tracking-tighter">System Entry: {editingOrder.createdAt}</span>
                                            </div>
                                        )}
                                        {editingOrder.updatedAt && (
                                            <div className="flex items-center gap-1.5">
                                                <History className="w-3 h-3" />
                                                <span className="text-[10px] font-bold uppercase tracking-tighter">Last Audit: {editingOrder.updatedAt}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* FOOTER */}
                            <div className="px-6 py-4 bg-white border-t border-[#E2E8F0] flex items-center justify-center rounded-b-[28px] sticky bottom-0">
                                <button
                                    onClick={handleSaveOrder}
                                    disabled={isSaving}
                                    className="bg-indigo-600 text-white font-black py-2.5 px-8 rounded-xl text-[13px] shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 flex items-center gap-2.5 min-w-[220px] justify-center"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Complete & Sync</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* MISSING ITEMS DETAIL POPUP */}
            {
                showMissingPopup && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-[#0F1A14]/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => setShowMissingPopup(false)}></div>
                        <div className="bg-white rounded-[18px] w-full max-w-[400px] shadow-[0_24px_64px_rgba(0,0,0,0.2)] relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden border border-[#E4EDE8]">
                            <div className="p-5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <Activity className="w-5 h-5 text-indigo-600" />
                                    <h3 className="text-indigo-900 text-[15px] font-[800]">Partial Delivery Audit</h3>
                                </div>
                                <button onClick={() => setShowMissingPopup(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-2 max-h-[400px] overflow-y-auto">
                                {popupItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-3 bg-[#F9FBFA] border border-[#E4EDE8] p-3 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1.5 h-1.5 rounded-full ${item.type === 'missing' ? 'bg-[#E67E22]' : item.type === 'shipped' ? 'bg-[#10B981]' : 'bg-slate-400'}`}></div>
                                            <span className="text-[13px] font-[700] text-[#0F1A14]">{item.name}</span>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${item.type === 'shipped' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            item.type === 'canceled' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                                'bg-orange-50 text-orange-600 border-orange-100'
                                            }`}>
                                            {item.type}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-[#F6F9F7] flex justify-end px-6">
                                <button onClick={() => setShowMissingPopup(false)} className="bg-[#A93226] text-white px-6 py-2 rounded-lg text-[12px] font-bold shadow-md hover:bg-[#922B21] transition-all">Close</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* RESHIP MANAGEMENT POPUP */}
            {
                isReshipPopupOpen && selectedReshipOrder && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[6px] animate-in fade-in duration-300" onClick={() => setIsReshipPopupOpen(false)}></div>
                        <div className="bg-white rounded-[28px] w-full max-w-[520px] shadow-[0_40px_100px_rgba(0,0,0,0.35)] relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">

                            {/* HEADER */}
                            <div className="relative bg-gradient-to-br from-[#1a1f5e] via-[#2d3494] to-[#3b4fd8] p-6 overflow-hidden">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl border border-white/20 shadow-inner">
                                            🚚
                                        </div>
                                        <div>
                                            <h3 className="text-white text-[18px] font-[900] tracking-tight leading-tight">Re-shipment Items</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-white/60 text-[11px] font-[600]">{selectedReshipOrder.customer}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsReshipPopupOpen(false)}
                                        className="w-9 h-9 rounded-xl bg-white/10 text-white hover:bg-white/25 transition-all flex items-center justify-center border border-white/15"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* ITEMS LIST */}
                            <div className="p-5 space-y-3 max-h-[380px] overflow-y-auto bg-[#F8FAFC]">
                                {selectedReshipOrder.missing.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden hover:border-[#6366F1]/30 hover:shadow-[0_4px_16px_rgba(99,102,241,0.08)] transition-all duration-200"
                                    >
                                        {/* Item name row */}
                                        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                                            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                                                <Package className="w-4 h-4 text-rose-500" />
                                            </div>
                                            <span className="text-[14px] font-[800] text-[#0F172A] flex-1 leading-tight">{item}</span>
                                        </div>

                                        {/* Divider */}
                                        <div className="mx-4 border-t border-dashed border-[#E2E8F0]" />

                                        {/* Value input + actions row */}
                                        {canReship && (
                                            <div className="flex items-center gap-3 px-4 py-3">
                                                {/* Amount input */}
                                                <div className="flex-1 flex items-center gap-2 bg-[#F8FAFC] border-[1.5px] border-[#E2E8F0] rounded-[12px] px-3 py-2 focus-within:border-[#6366F1] focus-within:bg-white transition-all">
                                                    <span className="text-[10px] font-[700] text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">AED</span>
                                                    <input
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={reshipAmounts[idx] || ''}
                                                        onChange={(e) => setReshipAmounts(prev => ({ ...prev, [idx]: e.target.value }))}
                                                        className="w-full bg-transparent border-none text-[15px] font-[900] text-[#1E293B] focus:outline-none placeholder:text-[#CBD5E1] placeholder:font-[400]"
                                                    />
                                                </div>

                                                {/* Ship button */}
                                                <button
                                                    onClick={async () => {
                                                        const amtInput = reshipAmounts[idx];
                                                        if (!amtInput || parseFloat(amtInput) <= 0) {
                                                            showToast('Please enter a valid shipment value', 'error');
                                                            return;
                                                        }
                                                        const amt = parseFloat(amtInput);
                                                        setShippingIdx(idx);
                                                        await handleReshipItem(selectedReshipOrder.id, idx, 'ship', amt);
                                                        setShippingIdx(null);
                                                        setReshipAmounts(prev => {
                                                            const n = { ...prev };
                                                            delete n[idx];
                                                            return n;
                                                        });
                                                        showToast(`Item "${item}" shipped. Invoice value updated.`, 'success');
                                                    }}
                                                    disabled={shippingIdx === idx}
                                                    className="flex items-center justify-center gap-2 w-[90px] bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-[12px] text-[12px] font-[800] transition-all shadow-[0_4px_12px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 whitespace-nowrap"
                                                >
                                                    {shippingIdx === idx ? (
                                                        <span className="w-4 h-4 border-[2px] border-white/30 border-t-white rounded-full animate-spin inline-block" />
                                                    ) : (
                                                        <Truck className="w-3.5 h-3.5" />
                                                    )}
                                                    Ship
                                                </button>

                                                {/* Cancel button */}
                                                <button
                                                    onClick={() => {
                                                        triggerConfirm(
                                                            'Cancel Item Shipment',
                                                            `Are you sure you want to cancel the shipment for "${item}"?`,
                                                            () => {
                                                                handleReshipItem(selectedReshipOrder.id, idx, 'cancel');
                                                                showToast(`Shipment for "${item}" canceled`, 'info');
                                                            },
                                                            'warning'
                                                        );
                                                    }}
                                                    className="flex items-center justify-center gap-2 w-[90px] bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white px-4 py-2.5 rounded-[12px] text-[12px] font-[800] border border-rose-200 hover:border-rose-500 transition-all hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* FOOTER */}
                            <div className="px-5 py-4 bg-white border-t border-[#E2E8F0] flex justify-between items-center">
                                <div className="flex items-center gap-2 text-[12px] text-[#64748B] font-[600]">
                                    <Clock className="w-3.5 h-3.5" />
                                    {selectedReshipOrder.missing.length} item{selectedReshipOrder.missing.length !== 1 ? 's' : ''} remaining
                                </div>
                                <button
                                    onClick={() => setIsReshipPopupOpen(false)}
                                    className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-7 py-2.5 rounded-[12px] text-[13px] font-[800] transition-all shadow-[0_4px_14px_rgba(15,23,42,0.25)] hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* PREMIUM CONFIRMATION MODAL */}
            {confirmConfig.isOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"></div>
                    <div className="bg-white rounded-[24px] w-full max-w-[420px] shadow-[0_25px_70px_rgba(0,0,0,0.3)] relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className={`h-2 w-full ${confirmConfig.type === 'danger' ? 'bg-rose-500' : confirmConfig.type === 'warning' ? 'bg-amber-500' : confirmConfig.type === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                        <div className="p-8">
                            <div className="flex flex-col items-center text-center">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-sm border ${confirmConfig.type === 'danger' ? 'bg-rose-50 text-rose-500 border-rose-100' : confirmConfig.type === 'warning' ? 'bg-amber-50 text-amber-500 border-amber-100' : confirmConfig.type === 'success' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-indigo-50 text-indigo-500 border-indigo-100'
                                    }`}>
                                    {confirmConfig.type === 'danger' && <Trash2 className="w-8 h-8" />}
                                    {confirmConfig.type === 'warning' && <AlertTriangle className="w-8 h-8" />}
                                    {confirmConfig.type === 'success' && <CheckCircle2 className="w-8 h-8" />}
                                    {confirmConfig.type === 'info' && <Bell className="w-8 h-8" />}
                                </div>
                                <h3 className="text-[19px] font-[900] text-slate-900 mb-2 leading-tight">{confirmConfig.title}</h3>
                                <p className="text-[14px] text-slate-500 font-medium leading-relaxed">{confirmConfig.message}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-8">
                                <button
                                    onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                                    className="px-6 py-3.5 rounded-xl text-[14px] font-[800] text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all border border-slate-100"
                                >
                                    No, Keep it
                                </button>
                                <button
                                    onClick={() => {
                                        confirmConfig.onConfirm();
                                        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                                    }}
                                    className={`px-6 py-3.5 rounded-xl text-[14px] font-[900] text-white shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 ${confirmConfig.type === 'danger' ? 'bg-rose-500 shadow-rose-200 hover:bg-rose-600' :
                                        confirmConfig.type === 'warning' ? 'bg-amber-500 shadow-amber-200 hover:bg-amber-600' :
                                            confirmConfig.type === 'success' ? 'bg-emerald-500 shadow-emerald-200 hover:bg-emerald-600' :
                                                'bg-[#4F46E5] shadow-indigo-200 hover:bg-indigo-700'
                                        }`}
                                >
                                    Yes, Proceed
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PREMIUM TOAST NOTIFICATION */}
            {toast.show && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[2000] animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className={`px-6 py-3 rounded-2xl flex items-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur-md border border-white/20 ${toast.type === 'success' ? 'bg-emerald-500/90 text-white' :
                        toast.type === 'error' ? 'bg-rose-500/90 text-white' :
                            'bg-indigo-900/90 text-white'
                        }`}>
                        {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-100" />}
                        {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-100" />}
                        {toast.type === 'info' && <Bell className="w-5 h-5 text-indigo-100" />}
                        <span className="text-[13px] font-[800] tracking-tight">{toast.message}</span>
                    </div>
                </div>
            )}

            {/* FULL PAGE LOADING OVERLAY */}
            {isSaving && (
                <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center animate-in fade-in duration-500">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
                    <div className="relative z-[3001] flex flex-col items-center gap-6">
                        <div className="relative flex items-center justify-center">
                            <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-indigo-500 animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <RefreshCcw className="w-8 h-8 text-white animate-pulse" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-white text-[24px] font-black tracking-tight animate-pulse">Saving Records...</h3>
                            <p className="text-white/60 text-[14px] font-bold">Please wait while we update the database</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                        </div>
                    </div>
                </div>
            )}

        </div >
    );
}
