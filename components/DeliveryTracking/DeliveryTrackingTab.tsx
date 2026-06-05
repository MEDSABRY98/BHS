'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    RefreshCcw,
    Plus,
    Search,
    ArrowRight,
    Pencil,
    X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from '../01-Unified/Notification';
import { DeliveryEntry } from './types';

// Import subcomponents
import NewOrderTab from './NewOrderTab';
import OrdersTab from './OrdersTab';

export default function DeliveryTrackingTab() {
    const [activeTab, setActiveTab] = useState('orders');

    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [customers, setCustomers] = useState<{ customerId: string, customerName: string, customerCity: string }[]>([]);

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



    // Date / location filters
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    const [orders, setOrders] = useState<DeliveryEntry[]>([]);

    // Edit LPO Modal State
    const [editingOrder, setEditingOrder] = useState<DeliveryEntry | null>(null);
    const [editForm, setEditForm] = useState({
        lpoNumber: '',
        lpoDate: '',
        lpoDeliveryDate: '',
        customerId: '',
        customerSearch: '',
        lpoValue: '',
        showDropdown: false
    });

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

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') {
            toast.success(message);
        } else if (type === 'error') {
            toast.error(message);
        } else {
            toast.info(message);
        }
    };

    const triggerConfirm = (
        title: string,
        message: string,
        onConfirm: () => void,
        type: 'danger' | 'warning' | 'info' | 'success' = 'danger'
    ) => {
        setConfirmConfig({ isOpen: true, title, message, onConfirm, type });
    };

    // ── User Action Permissions ─────────────────────────────
    const deliveryActions: string[] = useMemo(() => {
        try {
            const saved = localStorage.getItem('currentUser');
            if (!saved) return [];
            const user = JSON.parse(saved);

            const userName = user.name?.toLowerCase() || '';
            const userRole = user.role || '';

            if (userRole === 'Admin' || userName === 'med sabry') {
                return ['add', 'edit', 'delete', 'download'];
            }

            let perms: any = {};
            try {
                perms = JSON.parse(userRole);
            } catch (e) {
                return [];
            }

            return perms['delivery-tracking-actions'] || [];
        } catch { return []; }
    }, [isLoading]);

    const canAdd = deliveryActions.includes('add');
    const canEdit = deliveryActions.includes('edit');
    const canDelete = deliveryActions.includes('delete');
    const canDownload = deliveryActions.includes('download');

    // Fetch from Google Sheets on mount
    useEffect(() => {
        setIsLoading(true);
        fetch('/api/DeliveryTracking')
            .then(res => res.json())
            .then(data => {
                if (data.orders) {
                    const normalized = data.orders
                        .filter((o: any) => !(o.lpo || '').toString().includes('مكرر'))
                        .map((o: any) => ({
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
            const res = await fetch('/api/DeliveryTracking');
            const data = await res.json();
            if (data.orders) {
                const normalized = data.orders
                    .filter((o: any) => !(o.lpo || '').toString().includes('مكرر'))
                    .map((o: any) => ({
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

    const openEditModal = (order: DeliveryEntry) => {
        // Find matching customer based on customer name
        const matched = customers.find(c => c.customerName === order.customer);
        setEditingOrder(order);
        setEditForm({
            lpoNumber: order.lpo,
            lpoDate: order.date,
            lpoDeliveryDate: order.deliveryDate || '',
            customerId: matched ? matched.customerId : order.customerId || '',
            customerSearch: '',
            lpoValue: (order.lpoVal || 0).toString(),
            showDropdown: false
        });
    };

    const handleSaveEdit = async () => {
        if (!editingOrder) return;
        if (!editForm.lpoNumber || !editForm.lpoDate || !editForm.customerId || !editForm.lpoValue) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/DeliveryTracking', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingOrder.id,
                    lpoNumber: editForm.lpoNumber,
                    lpoDate: editForm.lpoDate,
                    deliveryDate: editForm.lpoDeliveryDate,
                    customerId: editForm.customerId,
                    lpoValue: parseFloat(editForm.lpoValue)
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to update LPO');
            }

            await refreshOrders();
            setEditingOrder(null);
            showToast('LPO updated successfully', 'success');
        } catch (error: any) {
            console.error('Failed to update LPO:', error);
            showToast(error.message || 'Failed to update LPO', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateStatusAndDate = async (orderId: string, status: string, postponedDate?: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        setIsSaving(true);
        try {
            await fetch('/api/DeliveryTracking', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    status,
                    postponedDate,
                }),
            });

            setOrders(prev => prev.map(o => o.id === orderId ? {
                ...o,
                status: status as any,
                deliveryDate: postponedDate || o.deliveryDate,
                postponedDate: postponedDate || o.postponedDate
            } : o));
            showToast('Status updated successfully', 'success');
        } catch (err) {
            console.error('Failed to update status:', err);
            showToast('Failed to update status', 'error');
        } finally {
            setIsSaving(false);
        }
    };

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

    const filteredOrders = useMemo(() => {
        if (!orders) return [];
        return orders
            .filter(o => {
                const lpo = o.lpo || '';
                const lpoId = o.lpoId || '';
                const invoiceNumber = o.invoiceNumber || '';
                const customer = o.customer || '';

                const matchesSearch = lpo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    lpoId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    customer.toLowerCase().includes(searchQuery.toLowerCase());

                const normalizedStatus = (o.status || 'pending').toLowerCase();
                const matchesFilter = filterStatus === 'all' || normalizedStatus === filterStatus;

                const oDateStr = o.date || '';
                const oDate = oDateStr ? new Date(oDateStr) : null;
                const matchesYear = !filterYear || (oDate && !isNaN(oDate.getTime()) && oDate.getFullYear().toString() === filterYear);
                const matchesMonth = !filterMonth || (oDate && !isNaN(oDate.getTime()) && (oDate.getMonth() + 1).toString().padStart(2, '0') === filterMonth);
                const matchesFrom = !filterDateFrom || (oDateStr && oDateStr >= filterDateFrom);
                const matchesTo = !filterDateTo || (oDateStr && oDateStr <= filterDateTo);

                return matchesSearch && matchesFilter && matchesYear && matchesMonth && matchesFrom && matchesTo;
            })
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, [orders, searchQuery, filterStatus, filterYear, filterMonth, filterDateFrom, filterDateTo]);

    const stats = useMemo(() => {
        const total = filteredOrders.length;
        const delivered = filteredOrders.filter(o => o.status === 'delivered').length;
        const pending = filteredOrders.filter(o => o.status === 'pending').length;
        const reship = filteredOrders.filter(o => o.reship).length;
        const missingCount = filteredOrders.reduce((acc, o) => acc + o.missing.length, 0);
        const discCount = filteredOrders.filter(o => o.invoiceVal > 0 && o.invoiceVal !== o.lpoVal).length;
        const postponed = filteredOrders.filter(o => o.status === 'postponed').length;
        const canceledOrders = filteredOrders.filter(o => o.status === 'canceled').length;

        let favor = 0, against = 0;
        let favorCount = 0, againstCount = 0;

        let deliveredLPO = 0, deliveredInvoice = 0;
        let postponedLPO = 0, postponedInvoice = 0;
        let pendingLPO = 0, pendingInvoice = 0;
        let canceledLPO = 0, canceledInvoice = 0;

        let totalLPO = 0, totalInvoice = 0;

        filteredOrders.forEach(o => {
            totalLPO += (o.lpoVal || 0);
            totalInvoice += (o.invoiceVal || 0);

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

            if (o.status === 'delivered') {
                deliveredLPO += (o.lpoVal || 0);
                deliveredInvoice += (o.invoiceVal || 0);
            } else if (o.status === 'postponed') {
                postponedLPO += (o.lpoVal || 0);
                postponedInvoice += (o.invoiceVal || 0);
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
            total, delivered, pending, reship, missingCount, discCount, postponed, canceledOrders,
            favor, against, favorCount, againstCount, net: against - favor,
            shippedCount, canceledCount, totalTracked,
            deliveredLPO, deliveredInvoice,
            postponedLPO, postponedInvoice,
            pendingLPO, pendingInvoice,
            canceledLPO, canceledInvoice,
            totalLPO, totalInvoice
        };
    }, [filteredOrders]);

    const deleteOrder = (id: string) => {
        const target = orders.find(o => o.id === id);
        if (!target) return;
        triggerConfirm(
            'Delete LPO Record',
            'Are you sure you want to permanently delete this LPO? This action cannot be undone.',
            async () => {
                try {
                    await fetch('/api/DeliveryTracking', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id }),
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

    const fontStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
        .font-inter { font-family: 'Inter', sans-serif; }
        .font-mono-dm { font-family: 'DM Mono', monospace; }
    `;

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-inter text-[#0F172A]">
            <style dangerouslySetInnerHTML={{ __html: fontStyles }} />

            {/* CONFIRMATION OVERLAY */}
            {confirmConfig.isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 font-bold">
                    <div className="bg-white rounded-[24px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="p-6 text-center border-b border-slate-50">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-inner
                                ${confirmConfig.type === 'danger' ? 'bg-rose-50 text-rose-500' :
                                    confirmConfig.type === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'}
                            `}>
                                {confirmConfig.type === 'danger' ? '⚠️' : 'ℹ️'}
                            </div>
                            <h3 className="text-[17px] font-[900] text-slate-800 tracking-tight leading-tight">{confirmConfig.title}</h3>
                            <p className="text-[#64748B] text-[12px] font-bold mt-2 leading-relaxed">{confirmConfig.message}</p>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-2">
                            <button
                                onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                                className="flex-1 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors text-[13px]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    confirmConfig.onConfirm();
                                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                                }}
                                className={`flex-1 py-2.5 rounded-xl font-black text-white text-[13px] shadow-sm transition-colors
                                    ${confirmConfig.type === 'danger' ? 'bg-rose-500 hover:bg-rose-600' :
                                        confirmConfig.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-500 hover:bg-blue-600'}
                                `}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}




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
                        { id: 'orders', label: 'All Orders', count: stats.total },
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
                                    ${activeTab === tab.id ? 'bg-[#4F46E5] text-white shadow-lg' : 'bg-white/10 text-white/60'}
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
                                <div className="absolute inset-0 border-[3px] border-indigo-100 rounded-full" />
                                <div className="absolute inset-0 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(79,70,229,0.4)]" />
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

                {/* TAB CONTENTS */}
                {!isLoading && (
                    <>
                        {activeTab === 'new_order' && canAdd && (
                            <NewOrderTab
                                canAdd={canAdd}
                                lpoRows={lpoRows}
                                setLpoRows={setLpoRows}
                                customers={customers}
                                isSaving={isSaving}
                                setIsSaving={setIsSaving}
                                refreshOrders={refreshOrders}
                                setActiveTab={setActiveTab}
                                showToast={showToast}
                            />
                        )}

                        {activeTab === 'orders' && (
                            <OrdersTab
                                filteredOrders={filteredOrders}
                                customers={customers}
                                canDownload={canDownload}
                                exportOrdersCSV={exportOrdersCSV}
                                filterYear={filterYear}
                                setFilterYear={setFilterYear}
                                filterMonth={filterMonth}
                                setFilterMonth={setFilterMonth}
                                filterDateFrom={filterDateFrom}
                                setFilterDateFrom={setFilterDateFrom}
                                filterDateTo={filterDateTo}
                                setFilterDateTo={setFilterDateTo}
                                filterStatus={filterStatus}
                                setFilterStatus={setFilterStatus}
                                canEdit={canEdit}
                                onUpdateStatus={handleUpdateStatusAndDate}
                                onDeleteOrder={deleteOrder}
                                onEditOrder={openEditModal}
                            />
                        )}
                    </>
                )}
            </div>

            {/* EDIT ORDER MODAL */}
            {editingOrder && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 font-bold">
                    <div className="bg-white rounded-[24px] w-full max-w-2xl overflow-visible shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                    <Pencil className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-[17px] font-[900] text-slate-800 tracking-tight leading-tight">Edit LPO Record</h3>
                                    <p className="text-[#64748B] text-[12px] font-medium mt-0.5">Modify order parameters and save changes</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingOrder(null)}
                                className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-2 rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-5 overflow-visible flex-1 min-h-[350px]">
                            <div className="grid grid-cols-2 gap-4">
                                {/* LPO Date */}
                                <div>
                                    <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-1.5 block">LPO Date <span className="text-rose-500">*</span></label>
                                    <input
                                        type="date"
                                        value={editForm.lpoDate}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, lpoDate: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[14px] outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                                    />
                                </div>

                                {/* Delivery Date */}
                                <div>
                                    <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-1.5 block">Delivery Date</label>
                                    <input
                                        type="date"
                                        value={editForm.lpoDeliveryDate}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, lpoDeliveryDate: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[14px] outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* LPO Number */}
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider block">LPO Number <span className="text-rose-500">*</span></label>
                                        <button
                                            type="button"
                                            onClick={() => setEditForm(prev => ({ ...prev, lpoNumber: 'No Number' }))}
                                            className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-tighter bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                                        >
                                            No Number
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="e.g. LPO-2025-01"
                                        value={editForm.lpoNumber}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, lpoNumber: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[14px] outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                                    />
                                </div>

                                {/* LPO Value */}
                                <div>
                                    <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-1.5 block">LPO Value <span className="text-rose-500">*</span></label>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={editForm.lpoValue}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, lpoValue: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[14px] outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all font-mono font-bold"
                                    />
                                </div>
                            </div>

                            {/* Customer Search Dropdown */}
                            <div className="relative">
                                <label className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-1.5 block">Customer Name <span className="text-rose-500">*</span></label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search Customer..."
                                        value={editForm.customerSearch || (customers.find(c => c.customerId === editForm.customerId)?.customerName || '')}
                                        onChange={(e) => setEditForm(prev => ({
                                            ...prev,
                                            customerSearch: e.target.value,
                                            showDropdown: true,
                                            customerId: '' // reset customerId until one is selected
                                        }))}
                                        onFocus={() => setEditForm(prev => ({ ...prev, showDropdown: true }))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pr-10 text-[14px] outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                                    />
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                                    {editForm.showDropdown && (
                                        <>
                                            <div className="fixed inset-0 z-[120]" onClick={() => setEditForm(prev => ({ ...prev, showDropdown: false }))} />
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-[130] max-h-[200px] overflow-y-auto p-1.5 font-bold">
                                                {customers
                                                    .filter(c => c.customerName.toLowerCase().includes((editForm.customerSearch || '').toLowerCase()))
                                                    .map((c, ci) => (
                                                        <button
                                                            key={`${ci}-${c.customerId}`}
                                                            type="button"
                                                            onClick={() => {
                                                                setEditForm(prev => ({
                                                                    ...prev,
                                                                    customerId: c.customerId,
                                                                    customerSearch: '',
                                                                    showDropdown: false
                                                                }));
                                                            }}
                                                            className="w-full text-left p-3 hover:bg-indigo-50 rounded-lg transition-colors group/item"
                                                        >
                                                            <span className="text-[13px] font-bold text-slate-700 group-hover/item:text-indigo-600">{c.customerName}</span>
                                                        </button>
                                                    ))
                                                }
                                                {customers.filter(c => c.customerName.toLowerCase().includes((editForm.customerSearch || '').toLowerCase())).length === 0 && (
                                                    <div className="p-4 text-center text-slate-400 text-[12px] italic font-medium">No results</div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 flex gap-2 border-t border-slate-100 rounded-b-[24px]">
                            <button
                                type="button"
                                onClick={() => setEditingOrder(null)}
                                className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors text-[13px]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[13px] shadow-lg shadow-indigo-600/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
