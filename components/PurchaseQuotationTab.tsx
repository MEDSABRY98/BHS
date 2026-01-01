'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Download, ArrowLeft, Search, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export default function PurchaseQuotation() {
    const [companyName, setCompanyName] = useState('Al Marai Al Arabia Trading Sole Proprietorship L.L.C');
    const [companyAddress, setCompanyAddress] = useState('Address - City - Country');
    const [companyPhone, setCompanyPhone] = useState('+971 XXX XXX XXXX');
    const [companyEmail, setCompanyEmail] = useState('info@almaraiarabia.com');

    const [supplierName, setSupplierName] = useState('');
    const [supplierAddress, setSupplierAddress] = useState('');
    const [supplierPhone, setSupplierPhone] = useState('');

    const [quotationNumber, setQuotationNumber] = useState('PQ-2025-001');
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

    const fetchNextQuotationNumber = async () => {
        try {
            const response = await fetch('/api/purchase-quotation');
            const data = await response.json();
            if (data.quotationNumber) {
                setQuotationNumber(data.quotationNumber);
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
                setItems(result.data.items.map((item: any, index: number) => ({
                    id: index + 1,
                    ...item
                })));
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

    const saveQuotation = async () => {
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
                // Download PDF after saving
                downloadPDF();

                // Fetch next number for new quotation
                await fetchNextQuotationNumber();
                // Reset form
                setSupplierName('');
                setSupplierAddress('');
                setSupplierPhone('');
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

        // Supplier Info (10mm after header)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('SUPPLIER INFORMATION', 20, 30);
        doc.setFont('helvetica', 'normal');
        doc.text(`Supplier Name: ${supplierName}`, 20, 37);
        doc.text(`Address: ${supplierAddress}`, 20, 44);

        // Quotation Details
        doc.setFont('helvetica', 'bold');
        doc.text('QUOTATION DETAILS', 200, 30);
        doc.setFont('helvetica', 'normal');
        doc.text(`Quotation No: ${quotationNumber}`, 200, 37);
        doc.text(`Date: ${quotationDate}`, 200, 44);

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

        // Save with company name and last part of quotation number
        const quotationLastPart = quotationNumber.split('-').pop() || quotationNumber;
        doc.save(`Al Marai Al Arabia Trading Sole Proprietorship L.L.C - ${quotationLastPart}.pdf`);
    };

    const handleBack = () => {
        window.location.href = '/';
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto bg-white shadow-lg">
                {/* Top Section */}
                <div className="bg-green-600 text-white p-6">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handleBack}
                            className="flex items-center justify-center w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-2xl font-bold flex-1 text-center">PQ # - Al Marai Al Arabia Trading Sole Proprietorship L.L.C</h1>
                        <div className="w-10"></div> {/* Spacer for centering */}
                    </div>
                </div>

                <div className="p-4 bg-gray-100 border-b border-gray-200">
                    <div className="flex gap-2 max-w-xl mx-auto">
                        <input
                            type="text"
                            value={searchNumber}
                            onChange={(e) => setSearchNumber(e.target.value)}
                            placeholder="Search by Quotation Number (e.g. PQ-2025-001)"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-600 shadow-sm"
                            onKeyDown={(e) => e.key === 'Enter' && searchQuotation()}
                        />
                        <button
                            onClick={searchQuotation}
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium shadow-sm disabled:opacity-50"
                        >
                            <Search size={18} />
                            Search
                        </button>
                    </div>
                </div>

                {/* Info Section */}
                <div className="p-8 border-b-2 border-gray-200">
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-sm font-bold text-gray-600 mb-3 border-b-2 border-green-600 pb-1 inline-block">SUPPLIER INFORMATION</h3>
                            <div className="space-y-2 mt-3">
                                <div className="flex items-center">
                                    <span className="text-sm font-semibold text-gray-700 w-32">Supplier Name:</span>
                                    <input
                                        type="text"
                                        value={supplierName}
                                        onChange={(e) => setSupplierName(e.target.value)}
                                        className="flex-1 px-2 py-1 border-b border-gray-300 focus:outline-none focus:border-green-600"
                                    />
                                </div>
                                <div className="flex items-center">
                                    <span className="text-sm font-semibold text-gray-700 w-32">Address:</span>
                                    <input
                                        type="text"
                                        value={supplierAddress}
                                        onChange={(e) => setSupplierAddress(e.target.value)}
                                        className="flex-1 px-2 py-1 border-b border-gray-300 focus:outline-none focus:border-green-600"
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-600 mb-3 border-b-2 border-green-600 pb-1 inline-block">QUOTATION DETAILS</h3>
                            <div className="space-y-2 mt-3">
                                <div className="flex items-center">
                                    <span className="text-sm font-semibold text-gray-700 w-32">Quotation No:</span>
                                    <input
                                        type="text"
                                        value={quotationNumber}
                                        readOnly
                                        className="flex-1 px-2 py-1 border-b border-gray-300 bg-gray-100 cursor-not-allowed"
                                    />
                                </div>
                                <div className="flex items-center">
                                    <span className="text-sm font-semibold text-gray-700 w-32">Date:</span>
                                    <input
                                        type="date"
                                        value={quotationDate}
                                        onChange={(e) => setQuotationDate(e.target.value)}
                                        className="flex-1 px-2 py-1 border-b border-gray-300 focus:outline-none focus:border-green-600"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="p-8">
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
                </div>

                {/* Action Button */}
                <div className="p-4 bg-gray-100 print:hidden flex justify-center">
                    <button
                        onClick={saveQuotation}
                        disabled={loading}
                        className="w-1/2 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
