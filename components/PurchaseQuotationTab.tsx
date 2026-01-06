'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Download, ArrowLeft, Search, Upload, Save, Box, FileText, Loader2, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface PurchaseQuotationProps {
    initialItems?: any[];
}

export default function PurchaseQuotation({ initialItems }: PurchaseQuotationProps) {
    const [companyName, setCompanyName] = useState('Al Marai Al Arabia Trading Sole Proprietorship L.L.C');
    const [companyAddress, setCompanyAddress] = useState('Address - City - Country');
    const [companyPhone, setCompanyPhone] = useState('+971 XXX XXX XXXX');
    const [companyEmail, setCompanyEmail] = useState('info@almaraiarabia.com');

    const [supplierName, setSupplierName] = useState('');
    const [supplierAddress, setSupplierAddress] = useState('');
    const [supplierPhone, setSupplierPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);

    const [quotationNumber, setQuotationNumber] = useState('PO-2025-001');
    const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);

    const [items, setItems] = useState([
        { id: 1, barcode: '', name: '', quantity: 1, unit: '-', price: 0 }
    ]);
    const [loading, setLoading] = useState(false);
    const [searchNumber, setSearchNumber] = useState('');

    // Fetch next quotation number on mount
    useEffect(() => {
        fetchNextQuotationNumber();
    }, []);

    // Load initial items if provided
    useEffect(() => {
        if (initialItems && initialItems.length > 0) {
            setItems(initialItems.map((item, index) => ({
                id: Date.now() + index,
                barcode: item.barcode || '',
                name: item.name || item.productName || '', // Handle different naming conventions
                quantity: item.quantity || item.qtyOrder || item.orderQty || 1,
                unit: item.unit || '-',
                price: item.price || 0
            })));
        }
    }, [initialItems]);

    const fetchNextQuotationNumber = async () => {
        try {
            const response = await fetch('/api/purchase-quotation');
            const data = await response.json();
            if (data.quotationNumber) {
                setQuotationNumber(data.quotationNumber);
                setIsEditMode(false);
            }
        } catch (error) {
            console.error('Error fetching quotation number:', error);
        }
    };

    const searchQuotation = async () => {
        if (!searchNumber.trim()) {
            alert('Please enter a quotation number');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/purchase-quotation/search?number=${encodeURIComponent(searchNumber)}`);
            const result = await response.json();

            if (result.found && result.data) {
                // Load the quotation data
                setQuotationNumber(result.data.quotationNumber);
                setQuotationDate(result.data.date);
                setSupplierName(result.data.supplierName);
                setNotes(result.data.notes || '');
                setItems(result.data.items.map((item: any, index: number) => ({
                    id: index + 1,
                    ...item
                })));
                setIsEditMode(true);
            } else {
                alert('Quotation not found');
            }
        } catch (error) {
            console.error('Error searching quotation:', error);
            alert('Error searching quotation');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = async () => {
        setSearchNumber('');
        setSupplierName('');
        setSupplierAddress('');
        setSupplierPhone('');
        setNotes('');
        setItems([{ id: 1, barcode: '', name: '', quantity: 1, unit: '-', price: 0 }]);
        setIsEditMode(false);
        // Ensure date is reset to today
        setQuotationDate(new Date().toISOString().split('T')[0]);
        await fetchNextQuotationNumber();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const bstr = event.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const newItems = data.map((row: any, index: number) => ({
                    id: Date.now() + index, // temporary unique id
                    barcode: row['Barcode'] || row['barcode'] || '',
                    name: row['Product Name'] || row['product name'] || '',
                    quantity: Number(row['Qty Order']) || Number(row['qty order']) || 1,
                    unit: '-',
                    price: 0
                })).filter(item => item.barcode || item.name);

                if (newItems.length > 0) {
                    setItems(prevItems => {
                        if (prevItems.length === 1 && !prevItems[0].barcode && !prevItems[0].name) {
                            return newItems.map((item, idx) => ({ ...item, id: idx + 1 }));
                        }
                        return [...prevItems, ...newItems].map((item, idx) => ({ ...item, id: idx + 1 }));
                    });
                } else {
                    alert('No valid items found in the Excel file');
                }
            } catch (error) {
                console.error('Error reading Excel file:', error);
                alert('Error processing Excel file');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const addItem = () => {
        setItems([...items, {
            id: items.length + 1,
            barcode: '',
            name: '',
            quantity: 1,
            unit: '-',
            price: 0
        }]);
    };

    const removeItem = (id: number) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const updateItem = (id: number, field: string, value: any) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const calculateSubtotal = () => {
        return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    };

    const calculateVAT = () => {
        return calculateSubtotal() * 0.05;
    };

    const calculateTotal = () => {
        return calculateSubtotal() + calculateVAT();
    };

    const saveQuotation = async (isDraft: boolean = false) => {
        if (!supplierName.trim()) {
            alert('Please enter Supplier Name');
            return;
        }

        if (items.length === 0 || !items[0].name) {
            alert('Please add at least one item');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/purchase-quotation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    date: quotationDate,
                    quotationNumber,
                    supplierName,
                    notes,
                    items: [...items]
                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                        .map(item => ({
                            barcode: item.barcode,
                            name: item.name,
                            quantity: item.quantity,
                            unit: item.unit,
                            price: item.price
                        }))
                }),
            });

            if (response.ok) {
                // Download PDF after saving only if NOT draft
                if (!isDraft) {
                    downloadPDF();
                }

                // Fetch next number for new quotation
                await fetchNextQuotationNumber();
                // Reset form
                setSupplierName('');
                setSupplierAddress('');
                setSupplierPhone('');
                setNotes('');
                setItems([{ id: 1, barcode: '', name: '', quantity: 1, unit: '-', price: 0 }]);
            } else {
                alert('Failed to save quotation');
            }
        } catch (error) {
            console.error('Error saving quotation:', error);
            alert('Error saving quotation');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const downloadPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4'); // landscape

        // Header - Green background (reduced by 50%)
        doc.setFillColor(22, 163, 74); // green-600
        doc.rect(0, 0, 297, 20, 'F');

        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('PURCHASE QUOTATION', 148.5, 10, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', 148.5, 16, { align: 'center' });

        // Reset text color
        doc.setTextColor(0, 0, 0);

        // Supplier Info (Centered in left half)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('SUPPLIER INFORMATION', 74, 30, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(`Supplier Name: ${supplierName}`, 74, 37, { align: 'center' });
        doc.text(`Address: ${supplierAddress}`, 74, 44, { align: 'center' });

        // Quotation Details (Centered in right half)
        doc.setFont('helvetica', 'bold');
        doc.text('QUOTATION DETAILS', 223, 30, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(`Quotation No: ${quotationNumber}`, 223, 37, { align: 'center' });
        doc.text(`Date: ${quotationDate}`, 223, 44, { align: 'center' });

        // Table Header (10mm after supplier info)
        let y = 54;
        doc.setFillColor(31, 41, 55); // gray-900
        doc.rect(15, y, 267, 8, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('#', 20, y + 5.5, { align: 'center' });
        doc.text('BARCODE', 60, y + 5.5, { align: 'center' });
        doc.text('ITEM DESCRIPTION', 130, y + 5.5, { align: 'center' });
        doc.text('QTY', 180, y + 5.5, { align: 'center' });
        doc.text('UNIT', 210, y + 5.5, { align: 'center' });
        doc.text('UNIT PRICE', 240, y + 5.5, { align: 'center' });
        doc.text('TOTAL', 265, y + 5.5, { align: 'center' });

        // Table Body
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        y += 8;

        const sortedItems = [...items].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        sortedItems.forEach((item, index) => {
            // Alternate row colors
            if (index % 2 === 0) {
                doc.setFillColor(249, 250, 251);
                doc.rect(15, y, 267, 8.5, 'F');
            }

            doc.text(String(index + 1), 20, y + 5, { align: 'center' });
            doc.text(item.barcode || '', 60, y + 5, { align: 'center' });
            doc.text(item.name || '', 130, y + 5, { align: 'center' });
            doc.text(String(item.quantity), 180, y + 5, { align: 'center' });
            doc.text(item.unit, 210, y + 5, { align: 'center' });
            doc.text(item.price.toFixed(2), 240, y + 5, { align: 'center' });
            doc.text((item.quantity * item.price).toFixed(2), 265, y + 5, { align: 'center' });

            y += 8.5;
        });

        // Table border
        doc.setDrawColor(200, 200, 200);
        doc.rect(15, 54, 267, y - 54);

        // Totals
        y += 10;
        const subtotal = calculateSubtotal();
        const vat = calculateVAT();
        const total = calculateTotal();

        doc.setFontSize(10);
        doc.text('Subtotal:', 220, y);
        doc.text(`AED ${subtotal.toFixed(2)}`, 282, y, { align: 'right' });

        y += 7;
        doc.text('VAT (5%):', 220, y);
        doc.text(`AED ${vat.toFixed(2)}`, 282, y, { align: 'right' });

        y += 7;
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(22, 163, 74);
        doc.rect(220, y - 5, 62, 10, 'F'); // من 220 إلى 282 (عرض 62)
        doc.setTextColor(255, 255, 255);
        doc.text('TOTAL AMOUNT:', 222, y + 2);
        doc.text(`AED ${total.toFixed(2)}`, 280, y + 2, { align: 'right' });

        // Notes
        if (notes.trim()) {
            y += 15;
            doc.setFillColor(31, 41, 55);
            doc.rect(15, y, 267, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text('NOTES', 20, y + 5.5);

            y += 8;
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);

            const splitNotes = doc.splitTextToSize(notes, 260); // Wrap text
            doc.text(splitNotes, 20, y + 5);
        }

        // Save with company name and last part of quotation number
        const quotationLastPart = quotationNumber.split('-').pop() || quotationNumber;
        doc.save(`Al Marai Al Arabia Trading Sole Proprietorship L.L.C - ${quotationLastPart}.pdf`);
    };



    return (
        <div className="bg-gray-50 px-6 py-0.5 min-h-screen">
            <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-xl overflow-hidden border-t-4 border-yellow-500">
                {/* Top Section */}


                <div className="p-6 bg-gray-50 border-b border-gray-200">
                    <div className="flex gap-2 max-w-2xl mx-auto">
                        <input
                            type="text"
                            value={searchNumber}
                            onChange={(e) => setSearchNumber(e.target.value)}
                            placeholder="Search by Quotation Number (e.g. PO-2025-001)"
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-green-600 shadow-sm text-lg"
                            onKeyDown={(e) => e.key === 'Enter' && searchQuotation()}
                        />
                        <button
                            onClick={searchQuotation}
                            disabled={loading}
                            className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 font-bold shadow-md disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                        <button
                            onClick={resetForm}
                            disabled={loading}
                            className="bg-gray-200 text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-300 transition-colors flex items-center justify-center font-bold shadow-md"
                            title="Reset / New Quotation"
                        >
                            <RotateCcw size={20} />
                        </button>
                    </div>
                </div>

                {/* Info Section */}
                <div className="p-8 border-b-2 border-gray-100">
                    <div className="flex flex-col gap-10">
                        {/* Supplier Information Card */}
                        <div className={`p-6 rounded-xl border transition-colors ${isEditMode ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isEditMode ? 'text-orange-800' : 'text-gray-800'}`}>
                                <Box className={`w-5 h-5 ${isEditMode ? 'text-orange-600' : 'text-green-600'}`} />
                                {isEditMode ? 'EDITING SUPPLIER INFORMATION' : 'SUPPLIER INFORMATION'}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-600">Supplier Name</label>
                                    <input
                                        type="text"
                                        value={supplierName}
                                        onChange={(e) => setSupplierName(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 transition-all"
                                        placeholder="Enter Supplier Name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-600">Address</label>
                                    <input
                                        type="text"
                                        value={supplierAddress}
                                        onChange={(e) => setSupplierAddress(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 transition-all"
                                        placeholder="Address"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Quotation Details Card */}
                        <div className={`p-6 rounded-xl border transition-colors ${isEditMode ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isEditMode ? 'text-orange-800' : 'text-gray-800'}`}>
                                <FileText className={`w-5 h-5 ${isEditMode ? 'text-orange-600' : 'text-blue-600'}`} />
                                {isEditMode ? 'EDITING QUOTATION DETAILS' : 'QUOTATION DETAILS'}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-600">Quotation No</label>
                                    <input
                                        type="text"
                                        value={quotationNumber}
                                        readOnly
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-200 text-gray-600 cursor-not-allowed font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-600">Date</label>
                                    <input
                                        type="date"
                                        value={quotationDate}
                                        onChange={(e) => setQuotationDate(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="p-6">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-900 text-white">
                                <th className="border border-gray-700 p-3 text-sm font-bold w-12">#</th>
                                <th className="border border-gray-700 p-3 text-sm font-bold w-40">BARCODE</th>
                                <th className="border border-gray-700 p-3 text-sm font-bold">ITEM DESCRIPTION</th>
                                <th className="border border-gray-700 p-3 text-sm font-bold w-28">QTY</th>
                                <th className="border border-gray-700 p-3 text-sm font-bold w-32">UNIT</th>
                                <th className="border border-gray-700 p-3 text-sm font-bold w-36">UNIT PRICE</th>
                                <th className="border border-gray-700 p-3 text-sm font-bold w-36">TOTAL</th>
                                <th className="border border-gray-700 p-3 text-sm font-bold w-12 print:hidden">DEL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 p-2 text-center text-sm font-semibold">{index + 1}</td>
                                    <td className="border border-gray-300 p-2">
                                        <input
                                            type="text"
                                            value={item.barcode}
                                            onChange={(e) => updateItem(item.id, 'barcode', e.target.value)}
                                            className="w-full px-2 py-1 text-sm text-center focus:outline-none focus:bg-green-50"
                                            placeholder="Barcode"
                                        />
                                    </td>
                                    <td className="border border-gray-300 p-2">
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                            className="w-full px-2 py-1 text-sm text-center focus:outline-none focus:bg-green-50"
                                            placeholder="Item Name"
                                        />
                                    </td>
                                    <td className="border border-gray-300 p-2">
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 text-sm text-center focus:outline-none focus:bg-green-50"
                                            min="0"
                                        />
                                    </td>
                                    <td className="border border-gray-300 p-2">
                                        <select
                                            value={item.unit}
                                            onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                            className="w-full px-2 py-1 text-sm focus:outline-none focus:bg-green-50"
                                        >
                                            <option value="-">-</option>
                                            <option value="PIECE">PIECE</option>
                                            <option value="CTN">CTN</option>
                                            <option value="LTR">LTR</option>
                                            <option value="KG">KG</option>
                                        </select>
                                    </td>
                                    <td className="border border-gray-300 p-2">
                                        <input
                                            type="number"
                                            value={item.price}
                                            onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 text-sm text-center focus:outline-none focus:bg-green-50"
                                            min="0"
                                            step="0.01"
                                        />
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center text-sm font-semibold">
                                        {(item.quantity * item.price).toFixed(2)}
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center print:hidden">
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            className="text-red-600 hover:text-red-800 disabled:opacity-30"
                                            disabled={items.length === 1}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="mt-4 flex gap-4">
                        <button
                            onClick={addItem}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors print:hidden"
                        >
                            <Plus size={18} />
                            Add Item
                        </button>

                        <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors print:hidden">
                            <Upload size={18} />
                            Upload Excel
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </label>
                    </div>

                    {/* Totals */}
                    <div className="mt-8 flex justify-end">
                        <div className="w-80 space-y-2">
                            <div className="flex justify-between items-center border-b border-gray-300 pb-2">
                                <span className="text-sm font-semibold text-gray-700">Subtotal:</span>
                                <span className="text-lg font-bold">AED {calculateSubtotal().toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-300 pb-2">
                                <span className="text-sm font-semibold text-gray-700">VAT (5%):</span>
                                <span className="text-lg font-bold">AED {calculateVAT().toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-green-600 text-white p-3 rounded">
                                <span className="text-base font-bold">TOTAL AMOUNT:</span>
                                <span className="text-xl font-bold">AED {calculateTotal().toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes Section */}
                    <div className="mt-8 border-t border-gray-200 pt-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Notes:</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add any additional notes here..."
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-600 h-24 resize-none"
                        />
                    </div>
                </div>

                {/* Action Button */}
                <div className="p-1 bg-gray-100 print:hidden flex justify-center gap-4">
                    <button
                        onClick={() => saveQuotation(true)}
                        disabled={loading}
                        className="w-1/3 flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={24} />
                        {loading ? 'Saving...' : 'Save & Draft'}
                    </button>
                    <button
                        onClick={() => saveQuotation(false)}
                        disabled={loading}
                        className="w-1/3 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download size={24} />
                        {loading ? 'Saving & Downloading...' : 'Save & Download PDF'}
                    </button>
                </div>
            </div>

            <style>{`
        @media print {
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
          @page { 
            size: A4 landscape;
            margin: 0.5cm;
          }
          .min-h-screen {
            min-height: auto;
          }
          .bg-gray-50 {
            background: white;
          }
          .p-8 {
            padding: 1rem;
          }
        }
      `}</style>
        </div>
    );
}
