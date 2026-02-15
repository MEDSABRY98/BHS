
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Package, RotateCw, AlertCircle, Plus,
    ArrowLeftRight, History, Layers, LogOut, ArrowRight, ArrowLeft, ChevronDown, Download
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Loading from './Loading';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/lib/pdfUtils';
import * as XLSX from 'xlsx';


// --- Types ---
interface ChipsyProduct {
    rowIndex: number;
    barcode: string;
    productName: string;
    qtyPcs: number;
    pcsInCtn: number;
    price: number;
}

interface ChipsyTransfer {
    user: string;
    date: string;
    locFrom: string;
    locTo: string;
    customerName?: string;
    barcode: string;
    productName: string;
    qtyPcs: number;
    description?: string;
    number?: string;
    // Legacy support for type if data still has it
    type?: 'IN' | 'OUT';
    personName?: string;
    receiverName?: string;
    price?: number;
    total?: number;
}

type TabView = 'inventory' | 'transfers' | 'new_transaction' | 'people_inventory' | 'person_details' | 'transaction_details' | 'reprint';

// --- Component ---
export default function ChipsyInventoryTab() {

    const [activeTab, setActiveTab] = useState<TabView>('inventory');
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                setCurrentUser(JSON.parse(savedUser));
            } catch (e) { }
        }
    }, []);
    const [products, setProducts] = useState<ChipsyProduct[]>([]);
    const [transfers, setTransfers] = useState<ChipsyTransfer[]>([]);
    const [mainCustomers, setMainCustomers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [reprintQuery, setReprintQuery] = useState('');
    const [isReprinting, setIsReprinting] = useState(false);

    // Transaction Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<ChipsyProduct | null>(null);

    // UI State for Selection
    const [sourceType, setSourceType] = useState<'Main Inventory' | 'Person' | 'Only Transfer'>('Main Inventory');
    const [destType, setDestType] = useState<'Main Inventory' | 'Person' | 'Customer'>('Person');

    // Data Inputs
    const [personName, setPersonName] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [description, setDescription] = useState('');
    const router = useRouter();

    // Person Inventory State
    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
    const [personSubTab, setPersonSubTab] = useState<'summary' | 'transactions' | 'distribution'>('summary');
    const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set());

    // Transaction Details State
    const [selectedTransactionNumber, setSelectedTransactionNumber] = useState<string>('');
    const [selectedTransactionItems, setSelectedTransactionItems] = useState<ChipsyTransfer[]>([]);

    // Print State


    // Cart now holds all row data including search state for each row
    const [cart, setCart] = useState<{
        product: ChipsyProduct | null,
        qty: number | string,
        unit: 'CTN' | 'PCS',
        price: number,
        searchTerm: string,
        showDropdown: boolean
    }[]>([
        { product: null, qty: '', unit: 'CTN', price: 0, searchTerm: '', showDropdown: false }
    ]);
    const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
    const [openSourceDropdown, setOpenSourceDropdown] = useState(false);
    const [openDestDropdown, setOpenDestDropdown] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        await fetchInventory();
        setLoading(false);
    };

    const fetchInventory = async () => {
        try {
            const res = await fetch('/api/chipsy');
            const json = await res.json();
            if (json.data) setProducts(json.data);
            if (json.transfers) setTransfers(json.transfers);
            if (json.allCustomers) setMainCustomers(json.allCustomers);
        } catch (e) {
            console.error('Failed to load chipsy inventory', e);
        }
    };



    // Auto-populate cart with all products when opening New Transaction tab
    useEffect(() => {
        if (activeTab === 'new_transaction' && products.length > 0) {
            const sortedProducts = [...products].sort((a, b) => a.productName.localeCompare(b.productName));
            console.log('Populating cart with', sortedProducts.length, 'products');

            const allRows = sortedProducts.map(p => ({
                product: p,
                searchTerm: `${p.productName} - ${p.barcode}`,
                qty: '',
                unit: 'CTN' as 'CTN' | 'PCS',
                price: p.price || 0,
                showDropdown: false
            }));
            setCart(allRows);
        }
    }, [activeTab]);

    const activeUser = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : 'Unknown';

    // Row Management
    const addRow = () => {
        setCart([...cart, { product: null, qty: '', unit: 'CTN', price: 0, searchTerm: '', showDropdown: false }]);
    };

    const removeRow = (index: number) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const updateRow = (index: number, field: keyof typeof cart[0], value: any) => {
        const newCart = [...cart];

        if (field === 'searchTerm') {
            // If typing search, show dropdown, clear product
            newCart[index].product = null;
            newCart[index].showDropdown = true;
        }

        if (field === 'product') {
            // If selecting product, set product, set name to search term, hide dropdown
            newCart[index].product = value;
            newCart[index].searchTerm = `${value.productName} - ${value.barcode}`;
            newCart[index].price = value.price || 0;
            newCart[index].showDropdown = false;
            // Auto focus next qty input could be added here if we had refs
        }

        (newCart[index] as any)[field] = value;
        setCart(newCart);
    };

    const handleTransaction = async () => {
        // Filter out incomplete rows
        const validRows = cart.filter(row => row.product && row.qty && parseFloat(row.qty as string) > 0);

        if (validRows.length === 0) return;

        // Derive Locations
        let finalLocFrom = '';
        let finalLocTo = '';

        if (sourceType === 'Only Transfer') {
            finalLocFrom = 'Only Transfer';
            finalLocTo = 'Frozen'; // Keep as Frozen per user request

            // Allow Customer Name for Only Transfer
            if (customerName) {
                // We don't change finalLocTo to Customer to avoid backend issues, 
                // but we will use customerName in PDF
            }

        } else {
            // Determine Locations
            // Source Logic
            if (sourceType === 'Main Inventory') {
                finalLocFrom = 'Main Inventory';
            } else if (sourceType === 'Person') {
                finalLocFrom = personName; // Person LOSES stock
            }

            // Destination Logic
            if (destType === 'Main Inventory') {
                finalLocTo = 'Main Inventory';
            } else if (destType === 'Person') {
                finalLocTo = personName; // Person GAINS stock
            } else if (destType === 'Customer') {
                finalLocTo = 'Customer';
                // Note: If personName is filled here, it's just 'Receiver', NOT 'LocTo'
            }

            // Validation
            if (!finalLocFrom || !finalLocTo) {
                alert('Please specify Locations and Names.');
                return;
            }
            if (finalLocFrom === finalLocTo) {
                alert('Source and Destination cannot be the same.');
                return;
            }
            if (sourceType === 'Person' && !personName) {
                alert('Please enter the Person Name (Source).');
                return;
            }
            if (destType === 'Person' && !personName) {
                alert('Please enter the Person Name (Destination).');
                return;
            }

            if (destType === 'Customer' && !customerName) {
                alert('Please enter a Customer Name.');
                return;
            }
        }

        const receiverName = (destType === 'Customer' && sourceType !== 'Person' && personName) ? personName : '';

        setSubmitting(true);
        try {

            let data: any = { success: false };

            // Save to Database (Google Sheet) logic for ALL types
            const payload = {
                transaction: {
                    user: activeUser ? JSON.parse(activeUser).name : 'Unknown',
                    locFrom: finalLocFrom,
                    locTo: finalLocTo,
                    customerName: customerName || '',
                    receiverName: finalLocTo === 'Customer' && personName ? personName : (sourceType === 'Only Transfer' ? (personName || '') : receiverName),
                    description
                },
                items: validRows.map(row => ({
                    barcode: row.product!.barcode,
                    qty: parseFloat(row.qty as string),
                    unit: row.unit,
                    price: row.price || 0
                }))
            };

            const res = await fetch('/api/chipsy/transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            data = await res.json();

            if (data.success && data.transactionNumber) {
                // Generate Real PDF
                const doc = new jsPDF();

                // Load Arabic Font
                try {
                    await addArabicFont(doc);
                    doc.setFont("Amiri", "normal");
                } catch (e) {
                    console.error("Could not load Arabic font, falling back", e);
                }

                // Pre-calculate Totals
                const sumTotalPcs = validRows.reduce((acc, row) => {
                    const qty = parseFloat(row.qty as string);
                    const pcsInCtn = row.product!.pcsInCtn || 1;
                    return acc + (row.unit === 'CTN' ? qty * pcsInCtn : qty);
                }, 0);

                const sumTotalCtns = validRows.reduce((acc, row) => {
                    const qty = parseFloat(row.qty as string);
                    const pcsInCtn = row.product!.pcsInCtn || 1;
                    return acc + (row.unit === 'CTN' ? qty : qty / pcsInCtn);
                }, 0);

                const subTotal = validRows.reduce((acc, row) => {
                    const qty = parseFloat(row.qty as string);
                    const pcsInCtn = row.product!.pcsInCtn || 1;
                    const totalPcs = row.unit === 'CTN' ? qty * pcsInCtn : qty;
                    return acc + (totalPcs * (row.price || 0));
                }, 0);
                const vat = subTotal * 0.05;
                const grandTotal = subTotal + vat;

                // Function to draw a single receipt instance (Original or Copy)
                const printReceipt = (isCopy: boolean) => {
                    let startPage = 1;

                    if (isCopy) {
                        doc.addPage();
                        // Reset font/styles after new page if needed (though usually persists)
                        doc.setFont("Amiri", "normal");
                        startPage = doc.getNumberOfPages();
                    } else {
                        startPage = 1;
                    }

                    const pageWidth = doc.internal.pageSize.getWidth();
                    const pageHeight = doc.internal.pageSize.getHeight();

                    // Helper to draw fixed header
                    const drawHeader = () => {
                        doc.setFontSize(11);
                        doc.setTextColor(22, 163, 74);
                        doc.text("Al Marai Al Arabia Trading Sole Proprietorship L.L.C", 10, 15, { align: "left" });
                        doc.text("المراعي العربية للتجارة شركة الشخص الواحد ذ.م.م", pageWidth - 10, 15, { align: "right" });
                        doc.setTextColor(0, 0, 0);
                        doc.text("TRN: 100391462700003", pageWidth / 2, 22, { align: "center" });
                    };

                    // Header (Info Line & Movement only, Header is now in didDrawPage)
                    doc.setFontSize(10);
                    const now = new Date();
                    const day = now.getDate().toString().padStart(2, '0');
                    const month = (now.getMonth() + 1).toString().padStart(2, '0');
                    const year = now.getFullYear();
                    const hours = now.getHours().toString().padStart(2, '0');
                    const minutes = now.getMinutes().toString().padStart(2, '0');
                    const dateStr = `${day}/${month}/${year} ${hours}:${minutes}`;

                    // Transaction Info
                    const infoText = `${dateStr}  |  ${data.transactionNumber}`;
                    doc.text(infoText, pageWidth / 2, 30, { align: "center" });

                    // Movement Info
                    doc.setFontSize(11);

                    let movementText = '';

                    // Simplified Format for Issues (Main -> Person/Customer)
                    if (finalLocFrom === 'Main Inventory') {
                        if (finalLocTo === 'Customer' && customerName) {
                            movementText = `Customer: ${customerName}`;
                        } else {
                            movementText = `Person: ${finalLocTo}`;
                        }
                    } else if (sourceType === 'Only Transfer') {
                        // Show Customer if available
                        if (customerName) {
                            movementText = `Customer: ${customerName}`;
                        } else {
                            movementText = '';
                        }
                    } else {
                        // Standard Format for Transfers/returns
                        let toText = finalLocTo;
                        if (finalLocTo === 'Customer' && customerName) {
                            toText = `Customer: ${customerName}`;
                        }
                        movementText = `From: ${finalLocFrom}   >>   To: ${toText}`;
                    }

                    if (movementText) {
                        doc.text(movementText, pageWidth / 2, 38, { align: "center" });
                    }

                    let yPos = 45;

                    // Table Data
                    const tableHead = [["#", "Barcode", "Product", "Qty (Pcs)", "Qty (Ctns)", "Price", "Total"]];
                    const tableBody = validRows.map((row, idx) => {
                        const qty = parseFloat(row.qty as string);
                        const pcsInCtn = row.product!.pcsInCtn || 1;
                        const totalPcs = row.unit === 'CTN' ? qty * pcsInCtn : qty;
                        const totalCtns = totalPcs / pcsInCtn;
                        const price = row.price || 0;
                        const total = totalPcs * price;

                        return [
                            (idx + 1).toString(),
                            row.product!.barcode,
                            row.product!.productName,
                            totalPcs.toLocaleString(),
                            totalCtns.toFixed(2),
                            price.toFixed(2),
                            total.toFixed(2)
                        ];
                    });

                    autoTable(doc, {
                        head: tableHead,
                        body: tableBody,
                        foot: [
                            ['', '', 'Total', sumTotalPcs.toLocaleString(), sumTotalCtns.toFixed(2), '', '']
                        ],
                        startY: yPos,
                        margin: { top: 35 },
                        theme: 'grid',
                        didDrawPage: (data) => {
                            drawHeader();
                        },
                        headStyles: { fillColor: [22, 163, 74], font: 'Amiri', halign: 'center' },
                        footStyles: { fillColor: [240, 240, 240], textColor: 50, font: 'Amiri', halign: 'center', fontStyle: 'bold' },
                        styles: {
                            fontSize: 10,
                            cellPadding: 2,
                            halign: 'center',
                            valign: 'middle',
                            font: 'Amiri' // Use Arabic font in body
                        },
                        columnStyles: {
                            0: { cellWidth: 'auto', halign: 'center' }, // Barcode Center
                            1: { cellWidth: 'auto', halign: 'center' }  // Product Name Center
                        }
                    });

                    // Totals
                    // @ts-ignore
                    const finalY = (doc as any).lastAutoTable.finalY + 10;

                    // Better Totals Design using autoTable
                    const tableWidth = 80;
                    const rightMargin = 14; // Default autoTable margin
                    const marginLeft = pageWidth - tableWidth - rightMargin;

                    autoTable(doc, {
                        startY: finalY,
                        margin: { left: marginLeft },
                        tableWidth: tableWidth,
                        theme: 'plain',        // No stripes
                        body: [
                            ['Subtotal', subTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })],
                            ['VAT (5%)', vat.toLocaleString('en-US', { minimumFractionDigits: 2 })],
                            ['Grand Total', grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })]
                        ],
                        styles: {
                            font: 'Amiri',
                            fontStyle: 'normal',
                            fontSize: 10,
                            cellPadding: 2,
                            halign: 'right',
                            lineColor: [200, 200, 200], // light gray
                            lineWidth: 0.1
                        },
                        columnStyles: {
                            0: { fontStyle: 'bold', halign: 'left', cellWidth: 40 }, // Label
                            1: { fontStyle: 'bold', halign: 'right', cellWidth: 40 } // Value
                        },
                        didParseCell: (data) => {
                            // Add border to bottom of rows for cleaner look
                            if (data.section === 'body') {
                                data.cell.styles.lineWidth = 0.1;
                                data.cell.styles.lineColor = [230, 230, 230];
                            }

                            // Style Grand Total Row
                            if (data.row.index === 2) {
                                data.cell.styles.fontSize = 12;
                                data.cell.styles.textColor = [22, 163, 74]; // Green color
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                    });

                    // Footer: Description & Signatures
                    // @ts-ignore
                    let currentY = (doc as any).lastAutoTable.finalY + 15;

                    // Description
                    if (description) {
                        doc.setFontSize(12);
                        // doc.setFont("helvetica", "italic");
                        doc.setTextColor(0);
                        doc.text(description, pageWidth / 2, currentY, { align: "center", maxWidth: 150 });
                        currentY += 20;
                    } else {
                        currentY += 10;
                    }

                    // Signatures
                    doc.setTextColor(50);
                    doc.setFontSize(11);

                    // Store Keeper
                    doc.text("Store Keeper", 40, currentY, { align: "center" });
                    doc.setFontSize(12);
                    doc.text("Salah Gamal", 40, currentY + 7, { align: "center" });
                    doc.setDrawColor(200);
                    doc.line(20, currentY + 10, 60, currentY + 10);

                    // Receiver
                    let receiverName = finalLocTo;
                    if (sourceType === 'Only Transfer') {
                        receiverName = personName || 'Frozen';
                    } else if (finalLocTo === 'Customer') {
                        // If Person Name is provided for a Customer destination (and not being used as Source), use it as Receiver
                        if (destType === 'Customer' && sourceType !== 'Person' && personName) {
                            receiverName = personName;
                        } else {
                            receiverName = customerName || 'Customer';
                        }
                    }

                    doc.setFontSize(11);
                    doc.text("Receiver", 170, currentY, { align: "center" });
                    doc.setFontSize(12);
                    doc.text(receiverName, 170, currentY + 7, { align: "center" });
                    doc.line(150, currentY + 10, 190, currentY + 10);

                    // Footer: Page Numbers & Label & Watermark
                    const endPage = doc.getNumberOfPages();
                    const totalPagesForSection = endPage - startPage + 1;

                    for (let i = startPage; i <= endPage; i++) {
                        doc.setPage(i);

                        // Footer Text
                        doc.setFontSize(9);
                        doc.setTextColor(150);
                        const footerText = isCopy ? "True Copy" : "Original";
                        doc.text(footerText, 15, pageHeight - 15, { align: 'left' });

                        // Page Number (Relative to Section)
                        const currentSectionPage = i - startPage + 1;
                        doc.text(`Page ${currentSectionPage} of ${totalPagesForSection}`, 15, pageHeight - 10, { align: 'left' });

                        // Watermark for COPY (On every page of the copy section)
                        if (isCopy) {
                            doc.setTextColor(230, 230, 230); // Very light gray
                            doc.setFontSize(80);
                            doc.text("COPY", pageWidth / 2, pageHeight / 2, { align: "center", angle: 45 });
                        }
                    }
                };

                // Print Original
                printReceipt(false);

                // Print Copy
                printReceipt(true);

                const now = new Date();
                const day = now.getDate().toString().padStart(2, '0');
                const month = (now.getMonth() + 1).toString().padStart(2, '0');
                const year = now.getFullYear();

                const pdfFileName = `${data.transactionNumber}.pdf`;

                doc.save(pdfFileName);
            }

            // Refresh Data (Only for real transactions)
            if (sourceType !== 'Only Transfer') {
                await fetchData();
            } else {
                setLoading(false); // Just stop loading state
            }

            // Go back to inventory
            setActiveTab('inventory');

            // Reset Form (Wait for fetch to finish to avoid UI jump?)
            setCart([{ product: null, qty: '', unit: 'CTN', price: 0, searchTerm: '', showDropdown: false }]);
            setPersonName('');
            setCustomerName('');
            setDescription('');

        } catch (error) {
            console.error(error);
            alert('Transaction Failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReprint = async () => {
        if (!reprintQuery) {
            alert('Please enter a Transaction Number');
            return;
        }

        const normalizedQuery = reprintQuery.trim().toUpperCase();
        const relatedTransfers = transfers.filter(t => t.number === normalizedQuery);

        if (relatedTransfers.length === 0) {
            alert('Transaction not found. Please check the number.');
            return;
        }

        const first = relatedTransfers[0];

        setIsReprinting(true);
        try {
            const doc = new jsPDF();

            // Load Arabic Font
            try {
                await addArabicFont(doc);
                doc.setFont("Amiri", "normal");
            } catch (e) {
                console.error("Could not load Arabic font, falling back", e);
                // Fallback to standard font if Arabic fails
                doc.setFont("Helvetica", "normal");
            }

            // Calculations
            // ... (rest of logic) ...
            const sumTotalPcs = relatedTransfers.reduce((acc, t) => acc + t.qtyPcs, 0);

            const sumTotalCtns = relatedTransfers.reduce((acc, t) => {
                const p = products.find(prod => prod.barcode === t.barcode);
                return acc + (t.qtyPcs / (p?.pcsInCtn || 1));
            }, 0);

            const subTotal = relatedTransfers.reduce((acc, t) => acc + (t.qtyPcs * (t.price || 0)), 0);
            const vat = subTotal * 0.05;
            const grandTotal = subTotal + vat;

            // Draw Receipt
            const printReceipt = (isCopy: boolean) => {
                let startPage = 1;

                if (isCopy) {
                    doc.addPage();
                    // Ensure font is set for new page
                    try {
                        doc.setFont("Amiri", "normal");
                    } catch (e) {
                        doc.setFont("Helvetica", "normal");
                    }
                    startPage = doc.getNumberOfPages();
                } else {
                    startPage = doc.getNumberOfPages();
                }

                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();

                const drawHeader = () => {
                    doc.setFontSize(11);
                    doc.setTextColor(22, 163, 74);
                    doc.text("Al Marai Al Arabia Trading Sole Proprietorship L.L.C", 10, 15, { align: "left" });
                    // Only try Arabic text if font is loaded, otherwise skip or use English
                    try {
                        doc.text("المراعي العربية للتجارة شركة الشخص الواحد ذ.م.م", pageWidth - 10, 15, { align: "right" });
                    } catch (e) {
                        // Fallback or empty
                    }
                    doc.setTextColor(0, 0, 0);
                    doc.text("TRN: 100391462700003", pageWidth / 2, 22, { align: "center" });
                };

                // Header Meta
                doc.setFontSize(10);
                const infoText = `${first.date}  |  ${normalizedQuery}`;
                doc.text(infoText, pageWidth / 2, 30, { align: "center" });

                // Location Logic
                doc.setFontSize(11);
                let movementText = '';

                let from = first.locFrom;
                let to = first.locTo;
                const customerName = first.customerName;

                // Normalization
                if (from === 'IN') from = 'Main Inventory';
                if (from === 'OUT') { from = to; to = 'Customer'; }
                if (from === 'MAIN') from = 'Main Inventory';
                if (to === 'MAIN') to = 'Main Inventory';
                if (to === 'CUSTOMER') to = 'Customer';

                if (from === 'Main Inventory') {
                    if (to === 'Customer' && customerName) {
                        movementText = `Customer: ${customerName}`;
                    } else {
                        movementText = `Person: ${to}`;
                    }
                } else if (from === 'Only Transfer' || (first.description && first.description.startsWith('Only Transfer'))) {
                    if (customerName) {
                        movementText = `Customer: ${customerName}`;
                    }
                } else {
                    let toText = to;
                    if (to === 'Customer' && customerName) toText = `Customer: ${customerName}`;
                    movementText = `From: ${from}   >>   To: ${toText}`;
                }

                if (movementText) {
                    doc.text(movementText, pageWidth / 2, 38, { align: "center" });
                }

                let yPos = 45;

                // Table
                const tableHead = [["#", "Barcode", "Product", "Qty (Pcs)", "Qty (Ctns)", "Price", "Total"]];
                const tableBody = relatedTransfers.map((t, idx) => {
                    const p = products.find(prod => prod.barcode === t.barcode);
                    const pcsInCtn = p?.pcsInCtn || 1;
                    const cartons = t.qtyPcs / pcsInCtn;
                    const price = t.price || 0;
                    const total = t.qtyPcs * price;

                    return [
                        (idx + 1).toString(),
                        t.barcode,
                        t.productName,
                        t.qtyPcs.toLocaleString(),
                        cartons.toFixed(2),
                        price.toFixed(2),
                        total.toFixed(2)
                    ];
                });

                autoTable(doc, {
                    head: tableHead,
                    body: tableBody,
                    foot: [
                        ['', '', 'Total', sumTotalPcs.toLocaleString(), sumTotalCtns.toFixed(2), '', '']
                    ],
                    startY: yPos,
                    margin: { top: 35 },
                    theme: 'grid',
                    didDrawPage: (data) => {
                        drawHeader();
                    },
                    headStyles: { fillColor: [22, 163, 74], font: 'Amiri', halign: 'center' },
                    footStyles: { fillColor: [240, 240, 240], textColor: 50, font: 'Amiri', halign: 'center', fontStyle: 'bold' },
                    styles: {
                        fontSize: 10,
                        cellPadding: 2,
                        halign: 'center',
                        valign: 'middle',
                        font: 'Amiri'
                    },
                    columnStyles: {
                        0: { cellWidth: 'auto', halign: 'center' },
                        1: { cellWidth: 'auto', halign: 'center' }
                    }
                });

                // Totals Block
                // @ts-ignore
                const finalY = (doc as any).lastAutoTable.finalY + 10;

                const tableWidth = 80;
                const rightMargin = 14;
                const marginLeft = pageWidth - tableWidth - rightMargin;

                autoTable(doc, {
                    startY: finalY,
                    margin: { left: marginLeft },
                    tableWidth: tableWidth,
                    theme: 'plain',
                    body: [
                        ['Subtotal', subTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })],
                        ['VAT (5%)', vat.toLocaleString('en-US', { minimumFractionDigits: 2 })],
                        ['Grand Total', grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })]
                    ],
                    styles: {
                        font: 'Amiri',
                        fontStyle: 'normal',
                        fontSize: 10,
                        cellPadding: 2,
                        halign: 'right',
                        lineColor: [200, 200, 200],
                        lineWidth: 0.1
                    },
                    columnStyles: {
                        0: { fontStyle: 'bold', halign: 'left', cellWidth: 40 },
                        1: { fontStyle: 'bold', halign: 'right', cellWidth: 40 }
                    },
                    didParseCell: (data) => {
                        if (data.section === 'body') {
                            data.cell.styles.lineWidth = 0.1;
                            data.cell.styles.lineColor = [230, 230, 230];
                        }
                        if (data.row.index === 2) {
                            data.cell.styles.fontSize = 12;
                            data.cell.styles.textColor = [22, 163, 74];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                });

                // Footer
                // @ts-ignore
                let currentY = (doc as any).lastAutoTable.finalY + 15;

                const description = first.description;
                if (description) {
                    doc.setFontSize(12);
                    doc.setTextColor(0);
                    doc.text(description, pageWidth / 2, currentY, { align: "center", maxWidth: 150 });
                    currentY += 20;
                } else {
                    currentY += 10;
                }

                // Signatures
                doc.setTextColor(50);
                doc.setFontSize(11);
                doc.text("Store Keeper", 40, currentY, { align: "center" });
                doc.setFontSize(12);
                doc.text("Salah Gamal", 40, currentY + 7, { align: "center" });
                doc.setDrawColor(200);
                doc.line(20, currentY + 10, 60, currentY + 10);

                // Receiver Name Logic
                let receiverNameDisplay = first.receiverName;
                if (!receiverNameDisplay) {
                    if (to === 'Customer') receiverNameDisplay = customerName || 'Customer';
                    else receiverNameDisplay = to;
                }

                doc.setFontSize(11);
                doc.text("Receiver", 170, currentY, { align: "center" });
                doc.setFontSize(12);
                doc.text(receiverNameDisplay || '', 170, currentY + 7, { align: "center" });
                doc.line(150, currentY + 10, 190, currentY + 10);

                // Page Number / Footer / Watermark
                const endPage = doc.getNumberOfPages();
                const totalPagesForSection = endPage - startPage + 1;

                for (let i = startPage; i <= endPage; i++) {
                    doc.setPage(i);
                    doc.setFontSize(9);
                    doc.setTextColor(150);
                    const footerText = isCopy ? "True Copy (Reprint)" : "Original (Reprint)";
                    doc.text(footerText, 15, pageHeight - 15, { align: 'left' });
                    const currentSectionPage = i - startPage + 1;
                    doc.text(`Page ${currentSectionPage} of ${totalPagesForSection}`, 15, pageHeight - 10, { align: 'left' });

                    if (isCopy) {
                        doc.setTextColor(230, 230, 230);
                        doc.setFontSize(80);
                        doc.text("COPY", pageWidth / 2, pageHeight / 2, { align: "center", angle: 45 });
                    }
                }
            };

            printReceipt(false);
            printReceipt(true);

            doc.save(`${normalizedQuery}.pdf`);

        } catch (e) {
            console.error(e);
            alert('Reprint failed: ' + e);
        } finally {
            setIsReprinting(false);
        }
    };


    // Calculations
    const filteredProducts = useMemo(() => {
        if (!searchQuery) return products;
        const lower = searchQuery.toLowerCase();
        return products.filter(p =>
            p.productName.toLowerCase().includes(lower) ||
            p.barcode.includes(lower)
        );
    }, [products, searchQuery]);

    const stats = useMemo(() => {
        const totalPcs = products.reduce((acc, p) => acc + p.qtyPcs, 0);
        const totalCtns = products.reduce((acc, p) => acc + (p.qtyPcs / (p.pcsInCtn || 1)), 0);
        const totalItems = products.length;
        return { totalPcs, totalCtns, totalItems };
    }, [products]);

    // Person Inventory Stats
    const peopleStats = useMemo(() => {
        // name -> { barcode: { received: number, distributed: number, balance: number } }
        const persons: Record<string, Record<string, { received: number, distributed: number, balance: number }>> = {};

        transfers.forEach(t => {
            // Normalization for Legacy Data
            let finalFrom = t.locFrom;
            let finalTo = t.locTo;

            if (t.locFrom === 'IN') {
                finalFrom = 'Main Inventory';
                finalTo = t.locTo;
            } else if (t.locFrom === 'OUT') {
                finalFrom = t.locTo;
                finalTo = 'Customer'; // Approx behavior
            }
            // Handle legacy 'MAIN' / 'CUSTOMER' DB values if any exist from interim testing
            if (finalFrom === 'MAIN') finalFrom = 'Main Inventory';
            if (finalTo === 'MAIN') finalTo = 'Main Inventory';
            if (finalTo === 'CUSTOMER') finalTo = 'Customer';

            // IGNORE 'Only Transfer' (Frozen)
            if (finalFrom === 'Only Transfer' || finalTo === 'Frozen') return;

            // Debit logic (Target receives stock)
            if (finalTo && finalTo !== 'Main Inventory' && finalTo !== 'Customer') {
                const name = finalTo.trim();
                if (!persons[name]) persons[name] = {};
                if (!persons[name][t.barcode]) persons[name][t.barcode] = { received: 0, distributed: 0, balance: 0 };

                persons[name][t.barcode].received += t.qtyPcs;
                persons[name][t.barcode].balance += t.qtyPcs;
            }

            // Credit logic (Source loses stock)
            if (finalFrom && finalFrom !== 'Main Inventory' && finalFrom !== 'Customer') {
                const name = finalFrom.trim();
                if (!persons[name]) persons[name] = {};
                if (!persons[name][t.barcode]) persons[name][t.barcode] = { received: 0, distributed: 0, balance: 0 };

                persons[name][t.barcode].distributed += t.qtyPcs;
                persons[name][t.barcode].balance -= t.qtyPcs;
            }
        });

        // Convert to array
        const result = Object.entries(persons).map(([name, prodMap]) => {
            let totalPcs = 0;
            let totalCtns = 0;
            let totalReceivedPcs = 0;
            let totalReceivedCtns = 0;
            let totalDistributedPcs = 0;
            let totalDistributedCtns = 0;
            let productCount = 0;

            Object.entries(prodMap).forEach(([barcode, stats]) => {
                if (stats.balance !== 0 || stats.received !== 0 || stats.distributed !== 0) {
                    const prod = products.find(p => p.barcode === barcode);
                    const pcsInCtn = prod ? (prod.pcsInCtn || 1) : 1;

                    if (stats.balance !== 0) {
                        productCount++;
                    }

                    totalPcs += stats.balance;
                    totalCtns += stats.balance / pcsInCtn;

                    totalReceivedPcs += stats.received;
                    totalReceivedCtns += stats.received / pcsInCtn;

                    totalDistributedPcs += stats.distributed;
                    totalDistributedCtns += stats.distributed / pcsInCtn;
                }
            });

            return { name, prodMap, totalPcs, totalCtns, totalReceivedPcs, totalReceivedCtns, totalDistributedPcs, totalDistributedCtns, productCount };
        }).filter(p => p.totalPcs !== 0 || p.productCount !== 0 || p.totalReceivedPcs !== 0); // Hide empty

        return result.sort((a, b) => b.totalPcs - a.totalPcs);
    }, [transfers, products]);

    // Helper to get previous customer names
    const previousCustomers = useMemo(() => {
        const customers = new Set<string>();
        transfers.forEach(t => {
            if (t.customerName) customers.add(t.customerName);
            if (t.locTo === 'Customer' && t.customerName) customers.add(t.customerName);
        });
        if (mainCustomers && mainCustomers.length > 0) {
            mainCustomers.forEach(c => customers.add(c));
        }
        return Array.from(customers).sort();
    }, [transfers, mainCustomers]);

    // Helper to get suggestions for a specific row
    const getRowSuggestions = (searchTerm: string) => {
        if (!searchTerm) return [];
        const lower = searchTerm.toLowerCase();
        return products.filter(p =>
            p.productName.toLowerCase().includes(lower) ||
            p.barcode.includes(lower)
        );
    };



    // Export Inventory to Excel
    const exportInventoryToExcel = () => {
        const workbook = XLSX.utils.book_new();

        const headers = ['Barcode', 'Product Name', 'Pcs/Ctn', 'Stock (Pieces)', 'Stock (Cartons)'];

        const rows = filteredProducts.map(p => [
            p.barcode,
            p.productName,
            p.pcsInCtn,
            p.qtyPcs,
            (p.qtyPcs / (p.pcsInCtn || 1)).toFixed(1)
        ]);

        // Add Totals Row
        const totalPcs = filteredProducts.reduce((acc, p) => acc + p.qtyPcs, 0);
        const totalCtns = filteredProducts.reduce((acc, p) => acc + (p.qtyPcs / (p.pcsInCtn || 1)), 0);

        rows.push(['', 'TOTAL', '', totalPcs, totalCtns.toFixed(1)]);

        const sheetData = [headers, ...rows];
        const sheet = XLSX.utils.aoa_to_sheet(sheetData);

        // Auto-width columns
        const colWidths = [
            { wch: 15 }, // Barcode
            { wch: 40 }, // Product Name
            { wch: 10 }, // Pcs/Ctn
            { wch: 15 }, // Stock Pieces
            { wch: 15 }  // Stock Cartons
        ];
        sheet['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(workbook, sheet, 'Inventory');

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Chipsy_Inventory_${dateStr}.xlsx`);
    };

    // Generic Export Handler
    const handleExport = () => {
        if (activeTab === 'inventory') {
            exportInventoryToExcel();
        } else if (activeTab === 'people_inventory') {
            exportPeopleInventoryToExcel();
        } else if (activeTab === 'transfers') {
            exportTransfersToExcel();
        } else if (activeTab === 'person_details') {
            exportPersonDetailsToExcel();
        } else if (activeTab === 'transaction_details') {
            exportTransactionDetailsToExcel();
        }
    };

    const exportPersonDetailsToExcel = () => {
        if (!selectedPerson) return;
        const workbook = XLSX.utils.book_new();

        if (personSubTab === 'summary') {
            const headers = [
                'Barcode',
                'Product Name',
                'Pcs/Ctn',
                'Taken (Pcs)',
                'Taken (Ctns)',
                'Remaining (Pcs)',
                'Remaining (Ctns)',
                'Distributed (Pcs)',
                'Distributed (Ctns)'
            ];
            const inventoryMap = peopleStats.find(p => p.name === selectedPerson)?.prodMap || {};
            const rows = Object.entries(inventoryMap)
                .filter(([_, stats]) => stats.balance !== 0 || stats.received !== 0 || stats.distributed !== 0)
                .map(([barcode, stats]) => {
                    const product = products.find(p => p.barcode === barcode);
                    const pcsInCtn = product?.pcsInCtn || 1;

                    return [
                        barcode,
                        product ? product.productName : barcode,
                        pcsInCtn,
                        stats.received,
                        parseFloat((stats.received / pcsInCtn).toFixed(2)),
                        stats.balance,
                        parseFloat((stats.balance / pcsInCtn).toFixed(2)),
                        stats.distributed,
                        parseFloat((stats.distributed / pcsInCtn).toFixed(2))
                    ];
                });

            const sheetData = [headers, ...rows];
            const sheet = XLSX.utils.aoa_to_sheet(sheetData);
            // Auto-width
            const wscols = [
                { wch: 15 }, // Barcode
                { wch: 30 }, // Name
                { wch: 10 }, // Pcs/Ctn
                { wch: 12 }, // Taken Pcs
                { wch: 12 }, // Taken Ctns
                { wch: 15 }, // Rem Pcs
                { wch: 15 }, // Rem Ctns
                { wch: 15 }, // Dist Pcs
                { wch: 15 }  // Dist Ctns
            ];
            sheet['!cols'] = wscols;

            XLSX.utils.book_append_sheet(workbook, sheet, 'Summary');

        } else if (personSubTab === 'transactions') {
            // Filter transactions for this person (received/issued)
            const personTransfers = transfers.filter(t => t.locTo === selectedPerson || t.locFrom === selectedPerson);
            const sorted = [...personTransfers].reverse();

            const headers = ['Date', 'Type (In/Out)', 'Product', 'Qty (Pcs)', 'Other Party', 'Description'];
            const rows = sorted.map(t => {
                const type = t.locTo === selectedPerson ? 'RECEIVED' : 'ISSUED';
                const otherParty = t.locTo === selectedPerson ? t.locFrom : t.locTo;
                return [
                    t.date,
                    type,
                    t.productName,
                    t.qtyPcs,
                    otherParty,
                    t.description || '-'
                ];
            });
            const sheetData = [headers, ...rows];
            const sheet = XLSX.utils.aoa_to_sheet(sheetData);
            const wscols = [{ wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 30 }];
            sheet['!cols'] = wscols;

            XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions');
        } else if (personSubTab === 'distribution') {
            // Simplified Distribution - Just raw list or summary? 
            // Matching the UI: "Distributions" usually means what they gave out.
            // Let's filter transfers where locFrom === selectedPerson
            const distributions = transfers.filter(t => t.locFrom === selectedPerson);

            const headers = ['Date', 'Product', 'Qty (Pcs)', 'To', 'Description'];
            const rows = distributions.map(t => [
                t.date,
                t.productName,
                t.qtyPcs,
                t.locTo,
                t.description || '-'
            ]);

            const sheetData = [headers, ...rows];
            const sheet = XLSX.utils.aoa_to_sheet(sheetData);
            const wscols = [{ wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 30 }];
            sheet['!cols'] = wscols;

            XLSX.utils.book_append_sheet(workbook, sheet, 'Distributions');
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const safeName = selectedPerson.replace(/[^a-z0-9]/gi, '_');
        XLSX.writeFile(workbook, `Chipsy_${safeName}_${personSubTab}_${dateStr}.xlsx`);
    };

    const exportTransactionDetailsToExcel = () => {
        if (!selectedTransactionItems || selectedTransactionItems.length === 0) return;
        const workbook = XLSX.utils.book_new();

        // Info Header in first few rows? Or just flat table? Flat table is better for Excel.
        // Let's do Header info then empty row then Items.
        const first = selectedTransactionItems[0];
        const infoRows = [
            ['Transaction Number', selectedTransactionNumber],
            ['Date', first.date],
            ['User', first.user],
            ['From', first.locFrom === 'IN' ? 'Main Inventory' : first.locFrom],
            ['To', first.locTo === 'CUSTOMER' ? `Customer (${first.customerName})` : first.locTo],
            ['Description', first.description || '-'],
            [] // Empty row
        ];

        const itemHeaders = ['Barcode', 'Product Name', 'Qty (Pcs)', 'Qty (Ctns)'];
        const itemRows = selectedTransactionItems.map(item => {
            const product = products.find(p => p.barcode === item.barcode);
            const pcsInCtn = product?.pcsInCtn || 1;
            return [
                item.barcode,
                item.productName,
                item.qtyPcs,
                (item.qtyPcs / pcsInCtn).toFixed(1)
            ];
        });

        const sheetData = [...infoRows, itemHeaders, ...itemRows];
        const sheet = XLSX.utils.aoa_to_sheet(sheetData);

        // Auto-width
        const wscols = [{ wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 12 }];
        // Set col widths starting from items? Excel is global. 
        sheet['!cols'] = wscols;

        XLSX.utils.book_append_sheet(workbook, sheet, 'Transaction Details');
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Trx_${selectedTransactionNumber}_${dateStr}.xlsx`);
    };

    const exportPeopleInventoryToExcel = () => {
        const workbook = XLSX.utils.book_new();
        const headers = ['Distributor', 'Taken (Ctns)', 'Taken (Pcs)', 'Current (Ctns)', 'Current (Pcs)', 'Distributed (Ctns)', 'Distributed (Pcs)'];

        const rows = peopleStats.map(p => [
            p.name,
            p.totalReceivedCtns.toFixed(1),
            p.totalReceivedPcs,
            p.totalCtns.toFixed(1),
            p.totalPcs,
            p.totalDistributedCtns.toFixed(1),
            p.totalDistributedPcs
        ]);

        // Totals
        const totalReceivedCtns = peopleStats.reduce((acc, p) => acc + p.totalReceivedCtns, 0);
        const totalReceivedPcs = peopleStats.reduce((acc, p) => acc + p.totalReceivedPcs, 0);
        const totalCtns = peopleStats.reduce((acc, p) => acc + p.totalCtns, 0);
        const totalPcs = peopleStats.reduce((acc, p) => acc + p.totalPcs, 0);
        const totalDistributedCtns = peopleStats.reduce((acc, p) => acc + p.totalDistributedCtns, 0);
        const totalDistributedPcs = peopleStats.reduce((acc, p) => acc + p.totalDistributedPcs, 0);

        rows.push([
            'TOTAL',
            totalReceivedCtns.toFixed(1),
            totalReceivedPcs,
            totalCtns.toFixed(1),
            totalPcs,
            totalDistributedCtns.toFixed(1),
            totalDistributedPcs
        ]);

        const sheetData = [headers, ...rows];
        const sheet = XLSX.utils.aoa_to_sheet(sheetData);

        // Auto-width
        const wscols = [
            { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
        ];
        sheet['!cols'] = wscols;

        XLSX.utils.book_append_sheet(workbook, sheet, 'People Inventory');
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Chipsy_People_Dist_${dateStr}.xlsx`);
    };

    const exportTransfersToExcel = () => {
        const workbook = XLSX.utils.book_new();
        const headers = ['Trx #', 'Date', 'User', 'From', 'To', 'Customer', 'Receiver', 'Items Count', 'Total Pcs', 'Total Ctns', 'Description'];

        // Existing logic for grouping transfers
        const grouped = new Map<string, typeof transfers>();
        transfers.forEach(t => {
            const key = t.number || `LEGACY-${t.date}-${t.locTo}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(t);
        });

        const rows: any[][] = [];

        Array.from(grouped.entries()).forEach(([trxNum, items]) => {
            const first = items[0];
            const count = items.length;
            const totalQty = items.reduce((acc, i) => acc + i.qtyPcs, 0);
            const totalCartons = items.reduce((acc, i) => {
                const p = products.find(prod => prod.barcode === i.barcode);
                return acc + (i.qtyPcs / (p?.pcsInCtn || 1));
            }, 0).toFixed(1);

            let displayFrom = first.locFrom;
            let displayTo = first.locTo;
            if (first.locFrom === 'IN') { displayFrom = 'Main Inventory'; displayTo = first.locTo; }
            else if (first.locFrom === 'OUT') { displayFrom = first.locTo; displayTo = 'Customer'; }
            if (first.locFrom === 'MAIN') displayFrom = 'Main Inventory';
            if (first.locTo === 'MAIN') displayTo = 'Main Inventory';
            if (first.locTo === 'CUSTOMER') displayTo = 'Customer';

            rows.push([
                trxNum,
                first.date,
                first.user,
                displayFrom,
                displayTo,
                first.customerName || '-',
                first.receiverName || '-',
                count,
                totalQty,
                totalCartons,
                first.description || '-'
            ]);
        });

        const sheetData = [headers, ...rows];
        const sheet = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(workbook, sheet, 'History Logs');
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Chipsy_History_${dateStr}.xlsx`);
    };

    return (
        <div className="space-y-6 max-w-[95%] mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <div className="flex items-center gap-4 mb-2">
                        <button
                            onClick={() => router.push('/')}
                            disabled={activeTab === 'new_transaction'}
                            className={`p-2 border border-gray-200 rounded-xl transition-colors shadow-sm text-gray-600 ${activeTab === 'new_transaction' ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Package className="w-8 h-8 text-orange-600" />
                            Chipsy Inventory
                        </h1>
                    </div>
                </div>
                {activeTab !== 'new_transaction' && (
                    <div className="flex gap-2">
                        {/* Export Button moved here */}
                        {(activeTab === 'inventory' || activeTab === 'people_inventory' || activeTab === 'transfers' || activeTab === 'person_details' || activeTab === 'transaction_details') && (
                            <button
                                onClick={handleExport}
                                className="p-3 bg-white border border-gray-200 text-green-600 rounded-lg hover:bg-green-50 shadow-sm transition-all flex items-center justify-center"
                                title="Export Current Tab to Excel"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                        )}

                        {(() => {
                            try {
                                const perms = JSON.parse(currentUser?.role || '{}');
                                if (perms['chipsy-inventory'] && currentUser?.name !== 'MED Sabry') {
                                    if (!perms['chipsy-inventory'].includes('new_transaction')) return null;
                                }
                            } catch (e) { }
                            return (
                                <button
                                    onClick={() => { setActiveTab('new_transaction'); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-sm transition-all font-medium"
                                >
                                    <Plus className="w-5 h-5" /> New Transaction
                                </button>
                            );
                        })()}
                    </div>
                )}
            </div>


            {/* Tabs (Hide when in transaction mode) */}
            {activeTab !== 'new_transaction' && activeTab !== 'person_details' && (
                <div className="flex w-full bg-white rounded-xl shadow-sm p-1 border border-gray-200">
                    {[
                        { id: 'inventory', label: 'Current Inventory' },
                        { id: 'people_inventory', label: 'People Inventory' },
                        { id: 'transfers', label: 'History Logs' },
                        { id: 'reprint', label: 'Reprint' }
                    ].filter(tab => {
                        try {
                            const perms = JSON.parse(currentUser?.role || '{}');
                            if (perms['chipsy-inventory'] && currentUser?.name !== 'MED Sabry') {
                                return perms['chipsy-inventory'].includes(tab.id);
                            }
                        } catch (e) { }
                        return true;
                    }).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 pb-3 pt-2 font-medium transition-colors border-b-2 text-center ${activeTab === tab.id ? 'border-orange-500 text-orange-600 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            {loading && <Loading message="Loading Chipsy System..." />}

            {!loading && activeTab === 'inventory' && (
                <div className="space-y-4">
                    {/* Stats Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                            <p className="text-gray-500 text-xs uppercase font-bold">Total Products</p>
                            <p className="text-2xl font-bold text-gray-800">{stats.totalItems}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                            <p className="text-gray-500 text-xs uppercase font-bold">Total Stock (Pcs)</p>
                            <p className="text-2xl font-bold text-blue-600">{(stats.totalPcs).toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                            <p className="text-gray-500 text-xs uppercase font-bold">Total Stock (Ctns)</p>
                            <p className="text-2xl font-bold text-green-600">{(stats.totalCtns).toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                        </div>
                    </div>

                    {/* Search */}
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-white pl-10 p-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none transition-all"
                        />
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-center">
                            <thead className="bg-white text-gray-500 text-sm uppercase border-b border-gray-200">
                                <tr>
                                    <th className="p-4 font-semibold text-center">Barcode</th>
                                    <th className="p-4 font-semibold text-center">Product</th>
                                    <th className="p-4 font-semibold text-center">Pcs/Ctn</th>
                                    <th className="p-4 font-semibold text-center bg-blue-50 text-blue-700">Stock (Pieces)</th>
                                    <th className="p-4 font-semibold text-center">Stock (Cartons)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredProducts.map(p => {
                                    const cartons = (p.qtyPcs / (p.pcsInCtn || 1)).toFixed(1);
                                    return (
                                        <tr key={p.barcode} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-mono text-sm text-gray-500 text-center">{p.barcode}</td>
                                            <td className="p-4 font-medium text-gray-800 text-center">{p.productName}</td>
                                            <td className="p-4 text-center text-gray-500 text-sm">{p.pcsInCtn}</td>
                                            <td className="p-4 text-center font-bold text-blue-600 bg-blue-50/30">{p.qtyPcs.toLocaleString()}</td>
                                            <td className="p-4 text-center font-medium text-gray-600">{cartons}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredProducts.length === 0 && <div className="p-8 text-center text-gray-400">No products found</div>}
                    </div>
                </div>
            )}

            {activeTab === 'transfers' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-center table-fixed">
                        <thead className="bg-white text-gray-500 text-sm uppercase border-b border-gray-200">
                            <tr>
                                <th className="p-4 font-semibold text-center w-[140px]">Trx #</th>
                                <th className="p-4 font-semibold text-center w-[110px]">Date</th>
                                <th className="p-4 font-semibold text-center w-[100px]">User</th>
                                <th className="p-4 font-semibold text-center w-[120px]">From (Source)</th>
                                <th className="p-4 font-semibold text-center w-[120px]">To (Destination)</th>
                                <th className="p-4 font-semibold text-center text-blue-600 w-[140px]">Customer Name</th>
                                <th className="p-4 font-semibold text-center text-gray-600 w-[140px]">Receiver Name</th>
                                <th className="p-4 font-semibold text-center w-[80px]">Items</th>
                                <th className="p-4 font-semibold text-center w-[100px]">Total Qty (Pcs)</th>
                                <th className="p-4 font-semibold text-center w-[100px]">Total Qty (Ctns)</th>
                                <th className="p-4 font-semibold text-center w-[200px]">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(() => {
                                const grouped = new Map<string, typeof transfers>();
                                transfers.forEach(t => {
                                    const key = t.number || `LEGACY-${t.date}-${t.locTo}`; // Updated key logic
                                    if (!grouped.has(key)) grouped.set(key, []);
                                    grouped.get(key)!.push(t);
                                });

                                return Array.from(grouped.entries()).map(([trxNum, items], idx) => {
                                    const first = items[0];
                                    const count = items.length;
                                    const totalQty = items.reduce((acc, i) => acc + i.qtyPcs, 0);

                                    const totalCartons = items.reduce((acc, i) => {
                                        const p = products.find(prod => prod.barcode === i.barcode);
                                        return acc + (i.qtyPcs / (p?.pcsInCtn || 1));
                                    }, 0).toFixed(1);

                                    // Display Logic
                                    let displayFrom = first.locFrom;
                                    let displayTo = first.locTo;

                                    // Legacy Normalization for Display
                                    if (first.locFrom === 'IN') {
                                        displayFrom = 'Main Inventory';
                                        displayTo = first.locTo;
                                    } else if (first.locFrom === 'OUT') {
                                        displayFrom = first.locTo;
                                        displayTo = 'Customer';
                                    }

                                    if (first.locFrom === 'MAIN') displayFrom = 'Main Inventory';
                                    if (first.locTo === 'MAIN') displayTo = 'Main Inventory';
                                    if (first.locTo === 'CUSTOMER') displayTo = 'Customer';

                                    // Check if Customer Name exists
                                    const customerNameDisplay = first.customerName || '-';

                                    return (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4">
                                                <button
                                                    onClick={() => {
                                                        setSelectedTransactionNumber(trxNum);
                                                        setSelectedTransactionItems(items);
                                                        setActiveTab('transaction_details');
                                                    }}
                                                    className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline text-sm"
                                                >
                                                    {trxNum.startsWith('LEGACY') ? 'Old Log' : trxNum}
                                                </button>
                                            </td>
                                            <td className="p-4 text-sm text-gray-500">{first.date}</td>
                                            <td className="p-4 text-sm font-medium text-gray-700">{first.user}</td>

                                            <td className="p-4 text-sm text-gray-600 font-bold">
                                                {displayFrom}
                                            </td>
                                            <td className="p-4 text-sm text-gray-600 font-bold">
                                                {displayTo}
                                            </td>
                                            <td className="p-4 text-sm text-blue-600 font-bold">
                                                {customerNameDisplay}
                                            </td>
                                            <td className="p-4 text-sm text-gray-600 font-bold">
                                                {first.receiverName || '-'}
                                            </td>

                                            <td className="p-4 text-sm font-bold text-gray-700">{count}</td>
                                            <td className="p-4 font-mono font-medium text-gray-800">{totalQty.toLocaleString()}</td>
                                            <td className="p-4 font-mono font-medium text-green-700">{totalCartons}</td>
                                            <td className="p-4 text-sm text-gray-500 italic">{first.description || '-'}</td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Transaction Details Tab */}
            {activeTab === 'transaction_details' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setActiveTab('transfers')}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                                </button>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">
                                        Transaction {selectedTransactionNumber.startsWith('LEGACY') ? 'Details' : selectedTransactionNumber}
                                    </h2>
                                    <p className="text-gray-500 text-sm">{selectedTransactionItems[0]?.date}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                                    {/* Helper Logic for display */}
                                    {(() => {
                                        const i = selectedTransactionItems[0];
                                        if (!i) return '';
                                        if (i.locFrom === 'IN') return 'RECEIVED';
                                        if (i.locFrom === 'OUT') return 'ISSUED';
                                        return 'TRANSFER';
                                    })()}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8 p-4 bg-gray-50 rounded-xl">
                            {(() => {
                                const i = selectedTransactionItems[0];
                                if (!i) return null;

                                let from = i.locFrom;
                                let to = i.locTo;

                                if (from === 'IN') { from = 'MAIN'; to = i.locTo; }
                                else if (from === 'OUT') { from = i.locTo; to = 'CUSTOMER'; }

                                if (i.locTo === 'CUSTOMER' && i.customerName) {
                                    to = `CUSTOMER (${i.customerName})`;
                                }

                                return (
                                    <>
                                        <div className="text-center">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-1">User</p>
                                            <p className="font-semibold text-gray-800">{i.user}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-1">From (Source)</p>
                                            <p className="font-semibold text-gray-800">{from}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-1">To (Destination)</p>
                                            <p className="font-semibold text-blue-600">{to}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Qty</p>
                                            <p className="font-semibold text-gray-800">
                                                {selectedTransactionItems.reduce((acc, item) => acc + item.qtyPcs, 0)} Pcs
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Cartons</p>
                                            <p className="font-semibold text-green-600">
                                                {selectedTransactionItems.reduce((acc, item) => {
                                                    const p = products.find(prod => prod.barcode === item.barcode);
                                                    return acc + (item.qtyPcs / (p?.pcsInCtn || 1));
                                                }, 0).toFixed(1)} Ctns
                                            </p>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        <div className="overflow-hidden rounded-xl border border-gray-200">
                            <table className="w-full text-center">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Barcode</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Product Name</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Qty (Pieces)</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Qty (Ctns)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {[...selectedTransactionItems].sort((a, b) => a.productName.localeCompare(b.productName)).map((item, idx) => {
                                        const product = products.find(p => p.barcode === item.barcode);
                                        const pcsInCtn = product?.pcsInCtn || 1;
                                        const cartons = (item.qtyPcs / pcsInCtn).toFixed(1);
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-mono text-sm text-gray-500 text-center">{item.barcode}</td>
                                                <td className="px-6 py-4 font-medium text-gray-900 text-center">{item.productName}</td>
                                                <td className="px-6 py-4 text-center font-bold text-blue-600">{item.qtyPcs}</td>
                                                <td className="px-6 py-4 text-center font-medium text-gray-600">{cartons}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Reprint Tab */}
            {activeTab === 'reprint' && (
                <div className="flex flex-col items-center justify-center py-12 px-4 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto w-full">

                    {/* Hero Card */}
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 w-full mb-8 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-red-500"></div>
                        <div className="flex flex-col md:flex-row gap-8 items-center">
                            <div className="p-6 bg-orange-50 rounded-2xl text-orange-600 transition-transform group-hover:scale-105 duration-300">
                                <History className="w-16 h-16" />
                            </div>
                            <div className="flex-1 space-y-4 w-full">
                                <div>
                                    <h2 className="text-3xl font-bold text-gray-800">Reprint Receipt</h2>
                                    <p className="text-gray-500 text-lg">Retrieve and print past transaction records swiftly.</p>
                                </div>
                                <div className="relative group/input">
                                    <input
                                        type="text"
                                        value={reprintQuery}
                                        onChange={(e) => setReprintQuery(e.target.value)}
                                        placeholder="Enter Transaction Number (e.g. TRX-0030 or OT-0030)"
                                        className="w-full h-[60px] pl-14 pr-4 border-2 border-gray-200 rounded-2xl text-lg focus:border-orange-500 focus:shadow-lg outline-none transition-all font-bold text-gray-700 uppercase tracking-wider placeholder:normal-case placeholder:font-normal"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleReprint();
                                        }}
                                    />
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6 group-focus-within/input:text-orange-500 transition-colors" />
                                </div>
                                <button
                                    onClick={handleReprint}
                                    disabled={isReprinting}
                                    className={`w-full h-[60px] bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-orange-200 transition-all transform active:scale-[0.98] ${isReprinting ? 'opacity-80 cursor-wait' : ''}`}
                                >
                                    {isReprinting ? (
                                        <>
                                            <RotateCw className="w-6 h-6 animate-spin" />
                                            Processing Request...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-6 h-6" />
                                            Find & Print Receipt
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Recent Transactions Grid */}
                    <div className="w-full space-y-4">
                        <div className="flex items-center gap-2 mb-2 px-2">
                            <History className="w-5 h-5 text-gray-400" />
                            <h3 className="text-gray-500 font-bold uppercase text-sm tracking-wide">Recent Transactions</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(() => {
                                // Extract unique transactions (First 6)
                                const uniqueTrx = new Map<string, any>();
                                transfers.forEach(t => {
                                    if (t.number && !uniqueTrx.has(t.number)) uniqueTrx.set(t.number, t);
                                });
                                // Convert map to array and take first 6
                                const recent = Array.from(uniqueTrx.values()).slice(0, 6);

                                return recent.map((t, i) => (
                                    <div
                                        key={t.number}
                                        onClick={() => {
                                            setReprintQuery(t.number);
                                            // Optional: Auto-trigger print or just fill input? Let's just fill input for safety
                                            // window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-200 cursor-pointer transition-all flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 font-bold text-xs group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 group-hover:text-orange-700 transition-colors">{t.number}</p>
                                                <p className="text-xs text-gray-400">{t.date}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Items</p>
                                            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-md group-hover:bg-orange-100 group-hover:text-orange-700 transition-colors">
                                                Active
                                            </span>
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* New Transaction Tab (Full Screen) */}
            {
                activeTab === 'new_transaction' && (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">

                        {/* Header Controls */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            {/* Header Details same as before */}
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">New Bulk Transaction</h2>
                                <button onClick={() => setActiveTab('inventory')} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-all">
                                    <Plus className="w-6 h-6 rotate-45" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.5fr_1.5fr] gap-4 items-end">
                                {/* Source Type */}
                                <div className="relative">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">From (Source)</label>
                                    <div
                                        onClick={() => setOpenSourceDropdown(!openSourceDropdown)}
                                        className="w-full h-[50px] px-4 border-2 border-gray-200 rounded-xl bg-white flex items-center justify-between cursor-pointer hover:border-orange-500 transition-all font-medium text-gray-700"
                                    >
                                        <span>{sourceType}</span>
                                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${openSourceDropdown ? 'rotate-180' : ''}`} />
                                    </div>

                                    {openSourceDropdown && (
                                        <>
                                            <div className="fixed inset-0 z-30 bg-transparent cursor-default" onClick={() => setOpenSourceDropdown(false)} />
                                            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                {['Main Inventory', 'Person', 'Only Transfer'].map((option) => (
                                                    <div
                                                        key={option}
                                                        onClick={() => {
                                                            const newSource = option as any;
                                                            setSourceType(newSource);
                                                            if (newSource === 'Only Transfer') {
                                                                // Freeze settings
                                                                // We can keep destType as is or set to something specific, 
                                                                // but disabling interaction is key.
                                                                // Let's reset customer name just in case.
                                                                setCustomerName('');
                                                            } else if (newSource === destType) {
                                                                const validDest = ['Main Inventory', 'Person', 'Customer'].find(d => d !== newSource);
                                                                if (validDest) setDestType(validDest as any);
                                                            }
                                                            setOpenSourceDropdown(false);
                                                        }}
                                                        className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between ${sourceType === option ? 'bg-orange-50 text-orange-700 font-bold' : 'hover:bg-gray-50 text-gray-700'
                                                            }`}
                                                    >
                                                        {option}
                                                        {sourceType === option && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Destination Type */}
                                <div className="relative">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">To (Destination)</label>
                                    <div
                                        onClick={() => sourceType !== 'Only Transfer' && setOpenDestDropdown(!openDestDropdown)}
                                        className={`w-full h-[50px] px-4 border-2 border-gray-200 rounded-xl bg-white flex items-center justify-between transition-all font-medium text-gray-700 ${sourceType === 'Only Transfer' ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'cursor-pointer hover:border-orange-500'}`}
                                    >
                                        <span>{sourceType === 'Only Transfer' ? 'Frozen' : destType}</span>
                                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${openDestDropdown ? 'rotate-180' : ''}`} />
                                    </div>

                                    {openDestDropdown && (
                                        <>
                                            <div className="fixed inset-0 z-30 bg-transparent cursor-default" onClick={() => setOpenDestDropdown(false)} />
                                            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                {['Main Inventory', 'Person', 'Customer'].map((option) => (
                                                    <div
                                                        key={option}
                                                        onClick={() => {
                                                            const newDest = option as any;
                                                            setDestType(newDest);
                                                            if (newDest === sourceType) {
                                                                const validSource = ['Main Inventory', 'Person'].find(s => s !== newDest);
                                                                if (validSource) setSourceType(validSource as any);
                                                            }
                                                            setOpenDestDropdown(false);
                                                        }}
                                                        className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between ${destType === option ? 'bg-orange-50 text-orange-700 font-bold' : 'hover:bg-gray-50 text-gray-700'
                                                            }`}
                                                    >
                                                        {option}
                                                        {destType === option && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Person Name Input */}
                                <div className="relative">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Person Name</label>
                                    <input
                                        type="text"
                                        className={`w-full h-[50px] px-4 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none transition-all bg-white font-medium text-gray-700 ${(sourceType === 'Person' || destType === 'Person' || destType === 'Customer' || sourceType === 'Only Transfer') ? 'opacity-100' : 'opacity-50 grayscale pointer-events-none'
                                            }`}
                                        value={personName}
                                        onChange={(e) => {
                                            setPersonName(e.target.value);
                                            setShowPersonSuggestions(true);
                                        }}
                                        onFocus={() => setShowPersonSuggestions(true)}
                                        // Delay blur to allow click registration
                                        onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 200)}
                                        placeholder="Enter Person Name..."
                                        disabled={sourceType !== 'Person' && destType !== 'Person' && destType !== 'Customer' && sourceType !== 'Only Transfer'}
                                    />
                                    {/* Custom Suggestions Dropdown */}
                                    {showPersonSuggestions && (sourceType === 'Person' || destType === 'Person' || destType === 'Customer' || sourceType === 'Only Transfer') && (
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 overflow-y-auto z-50">
                                            {peopleStats
                                                .filter(p => !personName || p.name.toLowerCase().includes(personName.toLowerCase()))
                                                .map((p, idx) => (
                                                    <div
                                                        key={idx}
                                                        onMouseDown={() => {
                                                            setPersonName(p.name);
                                                            setShowPersonSuggestions(false);
                                                        }}
                                                        className="px-4 py-3 hover:bg-orange-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0 flex items-center gap-3"
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs">
                                                            {p.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-700">{p.name}</p>
                                                            <p className="text-xs text-gray-400">Previous Transactions</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            {peopleStats.filter(p => !personName || p.name.toLowerCase().includes(personName.toLowerCase())).length === 0 && personName && (
                                                <div className="px-4 py-3 text-sm text-gray-400 italic">
                                                    No matches found. New person will be created.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Customer Name Input */}
                                <div className="relative">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Customer Name</label>
                                    <input
                                        type="text"
                                        className={`w-full h-[50px] px-4 border-2 border-blue-200 rounded-xl text-sm focus:border-blue-500 outline-none transition-all bg-white font-medium text-gray-700 ${(destType === 'Customer' || sourceType === 'Only Transfer') ? 'opacity-100' : 'opacity-50 grayscale pointer-events-none'
                                            }`}
                                        value={customerName}
                                        onChange={(e) => {
                                            setCustomerName(e.target.value);
                                            setShowCustomerSuggestions(true);
                                        }}
                                        onFocus={() => setShowCustomerSuggestions(true)}
                                        // Delay blur to allow click registration
                                        onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                                        placeholder="Enter Customer Name..."
                                        disabled={destType !== 'Customer' && sourceType !== 'Only Transfer'}
                                    />
                                    {/* Custom Suggestions Dropdown */}
                                    {showCustomerSuggestions && (destType === 'Customer' || sourceType === 'Only Transfer') && (
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 overflow-y-auto z-50">
                                            {previousCustomers
                                                .filter(c => !customerName || c.toLowerCase().includes(customerName.toLowerCase()))
                                                .map((c, idx) => (
                                                    <div
                                                        key={idx}
                                                        onMouseDown={() => {
                                                            setCustomerName(c);
                                                            setShowCustomerSuggestions(false);
                                                        }}
                                                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0 flex items-center gap-3"
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                                            {c.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-700">{c}</p>
                                                            <p className="text-xs text-gray-400">Previous Customer</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            {previousCustomers.filter(c => !customerName || c.toLowerCase().includes(customerName.toLowerCase())).length === 0 && customerName && (
                                                <div className="px-4 py-3 text-sm text-gray-400 italic">
                                                    No matches found.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Description Field - Full Width Row */}
                            <div className="mt-4">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full h-[50px] px-4 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none transition-all"
                                    placeholder="Enter transaction details..."
                                />
                            </div>
                        </div>

                        {/* Transaction Items Table */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-visible">
                            <div className="overflow-visible">
                                <table className="w-full">
                                    <thead className="bg-white border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 w-[5%]">#</th>
                                            <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[30%]">Product</th>
                                            <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[15%]">Quantity</th>
                                            <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[15%]">Unit</th>
                                            <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[15%]">Price / Pcs</th>
                                            <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 w-[15%]">Total</th>
                                            <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 w-[5%]">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {cart.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50">
                                                {/* Index */}
                                                <td className="px-6 py-4 align-top text-center font-bold text-gray-400 pt-7">
                                                    {idx + 1}
                                                </td>

                                                {/* Product Search Input */}
                                                <td className="px-6 py-4 align-top">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={row.searchTerm}
                                                            onChange={e => updateRow(idx, 'searchTerm', e.target.value)}
                                                            onFocus={() => {
                                                                updateRow(idx, 'showDropdown', true);
                                                            }}
                                                            onBlur={() => {
                                                                // Small delay to allow click on dropdown
                                                                setTimeout(() => updateRow(idx, 'showDropdown', false), 200);
                                                            }}
                                                            placeholder="Search Name / Barcode..."
                                                            className={`w-full h-[50px] px-4 border-2 rounded-xl text-sm font-medium outline-none transition-all flex items-center ${row.product ? 'border-blue-100 bg-blue-50 text-blue-800' : 'border-gray-200 focus:border-orange-400'}`}
                                                        />

                                                        {/* Row Dropdown */}
                                                        {row.showDropdown && row.searchTerm && !row.product && (
                                                            <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-20">
                                                                {getRowSuggestions(row.searchTerm).length > 0 ? (
                                                                    getRowSuggestions(row.searchTerm).map(p => (
                                                                        <div
                                                                            key={p.barcode}
                                                                            className="p-3 hover:bg-orange-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center"
                                                                            onMouseDown={() => updateRow(idx, 'product', p)} // MouseDown fires before Blur
                                                                        >
                                                                            <div>
                                                                                <p className="font-bold text-gray-800 text-sm">{p.productName}</p>
                                                                                <p className="text-xs text-gray-400 font-mono">{p.barcode}</p>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">
                                                                                    {p.qtyPcs} Pcs
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="p-3 text-center text-xs text-gray-400">No matches</div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {row.product && row.product.pcsInCtn > 1 && (
                                                            <div className="mt-2 text-xs text-blue-400 pl-2">
                                                                Pcs/Ctn: {row.product.pcsInCtn} | Stock: {row.product.qtyPcs} Pcs / {(row.product.qtyPcs / row.product.pcsInCtn).toFixed(1)} Ctns
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Qty Input */}
                                                <td className="px-6 py-4 align-top">
                                                    <input
                                                        type="number"
                                                        value={row.qty}
                                                        onChange={e => updateRow(idx, 'qty', e.target.value)}
                                                        placeholder="0"
                                                        className="w-full h-[50px] border-2 border-gray-200 rounded-xl text-center font-bold focus:border-orange-400 outline-none"
                                                    />
                                                </td>

                                                {/* Unit Toggle */}
                                                <td className="px-6 py-4 align-top">
                                                    <div className="flex h-[50px] bg-gray-100 p-1 rounded-xl items-center">
                                                        <button
                                                            onClick={() => updateRow(idx, 'unit', 'CTN')}
                                                            className={`flex-1 h-full rounded-lg text-xs font-bold transition-all flex items-center justify-center ${row.unit === 'CTN' ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}
                                                        >
                                                            CTN
                                                        </button>
                                                        <button
                                                            onClick={() => updateRow(idx, 'unit', 'PCS')}
                                                            className={`flex-1 h-full rounded-lg text-xs font-bold transition-all flex items-center justify-center ${row.unit === 'PCS' ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}
                                                        >
                                                            PCS
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Price Input */}
                                                <td className="px-6 py-4 align-top">
                                                    <input
                                                        type="number"
                                                        value={row.price}
                                                        onChange={e => updateRow(idx, 'price', parseFloat(e.target.value))}
                                                        className="w-full h-[50px] border-2 border-gray-200 rounded-xl text-center font-bold focus:border-orange-400 outline-none"
                                                    />
                                                </td>

                                                {/* Total Display */}
                                                <td className="px-6 py-4 align-top">
                                                    <div className="h-[50px] flex items-center justify-center font-mono font-bold text-gray-700 bg-gray-50 rounded-xl border border-gray-200">
                                                        {(() => {
                                                            const qty = parseFloat(row.qty as string) || 0;
                                                            const pcsInCtn = row.product?.pcsInCtn || 1;
                                                            const multiplier = row.unit === 'CTN' ? pcsInCtn : 1;
                                                            const total = qty * multiplier * (row.price || 0);
                                                            return total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                        })()}
                                                    </div>
                                                </td>

                                                {/* Delete Action */}
                                                <td className="px-6 py-4 align-top text-center">
                                                    <div className="h-[50px] flex items-center justify-center">
                                                        <button
                                                            onClick={() => removeRow(idx)}
                                                            className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            title="Remove Row"
                                                        >
                                                            <Plus className="w-5 h-5 rotate-45" />
                                                            <span className="sr-only">Delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals Footer */}
                            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                                {(() => {
                                    const activeItems = cart.filter(row => (parseFloat(row.qty as string) || 0) > 0).length;

                                    const totalPcs = cart.reduce((acc, row) => {
                                        const qty = parseFloat(row.qty as string) || 0;
                                        const pcsInCtn = row.product?.pcsInCtn || 1;
                                        return acc + (row.unit === 'CTN' ? qty * pcsInCtn : qty);
                                    }, 0);

                                    const totalCtns = cart.reduce((acc, row) => {
                                        const qty = parseFloat(row.qty as string) || 0;
                                        const pcsInCtn = row.product?.pcsInCtn || 1;
                                        return acc + (row.unit === 'CTN' ? qty : qty / pcsInCtn);
                                    }, 0);

                                    const subTotal = cart.reduce((acc, row) => {
                                        const qty = parseFloat(row.qty as string) || 0;
                                        const pcsInCtn = row.product?.pcsInCtn || 1;
                                        const multiplier = row.unit === 'CTN' ? pcsInCtn : 1;
                                        return acc + (qty * multiplier * (row.price || 0));
                                    }, 0);
                                    const vat = subTotal * 0.05;
                                    const grandTotal = subTotal + vat;

                                    return (
                                        <div className="flex flex-col md:flex-row justify-between gap-8">
                                            {/* Qty Stats */}
                                            <div className="flex gap-8 border-r border-gray-200 pr-8">
                                                <div className="text-left">
                                                    <p className="text-xs font-bold text-gray-400 uppercase">Items With Qty</p>
                                                    <p className="font-mono font-bold text-gray-800">{activeItems}</p>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-xs font-bold text-gray-400 uppercase">Total Ctns</p>
                                                    <p className="font-mono font-bold text-blue-600">{totalCtns.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-xs font-bold text-gray-400 uppercase">Total Pcs</p>
                                                    <p className="font-mono font-bold text-green-600">{totalPcs.toLocaleString()}</p>
                                                </div>
                                            </div>

                                            {/* Financials */}
                                            <div className="flex justify-end gap-8">
                                                <div className="text-right">
                                                    <p className="text-xs font-bold text-gray-400 uppercase">Subtotal</p>
                                                    <p className="font-mono font-bold text-gray-800">{subTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-bold text-gray-400 uppercase">VAT (5%)</p>
                                                    <p className="font-mono font-bold text-red-600">{vat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-bold text-gray-400 uppercase">Grand Total</p>
                                                    <p className="font-mono font-bold text-xl text-blue-600">{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Footer Actions */}
                            <div className="bg-white px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                                <button
                                    onClick={addRow}
                                    disabled={submitting}
                                    className="flex items-center gap-2 text-orange-600 font-bold hover:bg-orange-100 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-5 h-5" /> Add New Row
                                </button>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setActiveTab('inventory')}
                                        disabled={submitting}
                                        className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleTransaction}
                                        disabled={submitting || !personName}
                                        className="px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 shadow-lg transition-all flex items-center gap-2"
                                    >
                                        {submitting ? 'Saving...' : 'Confirm Transaction'} <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* People Inventory Tab */}
            {
                activeTab === 'people_inventory' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-white border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider min-w-[200px]">Distributor</th>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-blue-600 uppercase tracking-wider">Taken (Ctns)</th>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-blue-600 uppercase tracking-wider">Taken (Pcs)</th>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-green-600 uppercase tracking-wider">Current (Ctns)</th>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-green-600 uppercase tracking-wider">Current (Pcs)</th>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-orange-600 uppercase tracking-wider">Distributed (Ctns)</th>
                                        <th className="px-6 py-4 text-center text-sm font-bold text-orange-600 uppercase tracking-wider">Distributed (Pcs)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {peopleStats.length > 0 ? (
                                        peopleStats.map((person, idx) => (
                                            <tr
                                                key={idx}
                                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                                onClick={() => {
                                                    setSelectedPerson(person.name);
                                                    setPersonSubTab('summary');
                                                    setActiveTab('person_details');
                                                }}
                                            >
                                                <td className="px-6 py-4 text-sm font-bold text-gray-800 text-center">{person.name}</td>
                                                <td className="px-6 py-4 text-sm text-blue-600 font-mono text-center font-bold">
                                                    {person.totalReceivedCtns.toFixed(1)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-blue-600 font-bold text-center">
                                                    {person.totalReceivedPcs.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-green-600 font-mono text-center font-bold">
                                                    {person.totalCtns.toFixed(1)}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-green-600 text-center">
                                                    {person.totalPcs.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-orange-600 font-mono text-center font-bold">
                                                    {person.totalDistributedCtns.toFixed(1)}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-orange-600 text-center">
                                                    {person.totalDistributedPcs.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <AlertCircle className="w-8 h-8 opacity-50" />
                                                    <p>No inventory records found.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-100 border-t-2 border-gray-200">
                                    <tr>
                                        <td className="px-6 py-4 text-sm font-black text-gray-900 text-center uppercase">Total</td>
                                        <td className="px-6 py-4 text-sm font-bold text-blue-700 font-mono text-center">
                                            {peopleStats.reduce((sum, p) => sum + p.totalReceivedCtns, 0).toFixed(1)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-blue-700 text-center">
                                            {peopleStats.reduce((sum, p) => sum + p.totalReceivedPcs, 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-green-700 font-mono text-center">
                                            {peopleStats.reduce((sum, p) => sum + p.totalCtns, 0).toFixed(1)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-green-700 text-center">
                                            {peopleStats.reduce((sum, p) => sum + p.totalPcs, 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-orange-700 font-mono text-center">
                                            {peopleStats.reduce((sum, p) => sum + p.totalDistributedCtns, 0).toFixed(1)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-orange-700 text-center">
                                            {peopleStats.reduce((sum, p) => sum + p.totalDistributedPcs, 0).toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )
            }

            {/* Person Details Tab (Drill Down) */}
            {
                activeTab === 'person_details' && selectedPerson && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setActiveTab('people_inventory')}
                                    className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
                                >
                                    <ArrowRight className="w-6 h-6 rotate-180" />
                                </button>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">{selectedPerson}</h2>
                                    <p className="text-sm text-gray-500">Inventory Details</p>
                                </div>
                            </div>
                        </div>

                        {/* Sub Tabs */}
                        <div className="flex w-fit mx-auto bg-gray-100 p-1 rounded-xl mb-6 shadow-inner">
                            <button
                                onClick={() => setPersonSubTab('summary')}
                                className={`px-6 py-2 min-w-[160px] text-sm font-bold rounded-lg transition-all text-center ${personSubTab === 'summary' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Inventory Summary
                            </button>
                            <button
                                onClick={() => setPersonSubTab('transactions')}
                                className={`px-6 py-2 min-w-[160px] text-sm font-bold rounded-lg transition-all text-center ${personSubTab === 'transactions' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Transaction History
                            </button>
                            <button
                                onClick={() => setPersonSubTab('distribution')}
                                className={`px-6 py-2 min-w-[160px] text-sm font-bold rounded-lg transition-all text-center ${personSubTab === 'distribution' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Distributions
                            </button>
                        </div>

                        {/* Summary View */}
                        {personSubTab === 'summary' && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-white border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Barcode</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Product Name</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-blue-600 uppercase tracking-wider">Taken (Received)</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-green-600 uppercase tracking-wider">Remaining (Balance)</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-orange-600 uppercase tracking-wider">Distributed</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(() => {
                                                const inventoryMap = peopleStats.find(p => p.name === selectedPerson)?.prodMap || {};
                                                const inventoryItems = Object.entries(inventoryMap)
                                                    .filter(([_, stats]) => stats.balance !== 0 || stats.received !== 0 || stats.distributed !== 0);

                                                // Calculate Totals
                                                const totals = inventoryItems.reduce((acc, [barcode, stats]) => {
                                                    const product = products.find(p => p.barcode === barcode);
                                                    const pcsInCtn = product ? (product.pcsInCtn || 1) : 1;

                                                    acc.receivedPcs += stats.received;
                                                    acc.receivedCtns += stats.received / pcsInCtn;
                                                    acc.balancePcs += stats.balance;
                                                    acc.balanceCtns += stats.balance / pcsInCtn;
                                                    acc.distPcs += stats.distributed;
                                                    acc.distCtns += stats.distributed / pcsInCtn;
                                                    return acc;
                                                }, { receivedPcs: 0, receivedCtns: 0, balancePcs: 0, balanceCtns: 0, distPcs: 0, distCtns: 0 });

                                                if (inventoryItems.length === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                                                No active inventory items.
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                return (
                                                    <React.Fragment>
                                                        {inventoryItems.map(([barcode, stats]) => {
                                                            const product = products.find(p => p.barcode === barcode);
                                                            const productName = product ? product.productName : barcode;
                                                            const pcsInCtn = product ? (product.pcsInCtn || 1) : 1;

                                                            const receivedCtns = stats.received / pcsInCtn;
                                                            const balanceCtns = stats.balance / pcsInCtn;
                                                            const distributedCtns = stats.distributed / pcsInCtn;

                                                            return (
                                                                <tr key={barcode} className="hover:bg-gray-50">
                                                                    <td className="px-6 py-4 font-mono text-sm text-gray-500 text-center">{barcode}</td>
                                                                    <td className="px-6 py-4 text-sm font-medium text-gray-800 text-center">{productName}</td>
                                                                    {/* Received */}
                                                                    <td className="px-6 py-4 text-center bg-blue-50/30">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-gray-900 font-bold">{stats.received} Pcs</span>
                                                                            <span className="text-gray-500 text-xs">{receivedCtns.toFixed(1)} Ctns</span>
                                                                        </div>
                                                                    </td>
                                                                    {/* Remaining */}
                                                                    <td className="px-6 py-4 text-center bg-green-50/30">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-gray-900 font-bold">{stats.balance} Pcs</span>
                                                                            <span className="text-gray-500 text-xs">{balanceCtns.toFixed(1)} Ctns</span>
                                                                        </div>
                                                                    </td>
                                                                    {/* Distributed */}
                                                                    <td className="px-6 py-4 text-center bg-orange-50/30">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-gray-900 font-bold">{stats.distributed} Pcs</span>
                                                                            <span className="text-gray-500 text-xs">{distributedCtns.toFixed(1)} Ctns</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {/* Footer Row */}
                                                        <tr className="bg-gray-100 border-t-2 border-gray-200">
                                                            <td colSpan={2} className="px-6 py-4 text-sm font-black text-gray-900 text-right uppercase"></td>
                                                            <td className="px-6 py-4 text-center bg-blue-100/50">
                                                                <div className="flex flex-col">
                                                                    <span className="text-blue-900 font-bold">{totals.receivedPcs} Pcs</span>
                                                                    <span className="text-blue-700 text-xs font-mono">{totals.receivedCtns.toFixed(1)} Ctns</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center bg-green-100/50">
                                                                <div className="flex flex-col">
                                                                    <span className="text-green-900 font-bold">{totals.balancePcs} Pcs</span>
                                                                    <span className="text-green-700 text-xs font-mono">{totals.balanceCtns.toFixed(1)} Ctns</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center bg-orange-100/50">
                                                                <div className="flex flex-col">
                                                                    <span className="text-orange-900 font-bold">{totals.distPcs} Pcs</span>
                                                                    <span className="text-orange-700 text-xs font-mono">{totals.distCtns.toFixed(1)} Ctns</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Transactions View */}
                        {personSubTab === 'transactions' && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-white border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Trx #</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Items</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Total Pcs</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Total Ctns</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(() => {
                                                // Filter transfers for this person
                                                const personTransfers = transfers.filter(t => {
                                                    let finalFrom = t.locFrom;
                                                    let finalTo = t.locTo;

                                                    if (t.locFrom === 'IN') { finalFrom = 'Main Inventory'; finalTo = t.locTo; }
                                                    else if (t.locFrom === 'OUT') { finalFrom = t.locTo; finalTo = 'Customer'; }
                                                    if (finalFrom === 'MAIN') finalFrom = 'Main Inventory';
                                                    if (finalTo === 'MAIN') finalTo = 'Main Inventory';
                                                    if (finalTo === 'CUSTOMER') finalTo = 'Customer';

                                                    // Use receiverName to link Only Transfer (or Frozen) items to a person
                                                    return finalFrom === selectedPerson || finalTo === selectedPerson || t.receiverName === selectedPerson;
                                                });

                                                // Calculate Grand Totals
                                                const grandTotalPcs = personTransfers.reduce((acc, i) => acc + i.qtyPcs, 0);
                                                const grandTotalCtns = personTransfers.reduce((acc, i) => {
                                                    const p = products.find(prod => prod.barcode === i.barcode);
                                                    return acc + (i.qtyPcs / (p?.pcsInCtn || 1));
                                                }, 0);

                                                const grouped = new Map<string, typeof transfers>();
                                                personTransfers.forEach(t => {
                                                    const key = t.number || `LEGACY-${t.date}-${t.locTo}`;
                                                    if (!grouped.has(key)) grouped.set(key, []);
                                                    grouped.get(key)!.push(t);
                                                });

                                                if (grouped.size === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                                                                No transactions found for this person.
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                return (
                                                    <React.Fragment>
                                                        {Array.from(grouped.entries()).map(([trxNum, items], idx) => {
                                                            const first = items[0];
                                                            const count = items.length;
                                                            const totalPcs = items.reduce((acc, i) => acc + i.qtyPcs, 0);
                                                            const totalCtns = items.reduce((acc, i) => {
                                                                const p = products.find(prod => prod.barcode === i.barcode);
                                                                return acc + (i.qtyPcs / (p?.pcsInCtn || 1));
                                                            }, 0).toFixed(1);

                                                            // Determine Type
                                                            let relation = 'TRANSFER';
                                                            let finalFrom = first.locFrom;
                                                            let finalTo = first.locTo;

                                                            if (finalFrom === 'IN') { finalFrom = 'Main Inventory'; finalTo = first.locTo; }
                                                            else if (finalFrom === 'OUT') { finalFrom = first.locTo; finalTo = 'Customer'; }
                                                            if (finalFrom === 'MAIN') finalFrom = 'Main Inventory';
                                                            if (finalTo === 'MAIN') finalTo = 'Main Inventory';
                                                            if (finalTo === 'CUSTOMER') finalTo = 'Customer';

                                                            if (finalTo === selectedPerson) relation = 'RECEIVED';
                                                            else if (finalFrom === selectedPerson || first.receiverName === selectedPerson) relation = 'ISSUED';

                                                            return (
                                                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                                    <td className="px-6 py-4 text-center">
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedTransactionNumber(trxNum);
                                                                                setSelectedTransactionItems(items);
                                                                                setActiveTab('transaction_details');
                                                                            }}
                                                                            className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline text-sm"
                                                                        >
                                                                            {trxNum.startsWith('LEGACY') ? 'Old Log' : trxNum}
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 text-center">{first.date}</td>
                                                                    <td className="px-6 py-4 text-center">
                                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${relation === 'RECEIVED' ? 'bg-green-100 text-green-700' :
                                                                            relation === 'ISSUED' ? 'bg-red-100 text-red-700' :
                                                                                'bg-gray-100 text-gray-700'
                                                                            }`}>
                                                                            {relation}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-sm font-bold text-gray-700 text-center">{count}</td>
                                                                    <td className="px-6 py-4 font-mono font-medium text-gray-800 text-center">{totalPcs.toLocaleString()}</td>
                                                                    <td className="px-6 py-4 font-mono font-medium text-gray-600 text-center">{totalCtns}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {/* Footer Row */}
                                                        <tr className="bg-gray-100 border-t-2 border-gray-200">
                                                            <td colSpan={3} className="px-6 py-4 text-sm font-black text-gray-900 text-right uppercase"></td>
                                                            <td className="px-6 py-4 text-sm font-bold text-gray-700 text-center">{personTransfers.length}</td>
                                                            <td className="px-6 py-4 text-sm font-bold text-gray-900 text-center">{grandTotalPcs.toLocaleString()}</td>
                                                            <td className="px-6 py-4 text-sm font-bold text-blue-700 font-mono text-center">{grandTotalCtns.toFixed(1)}</td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                        }

                        {/* Distributions View */}
                        {personSubTab === 'distribution' && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-white border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Trx #</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Destination</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Product / Details</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Qty (Ctns)</th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">Qty (Pcs)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(() => {
                                                // Filter transfers OUT from this person
                                                const distributions = transfers.filter(t => {
                                                    let finalFrom = t.locFrom;
                                                    if (t.locFrom === 'IN') finalFrom = 'Main Inventory';
                                                    else if (t.locFrom === 'OUT') finalFrom = t.locTo;
                                                    if (finalFrom === 'MAIN') finalFrom = 'Main Inventory';

                                                    return finalFrom === selectedPerson;
                                                });

                                                if (distributions.length === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                                                                No distributions found for this person.
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                // Group by Transaction Number and Destination
                                                const grouped = new Map<string, typeof distributions>();

                                                distributions.forEach(t => {
                                                    const key = `${t.number || `LEGACY-${t.date}`}-${t.locTo}`;
                                                    if (!grouped.has(key)) grouped.set(key, []);
                                                    grouped.get(key)!.push(t);
                                                });

                                                return Array.from(grouped.entries()).map(([key, items], groupIdx) => {
                                                    const first = items[0];
                                                    const trxNum = first.number || 'LEGACY';

                                                    let destination = first.locTo;
                                                    if (destination === 'Customer' || destination === 'CUSTOMER') {
                                                        destination = `Customer: ${first.customerName || 'Unknown'}`;
                                                    } else if (destination === 'Main Inventory' || destination === 'MAIN') {
                                                        destination = 'Main Inventory';
                                                    }

                                                    // Calculate Totals per Transaction
                                                    const totalPcs = items.reduce((acc, i) => acc + i.qtyPcs, 0);
                                                    const totalCtns = items.reduce((acc, i) => {
                                                        const prod = products.find(p => p.barcode === i.barcode);
                                                        return acc + (i.qtyPcs / (prod?.pcsInCtn || 1));
                                                    }, 0);

                                                    const isExpanded = expandedTransactions.has(key);

                                                    const toggleExpand = () => {
                                                        const newSet = new Set(expandedTransactions);
                                                        if (isExpanded) {
                                                            newSet.delete(key);
                                                        } else {
                                                            newSet.add(key);
                                                        }
                                                        setExpandedTransactions(newSet);
                                                    };

                                                    return (
                                                        <React.Fragment key={groupIdx}>
                                                            {/* Summary Row */}
                                                            <tr
                                                                className={`border-t-4 border-white cursor-pointer transition-colors ${isExpanded ? 'bg-orange-50' : 'bg-gray-50 hover:bg-gray-100'}`}
                                                                onClick={toggleExpand}
                                                            >
                                                                <td className="px-6 py-4 font-mono text-sm text-blue-600 font-bold text-center relative">
                                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                                                        {isExpanded ? <ChevronDown className="w-5 h-5 text-orange-500" /> : <ArrowRight className="w-5 h-5 text-gray-400" />}
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedTransactionNumber(trxNum);
                                                                            setSelectedTransactionItems(items);
                                                                            setActiveTab('transaction_details');
                                                                        }}
                                                                        className="hover:underline z-10 relative"
                                                                    >
                                                                        {trxNum.startsWith('LEGACY') ? 'Old Log' : trxNum}
                                                                    </button>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-gray-500 text-center font-bold">{first.date}</td>
                                                                <td className="px-6 py-4 text-sm font-bold text-gray-800 text-center">{destination}</td>
                                                                <td className="px-6 py-4 text-sm font-bold text-gray-400 text-center uppercase tracking-wider">
                                                                    Total ({items.length} items)
                                                                </td>
                                                                <td className="px-6 py-4 text-sm font-bold text-orange-700 font-mono text-center bg-orange-50/50 rounded-lg">
                                                                    {totalCtns.toFixed(1)}
                                                                </td>
                                                                <td className="px-6 py-4 text-sm font-bold text-gray-800 text-center bg-gray-100/50 rounded-lg">
                                                                    {totalPcs.toLocaleString()}
                                                                </td>
                                                            </tr>

                                                            {/* Details Rows */}
                                                            {isExpanded && items.map((item, itemIdx) => {
                                                                const prod = products.find(p => p.barcode === item.barcode);
                                                                const pcsInCtn = prod ? prod.pcsInCtn : 1;
                                                                const ctns = item.qtyPcs / pcsInCtn;

                                                                return (
                                                                    <tr key={`${groupIdx}-${itemIdx}`} className="bg-white hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 animate-in fade-in slide-in-from-top-2 duration-300">
                                                                        {/* Indent / Empty Cols */}
                                                                        <td className="px-6 py-3 border-r border-gray-50 bg-gray-50/30"></td>
                                                                        <td className="px-6 py-3 border-r border-gray-50 bg-gray-50/30"></td>
                                                                        <td className="px-6 py-3 border-r border-gray-50 bg-gray-50/30"></td>

                                                                        <td className="px-6 py-3 text-sm font-medium text-gray-700 text-center flex flex-col items-center">
                                                                            <span>{item.productName}</span>
                                                                            <span className="text-xs text-gray-400 font-mono">{item.barcode}</span>
                                                                        </td>
                                                                        <td className="px-6 py-3 text-sm text-gray-500 font-mono text-center">
                                                                            {ctns.toFixed(1)}
                                                                        </td>
                                                                        <td className="px-6 py-3 text-sm font-bold text-gray-600 text-center">
                                                                            {item.qtyPcs.toLocaleString()}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                        <tfoot className="bg-gray-100 border-t-2 border-gray-200">
                                            {(() => {
                                                const distributions = transfers.filter(t => {
                                                    let finalFrom = t.locFrom;
                                                    if (t.locFrom === 'IN') finalFrom = 'Main Inventory';
                                                    else if (t.locFrom === 'OUT') finalFrom = t.locTo;
                                                    if (finalFrom === 'MAIN') finalFrom = 'Main Inventory';

                                                    return finalFrom === selectedPerson;
                                                });

                                                const totalPcs = distributions.reduce((acc, t) => acc + t.qtyPcs, 0);
                                                const totalCtns = distributions.reduce((acc, t) => {
                                                    const prod = products.find(p => p.barcode === t.barcode);
                                                    return acc + (t.qtyPcs / (prod?.pcsInCtn || 1));
                                                }, 0);

                                                return (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-4 text-sm font-black text-gray-900 text-right uppercase"></td>
                                                        <td className="px-6 py-4 text-sm font-bold text-orange-700 font-mono text-center">
                                                            {totalCtns.toFixed(1)}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-bold text-gray-900 text-center">
                                                            {totalPcs.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })()}
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div >
                )
            }



            {/* Loading Overlay */}
            {
                submitting && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in duration-300">
                            <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
                            <p className="text-xl font-bold text-gray-800 animate-pulse">Be Patient 😌</p>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
