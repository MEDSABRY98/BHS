'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    RefreshCcw,
    Plus,
    Search,
    ArrowRight,
    BarChart3,
    ShieldCheck,
    Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from '../01-Unified/Notification';
import { DeliveryEntry } from './types';

// Import subcomponents
import StatsTab from './StatsTab';
import NewOrderTab from './NewOrderTab';
import CheckingTab from './CheckingTab';
import OrdersTab from './OrdersTab';
import DuplicatesTab from './DuplicatesTab';
import MissingItemsTab from './MissingItemsTab';
import ReshipTab from './ReshipTab';
import EditOrderModal from './EditOrderModal';
import ReshipPopup from './ReshipPopup';
import ImportModals from './ImportModals';

export default function DeliveryTrackingTab() {
    const [activeTab, setActiveTab] = useState('stats');
    const [statsSubTab, setStatsSubTab] = useState<'kpis' | 'daily' | 'customers' | 'cities' | 'products'>('kpis');

    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<DeliveryEntry | null>(null);
    const [isReshipPopupOpen, setIsReshipPopupOpen] = useState(false);
    const [selectedReshipOrder, setSelectedReshipOrder] = useState<DeliveryEntry | null>(null);
    const [customers, setCustomers] = useState<{ customerId: string, customerName: string, customerCity: string }[]>([]);
    
    // Checked items search state
    const [checkingSearchQuery, setCheckingSearchQuery] = useState('');
    const [checkingSubmittedQuery, setCheckingSubmittedQuery] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Import states
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isLpoExcelModalOpen, setIsLpoExcelModalOpen] = useState(false);
    const [importType, setImportType] = useState<'lpo' | 'loi' | 'invoice'>('lpo');

    // Date / location filters
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterCity, setFilterCity] = useState('');

    const [orders, setOrders] = useState<DeliveryEntry[]>([]);

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
                return ['add', 'edit', 'delete', 'download', 'reship'];
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
    const canReship = deliveryActions.includes('reship');

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

                if (importType === 'lpo') {
                    const lposToAdd: any[] = [];

                    for (const row of data) {
                        const lpoNumber = row['LPO Number'] || row['lpo number'] || row['LPO_Number'];
                        const lpoDateRaw = row['LPO Date'] || row['lpo date'] || row['LPO_Date'];
                        const deliveryDateRaw = row['Delivery Date'] || row['delivery date'] || row['Delivery_Date'];
                        const customerName = row['Customer Name'] || row['customer name'] || row['Customer_Name'];
                        const lpoValue = row['LPO Value'] || row['lpo value'] || row['LPO_Value'];

                        if (lpoNumber && lpoDateRaw && customerName && lpoValue) {
                            const lpoDate = typeof lpoDateRaw === 'string' ? lpoDateRaw : new Date((lpoDateRaw - 25569) * 86400 * 1000).toISOString().split('T')[0];
                            const lpoDeliveryDate = deliveryDateRaw ? (typeof deliveryDateRaw === 'string' ? deliveryDateRaw : new Date((deliveryDateRaw - 25569) * 86400 * 1000).toISOString().split('T')[0]) : '';
                            const matchedCustomer = customers.find(c =>
                                c.customerName.toLowerCase().trim() === customerName.toString().toLowerCase().trim()
                            );
                            lposToAdd.push({
                                lpoNumber: lpoNumber.toString(),
                                lpoDate,
                                lpoDeliveryDate,
                                customerName: matchedCustomer ? matchedCustomer.customerId : customerName.toString(),
                                lpoValue: parseFloat(lpoValue)
                            });
                        }
                    }

                    if (lposToAdd.length === 0) {
                        showToast('No valid LPO records found in Excel', 'error');
                        return;
                    }

                    const res = await fetch('/api/DeliveryTracking', {
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
                } else if (importType === 'loi') {
                    const lposToAdd: any[] = [];

                    for (const row of data) {
                        const lpoNumber = row['LPO Number'] || row['lpo number'] || row['LPO_Number'];
                        const lpoDateRaw = row['LPO Date'] || row['lpo date'] || row['LPO_Date'];
                        const deliveryDateRaw = row['Delivery Date'] || row['delivery date'] || row['Delivery_Date'];
                        const customerName = row['Customer Name'] || row['customer name'] || row['Customer_Name'];
                        const lpoValue = row['LPO Value'] || row['lpo value'] || row['LPO_Value'];

                        const invoiceDateRaw = row['Invoice Date'] || row['invoice date'] || row['Invoice_Date'];
                        const invoiceNumber = row['Invoice Number'] || row['invoice number'] || row['Invoice_Number'];
                        const invoiceValue = row['Invoice Value'] || row['invoice value'] || row['Invoice_Value'];
                        const status = row['Status'] || row['status'];
                        const notes = row['Notes'] || row['notes'];

                        if (lpoNumber && lpoDateRaw && customerName && lpoValue) {
                            const lpoDate = typeof lpoDateRaw === 'string' ? lpoDateRaw : new Date((lpoDateRaw - 25569) * 86400 * 1000).toISOString().split('T')[0];
                            const lpoDeliveryDate = deliveryDateRaw ? (typeof deliveryDateRaw === 'string' ? deliveryDateRaw : new Date((deliveryDateRaw - 25569) * 86400 * 1000).toISOString().split('T')[0]) : '';
                            const invoiceDate = invoiceDateRaw ? (typeof invoiceDateRaw === 'string' ? invoiceDateRaw : new Date((invoiceDateRaw - 25569) * 86400 * 1000).toISOString().split('T')[0]) : '';

                            const matchedCustomer = customers.find(c =>
                                c.customerName.toLowerCase().trim() === customerName.toString().toLowerCase().trim()
                            );
                            lposToAdd.push({
                                lpoNumber: lpoNumber.toString(),
                                lpoDate,
                                lpoDeliveryDate,
                                customerName: matchedCustomer ? matchedCustomer.customerId : customerName.toString(),
                                lpoValue: parseFloat(lpoValue),
                                invoiceDate,
                                invoiceNumber: invoiceNumber ? invoiceNumber.toString() : '',
                                invoiceValue: invoiceValue ? parseFloat(invoiceValue) : 0,
                                status: status ? status.toString().toLowerCase() : 'pending',
                                notes: notes ? notes.toString() : ''
                            });
                        }
                    }

                    if (lposToAdd.length === 0) {
                        showToast('No valid LPO records found in Excel', 'error');
                        return;
                    }

                    const res = await fetch('/api/DeliveryTracking', {
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
                } else if (importType === 'invoice') {
                    showToast('Invoice complementary steps upload functionality to be implemented.', 'info');
                    if (fileInputRef.current) fileInputRef.current.value = '';
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

    const handleSaveOrder = async (updatedOrder: DeliveryEntry) => {
        if (updatedOrder.status !== 'canceled') {
            if (!updatedOrder.invoiceDate) {
                showToast('Please enter the Invoice Date', 'error');
                return;
            }
            if (!updatedOrder.invoiceNumber || !updatedOrder.invoiceNumber.trim()) {
                showToast('Please enter the Invoice Number', 'error');
                return;
            }
            if (!updatedOrder.invoiceNumber.toUpperCase().startsWith('SAL')) {
                showToast('Invoice Number must start with SAL', 'error');
                return;
            }
            if (!updatedOrder.invoiceVal || updatedOrder.invoiceVal <= 0) {
                showToast('Please enter a valid Invoice Value', 'error');
                return;
            }
            if (updatedOrder.status === 'partial' && updatedOrder.missing.length === 0) {
                showToast('Please add missing products for Partial Delivery', 'error');
                return;
            }

            if (updatedOrder.missing.length > 0) {
                if (!updatedOrder.notes || !updatedOrder.notes.trim()) {
                    showToast('Please add a Note for the missing items', 'error');
                    return;
                }
            }
        } else {
            if (!updatedOrder.notes || !updatedOrder.notes.trim()) {
                showToast('Please add a Note for the canceled LPO', 'error');
                return;
            }
            updatedOrder.invoiceVal = updatedOrder.invoiceVal || 0;
            updatedOrder.invoiceNumber = updatedOrder.invoiceNumber || '';
            updatedOrder.invoiceDate = updatedOrder.invoiceDate || '';
        }

        setIsSaving(true);
        try {
            const rowIndex = (updatedOrder as any)._rowIndex;
            const finalLpoVal = updatedOrder.lpoVal === 0 ? updatedOrder.invoiceVal : updatedOrder.lpoVal;

            await fetch('/api/DeliveryTracking', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex,
                    invoiceDate: updatedOrder.invoiceDate,
                    invoiceNumber: updatedOrder.invoiceNumber,
                    invoiceValue: updatedOrder.invoiceVal,
                    lpoValue: finalLpoVal,
                    status: updatedOrder.status,
                    reship: updatedOrder.reship,
                    notes: updatedOrder.notes,
                }),
            });

            const originalOrder = orders.find(o => o.id === updatedOrder.id);
            const originalMissing = originalOrder?.missing || [];
            const newMissingItems = updatedOrder.missing.filter(
                item => !originalMissing.includes(item)
            );

            if (newMissingItems.length > 0) {
                await Promise.all(newMissingItems.map(item =>
                    fetch('/api/DeliveryTracking', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'add_item',
                            lpoId: updatedOrder.lpoId,
                            itemName: item,
                            status: updatedOrder.reship ? 'missing' : 'canceled',
                            shipmentValue: 0,
                        }),
                    })
                ));
            }

            if (!updatedOrder.reship && originalMissing.length > 0) {
                await Promise.all(originalMissing.map(item =>
                    fetch('/api/DeliveryTracking', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'cancel_item',
                            lpoId: updatedOrder.lpoId,
                            itemName: item,
                            shipmentValue: 0,
                        }),
                    }).catch(() => {/* ignore if item was already updated */ })
                ));
            }

            const finalOrder = !updatedOrder.reship
                ? {
                    ...updatedOrder,
                    lpoVal: finalLpoVal,
                    missing: [],
                    canceledItems: [...new Set([
                        ...(updatedOrder.canceledItems || []),
                        ...originalMissing,
                        ...updatedOrder.missing
                    ])],
                }
                : { ...updatedOrder, lpoVal: finalLpoVal };

            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? finalOrder : o));
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
            const rowIndex = (o as any)._rowIndex;
            await fetch('/api/DeliveryTracking', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex,
                    invoiceValue: newInvoiceVal,
                    status: finalStatus,
                    reship: !isFinished
                })
            });

            await fetch('/api/DeliveryTracking', {
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

    const downloadTemplate = (type: 'lpo' | 'loi' | 'invoice') => {
        let headers: string[] = [];
        let filename = '';

        if (type === 'lpo') {
            headers = ['LPO Number', 'LPO Date', 'Delivery Date', 'Customer Name', 'LPO Value'];
            filename = 'LPO_Only_Template.xlsx';
        } else if (type === 'loi') {
            headers = ['LPO Number', 'LPO Date', 'Delivery Date', 'Customer Name', 'LPO Value', 'Invoice Date', 'Invoice Number', 'Invoice Value', 'Status', 'Notes'];
            filename = 'LPO_Complementary_Template.xlsx';
        } else if (type === 'invoice') {
            headers = ['LPO ID', 'Invoice Date', 'Invoice Number', 'Invoice Value', 'Status', 'Notes'];
            filename = 'Invoice_Complementary_Template.xlsx';
        }

        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, filename);
        showToast(`Template ${filename} downloaded`, 'success');
    };

    const duplicateOrders = useMemo(() => {
        if (!orders) return { list: [], grouped: {} as Record<string, DeliveryEntry[]>, counts: {} as Record<string, number> };
        const counts: Record<string, number> = {};
        orders.forEach(o => {
            const lpoNum = (o.lpo || '').toString().trim().toLowerCase();
            if (lpoNum === 'no number' || lpoNum.includes('مكرر')) return;

            const cust = (o.customer || '').toString().trim().toLowerCase();
            const key = `${lpoNum}|${cust}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        const list = orders.filter(o => {
            const lpoNum = (o.lpo || '').toString().trim().toLowerCase();
            if (lpoNum === 'no number' || lpoNum.includes('مكرر')) return false;

            const cust = (o.customer || '').toString().trim().toLowerCase();
            const key = `${lpoNum}|${cust}`;
            return counts[key] > 1;
        });

        const grouped: Record<string, DeliveryEntry[]> = {};
        list.forEach(o => {
            if (!grouped[o.customer]) grouped[o.customer] = [];
            grouped[o.customer].push(o);
        });

        return { list, grouped, counts };
    }, [orders]);

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

                const matchesSearch = lpo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    lpoId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    customer.toLowerCase().includes(searchQuery.toLowerCase());

                const lpoNum = (o.lpo || '').toString().trim().toLowerCase();
                const cust = (o.customer || '').toString().trim().toLowerCase();
                const key = `${lpoNum}|${cust}`;
                const isAutoDuplicate = duplicateOrders.counts[key] > 1;

                if (isAutoDuplicate) return false;

                const normalizedStatus = (o.status || 'pending').toLowerCase();
                const matchesFilter = filterStatus === 'all' || normalizedStatus === filterStatus;

                const oDateStr = o.date || '';
                const oDate = oDateStr ? new Date(oDateStr) : null;
                const matchesYear = !filterYear || (oDate && !isNaN(oDate.getTime()) && oDate.getFullYear().toString() === filterYear);
                const matchesMonth = !filterMonth || (oDate && !isNaN(oDate.getTime()) && (oDate.getMonth() + 1).toString().padStart(2, '0') === filterMonth);
                const matchesFrom = !filterDateFrom || (oDateStr && oDateStr >= filterDateFrom);
                const matchesTo = !filterDateTo || (oDateStr && oDateStr <= filterDateTo);

                const orderCity = customerToCity[customer] || 'Unknown';
                const matchesCity = !filterCity || orderCity === filterCity;

                return matchesSearch && matchesFilter && matchesYear && matchesMonth && matchesFrom && matchesTo && matchesCity;
            })
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, [orders, searchQuery, filterStatus, filterYear, filterMonth, filterDateFrom, filterDateTo, filterCity, customerToCity, duplicateOrders.counts]);

    const groupedMissingItems = useMemo(() => {
        const groups: Record<string, { order: DeliveryEntry, items: { item: string, status: 'pending' | 'canceled', id: string }[] }> = {};

        filteredOrders.forEach(o => {
            const items = [
                ...o.missing.map((m, i) => ({ item: m, status: 'pending' as const, id: `${o.id}-m-${i}` })),
                ...(o.canceledItems || []).map((m, i) => ({ item: m, status: 'canceled' as const, id: `${o.id}-c-${i}` }))
            ];

            if (items.length > 0) {
                groups[o.id] = { order: o, items };
            }
        });

        return Object.values(groups).sort((a, b) => (b.order.date || '').localeCompare(a.order.date || ''));
    }, [filteredOrders]);

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

    const deleteOrder = (id: string) => {
        const target = orders.find(o => o.id === id);
        if (!target) return;
        triggerConfirm(
            'Delete LPO Record',
            'Are you sure you want to permanently delete this LPO? This action cannot be undone.',
            async () => {
                try {
                    const rowIndex = (target as any)._rowIndex;
                    await fetch('/api/DeliveryTracking', {
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

            {/* EDIT ORDER MODAL */}
            <EditOrderModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                order={editingOrder}
                isSaving={isSaving}
                onSave={handleSaveOrder}
            />

            {/* RESHIP POPUP */}
            <ReshipPopup
                isOpen={isReshipPopupOpen}
                onClose={() => {
                    setIsReshipPopupOpen(false);
                    setSelectedReshipOrder(null);
                }}
                selectedReshipOrder={selectedReshipOrder}
                canReship={canReship}
                handleReshipItem={handleReshipItem}
                showToast={showToast}
                triggerConfirm={triggerConfirm}
            />

            {/* EXCEL IMPORT / DOWNLOAD MODALS */}
            <ImportModals
                isImportOpen={isImportModalOpen}
                setIsImportOpen={setIsImportModalOpen}
                isLpoExcelOpen={isLpoExcelModalOpen}
                setIsLpoExcelOpen={setIsLpoExcelModalOpen}
                setImportType={setImportType}
                triggerFileInput={() => fileInputRef.current?.click()}
                downloadTemplate={downloadTemplate}
            />

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleExcelUpload}
                accept=".xlsx, .xls"
                className="hidden"
            />

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
                        { id: 'duplicates', label: 'Duplicate LPOs', icon: RefreshCcw, count: duplicateOrders.list.length },
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
                                setIsLpoExcelModalOpen={setIsLpoExcelModalOpen}
                                showToast={showToast}
                            />
                        )}

                        {activeTab === 'stats' && (
                            <StatsTab
                                filterCity={filterCity}
                                setFilterCity={setFilterCity}
                                filterYear={filterYear}
                                setFilterYear={setFilterYear}
                                filterMonth={filterMonth}
                                setFilterMonth={setFilterMonth}
                                filterDateFrom={filterDateFrom}
                                setFilterDateFrom={setFilterDateFrom}
                                filterDateTo={filterDateTo}
                                setFilterDateTo={setFilterDateTo}
                                uniqueCities={uniqueCities}
                                customerToCity={customerToCity}
                                filteredOrders={filteredOrders}
                                showToast={showToast}
                            />
                        )}

                        {activeTab === 'checking' && (
                            <CheckingTab
                                orders={orders}
                                checkingSearchQuery={checkingSearchQuery}
                                setCheckingSearchQuery={setCheckingSearchQuery}
                                checkingSubmittedQuery={checkingSubmittedQuery}
                                setCheckingSubmittedQuery={setCheckingSubmittedQuery}
                            />
                        )}

                        {activeTab === 'orders' && (
                            <OrdersTab
                                filteredOrders={filteredOrders}
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
                                openEditModal={openEditModal}
                            />
                        )}

                        {activeTab === 'duplicates' && (
                            <DuplicatesTab
                                duplicateOrders={duplicateOrders}
                            />
                        )}

                        {activeTab === 'missing_items' && (
                            <MissingItemsTab
                                groupedMissingItems={groupedMissingItems}
                                canDownload={canDownload}
                                exportMissingItemsCSV={exportMissingItemsCSV}
                                filterYear={filterYear}
                                setFilterYear={setFilterYear}
                                filterMonth={filterMonth}
                                setFilterMonth={setFilterMonth}
                                filterDateFrom={filterDateFrom}
                                setFilterDateFrom={setFilterDateFrom}
                                filterDateTo={filterDateTo}
                                setFilterDateTo={setFilterDateTo}
                            />
                        )}

                        {activeTab === 'reship' && (
                            <ReshipTab
                                filteredOrders={filteredOrders}
                                filterYear={filterYear}
                                setFilterYear={setFilterYear}
                                filterMonth={filterMonth}
                                setFilterMonth={setFilterMonth}
                                filterDateFrom={filterDateFrom}
                                setFilterDateFrom={setFilterDateFrom}
                                filterDateTo={filterDateTo}
                                setFilterDateTo={setFilterDateTo}
                                openReshipPopup={openReshipPopup}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
