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
    Download
} from 'lucide-react';

interface DeliveryEntry {
    id: string;
    lpoId: string;
    lpo: string;
    date: string;
    customer: string;
    lpoVal: number;
    invoiceVal: number;
    invoiceDate: string;
    status: 'delivered' | 'pending' | 'partial' | 'delivered_with_cancel';
    missing: string[];
    shippedItems?: string[];
    canceledItems?: string[];
    reship: boolean;
    notes: string;
}

const STATUS_CONFIG = {
    delivered: { label: 'Delivered', color: 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]/10', dot: 'bg-[#6366F1]', icon: '✅' },
    pending: { label: 'Pending', color: 'bg-[#FEF6E8] text-[#9B6000] border-[#F5A623]/10', dot: 'bg-[#F5A623]', icon: '⏳' },
    partial: { label: 'Partial', color: 'bg-[#FEF0E7] text-[#7D4000] border-[#E67E22]/10', dot: 'bg-[#E67E22]', icon: '⚠️' },
    delivered_with_cancel: { label: 'Delivery With Cancel', color: 'bg-[#F4ECF7] text-[#8E44AD] border-[#8E44AD]/10', dot: 'bg-[#9B59B6]', icon: '📦' },
};

export default function DeliveryTrackingTab() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<DeliveryEntry | null>(null);
    const [missingItemInput, setMissingItemInput] = useState('');
    const [showMissingPopup, setShowMissingPopup] = useState(false);
    const [popupItems, setPopupItems] = useState<string[]>([]);
    const [isReshipPopupOpen, setIsReshipPopupOpen] = useState(false);
    const [selectedReshipOrder, setSelectedReshipOrder] = useState<DeliveryEntry | null>(null);
    const [reshipAmounts, setReshipAmounts] = useState<{ [key: number]: string }>({});
    const [shippingIdx, setShippingIdx] = useState<number | null>(null);

    // New LPO Form State
    const [newLpoData, setNewLpoData] = useState({
        lpoNumber: '',
        lpoDate: '',
        customerName: '',
        lpoValue: ''
    });

    // Loading / saving states
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Date filters for All Orders tab
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

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
        setEditingOrder({ ...order }); // Clone to avoid direct mutation
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

    const handleSaveOrder = async () => {
        if (!editingOrder) return;

        // ── Validation ──────────────────────────────────────
        // 1. The three required invoice fields
        if (!editingOrder.invoiceDate) {
            showToast('Please enter the Invoice Date', 'error');
            return;
        }
        if (!editingOrder.invoiceVal || editingOrder.invoiceVal <= 0) {
            showToast('Please enter a valid Invoice Value', 'error');
            return;
        }
        if (editingOrder.status === 'pending') {
            showToast('Please select a Delivery Status', 'error');
            return;
        }

        // 2. If there are missing items → reship choice + notes required
        if (editingOrder.missing.length > 0) {
            if (!editingOrder.notes || !editingOrder.notes.trim()) {
                showToast('Please add a Note for the missing items', 'error');
                return;
            }
        }
        // ────────────────────────────────────────────────────

        setIsSaving(true);
        try {
            const rowIndex = (editingOrder as any)._rowIndex;

            // 1) Update the LPO record fields in LPO Records sheet
            await fetch('/api/delivery', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex,
                    invoiceDate: editingOrder.invoiceDate,
                    invoiceValue: editingOrder.invoiceVal,
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
                            status: 'missing',
                            shipmentValue: 0,
                        }),
                    })
                ));
            }

            setOrders(prev => prev.map(o => o.id === editingOrder.id ? editingOrder : o));
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
        const header = ['LPO ID', 'LPO Number', 'LPO Date', 'Customer Name', 'LPO Value', 'Invoice Date', 'Invoice Value', 'Difference', 'Status', 'Missing Items', 'Re-ship?', 'Notes'];
        const rows: string[][] = filteredOrders.map(o => {
            const diff = o.invoiceVal > 0 ? o.invoiceVal - o.lpoVal : 0;
            return [
                o.lpoId, o.lpo, o.date, o.customer,
                String(o.lpoVal), o.invoiceDate || '', o.invoiceVal > 0 ? String(o.invoiceVal) : '',
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
    // ─────────────────────────────────────────────────────────

    const handleReshipItem = (orderId: string, itemIdx: number, action: 'ship' | 'cancel', amount: number = 0) => {
        setOrders(prev => prev.map(o => {
            if (o.id === orderId) {
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
                    if (canceledItems.length > 0) {
                        finalStatus = 'delivered_with_cancel';
                    } else if (newInvoiceVal > 0) {
                        finalStatus = 'delivered';
                    } else {
                        finalStatus = 'pending';
                    }
                }

                return {
                    ...o,
                    invoiceVal: newInvoiceVal,
                    missing: newMissing,
                    shippedItems,
                    canceledItems,
                    reship: !isFinished,
                    status: finalStatus
                };
            }
            return o;
        }));

        if (selectedReshipOrder && selectedReshipOrder.id === orderId) {
            const item = selectedReshipOrder.missing[itemIdx];
            const newM = selectedReshipOrder.missing.filter((_, i) => i !== itemIdx);

            const sItems = [...(selectedReshipOrder.shippedItems || [])];
            const cItems = [...(selectedReshipOrder.canceledItems || [])];

            if (action === 'ship') sItems.push(item);
            else cItems.push(item);

            if (newM.length === 0) {
                setIsReshipPopupOpen(false);
                setSelectedReshipOrder(null);
            } else {
                setSelectedReshipOrder({
                    ...selectedReshipOrder,
                    invoiceVal: selectedReshipOrder.invoiceVal + amount,
                    missing: newM,
                    shippedItems: sItems,
                    canceledItems: cItems
                });
            }
        }
    };

    // Font imports via style tag to ensure they match mockup exactly
    const fontStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
    .font-inter { font-family: 'Inter', sans-serif; }
    .font-mono-dm { font-family: 'DM Mono', monospace; }
  `;

    const [orders, setOrders] = useState<DeliveryEntry[]>([]);

    // Fetch from Google Sheets on mount
    useEffect(() => {
        setIsLoading(true);
        fetch('/api/delivery')
            .then(res => res.json())
            .then(data => {
                if (data.orders) setOrders(data.orders);
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
            if (data.orders) setOrders(data.orders);
        } catch {
            showToast('Failed to refresh data', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const stats = useMemo(() => {
        const total = orders.length;
        const delivered = orders.filter(o => o.status === 'delivered').length;
        const pending = orders.filter(o => o.status === 'pending').length;
        const reship = orders.filter(o => o.reship).length;
        const missingCount = orders.reduce((acc, o) => acc + o.missing.length, 0);
        const discCount = orders.filter(o => o.invoiceVal > 0 && o.invoiceVal !== o.lpoVal).length;
        const partial = orders.filter(o => o.status === 'partial').length;

        let favor = 0, against = 0;
        orders.forEach(o => {
            if (o.invoiceVal > 0 && o.lpoVal > 0) {
                const d = o.invoiceVal - o.lpoVal;
                if (d < 0) favor += Math.abs(d);
                else if (d > 0) against += d;
            }
        });

        const shippedCount = orders.reduce((acc, o) => acc + (o.shippedItems?.length || 0), 0);
        const canceledCount = orders.reduce((acc, o) => acc + (o.canceledItems?.length || 0), 0);

        const totalTracked = missingCount + canceledCount;

        return {
            total, delivered, pending, reship, missingCount, discCount, partial,
            favor, against, net: against - favor,
            shippedCount, canceledCount, totalTracked
        };
    }, [orders]);

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            // Text search
            const matchesSearch = o.lpo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.customer.toLowerCase().includes(searchQuery.toLowerCase());
            // Status filter
            const matchesFilter = filterStatus === 'all' || o.status === filterStatus;

            // Date filters (applied to LPO date)
            const oDate = o.date ? new Date(o.date) : null;
            const matchesYear = !filterYear || (oDate && oDate.getFullYear().toString() === filterYear);
            const matchesMonth = !filterMonth || (oDate && (oDate.getMonth() + 1).toString().padStart(2, '0') === filterMonth);
            const matchesFrom = !filterDateFrom || (oDate && o.date >= filterDateFrom);
            const matchesTo = !filterDateTo || (oDate && o.date <= filterDateTo);

            return matchesSearch && matchesFilter && matchesYear && matchesMonth && matchesFrom && matchesTo;
        });
    }, [orders, searchQuery, filterStatus, filterYear, filterMonth, filterDateFrom, filterDateTo]);

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
                            <span className="text-[17px] font-[900] tracking-tight leading-none">Delivery Tracking</span>
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
                        { id: 'new_order', label: 'New LPO', icon: Plus },
                        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
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
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <div className="w-12 h-12 border-[3px] border-[#312E81]/20 border-t-[#312E81] rounded-full animate-spin" />
                        <p className="text-[14px] font-[600] text-[#5A7266]">Loading from Google Sheets...</p>
                    </div>
                )}
                {!isLoading && activeTab === 'new_order' && (
                    <div className="max-w-[1000px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="bg-white rounded-[24px] border-[1.5px] border-[#E2E8F0] shadow-[0_10px_40px_rgba(0,0,0,0.04)] overflow-hidden">
                            <div className="p-8 bg-[#312E81] flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-[24px]">📦</div>
                                    <div>
                                        <h3 className="text-white text-[20px] font-[900] tracking-tight">Record New LPO</h3>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 space-y-8">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[12px] font-[700] text-[#2C3E35] uppercase tracking-wider">LPO Number <span className="text-[#E74C3C]">*</span></label>
                                        <input
                                            type="text"
                                            placeholder="e.g. LPO-2025-0142"
                                            value={newLpoData.lpoNumber}
                                            onChange={(e) => setNewLpoData(prev => ({ ...prev, lpoNumber: e.target.value }))}
                                            className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[10px] p-[12px_16px] text-[14px] outline-none focus:border-[#4F46E5] focus:bg-white transition-all shadow-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[12px] font-[700] text-[#2C3E35] uppercase tracking-wider">LPO Date <span className="text-[#E74C3C]">*</span></label>
                                        <input
                                            type="date"
                                            value={newLpoData.lpoDate}
                                            onChange={(e) => setNewLpoData(prev => ({ ...prev, lpoDate: e.target.value }))}
                                            className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[10px] p-[12px_16px] text-[14px] outline-none focus:border-[#4F46E5] focus:bg-white transition-all appearance-none shadow-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[12px] font-[700] text-[#2C3E35] uppercase tracking-wider">Customer Name <span className="text-[#E74C3C]">*</span></label>
                                        <input
                                            type="text"
                                            placeholder="Customer / Company name"
                                            value={newLpoData.customerName}
                                            onChange={(e) => setNewLpoData(prev => ({ ...prev, customerName: e.target.value }))}
                                            className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[10px] p-[12px_16px] text-[14px] outline-none focus:border-[#4F46E5] focus:bg-white transition-all shadow-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[12px] font-[700] text-[#2C3E35] uppercase tracking-wider">LPO Value <span className="text-[#E74C3C]">*</span></label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={newLpoData.lpoValue}
                                            onChange={(e) => setNewLpoData(prev => ({ ...prev, lpoValue: e.target.value }))}
                                            className="bg-[#F6F9F7] border-[1.5px] border-[#E4EDE8] rounded-[10px] p-[12px_16px] text-[14px] outline-none focus:border-[#4F46E5] focus:bg-white transition-all font-mono-dm shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-[#F6F9F7]/50 border-t border-[#E4EDE8] flex items-center justify-end gap-4">
                                <button
                                    onClick={async () => {
                                        if (!newLpoData.lpoNumber || !newLpoData.lpoDate || !newLpoData.customerName || !newLpoData.lpoValue) {
                                            showToast('Please fill all required fields', 'error');
                                            return;
                                        }
                                        setIsSaving(true);
                                        try {
                                            const lpoId = `L-${(orders.length + 1).toString().padStart(3, '0')}`;
                                            await fetch('/api/delivery', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    action: 'add_lpo',
                                                    lpoNumber: newLpoData.lpoNumber,
                                                    lpoDate: newLpoData.lpoDate,
                                                    customerName: newLpoData.customerName,
                                                    lpoValue: parseFloat(newLpoData.lpoValue),
                                                }),
                                            });
                                            await refreshOrders();
                                            setNewLpoData({ lpoNumber: '', lpoDate: '', customerName: '', lpoValue: '' });
                                            setActiveTab('dashboard');
                                            showToast('LPO Recorded successfully', 'success');
                                        } catch {
                                            showToast('Failed to save LPO', 'error');
                                        } finally {
                                            setIsSaving(false);
                                        }
                                    }}
                                    disabled={isSaving}
                                    className="bg-[#312E81] text-white font-[800] py-3.5 px-10 rounded-[12px] text-[14px] flex items-center gap-2 transition-all shadow-[0_4px_16px_rgba(49,46,129,0.35)] hover:bg-[#4F46E5] hover:translate-y-[-2px] active:translate-y-[0px] disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? '⏳ Saving...' : '📂 Create LPO Record'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!isLoading && activeTab === 'dashboard' && (
                    <>
                        {/* KPI GRID */}
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-[14px] mb-[26px]">
                            {[
                                { label: 'Total Orders', value: stats.total, trend: `${stats.total} orders`, colorClass: 'green', icon: '📦' },
                                { label: 'Delivered', value: stats.delivered, trend: `${Math.round(stats.delivered / stats.total * 100)}%`, colorClass: 'blue', icon: '✅' },
                                { label: 'Partial', value: stats.partial, trend: `${Math.round(stats.partial / stats.total * 100)}%`, colorClass: 'orange', icon: '⚠️' },
                                { label: 'Pending', value: stats.pending, trend: `${Math.round(stats.pending / stats.total * 100)}%`, colorClass: 'gold', icon: '⏳' },
                                { label: 'Pending Re-ship', value: stats.reship, trend: `${stats.reship} customers`, colorClass: 'orange', icon: '🔄' },
                                { label: 'Items Shipped', value: stats.shippedCount, trend: `Success`, colorClass: 'green', icon: '🚚' },
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
                        <div className="mb-[24px]">
                            {/* STATS & FINANCES */}
                            <div className="bg-white rounded-[16px] border-[1.5px] border-[#E4EDE8] shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-8">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                    {/* Breakdown */}
                                    <div>
                                        <div className="flex items-center gap-3 text-[16px] font-[800] text-[#0F1A14] mb-[24px]">
                                            <div className="w-[40px] h-[40px] bg-[#E8F7EF] rounded-[10px] flex items-center justify-center text-[20px] text-[#1A8A47] shadow-sm">📊</div>
                                            Order Status Breakdown
                                        </div>
                                        <div className="space-y-[18px]">
                                            {[
                                                { label: 'Delivered', count: stats.delivered, color: '#2DBE6C' },
                                                { label: 'Partial', count: stats.partial, color: '#E67E22' },
                                                { label: 'With Cancel', count: orders.filter(o => o.status === 'delivered_with_cancel').length, color: '#8E44AD' },
                                                { label: 'Pending', count: stats.pending, color: '#F5A623' },
                                            ].map((s, i) => {
                                                const pct = stats.total > 0 ? Math.round(s.count / stats.total * 100) : 0;
                                                return (
                                                    <div key={i} className="flex flex-col gap-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-[12px] text-[#5A7266] font-[700] uppercase tracking-wider">{s.label}</div>
                                                            <div className="text-[14px] font-[900] font-mono-dm" style={{ color: s.color }}>
                                                                {pct}% <span className="text-[11px] opacity-60 ml-1">({s.count})</span>
                                                            </div>
                                                        </div>
                                                        <div className="w-full h-[12px] bg-[#ECF5EF] rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]">
                                                            <div
                                                                className="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                                                                style={{ width: `${pct}%`, backgroundColor: s.color }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Finances */}
                                    <div className="lg:border-l lg:border-[#E4EDE8] lg:pl-12">
                                        <div className="flex items-center gap-3 text-[16px] font-[800] text-[#0F1A14] mb-[24px]">
                                            <div className="w-[40px] h-[40px] bg-[#EBF5FB] rounded-[10px] flex items-center justify-center text-[20px] text-[#2980B9] shadow-sm">💰</div>
                                            Financial Discrepancy Summary
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px]">
                                            <div className="bg-[#FDEDEC] rounded-[14px] p-[20px_16px] text-center border border-[#E74C3C]/10 shadow-[0_4px_12px_rgba(231,76,60,0.08)] transition-transform hover:scale-[1.02]">
                                                <div className="text-[10px] text-[#5A7266] font-extrabold uppercase mb-[8px] tracking-widest">Invoice Under LPO</div>
                                                <div className="text-[11px] text-[#A93226] font-[600] mb-[6px] bg-white/40 rounded-full py-0.5 px-2 inline-block">We take less 📉</div>
                                                <div className="text-[22px] font-[950] font-mono-dm text-[#E74C3C] tracking-tight">{stats.favor.toLocaleString()}</div>
                                            </div>
                                            <div className="bg-[#EEF2FF] rounded-[14px] p-[20px_16px] text-center border border-[#4F46E5]/10 shadow-[0_4px_12px_rgba(79,70,229,0.08)] transition-transform hover:scale-[1.02]">
                                                <div className="text-[10px] text-[#64748B] font-extrabold uppercase mb-[8px] tracking-widest">Invoice Over LPO</div>
                                                <div className="text-[11px] text-[#4F46E5] font-[600] mb-[6px] bg-white/40 rounded-full py-0.5 px-2 inline-block">We take more 📈</div>
                                                <div className="text-[22px] font-[950] font-mono-dm text-[#312E81] tracking-tight">{stats.against.toLocaleString()}</div>
                                            </div>
                                            <div className="bg-[#F6F9F7] rounded-[14px] p-[20px_16px] text-center border border-[#B2C4BB]/30 shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-transform hover:scale-[1.02]">
                                                <div className="text-[10px] text-[#5A7266] font-extrabold uppercase mb-[8px] tracking-widest">Net Difference</div>
                                                <div className="text-[11px] text-[#5A7266] font-[600] mb-[6px] bg-white/40 rounded-full py-0.5 px-2 inline-block">Overall balance</div>
                                                <div className={`text-[22px] font-[950] font-mono-dm tracking-tight ${stats.net >= 0 ? 'text-[#4F46E5]' : 'text-[#E74C3C]'}`}>
                                                    {stats.net >= 0 ? '+' : '-'}{Math.abs(stats.net).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {!isLoading && activeTab === 'orders' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center justify-between mb-[14px]">
                            <div className="flex items-center gap-2 text-[15px] font-[700] text-[#0F1A14]">
                                <div className="w-[3px] h-[16px] bg-[#4F46E5] rounded-[3px]"></div>
                                All Orders Register
                            </div>
                            <div className="flex items-center gap-[6px]">
                                {['all', 'delivered', 'partial', 'delivered_with_cancel', 'pending'].map((s) => (
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
                                        {s === 'all' ? 'All' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label}
                                    </button>
                                ))}
                                <div className="w-px h-4 bg-[#B2C4BB] mx-1"></div>
                                <button onClick={exportOrdersCSV} className="flex items-center gap-1.5 text-[11px] font-[600] text-[#5A7266] bg-white border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 hover:border-[#4F46E5] hover:text-[#4F46E5] transition-all">
                                    <Download className="w-3 h-3" /> Export List
                                </button>
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
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">LPO ID</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">LPO Number</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">LPO Date</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Customer Name</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">LPO Value</th>
                                            <th className="p-[12px_16px] text-[10.5px] font-[600] text-white/80 uppercase tracking-[0.6px] text-center">Invoice DATE</th>
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
                                            <tr><td colSpan={12} className="text-center py-20 text-[#B2C4BB] font-medium">No orders matching your filters</td></tr>
                                        ) : (
                                            filteredOrders.map((o) => {
                                                const diff = o.invoiceVal > 0 ? o.invoiceVal - o.lpoVal : 0;
                                                const s = STATUS_CONFIG[o.status];
                                                return (
                                                    <tr key={o.id} className="hover:bg-[#F0FAF4] transition-colors group">
                                                        <td className="p-[12px_16px] text-center"><span className="font-mono-dm text-[12px] font-[500] text-[#5A7266] bg-[#F6F9F7] px-[9px] py-[3px] rounded-[5px] border border-[#E4EDE8]">{o.lpoId}</span></td>
                                                        <td className="p-[12px_16px] text-center"><span className="font-mono-dm text-[12px] font-[500] text-[#4F46E5] bg-[#EEF2FF] px-[9px] py-[3px] rounded-[5px] border border-[#4F46E5]/12">{o.lpo}</span></td>
                                                        <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#2C3E35]">{o.date}</td>
                                                        <td className="p-[12px_16px] text-center font-[600] text-[12.5px] text-[#0F1A14]">{o.customer}</td>
                                                        <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#5A7266]">{o.lpoVal.toLocaleString()}</td>
                                                        <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#2C3E35]">{o.invoiceDate || '—'}</td>
                                                        <td className="p-[12px_16px] text-center font-mono-dm text-[12.5px] text-[#5A7266]">{o.invoiceVal > 0 ? o.invoiceVal.toLocaleString() : '—'}</td>
                                                        <td className="p-[12px_16px] text-center">
                                                            {o.invoiceVal === 0 ? '—' :
                                                                <span className={`text-[12px] font-[700] font-mono-dm ${diff > 0 ? 'text-[#E74C3C]' : diff < 0 ? 'text-[#1A8A47]' : 'text-[#B2C4BB]'}`}>
                                                                    {diff === 0 ? '0' : (diff > 0 ? `+${diff.toLocaleString()}` : `-${Math.abs(diff).toLocaleString()}`)}
                                                                </span>
                                                            }
                                                        </td>
                                                        <td className="p-[12px_16px] text-center">
                                                            <div className={`inline-flex items-center gap-[5px] px-[10px] py-[3px] rounded-[20px] text-[11px] font-[600] border border-transparent ${s.color}`}>
                                                                <div className={`w-[5px] h-[5px] rounded-full ${s.dot}`}></div>
                                                                {s.label}
                                                            </div>
                                                        </td>
                                                        <td className="p-[12px_16px] text-center">
                                                            {o.missing.length > 0 ? (
                                                                <button
                                                                    onClick={() => { setPopupItems(o.missing); setShowMissingPopup(true); }}
                                                                    className="bg-[#FDEDEC] text-[#A93226] text-[11px] font-bold px-3 py-1 rounded-full hover:bg-[#FADBD8] transition-colors shadow-sm"
                                                                >
                                                                    {o.missing.length} Items 📦
                                                                </button>
                                                            ) : '—'}
                                                        </td>
                                                        <td className="p-[12px_16px] text-center">
                                                            {o.reship ? <span className="bg-[#EBF5FB] text-[#2980B9] text-[10px] font-bold px-2 py-0.5 rounded-full">🔄 YES</span> : o.missing.length > 0 ? <span className="text-[#A93226] font-bold text-[10px]">🚫 NO</span> : '—'}
                                                        </td>
                                                        <td className="p-[12px_16px] text-center">
                                                            <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => openEditModal(o)}
                                                                    className="w-7 h-7 bg-[#EBF5FB] text-[#2980B9] rounded-md flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
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
                            <button onClick={exportMissingItemsCSV} className="flex items-center gap-1.5 text-[11px] font-[600] text-[#5A7266] bg-white border-[1.5px] border-[#E4EDE8] rounded-[8px] px-3 py-1.5 hover:border-[#2980B9] transition-all">
                                <Download className="w-3 h-3" /> Export List
                            </button>
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
                                        {orders.flatMap(o => [
                                            ...o.missing.map((m, i) => ({ item: m, status: 'pending', id: `${o.id}-m-${i}`, order: o })),
                                            ...(o.canceledItems || []).map((m, i) => ({ item: m, status: 'canceled', id: `${o.id}-c-${i}`, order: o }))
                                        ]).length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-20 text-center text-[#B2C4BB] font-medium italic">
                                                    No items found in the log
                                                </td>
                                            </tr>
                                        ) : (
                                            orders.flatMap(o => [
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
                                        {orders.filter(o => o.reship).map((o) => (
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
                                                        {o.missing.length} Items 📦
                                                    </button>
                                                </td>
                                                <td className="p-[12px_16px] text-center font-[500] text-[12px] text-[#5A7266] italic max-w-[200px] truncate">
                                                    {o.notes || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                        {!orders.some(o => o.reship) && (
                                            <tr>
                                                <td colSpan={6} className="py-20 text-center text-[#B2C4BB] font-medium italic">
                                                    No re-shipments pending
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

            {/* UPDATE DELIVERY MODAL (Employee 2) */}
            {
                isEditModalOpen && editingOrder && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-[#0F1A14]/40 backdrop-blur-[4px] animate-in fade-in duration-300" onClick={() => setIsEditModalOpen(false)}></div>
                        <div className="bg-white rounded-[20px] w-full max-w-[680px] max-h-[90vh] overflow-y-auto shadow-[0_32px_80px_rgba(0,0,0,0.25)] relative z-10 animate-in zoom-in-95 duration-200">
                            <div className="p-6 bg-[#2980B9] rounded-t-[20px] flex items-center justify-between sticky top-0 z-20">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white text-[20px]">🚚</div>
                                    <div>
                                        <h3 className="text-white text-[16px] font-[800]">Update Delivery Progress</h3>
                                        <p className="text-white/70 text-[10px] uppercase tracking-wider font-bold">LPO: {editingOrder.lpo} · {editingOrder.customer}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="w-8 h-8 rounded-lg bg-white/14 text-white hover:bg-white/24 transition-all flex items-center justify-center"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                {/* RO LPO Info Summary */}
                                <div className="bg-[#F6F9F7] border border-[#E4EDE8] rounded-[14px] p-4 flex items-center justify-between gap-4">
                                    <div>
                                        <div className="text-[10px] text-[#5A7266] font-bold uppercase tracking-widest mb-1">Original Order Value</div>
                                        <div className="text-[18px] font-[900] font-mono-dm text-[#0F1A14]">{editingOrder.lpoVal.toLocaleString()}</div>
                                    </div>
                                    <div className="w-px h-10 bg-[#E4EDE8]"></div>
                                    <div>
                                        <div className="text-[10px] text-[#5A7266] font-bold uppercase tracking-widest mb-1">Recording Date</div>
                                        <div className="text-[14px] font-[700] text-[#0F1A14]">{editingOrder.date}</div>
                                    </div>
                                    <div className="ml-auto bg-white/60 border border-white px-3 py-1.5 rounded-lg text-[11px] font-bold text-[#2980B9]">
                                        LPO-ID: {editingOrder.lpoId}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-[800] text-[#2C3E35] uppercase tracking-widest">
                                            Delivery Status <span className="text-[#E74C3C]">*</span>
                                        </label>
                                        <select
                                            value={editingOrder.status}
                                            onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value as any })}
                                            className={`border-[1.75px] rounded-[10px] p-[11px_14px] text-[13px] font-medium outline-none transition-all appearance-none cursor-pointer shadow-sm ${editingOrder.status === 'pending'
                                                ? 'border-[#E74C3C] bg-[#FFF5F5] focus:border-[#E74C3C]'
                                                : 'bg-[#F6F9F7] border-[#E4EDE8] focus:border-[#2980B9] focus:bg-white'
                                                }`}
                                        >
                                            <option value="delivered">✅ Fully Delivered</option>
                                            <option value="partial">⚠️ Partial Delivery</option>
                                            <option value="pending">⏳ Pending</option>
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-[800] text-[#2C3E35] uppercase tracking-widest">
                                            Invoice Date <span className="text-[#E74C3C]">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={editingOrder.invoiceDate || ''}
                                            onChange={(e) => setEditingOrder({ ...editingOrder, invoiceDate: e.target.value })}
                                            className={`border-[1.75px] rounded-[10px] p-[11px_14px] text-[13px] font-medium outline-none transition-all appearance-none shadow-sm ${!editingOrder.invoiceDate
                                                ? 'border-[#E74C3C] bg-[#FFF5F5] focus:border-[#E74C3C]'
                                                : 'bg-[#F6F9F7] border-[#E4EDE8] focus:border-[#2980B9] focus:bg-white'
                                                }`}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-[800] text-[#2C3E35] uppercase tracking-widest">
                                            Actual Invoice Value <span className="text-[#E74C3C]">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={editingOrder.invoiceVal || ''}
                                            onChange={(e) => setEditingOrder({ ...editingOrder, invoiceVal: Number(e.target.value) })}
                                            className={`border-[1.75px] rounded-[10px] p-[11px_14px] text-[13px] font-[700] outline-none transition-all font-mono-dm shadow-sm ${!editingOrder.invoiceVal || editingOrder.invoiceVal <= 0
                                                ? 'border-[#E74C3C] bg-[#FFF5F5] focus:border-[#E74C3C]'
                                                : 'bg-[#F6F9F7] border-[#E4EDE8] focus:border-[#2980B9] focus:bg-white'
                                                }`}
                                        />
                                    </div>

                                    <div className="col-span-full flex flex-col gap-1.5">
                                        <label className="text-[11px] font-[800] text-[#2C3E35] uppercase tracking-widest">Missing Products</label>
                                        <div className="flex gap-2.5">
                                            <input
                                                type="text"
                                                placeholder="Add specific missing item title..."
                                                value={missingItemInput}
                                                onChange={(e) => setMissingItemInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && addMissingItem()}
                                                className="flex-1 bg-[#F6F9F7] border-[1.75px] border-[#E4EDE8] rounded-[10px] p-[11px_14px] text-[13px] outline-none focus:border-[#2980B9] transition-all"
                                            />
                                            <button
                                                onClick={addMissingItem}
                                                className="bg-[#2980B9] text-white rounded-[10px] px-5 text-[12px] font-bold hover:bg-[#1C5D85] transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        <div className="mt-2 bg-[#F6F9F7] border border-[#E4EDE8] rounded-[10px] p-2.5 min-h-[44px] flex flex-wrap gap-1.5">
                                            {editingOrder.missing.length > 0 ? (
                                                editingOrder.missing.map((m, i) => (
                                                    <span key={i} className="bg-white border border-[#E4EDE8] text-[#2980B9] text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-sm">
                                                        {m} <X className="w-2.5 h-2.5 cursor-pointer hover:text-red-500" onClick={() => removeMissingItem(i)} />
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[11px] text-[#B2C4BB] italic py-1.5 px-1">No missing items reported.</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="col-span-full flex flex-col gap-1.5">
                                        <label className="text-[11px] font-[800] text-[#2C3E35] uppercase tracking-widest flex items-center gap-1">
                                            Will missing items be re-shipped?
                                            {editingOrder.missing.length > 0 && <span className="text-[#E74C3C]">*</span>}
                                        </label>
                                        <div className={`flex p-1 border-[1.75px] rounded-[11px] overflow-hidden shadow-inner ${editingOrder.missing.length > 0 && editingOrder.reship === undefined
                                            ? 'bg-[#FFF5F5] border-[#E74C3C]'
                                            : 'bg-[#F6F9F7] border-[#E4EDE8]'
                                            }`}>
                                            <button
                                                onClick={() => setEditingOrder({ ...editingOrder, reship: true })}
                                                className={`flex-1 py-2 text-[12px] font-[700] rounded-lg transition-all ${editingOrder.reship ? 'bg-[#2980B9] text-white shadow-md' : 'text-[#5A7266]'}`}
                                            >
                                                🔄 Yes, Re-ship
                                            </button>
                                            <button
                                                onClick={() => setEditingOrder({ ...editingOrder, reship: false })}
                                                className={`flex-1 py-2 text-[12px] font-[700] rounded-lg transition-all ${!editingOrder.reship && editingOrder.missing.length > 0 ? 'bg-[#E74C3C] text-white shadow-md' : 'text-[#5A7266]'}`}
                                            >
                                                🚫 No, Don't Ship
                                            </button>
                                        </div>
                                    </div>

                                    <div className="col-span-full flex flex-col gap-1.5">
                                        <label className="text-[11px] font-[800] text-[#2C3E35] uppercase tracking-widest flex items-center gap-1">
                                            Delivery Notes
                                            {editingOrder.missing.length > 0 && (
                                                <span className="text-[#E74C3C]">* required for missing items</span>
                                            )}
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={editingOrder.notes}
                                            onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                                            placeholder={editingOrder.missing.length > 0 ? 'Required: explain missing items situation...' : 'Notes regarding delivery issues, discrepancies, etc...'}
                                            className={`border-[1.75px] rounded-[10px] p-[11px_14px] text-[13px] outline-none transition-all resize-none ${editingOrder.missing.length > 0 && !editingOrder.notes?.trim()
                                                ? 'border-[#E74C3C] bg-[#FFF5F5] focus:border-[#E74C3C]'
                                                : 'bg-[#F6F9F7] border-[#E4EDE8] focus:border-[#2980B9] focus:bg-white'
                                                }`}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-[#F6F9F7]/50 border-t border-[#E4EDE8] flex items-center justify-between">
                                <button
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="text-[13px] font-[700] text-[#5A7266] uppercase tracking-widest hover:text-[#0F1A14] transition-colors"
                                >
                                    Skip
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="bg-[#EBF5FB] text-[#2980B9] font-[700] py-3 px-6 rounded-xl text-[13px] hover:bg-[#D4EAF8] transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveOrder}
                                        disabled={isSaving}
                                        className="bg-[#2980B9] text-white font-[800] py-3 px-10 rounded-xl text-[13px] shadow-[0_4px_16px_rgba(41,128,185,0.3)] hover:bg-[#1C5D85] hover:translate-y-[-1px] transition-all disabled:opacity-80 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2.5 min-w-[160px] justify-center"
                                    >
                                        {isSaving ? (
                                            <>
                                                <span className="w-4 h-4 border-[2.5px] border-white/30 border-t-white rounded-full animate-spin inline-block" />
                                                Syncing...
                                            </>
                                        ) : (
                                            <>💾 Complete & Sync</>
                                        )}
                                    </button>
                                </div>
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
                            <div className="p-5 bg-[#FDEDEC] border-b border-[#E74C3C]/10 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-[18px]">📦</span>
                                    <h3 className="text-[#A93226] text-[15px] font-[800]">Missing Items List</h3>
                                </div>
                                <button onClick={() => setShowMissingPopup(false)} className="text-[#A93226]/60 hover:text-[#A93226] transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-2">
                                {popupItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-[#F9FBFA] border border-[#E4EDE8] p-3 rounded-xl">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#E74C3C]"></div>
                                        <span className="text-[13px] font-[700] text-[#0F1A14]">{item}</span>
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
                        <div className="absolute inset-0 bg-[#0F1A14]/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => setIsReshipPopupOpen(false)}></div>
                        <div className="bg-white rounded-[24px] w-full max-w-[500px] shadow-[0_32px_80px_rgba(0,0,0,0.3)] relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden border border-[#E4EDE8]">
                            <div className="p-6 bg-[#2980B9] text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-[20px]">📦</div>
                                    <div>
                                        <h3 className="text-[16px] font-[800]">Manage Re-shipment Items</h3>
                                        <p className="text-white/70 text-[10px] uppercase tracking-wider font-bold">{selectedReshipOrder.customer} · {selectedReshipOrder.lpo}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsReshipPopupOpen(false)} className="w-8 h-8 rounded-lg bg-white/14 text-white hover:bg-white/24 transition-all flex items-center justify-center"><X className="w-4 h-4" /></button>
                            </div>

                            <div className="p-6 bg-[#F6F9F7]/50 border-b border-[#E4EDE8]">
                                <p className="text-[13px] text-[#5A7266] leading-relaxed">
                                    Select the action for each missing item. Shipping an item will mark it as delivered, while canceling will remove it from the pending shipment list.
                                </p>
                            </div>

                            <div className="p-6 space-y-3 max-h-[350px] overflow-y-auto">
                                {selectedReshipOrder.missing.map((item, idx) => (
                                    <div key={idx} className="flex flex-col bg-white border border-[#E4EDE8] p-4 rounded-[16px] shadow-sm hover:border-[#2980B9]/30 transition-all group/item">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-[#E74C3C] group-hover/item:scale-125 transition-transform"></div>
                                                <span className="text-[14px] font-[700] text-[#0F1A14]">{item}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={async () => {
                                                        const amtInput = reshipAmounts[idx];
                                                        if (!amtInput || parseFloat(amtInput) <= 0) {
                                                            showToast('Please enter a valid shipment value', 'error');
                                                            return;
                                                        }
                                                        const amt = parseFloat(amtInput);
                                                        setShippingIdx(idx);
                                                        try {
                                                            await fetch('/api/delivery', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    action: 'add_item',
                                                                    lpoId: selectedReshipOrder.lpoId,
                                                                    itemName: item,
                                                                    status: 'shipped',
                                                                    shipmentValue: amt,
                                                                }),
                                                            });
                                                        } catch { /* best-effort */ } finally {
                                                            setShippingIdx(null);
                                                        }
                                                        handleReshipItem(selectedReshipOrder.id, idx, 'ship', amt);
                                                        setReshipAmounts(prev => {
                                                            const n = { ...prev };
                                                            delete n[idx];
                                                            return n;
                                                        });
                                                        showToast(`Item "${item}" shipped. Invoice value updated.`, 'success');
                                                    }}
                                                    disabled={shippingIdx === idx}
                                                    className="bg-[#2DBE6C] text-white hover:bg-[#1A8A47] px-4 py-1.5 rounded-lg text-[11px] font-[800] transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-80 disabled:cursor-not-allowed min-w-[64px] justify-center"
                                                >
                                                    {shippingIdx === idx ? (
                                                        <span className="w-3.5 h-3.5 border-[2px] border-white/30 border-t-white rounded-full animate-spin inline-block" />
                                                    ) : (
                                                        <><Truck className="w-3 h-3" /> Ship</>
                                                    )}
                                                </button>
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
                                                    className="bg-[#FDEDEC] text-[#A93226] hover:bg-[#E74C3C] hover:text-white px-3 py-1.5 rounded-lg text-[11px] font-[800] transition-all flex items-center gap-1"
                                                >
                                                    <XCircle className="w-3 h-3" /> Cancel
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 px-5 py-2 bg-[#F6F9F7] rounded-lg border border-[#E4EDE8]/60">
                                            <span className="text-[10px] font-bold text-[#5A7266] uppercase whitespace-nowrap">Shipment Value:</span>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={reshipAmounts[idx] || ''}
                                                onChange={(e) => setReshipAmounts(prev => ({ ...prev, [idx]: e.target.value }))}
                                                className="w-full bg-transparent border-none text-[13px] font-mono-dm font-bold text-[#0D5C2E] focus:outline-none placeholder:text-[#B2C4BB]"
                                            />
                                            <span className="text-[11px] font-bold text-[#B2C4BB]">AED</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 bg-[#F6F9F7] flex justify-between items-center border-t border-[#E4EDE8]">
                                <div className="text-[11px] text-[#5A7266] font-bold italic">
                                    {selectedReshipOrder.missing.length} items remaining
                                </div>
                                <button onClick={() => setIsReshipPopupOpen(false)} className="bg-[#5A7266] text-white px-8 py-2.5 rounded-xl text-[13px] font-bold shadow-md hover:bg-[#2C3E35] transition-all">Close</button>
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

        </div >
    );
}
