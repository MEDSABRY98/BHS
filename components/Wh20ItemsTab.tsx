'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Package, Calendar, User, MapPin,
    FileText, Printer, Plus, Trash2,
    ChevronDown, Save, RefreshCw, X, ArrowLeft
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/lib/pdfUtils';
import Loading from './Loading';
import { NotificationContainer, NotificationType } from './Notification';

interface Wh20Item {
    barcode: string;
    product: string;
    ctn: number;
    pcs: number;
    qty: number;
    price: number;
    rowIndex: number;
}

interface RowItem {
    barcode: string;
    productName: string;
    unit: 'CTN' | 'PCS';
    qty: string;
    price: string;
    searchTerm: string;
    pcsPerCtn: number;
}

export default function Wh20ItemsTab() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [inventory, setInventory] = useState<Wh20Item[]>([]);

    // Header Data
    const [header, setHeader] = useState({
        date: new Date().toISOString().split('T')[0],
        receiverName: '',
        destination: '',
        reason: ''
    });

    const [suggestions, setSuggestions] = useState<{ recipients: string[], destinations: string[] }>({
        recipients: [],
        destinations: []
    });

    const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
    const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);

    // Notifications
    const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: NotificationType }>>([]);

    const addNotification = (message: string, type: NotificationType) => {
        const id = Math.random().toString(36).substring(7);
        setNotifications((prev) => [...prev, { id, message, type }]);
    };

    const removeNotification = (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    // Body Data
    const [rows, setRows] = useState<RowItem[]>([
        { barcode: '', productName: '', unit: 'PCS', qty: '', price: '', searchTerm: '', pcsPerCtn: 1 }
    ]);

    // Reprint State
    const [reprintNumber, setReprintNumber] = useState('');
    const [isReprinting, setIsReprinting] = useState(false);

    // UI state for dropdowns
    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/wh20-items');
            const data = await res.json();

            if (data.autocomplete) {
                setSuggestions(data.autocomplete);
            }

            if (data.items) {
                // Sort items alphabetically by product name
                const sortedItems = [...data.items].sort((a, b) =>
                    a.product.localeCompare(b.product, 'ar', { sensitivity: 'base' })
                );
                setInventory(sortedItems);

                // Pre-populate rows with all sorted products
                const initialRows = sortedItems.map(item => ({
                    barcode: item.barcode,
                    productName: `${item.product} - ${item.barcode}`,
                    unit: 'PCS' as 'CTN' | 'PCS',
                    qty: '',
                    price: '', // Do not pre-fill price from inventory
                    searchTerm: `${item.product} - ${item.barcode}`,
                    pcsPerCtn: item.pcs || 1
                }));
                // If there are no items, keep at least one empty row
                setRows(initialRows.length > 0 ? initialRows : [
                    { barcode: '', productName: '', unit: 'PCS', qty: '', price: '', searchTerm: '', pcsPerCtn: 1 }
                ]);
            }
        } catch (error) {
            console.error('Failed to fetch inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const addRow = () => {
        setRows([...rows, { barcode: '', productName: '', unit: 'PCS', qty: '', price: '', searchTerm: '', pcsPerCtn: 1 }]);
    };

    const removeRow = (index: number) => {
        if (rows.length > 1) {
            const newRows = [...rows];
            newRows.splice(index, 1);
            setRows(newRows);
        }
    };

    const updateRow = (index: number, field: keyof RowItem, value: any) => {
        const newRows = [...rows];
        (newRows[index] as any)[field] = value;

        if (field === 'searchTerm') {
            setActiveDropdown(index);
            // If barcode matches exactly, auto-select it
            const exactMatch = inventory.find(item =>
                item.barcode.toLowerCase() === value.toLowerCase() ||
                item.product.toLowerCase() === value.toLowerCase()
            );
            if (exactMatch) {
                selectProduct(index, exactMatch);
            }
        }

        setRows(newRows);
    };

    const selectProduct = (index: number, product: Wh20Item) => {
        const newRows = [...rows];
        newRows[index] = {
            ...newRows[index],
            barcode: product.barcode,
            productName: `${product.product} - ${product.barcode}`,
            // price: product.price.toString(), // Do not auto-fill price
            searchTerm: `${product.product} - ${product.barcode}`,
            pcsPerCtn: product.pcs || 1
        };
        setRows(newRows);
        setActiveDropdown(null);
    };

    const filteredInventory = (searchTerm: string) => {
        if (!searchTerm) return [];
        const term = searchTerm.toLowerCase();
        return inventory.filter(item =>
            item.barcode.toLowerCase().includes(term) ||
            item.product.toLowerCase().includes(term)
        ).slice(0, 10);
    };

    const handlePrintAndSave = async () => {
        if (!header.receiverName) {
            addNotification('Please enter Receiver Name', 'error');
            return;
        }

        const validRows = rows.filter(r => r.productName && r.qty && parseFloat(r.qty) > 0);
        if (validRows.length === 0) {
            addNotification('Please add at least one valid item', 'error');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Save to Google Sheets first
            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const saveResponse = await fetch('/api/wh20-items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    header,
                    rows: validRows.map(r => ({
                        productName: r.productName,
                        barcode: r.barcode,
                        unit: r.unit,
                        qty: r.qty,
                        price: r.price,
                        total: (r.unit === 'CTN' ? parseFloat(r.qty) * r.pcsPerCtn : parseFloat(r.qty)) * parseFloat(r.price)
                    })),
                    user: user.name || 'Unknown'
                })
            });

            if (!saveResponse.ok) {
                throw new Error('Failed to save transfer data');
            }

            const { transactionNumber } = await saveResponse.json();

            // 2. Generate PDF using the new transaction number
            const doc = new jsPDF();

            // Support Arabic and English by using Amiri font
            try {
                await addArabicFont(doc);
                doc.setFont("Amiri", "normal");
            } catch (e) {
                console.warn("Could not load Arabic font, falling back to Helvetica");
                doc.setFont("helvetica", "normal");
            }

            const pageWidth = doc.internal.pageSize.getWidth();

            // Title with Transaction Number
            doc.setFontSize(22);
            doc.setTextColor(51, 65, 85);
            doc.text(`Inventory Report - ${transactionNumber}`, pageWidth / 2, 25, { align: 'center' });

            // Header Info
            const labels = ["Date", "Receiver", "Destination", "Reason"];
            const values = [header.date, header.receiverName, header.destination, header.reason];
            const columnWidth = (pageWidth - 40) / 4;
            const startX = 20;
            const labelY = 35;
            const valueStartY = 42;
            let maxHeaderBottomY = valueStartY;

            labels.forEach((label, i) => {
                const xPos = startX + (i * columnWidth) + (columnWidth / 2);

                // Draw Label
                doc.setFontSize(11);
                doc.setTextColor(148, 163, 184);
                doc.text(label, xPos, labelY, { align: 'center' });

                // Draw Value with Wrapping
                doc.setFontSize(14);
                doc.setTextColor(51, 65, 85);
                const splitValue = doc.splitTextToSize(values[i] || '', columnWidth - 5);
                doc.text(splitValue, xPos, valueStartY, { align: 'center' });

                const columnBottomY = valueStartY + (splitValue.length * 6);
                if (columnBottomY > maxHeaderBottomY) {
                    maxHeaderBottomY = columnBottomY;
                }
            });

            let currentY = maxHeaderBottomY + 8; // Padding before table

            // Table
            const head = [["#", "Product", "Unit", "Qty", "Price", "Total"]];
            const body = validRows.map((row, idx) => {
                const qty = parseFloat(row.qty) || 0;
                const price = parseFloat(row.price) || 0;
                const totalPcs = row.unit === 'CTN' ? qty * row.pcsPerCtn : qty;
                const total = totalPcs * price;
                return [
                    idx + 1,
                    row.productName,
                    row.unit,
                    qty.toLocaleString(),
                    price.toLocaleString(),
                    total.toLocaleString()
                ];
            });

            const subtotal = validRows.reduce((acc, row) => {
                const qty = parseFloat(row.qty) || 0;
                const totalPcs = row.unit === 'CTN' ? qty * row.pcsPerCtn : qty;
                return acc + (totalPcs * parseFloat(row.price || '0'));
            }, 0);

            const vat = subtotal * 0.05;
            const grandTotal = subtotal + vat;

            autoTable(doc, {
                head: head,
                body: body,
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], halign: 'center', font: 'Amiri' },
                styles: { font: "Amiri", halign: 'center', valign: 'middle' },
                columnStyles: {
                    0: { cellWidth: 10 },
                    1: { halign: 'center' }, // Product Name
                    2: { cellWidth: 25 }, // Unit
                    3: { cellWidth: 25 }, // Qty
                    4: { cellWidth: 25 }, // Price
                    5: { cellWidth: 25 }  // Total
                },
                foot: [
                    ['', '', '', '', 'Subtotal', subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
                    ['', '', '', '', 'VAT (5%)', vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
                    ['', '', '', '', 'Grand Total', grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })]
                ],
                footStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', font: 'Amiri', halign: 'center' }
            });

            // Signature
            // @ts-ignore
            const finalY = doc.lastAutoTable.finalY + 30;
            doc.setFontSize(12);
            const signatureText = "Signature: __________________________";
            doc.text(signatureText, startX, finalY);

            const signatureWidth = doc.getTextWidth(signatureText);
            const signatureCenterX = startX + (signatureWidth / 2);

            doc.setFontSize(10);
            const receiverText = `Recipient: ${header.receiverName}`;
            doc.text(receiverText, signatureCenterX, finalY + 10, { align: 'center' });

            // Save PDF
            const fileName = `${transactionNumber}_${header.receiverName}.pdf`;
            doc.save(fileName);

            addNotification('Transfer saved and PDF generated successfully!', 'success');
            // Reset form: Clear header and clear Qty/Price only from rows
            setHeader(prev => ({ ...prev, receiverName: '', destination: '', reason: '' }));
            setRows(prev => prev.map(row => ({ ...row, qty: '', price: '' })));

        } catch (error) {
            console.error('Process failed:', error);
            addNotification('Failed to save transfer or generate PDF. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };


    const handleReprint = async () => {
        if (!reprintNumber) {
            addNotification('Please enter a transaction number', 'error');
            return;
        }

        setIsReprinting(true);
        try {
            const res = await fetch(`/api/wh20-items/reprint?transactionNumber=${reprintNumber}`);
            const data = await res.json();

            if (data.error || !data.transfer || data.transfer.length === 0) {
                addNotification(data.error || 'Transaction not found', 'error');
                return;
            }

            const transfer = data.transfer;
            const firstRow = transfer[0];

            // Reuse PDF generation logic
            const doc = new jsPDF();
            try {
                await addArabicFont(doc);
                doc.setFont("Amiri", "normal");
            } catch (e) {
                console.warn("Could not load Arabic font", e);
                doc.setFont("helvetica", "normal");
            }

            const pageWidth = doc.internal.pageSize.getWidth();

            // Title
            doc.setFontSize(22);
            doc.setTextColor(51, 65, 85);
            doc.text(`Inventory Report - ${firstRow.number}`, pageWidth / 2, 25, { align: 'center' });

            // Header Info
            const labels = ["Date", "Receiver", "Destination", "Reason"];
            const values = [firstRow.date, firstRow.recipientName, firstRow.destination, firstRow.reason];
            const columnWidth = (pageWidth - 40) / 4;
            const startX = 20;
            const labelY = 35;
            const valueStartY = 42;
            let maxHeaderBottomY = valueStartY;

            labels.forEach((label, i) => {
                const xPos = startX + (i * columnWidth) + (columnWidth / 2);

                // Draw Label
                doc.setFontSize(11);
                doc.setTextColor(148, 163, 184);
                doc.text(label, xPos, labelY, { align: 'center' });

                // Draw Value with Wrapping
                doc.setFontSize(14);
                doc.setTextColor(51, 65, 85);
                const splitValue = doc.splitTextToSize(values[i] || '', columnWidth - 5);
                doc.text(splitValue, xPos, valueStartY, { align: 'center' });

                const columnBottomY = valueStartY + (splitValue.length * 6);
                if (columnBottomY > maxHeaderBottomY) {
                    maxHeaderBottomY = columnBottomY;
                }
            });

            let currentY = maxHeaderBottomY + 8; // Padding before table

            // Table
            // Table
            const validRows = transfer.map((t: any) => ({
                productName: t.product || '',
                unit: t.type || 'CTN',
                qty: parseFloat(t.qty.toString() || '0'),
                price: parseFloat(t.price.toString() || '0'),
                total: parseFloat(t.total.toString() || '0')
            }));

            // Calculate totals
            let subtotal = 0;
            validRows.forEach((r: any) => {
                subtotal += r.total;
            });
            const vat = subtotal * 0.05;
            const grandTotal = subtotal + vat;

            const tableBody = validRows.map((r: any, i: number) => [
                (i + 1).toString(),
                r.productName,
                r.unit,
                r.qty.toLocaleString(),
                r.price.toLocaleString(undefined, { minimumFractionDigits: 2 }),
                r.total.toLocaleString(undefined, { minimumFractionDigits: 2 })
            ]);

            autoTable(doc, {
                startY: currentY,
                head: [['#', 'Product', 'Unit', 'Qty', 'Price', 'Total']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], halign: 'center', font: 'Amiri' },
                styles: { font: "Amiri", halign: 'center', valign: 'middle' },
                columnStyles: {
                    0: { cellWidth: 10 },
                    1: { halign: 'center' }, // Product Name
                    2: { cellWidth: 25 }, // Unit
                    3: { cellWidth: 25 }, // Qty
                    4: { cellWidth: 25 }, // Price
                    5: { cellWidth: 25 }  // Total
                },
                foot: [
                    ['', '', '', '', 'Subtotal', subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
                    ['', '', '', '', 'VAT (5%)', vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
                    ['', '', '', '', 'Grand Total', grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })]
                ],
                footStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', font: 'Amiri', halign: 'center' }
            });

            // Signature
            // @ts-ignore
            const finalY = doc.lastAutoTable.finalY + 30;
            doc.setFontSize(12);
            const signatureText = "Signature: __________________________";
            doc.text(signatureText, startX, finalY);

            const signatureWidth = doc.getTextWidth(signatureText);
            const signatureCenterX = startX + (signatureWidth / 2);

            doc.setFontSize(10);
            const receiverText = `Recipient: ${firstRow.recipientName}`;
            doc.text(receiverText, signatureCenterX, finalY + 10, { align: 'center' });

            doc.save(`${firstRow.number}_${firstRow.recipientName}.pdf`);
            addNotification('Reprint successful!', 'success');

        } catch (error) {
            console.error('Reprint failed:', error);
            addNotification('Failed to reprint.', 'error');
        } finally {
            setIsReprinting(false);
        }
    };

    if (loading) {
        return <Loading message="Loading Inventory..." />;
    }

    return (
        <div className="max-w-[1350px] mx-auto p-4 sm:p-6 space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200">
                <div className="bg-gradient-to-r from-indigo-600 to-violet-700 p-6 rounded-t-2xl">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors text-white backdrop-blur-sm"
                                title="Back to Home"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <Package className="w-6 h-6 text-white" />
                                </div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">WH/20 ITEMS</h2>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center bg-white/20 backdrop-blur-sm rounded-xl p-1 border border-white/10">
                                <input
                                    type="text"
                                    placeholder="WH20-XXXX"
                                    value={reprintNumber}
                                    onChange={(e) => setReprintNumber(e.target.value)}
                                    className="w-32 px-3 py-1.5 bg-transparent text-white placeholder-white/60 outline-none text-sm font-medium"
                                />
                                <button
                                    onClick={handleReprint}
                                    disabled={isReprinting || !reprintNumber}
                                    className="p-1.5 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all disabled:opacity-50"
                                    title="Reprint PDF"
                                >
                                    {isReprinting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                                </button>
                            </div>

                            <button
                                onClick={handlePrintAndSave}
                                disabled={submitting || !!reprintNumber}
                                className="flex items-center gap-2 px-6 py-2 bg-white text-indigo-600 rounded-xl font-semibold shadow-lg hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                            >
                                {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                                PRINT PDF
                            </button>
                        </div>
                    </div>
                </div>

                <div className={`p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-50/50 rounded-b-2xl ${!!reprintNumber ? 'opacity-60 pointer-events-none' : ''}`}>
                    {/* Date */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-indigo-500" /> Date
                        </label>
                        <input
                            type="date"
                            value={header.date}
                            onChange={(e) => setHeader({ ...header, date: e.target.value })}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                        />
                    </div>

                    {/* Receiver Name */}
                    <div className="space-y-2 relative">
                        <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                            <User className="w-4 h-4 text-indigo-500" /> Recipient Name
                        </label>
                        <input
                            type="text"
                            placeholder="Enter recipient's name"
                            value={header.receiverName}
                            onChange={(e) => setHeader({ ...header, receiverName: e.target.value })}
                            onFocus={() => setShowRecipientDropdown(true)}
                            onBlur={() => setTimeout(() => setShowRecipientDropdown(false), 200)}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                        />
                        {showRecipientDropdown && suggestions.recipients.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                                {suggestions.recipients
                                    .filter(r => r.toLowerCase().includes(header.receiverName.toLowerCase()))
                                    .map((r, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm text-slate-700 transition-colors border-b border-slate-100 last:border-0"
                                            onMouseDown={() => {
                                                setHeader({ ...header, receiverName: r });
                                                setShowRecipientDropdown(false);
                                            }}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                {suggestions.recipients.filter(r => r.toLowerCase().includes(header.receiverName.toLowerCase())).length === 0 && (
                                    <div className="px-4 py-3 text-sm text-slate-500">No suggestions</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Destination */}
                    <div className="space-y-2 relative">
                        <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-indigo-500" /> Destination
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Warehouse 3"
                            value={header.destination}
                            onChange={(e) => setHeader({ ...header, destination: e.target.value })}
                            onFocus={() => setShowDestinationDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDestinationDropdown(false), 200)}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                        />
                        {showDestinationDropdown && suggestions.destinations.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                                {suggestions.destinations
                                    .filter(d => d.toLowerCase().includes(header.destination.toLowerCase()))
                                    .map((d, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm text-slate-700 transition-colors border-b border-slate-100 last:border-0"
                                            onMouseDown={() => {
                                                setHeader({ ...header, destination: d });
                                                setShowDestinationDropdown(false);
                                            }}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                {suggestions.destinations.filter(d => d.toLowerCase().includes(header.destination.toLowerCase())).length === 0 && (
                                    <div className="px-4 py-3 text-sm text-slate-500">No suggestions</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Reason */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-500" /> Reason
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Internal Transfer"
                            value={header.reason}
                            onChange={(e) => setHeader({ ...header, reason: e.target.value })}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                        />
                    </div>
                </div>

                {/* Overlay to freeze inputs if reprint number is entered (as per request) */}

            </div>

            {/* Items Table */}
            <div className={`bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 relative ${!!reprintNumber ? 'opacity-60 pointer-events-none select-none' : ''}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 text-sm font-bold text-slate-700 uppercase tracking-wider w-16 text-center">#</th>
                                <th className="px-6 py-4 text-sm font-bold text-slate-700 uppercase tracking-wider min-w-[300px] text-center">Product / Barcode</th>
                                <th className="px-6 py-4 text-sm font-bold text-slate-700 uppercase tracking-wider w-32 text-center">Unit</th>
                                <th className="px-6 py-4 text-sm font-bold text-slate-700 uppercase tracking-wider w-32 text-center">Qty</th>
                                <th className="px-6 py-4 text-sm font-bold text-slate-700 uppercase tracking-wider w-32 text-center">Price</th>
                                <th className="px-6 py-4 text-sm font-bold text-slate-700 uppercase tracking-wider w-32 text-center">Total</th>
                                <th className="px-6 py-4 w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((row, index) => (
                                <tr key={index} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-slate-500 font-medium">{index + 1}</td>
                                    <td className="px-6 py-4 relative">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search product or scan barcode..."
                                                value={row.searchTerm}
                                                onChange={(e) => updateRow(index, 'searchTerm', e.target.value)}
                                                onFocus={() => setActiveDropdown(index)}
                                                className="w-full px-4 py-2 bg-transparent border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                            />
                                        </div>

                                        {/* Autocomplete Dropdown */}
                                        {activeDropdown === index && row.searchTerm && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-10"
                                                    onClick={() => setActiveDropdown(null)}
                                                />
                                                <div className="absolute left-6 right-6 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-20 overflow-hidden max-h-60 overflow-y-auto">
                                                    {filteredInventory(row.searchTerm).length > 0 ? (
                                                        filteredInventory(row.searchTerm).map((item) => (
                                                            <button
                                                                key={item.barcode}
                                                                onClick={() => selectProduct(index, item)}
                                                                className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex flex-col transition-colors border-b last:border-0 border-slate-100"
                                                            >
                                                                <span className="font-semibold text-slate-800">{item.product}</span>
                                                                <span className="text-xs text-slate-500 font-mono tracking-wider">{item.barcode}</span>
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <div className="px-4 py-3 text-slate-500 text-sm flex items-center gap-2">
                                                            No matches found
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <select
                                            value={row.unit}
                                            onChange={(e) => updateRow(index, 'unit', e.target.value as 'CTN' | 'PCS')}
                                            className="w-full px-3 py-2 bg-transparent border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="CTN">CTN</option>
                                            <option value="PCS">PCS</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0"
                                            value={row.qty}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    updateRow(index, 'qty', val);
                                                }
                                            }}
                                            className="w-full px-4 py-2 bg-transparent border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-center"
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder=""
                                            value={row.price}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    updateRow(index, 'price', val);
                                                }
                                            }}
                                            className="w-full px-4 py-2 bg-transparent border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-center"
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-slate-700 bg-slate-100/50 px-3 py-2 rounded-lg text-center">
                                            {(() => {
                                                const qty = parseFloat(row.qty || '0');
                                                const totalPcs = row.unit === 'CTN' ? qty * row.pcsPerCtn : qty;
                                                return (totalPcs * parseFloat(row.price || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 });
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => removeRow(index)}
                                            disabled={rows.length === 1}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <button
                        onClick={addRow}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600/10 text-indigo-700 rounded-xl font-bold hover:bg-indigo-600/20 transition-all border border-indigo-600/20 active:scale-95"
                    >
                        <Plus className="w-5 h-5" /> Add New Row
                    </button>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Grand Total</p>
                            <p className="text-3xl font-black text-slate-800 tracking-tight">
                                {rows.reduce((acc, row) => {
                                    const qty = parseFloat(row.qty || '0');
                                    const totalPcs = row.unit === 'CTN' ? qty * row.pcsPerCtn : qty;
                                    return acc + (totalPcs * parseFloat(row.price || '0'));
                                }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                <span className="text-sm ml-1 text-slate-400">AED</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <NotificationContainer notifications={notifications} onRemove={removeNotification} />
        </div>
    );
}
