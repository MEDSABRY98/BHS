'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Package, Calendar, User, MapPin,
    FileText, Printer, Plus, Trash2,
    ChevronDown, Save, RefreshCw, X, ArrowLeft, Tag, FileDown
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
    tags: string;
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
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Header Data
    const [header, setHeader] = useState({
        date: new Date().toISOString().split('T')[0],
        receiverName: '',
        destination: '',
        operationType: ''
    });

    const [suggestions, setSuggestions] = useState<{ recipients: string[], destinations: string[] }>({
        recipients: [],
        destinations: []
    });

    const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
    const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const [showTagDropdown, setShowTagDropdown] = useState(false);
    const [selectedTag, setSelectedTag] = useState<string>('');

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

    // Tab State
    const [activeTab, setActiveTab] = useState<'entry' | 'search' | 'history' | 'people'>('entry');
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [rawHistory, setRawHistory] = useState<any[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

    // Reprint State
    const [reprintNumber, setReprintNumber] = useState('');
    const [isReprinting, setIsReprinting] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);

    // UI state for dropdowns
    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

    const uniqueTags = useMemo(() => {
        const tags = new Set<string>();
        inventory.forEach(item => {
            if (item.tags) {
                // Split multi-tags if they are comma-separated, otherwise just add
                item.tags.split(',').forEach(t => tags.add(t.trim()));
            }
        });
        return Array.from(tags).sort();
    }, [inventory]);

    const peopleConsignments = useMemo(() => {
        const summary: Record<string, any> = {};

        rawHistory.forEach((rec: any) => {
            const name = rec.recipientName;
            const opType = rec.operationType;
            if (!name || !opType) return;

            // Operation types that affect consignment balance
            const isTaken = opType === 'عهدة على المستلم' || opType === 'Consignment to Receiver';
            const isReturned = opType === 'رد عهدة للمستودع' || opType === 'تصفية العهدة' || opType === 'Return to Warehouse' || opType === 'Liquidation';

            if (!isTaken && !isReturned) return;

            const fullProduct = rec.product || '';
            const productNameOnly = fullProduct.includes(' - ') ? fullProduct.split(' - ')[0] : fullProduct;
            const key = `${name}_${fullProduct}`; // Keep full product as key for uniqueness

            if (!summary[key]) {
                summary[key] = {
                    name,
                    product: productNameOnly,
                    barcode: rec.barcode,
                    takenPcs: 0, takenCtn: 0,
                    returnedPcs: 0, returnedCtn: 0,
                    netPcs: 0, netCtn: 0
                };
            }

            const qty = parseFloat(rec.qty) || 0;
            const isCtn = rec.type === 'CTN';

            if (isTaken) {
                if (isCtn) summary[key].takenCtn += qty;
                else summary[key].takenPcs += qty;
            } else {
                if (isCtn) summary[key].returnedCtn += qty;
                else summary[key].returnedPcs += qty;
            }
        });

        return Object.values(summary).map(s => ({
            ...s,
            netPcs: s.takenPcs - s.returnedPcs,
            netCtn: s.takenCtn - s.returnedCtn
        })).filter(s => s.takenPcs > 0 || s.takenCtn > 0 || s.returnedPcs > 0 || s.returnedCtn > 0);
    }, [rawHistory]);

    const uniquePeople = useMemo(() => {
        const peopleMap: Record<string, { name: string, productCount: number, hasBalance: boolean }> = {};
        peopleConsignments.forEach(c => {
            if (!peopleMap[c.name]) {
                peopleMap[c.name] = { name: c.name, productCount: 0, hasBalance: false };
            }
            peopleMap[c.name].productCount++;
            if (c.netCtn !== 0 || c.netPcs !== 0) {
                peopleMap[c.name].hasBalance = true;
            }
        });
        return Object.values(peopleMap).sort((a, b) => a.name.localeCompare(b.name));
    }, [peopleConsignments]);

    const exportToExcel = (personName: string) => {
        const data = peopleConsignments.filter(c => c.name === personName);
        if (data.length === 0) return;

        // Create CSV content (Excel can open CSV with UTF-8 BOM)
        const headers = ["Barcode", "Product Name", "Taken (CTN)", "Taken (PCS)", "Returned (CTN)", "Returned (PCS)", "Net (CTN)", "Net (PCS)"];
        const rows = data.map(item => [
            item.barcode,
            item.product,
            item.takenCtn,
            item.takenPcs,
            item.returnedCtn,
            item.returnedPcs,
            item.netCtn,
            item.netPcs
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${personName}_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            // Load user permissions
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                setCurrentUser(user);

                // Set initial tab based on permissions
                try {
                    const perms = JSON.parse(user.role || '{}');
                    if (perms['wh20-items'] && user.name !== 'MED Sabry') {
                        const allowed = perms['wh20-items'];
                        if (allowed.length > 0 && !allowed.includes('entry')) {
                            setActiveTab(allowed[0] as any);
                        }
                    }
                } catch (e) { }
            }

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

                // Initialize rows with all products
                updateRowsByTag('', sortedItems);
            }
        } catch (error) {
            console.error('Failed to fetch inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const translateOpType = (val: string) => {
        const map: Record<string, string> = {
            'مبيع كاش': 'Cash Sale',
            'مبيع أجل': 'Credit Sale',
            'توصيل للعميل': 'Customer Delivery',
            'سميل': 'Sample',
            'عهدة على المستلم': 'Consignment to Receiver',
            'رد عهدة للمستودع': 'Return to Warehouse',
            'تصفية العهدة': 'Liquidation'
        };
        return map[val] || val;
    };

    const updateRowsByTag = (tag: string, currentInventory?: Wh20Item[]) => {
        const itemsToUse = currentInventory || inventory;
        const filtered = tag
            ? itemsToUse.filter(item => item.tags && item.tags.split(',').map(t => t.trim()).includes(tag))
            : itemsToUse;

        const initialRows = filtered.map(item => ({
            barcode: item.barcode,
            productName: `${item.product} - ${item.barcode}`,
            unit: 'PCS' as 'CTN' | 'PCS',
            qty: '',
            price: '',
            searchTerm: `${item.product} - ${item.barcode}`,
            pcsPerCtn: item.pcs || 1
        }));

        setRows(initialRows.length > 0 ? initialRows : [
            { barcode: '', productName: '', unit: 'PCS', qty: '', price: '', searchTerm: '', pcsPerCtn: 1 }
        ]);
        setSelectedTag(tag);
    };

    useEffect(() => {
        if (activeTab === 'search') {
            fetchHistory(6);
        } else if (activeTab === 'history' || activeTab === 'people') {
            fetchHistory();
        }
    }, [activeTab]);

    const fetchHistory = async (limit?: number) => {
        setHistoryLoading(true);
        try {
            const url = limit
                ? `/api/wh20-items?action=history&limit=${limit}`
                : '/api/wh20-items?action=history';
            const res = await fetch(url);
            const data = await res.json();

            if (data.history) {
                setRawHistory(data.history);
                const grouped: Record<string, any> = {};
                data.history.forEach((t: any) => {
                    if (!grouped[t.number]) {
                        grouped[t.number] = {
                            number: t.number,
                            date: t.date,
                            recipientName: t.recipientName,
                            destination: t.destination,
                            operationType: t.operationType,
                            user: t.user,
                            total: 0
                        };
                    }
                    grouped[t.number].total += t.total;
                });
                const sorted = Object.values(grouped).sort((a: any, b: any) =>
                    // Sort descending by number (assuming WH20-002 > WH20-001)
                    b.number.localeCompare(a.number)
                );

                if (limit) {
                    setRecentTransactions(sorted.slice(0, limit));
                } else {
                    setHistoryData(sorted);
                }
            }
        } catch (err) {
            console.error('Failed to fetch history', err);
            addNotification('Failed to load history', 'error');
        } finally {
            setHistoryLoading(false);
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
            if (!header.receiverName || !header.operationType) {
                addNotification('Please fill in required fields (Recipient and Type)', 'error');
                return;
            }

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

            // Header Info - Refined Layout
            const startX = 20;
            let currentY = 35;
            const drawHeaderItem = (label: string, value: string, x: number, w: number, y: number) => {
                doc.setFontSize(10);
                doc.setTextColor(148, 163, 184); // Slate 400
                doc.text(label, x, y);

                doc.setFontSize(13);
                doc.setTextColor(51, 65, 85); // Slate 700 (Value)
                const splitValue = doc.splitTextToSize(value || '-', w - 10);
                doc.text(splitValue, x + w / 2, y, { align: 'center' });
                return y + (splitValue.length * 7);
            };

            const colW = (pageWidth - 40) / 2;
            const row1BottomY = Math.max(
                drawHeaderItem("Date", header.date, 20, colW, currentY),
                drawHeaderItem("Type", translateOpType(header.operationType), 20 + colW, colW, currentY)
            );
            currentY = row1BottomY + 4;

            currentY = drawHeaderItem("Receiver", header.receiverName, 20, pageWidth - 40, currentY) + 4;
            currentY = drawHeaderItem("Destination & Description", header.destination, 20, pageWidth - 40, currentY) + 2;

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
            setHeader(prev => ({ ...prev, operationType: '', receiverName: '', destination: '' }));
            setSelectedTag('');
            // Reset rows based on empty tag
            updateRowsByTag('');

        } catch (error) {
            console.error('Process failed:', error);
            addNotification('Failed to save transfer or generate PDF. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };


    const handleReprint = async (numberOverride?: string) => {
        const numberToReprint = numberOverride || reprintNumber;
        if (!numberToReprint) {
            addNotification('Please enter a transaction number', 'error');
            return;
        }

        setIsReprinting(true);
        try {
            const res = await fetch(`/api/wh20-items/reprint?transactionNumber=${numberToReprint}`);
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

            // Header Info - Refined Layout
            const startX = 20;
            let currentY = 35;
            const drawHeaderItem = (label: string, value: string, x: number, w: number, y: number) => {
                doc.setFontSize(10);
                doc.setTextColor(148, 163, 184); // Slate 400
                doc.text(label, x, y);

                doc.setFontSize(13);
                doc.setTextColor(51, 65, 85); // Slate 700 (Value)
                const splitValue = doc.splitTextToSize(value || '-', w - 10);
                doc.text(splitValue, x + w / 2, y, { align: 'center' });
                return y + (splitValue.length * 7);
            };

            const colW = (pageWidth - 40) / 2;
            const row1BottomY = Math.max(
                drawHeaderItem("Date", firstRow.date, 20, colW, currentY),
                drawHeaderItem("Type", translateOpType(firstRow.operationType), 20 + colW, colW, currentY)
            );
            currentY = row1BottomY + 4;

            currentY = drawHeaderItem("Receiver", firstRow.recipientName, 20, pageWidth - 40, currentY) + 4;
            currentY = drawHeaderItem("Destination & Description", firstRow.destination, 20, pageWidth - 40, currentY) + 2;

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

            {/* Header & Tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100/50 rounded-xl">
                            <Package className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">WH/20 ITEMS</h2>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {[
                        { id: 'entry', label: 'Entry' },
                        { id: 'search', label: 'Search' },
                        { id: 'history', label: 'History' },
                        { id: 'people', label: 'People Inventory' }
                    ].filter(tab => {
                        if (!currentUser || currentUser.name === 'MED Sabry') return true;
                        try {
                            const perms = JSON.parse(currentUser.role || '{}');
                            if (perms['wh20-items']) {
                                return perms['wh20-items'].includes(tab.id);
                            }
                        } catch (e) { }
                        return true;
                    }).map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 min-w-[140px] px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Entry Tab Content */}
            {activeTab === 'entry' && (
                <>
                    {/* Header Input Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                        <div className="bg-gradient-to-r from-indigo-600 to-violet-700 p-4 sm:p-6 rounded-t-2xl">
                            <div className="flex justify-between items-center text-white">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <FileText className="w-5 h-5" /> New Transaction
                                </h3>
                                <button
                                    onClick={handlePrintAndSave}
                                    disabled={submitting}
                                    className="flex items-center gap-2 px-6 py-2 bg-white text-indigo-600 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition-all disabled:opacity-50"
                                >
                                    {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    Save & Print
                                </button>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-50/50 rounded-b-2xl">
                            {/* Date Input */}
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

                            {/* Tag Filter Dropdown */}
                            <div className="space-y-2 relative">
                                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-indigo-500" /> Filter by Tag
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                                    onBlur={() => setTimeout(() => setShowTagDropdown(false), 200)}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-left flex justify-between items-center"
                                >
                                    <span className={selectedTag ? 'text-slate-800' : 'text-slate-400'}>
                                        {selectedTag || 'All Products'}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showTagDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden max-h-60 overflow-y-auto">
                                        <button
                                            type="button"
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm text-slate-700 transition-colors border-b border-slate-100 last:border-0 font-medium"
                                            onMouseDown={() => {
                                                updateRowsByTag('');
                                                setShowTagDropdown(false);
                                            }}
                                        >
                                            All Products
                                        </button>
                                        {uniqueTags.map((tag) => (
                                            <button
                                                key={tag}
                                                type="button"
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm text-slate-700 transition-colors border-b border-slate-100 last:border-0 font-medium"
                                                onMouseDown={() => {
                                                    updateRowsByTag(tag);
                                                    setShowTagDropdown(false);
                                                }}
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Operation Type */}
                            <div className="space-y-2 relative">
                                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-500" /> Type
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                                    onBlur={() => setTimeout(() => setShowTypeDropdown(false), 200)}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-left flex justify-between items-center"
                                >
                                    <span className={header.operationType ? 'text-slate-800' : 'text-slate-400'}>
                                        {header.operationType || 'Select Type'}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showTypeDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden max-h-60 overflow-y-auto">
                                        {[
                                            'Cash Sale',
                                            'Credit Sale',
                                            'Customer Delivery',
                                            'Sample',
                                            'Consignment to Receiver',
                                            'Return to Warehouse',
                                            'Liquidation'
                                        ].map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm text-slate-700 transition-colors border-b border-slate-100 last:border-0 font-medium"
                                                onMouseDown={() => {
                                                    setHeader({ ...header, operationType: type });
                                                    setShowTypeDropdown(false);
                                                }}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recipient Input */}
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
                                    </div>
                                )}
                            </div>

                            {/* Destination Input */}
                            <div className="space-y-2 relative md:col-span-2 lg:col-span-4">
                                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-indigo-500" /> Destination & Description
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Warehouse 3, Item usage..."
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
                                    </div>
                                )}
                            </div>


                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 relative">
                        <div className="overflow-visible min-h-[300px]">
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
                                                        <div
                                                            className={`absolute left-6 right-6 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden max-h-60 overflow-y-auto ${
                                                                // Show upwards if it's one of the last 2 rows and there are enough rows
                                                                (rows.length > 2 && index >= rows.length - 2)
                                                                    ? 'bottom-full mb-2 origin-bottom'
                                                                    : 'top-full mt-2 origin-top'
                                                                }`}
                                                        >
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
                                                <div
                                                    onClick={() => updateRow(index, 'unit', row.unit === 'CTN' ? 'PCS' : 'CTN')}
                                                    className="relative flex items-center bg-slate-100 p-1.5 rounded-2xl cursor-pointer select-none w-32 mx-auto h-11 border border-slate-200/50 group/unit hover:border-indigo-100 transition-all shadow-inner"
                                                >
                                                    <div
                                                        className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-[0.9rem] shadow-md transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) transform ${row.unit === 'PCS' ? 'translate-x-[calc(100%)]' : 'translate-x-0'}`}
                                                    />
                                                    <div className={`relative z-10 flex-1 text-center text-xs font-black tracking-widest transition-all duration-500 ${row.unit === 'CTN' ? 'text-indigo-600 scale-110' : 'text-slate-400 group-hover/unit:text-slate-500'}`}>
                                                        CTN
                                                    </div>
                                                    <div className={`relative z-10 flex-1 text-center text-xs font-black tracking-widest transition-all duration-500 ${row.unit === 'PCS' ? 'text-indigo-600 scale-110' : 'text-slate-400 group-hover/unit:text-slate-500'}`}>
                                                        PCS
                                                    </div>
                                                </div>
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
                </>
            )}

            {/* Search Tab Content */}
            {activeTab === 'search' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <Search className="w-5 h-5 text-indigo-500" />
                            Search Transaction
                        </h3>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                placeholder="Enter Transaction Number (e.g. WH20-0001)"
                                value={reprintNumber}
                                onChange={(e) => setReprintNumber(e.target.value)}
                                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                            <button
                                onClick={() => handleReprint()}
                                disabled={isReprinting || !reprintNumber}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                            >
                                {isReprinting ? <RefreshCw className="animate-spin w-4 h-4" /> : <Printer className="w-4 h-4" />}
                                Print PDF
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                                <RefreshCw className="w-5 h-5 text-indigo-500" />
                                Recent Transactions (Last 6)
                            </h3>
                            <button
                                onClick={() => fetchHistory(6)}
                                disabled={historyLoading}
                                className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left table-fixed">
                                <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                                    <tr>
                                        <th className="px-4 py-3 rounded-tl-lg text-center w-[15%]">Number</th>
                                        <th className="px-4 py-3 text-center w-[15%]">Date</th>
                                        <th className="px-4 py-3 text-center w-[40%]">Recipient</th>
                                        <th className="px-4 py-3 text-center w-[20%]">Total Amount</th>
                                        <th className="px-4 py-3 rounded-tr-lg text-center w-[10%]">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {recentTransactions.map((tx) => (
                                        <tr key={tx.number} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-sm font-medium text-slate-700 text-center truncate" title={tx.number}>{tx.number}</td>
                                            <td className="px-4 py-3 text-sm text-slate-600 text-center">{tx.date}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-slate-800 text-center truncate" title={tx.recipientName}>{tx.recipientName}</td>
                                            <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-center">{tx.total?.toLocaleString()} AED</td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleReprint(tx.number)}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Reprint PDF"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {recentTransactions.length === 0 && (
                                        <tr><td colSpan={5} className="text-center py-8 text-slate-500">No recent transactions found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* History Tab Content */}
            {activeTab === 'history' && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-500" />
                            Transaction History
                        </h3>
                        <button
                            onClick={() => fetchHistory()}
                            disabled={historyLoading}
                            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left table-fixed">
                            <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                                <tr>
                                    <th className="px-2 py-3 rounded-tl-lg text-center w-[12%]">Number</th>
                                    <th className="px-2 py-3 text-center w-[10%]">Date</th>
                                    <th className="px-2 py-3 text-center w-[10%]">Type</th>
                                    <th className="px-2 py-3 text-center w-[18%]">Recipient</th>
                                    <th className="px-2 py-3 text-center w-[30%]">Destination & Description</th>
                                    <th className="px-2 py-3 text-center w-[14%]">Total Amount</th>
                                    <th className="px-2 py-3 rounded-tr-lg text-center w-[6%]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {historyData.map((tx) => (
                                    <tr key={tx.number} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-2 py-3 font-mono text-xs font-medium text-slate-700 text-center truncate" title={tx.number}>{tx.number}</td>
                                        <td className="px-2 py-3 text-xs text-slate-600 text-center truncate" title={tx.date}>{tx.date}</td>
                                        <td className="px-2 py-3 text-xs text-slate-600 text-center truncate" title={translateOpType(tx.operationType)}>{translateOpType(tx.operationType)}</td>
                                        <td className="px-2 py-3 text-sm font-medium text-slate-800 text-center truncate" title={tx.recipientName}>{tx.recipientName}</td>
                                        <td className="px-2 py-3 text-sm text-slate-600 text-center truncate px-2" title={tx.destination}>{tx.destination}</td>
                                        <td className="px-2 py-3 text-sm font-bold text-indigo-600 text-center truncate">{tx.total?.toLocaleString()} AED</td>
                                        <td className="px-2 py-3 text-center">
                                            <button
                                                onClick={() => handleReprint(tx.number)}
                                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Reprint PDF"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {historyData.length === 0 && (
                                    <tr><td colSpan={7} className="text-center py-12 text-slate-500">No history found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* People Inventory Tab */}
            {activeTab === 'people' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden mb-12">
                        {/* Header Section with Modern Gradient */}
                        <div className="relative p-8 border-b border-indigo-50/50 bg-gradient-to-br from-indigo-50/30 via-white to-violet-50/30">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <User className="w-32 h-32 text-indigo-200 rotate-12" />
                            </div>

                            <div className="relative flex flex-col sm:flex-row justify-between items-center gap-6">
                                <div className="flex items-center gap-5">
                                    {selectedPerson && (
                                        <button
                                            onClick={() => setSelectedPerson(null)}
                                            className="p-3 hover:bg-white hover:shadow-md bg-slate-50 rounded-2xl transition-all text-slate-600 active:scale-90"
                                        >
                                            <ArrowLeft className="w-6 h-6" />
                                        </button>
                                    )}
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-1 block">Analytics</span>
                                        <h3 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                            {selectedPerson ? (
                                                <>
                                                    <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-sm">
                                                        {selectedPerson.charAt(0)}
                                                    </div>
                                                    {selectedPerson}
                                                </>
                                            ) : 'Consignment Tracking'}
                                        </h3>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => fetchHistory()}
                                        disabled={historyLoading}
                                        className="px-6 py-3 bg-white border border-slate-100 text-slate-600 rounded-2xl text-sm font-bold shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex items-center gap-2 group active:scale-95 disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-4 h-4 text-indigo-500 ${historyLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                        Refresh Data
                                    </button>
                                    {selectedPerson && (
                                        <button
                                            onClick={() => exportToExcel(selectedPerson)}
                                            className="p-3 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all shadow-sm flex items-center justify-center active:scale-95"
                                            title="Export Statement"
                                        >
                                            <FileDown className="w-6 h-6" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 sm:p-8">
                            {!selectedPerson ? (
                                // Modern List of People
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {historyLoading ? (
                                        <div className="col-span-full py-20 text-center">
                                            <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-4" />
                                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Syncing Cloud Inventory...</p>
                                        </div>
                                    ) : uniquePeople.length === 0 ? (
                                        <div className="col-span-full py-20 text-center bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
                                            <Package className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                                            <p className="text-slate-400 font-medium text-lg">No active consignments found</p>
                                        </div>
                                    ) : (
                                        uniquePeople.map((p, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setSelectedPerson(p.name)}
                                                className="group relative bg-slate-50/50 hover:bg-white p-6 rounded-[2rem] border border-transparent hover:border-indigo-100 hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden active:scale-[0.98]"
                                            >
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-xl font-black text-indigo-600 shadow-sm border border-indigo-50 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                                        {p.name.charAt(0)}
                                                    </div>
                                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${p.hasBalance
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-emerald-100 text-emerald-700'
                                                        }`}>
                                                        {p.hasBalance ? 'Active' : 'Cleared'}
                                                    </span>
                                                </div>
                                                <h4 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">{p.name}</h4>
                                                <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
                                                    <Tag className="w-4 h-4 opacity-40" /> {p.productCount} Managed Products
                                                </p>
                                                <div className="absolute bottom-0 right-0 p-4 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                                        <ArrowLeft className="w-5 h-5 rotate-180" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                // Detail View - Cards Layout
                                <div className="space-y-6 overflow-hidden">
                                    <div className="-mx-4 sm:mx-0">
                                        <table className="w-full text-sm text-center border-separate border-spacing-x-0 border-spacing-y-3 table-fixed">
                                            <thead>
                                                <tr className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                                                    <th className="px-2 py-3 w-[12%] text-center">Barcode</th>
                                                    <th className="px-2 py-3 w-[28%] text-center">Product Name</th>
                                                    <th colSpan={2} className="px-2 py-3 text-center bg-indigo-50/50 rounded-l-2xl text-indigo-600 font-black">Stock In</th>
                                                    <th colSpan={2} className="px-2 py-3 text-center bg-emerald-50/50 text-emerald-600 font-black">Stock Out</th>
                                                    <th colSpan={2} className="px-2 py-3 text-center bg-amber-50/50 rounded-r-2xl text-amber-600 font-black">Current Position</th>
                                                </tr>
                                                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    <th colSpan={2}></th>
                                                    <th className="px-4 py-2 text-center bg-indigo-50/20 text-indigo-400 w-[10%]">CTN</th>
                                                    <th className="px-4 py-2 text-center bg-indigo-50/20 text-indigo-400 w-[10%]">PCS</th>
                                                    <th className="px-4 py-2 text-center bg-emerald-50/20 text-emerald-400 w-[10%]">CTN</th>
                                                    <th className="px-4 py-2 text-center bg-emerald-50/20 text-emerald-400 w-[10%]">PCS</th>
                                                    <th className="px-4 py-2 text-center bg-amber-50/40 text-amber-400 w-[10%]">CTN</th>
                                                    <th className="px-4 py-2 text-center bg-amber-50/40 text-amber-400 w-[10%]">PCS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {peopleConsignments
                                                    .filter(c => c.name === selectedPerson)
                                                    .map((item, idx) => (
                                                        <tr key={idx} className="group transition-all duration-300 hover:bg-slate-50/50">
                                                            <td className="bg-white px-4 py-4 rounded-l-2xl border-y border-l border-slate-100 font-mono text-sm font-medium text-indigo-500 text-center truncate">
                                                                {item.barcode}
                                                            </td>
                                                            <td className="bg-white px-4 py-4 border-y border-slate-100 text-center">
                                                                <div className="text-sm font-bold text-slate-800 tracking-tight truncate px-2" title={item.product}>{item.product}</div>
                                                            </td>

                                                            {/* Stock In */}
                                                            <td className="bg-indigo-50/40 px-4 py-4 border-y border-slate-100 text-center">
                                                                <span className="text-xl font-black text-indigo-600">{item.takenCtn}</span>
                                                            </td>
                                                            <td className="bg-indigo-50/40 px-4 py-4 border-y border-slate-100 text-center">
                                                                <span className="text-xl font-black text-indigo-400/80">{item.takenPcs}</span>
                                                            </td>

                                                            {/* Stock Out */}
                                                            <td className="bg-emerald-50/40 px-4 py-4 border-y border-slate-100 text-center">
                                                                <span className="text-xl font-black text-emerald-600">{item.returnedCtn}</span>
                                                            </td>
                                                            <td className="bg-emerald-50/40 px-4 py-4 border-y border-slate-100 text-center">
                                                                <span className="text-xl font-black text-emerald-400/80">{item.returnedPcs}</span>
                                                            </td>

                                                            {/* Current Position */}
                                                            <td className="bg-amber-50/40 px-4 py-4 border-y border-slate-100 text-center">
                                                                <span className={`text-xl font-black ${item.netCtn >= 0 ? 'text-slate-800' : 'text-rose-500'}`}>{item.netCtn}</span>
                                                            </td>
                                                            <td className="bg-amber-50/40 px-4 py-4 rounded-r-2xl border-y border-r border-slate-100 text-center">
                                                                <span className={`text-xl font-black ${item.netPcs >= 0 ? 'text-slate-400' : 'text-rose-500'}`}>{item.netPcs}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <NotificationContainer notifications={notifications} onRemove={removeNotification} />
        </div>
    );
}
