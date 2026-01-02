'use client';

import React, { useState, useEffect } from 'react';
import { Printer, Calendar, User, FileText, DollarSign, Hash, ArrowLeft, Search, List, PlusCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function CashReceiptTab() {
  const [formData, setFormData] = useState({
    receivedFrom: '',
    sendBy: '',
    amount: '',
    amountInWords: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
    receiptNumber: ''
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'saved'>('new');
  const [savedReceipts, setSavedReceipts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [isFetchingSaved, setIsFetchingSaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const numberToWords = (num: number): string => {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';

    const convert = (n: number): string => {
      if (n < 10) return units[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
      if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
      if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
      return '';
    };

    const wholePart = Math.floor(num);
    const decimalPart = Math.round((num - wholePart) * 100);

    let result = convert(wholePart) + ' UAE Dirhams';
    if (decimalPart > 0) {
      result += ' and ' + convert(decimalPart) + ' Fils';
    }
    return result + ' Only';
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const num = parseFloat(val);
    setFormData(prev => ({
      ...prev,
      amount: val,
      amountInWords: !isNaN(num) ? numberToWords(num) : ''
    }));
  };

  const saveToGoogleSheets = async () => {
    try {
      const response = await fetch('/api/cash-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: formData.date,
          receiptNumber: formData.receiptNumber,
          receivedFrom: formData.receivedFrom,
          sendBy: formData.sendBy,
          amount: formData.amount,
          amountInWords: formData.amountInWords,
          reason: formData.reason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save to Google Sheets');
      }
      return true;
    } catch (error: any) {
      console.error('Error saving:', error);
      alert('Error: ' + error.message);
      return false;
    }
  };

  const handlePrint = async () => {
    if (!formData.receivedFrom || !formData.amount || !formData.receiptNumber) {
      alert('Please fill at least: Receipt Number, Received From, and Amount');
      return;
    }

    setLoading(true);

    const saved = await saveToGoogleSheets();
    if (!saved) {
      if (!confirm('Failed to save to Google Sheets. Do you want to continue printing anyway?')) {
        setLoading(false);
        return;
      }
    }

    const receiptElement = document.getElementById('receipt');
    if (!receiptElement) return;

    try {
      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      const cleanFilename = `${formData.receiptNumber}_${formData.date}`.replace(/[^a-z0-9]/gi, '_');
      pdf.save(`${cleanFilename}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      window.print();
    } finally {
      setLoading(false);
      fetchNextReceiptNumber();
    }
  };

  const handleBack = () => {
    window.location.href = '/';
  };

  useEffect(() => {
    const handleBeforePrint = () => {
      const receiptNumber = formData.receiptNumber || 'Receipt';
      const date = formData.date || new Date().toISOString().split('T')[0];
      const filename = `${receiptNumber}_${date}`;
      document.title = filename;
    };

    const handleAfterPrint = () => {
      document.title = 'BHS Analysis';
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [formData.receiptNumber, formData.date]);

  const fetchNextReceiptNumber = async () => {
    try {
      const response = await fetch('/api/cash-receipt');
      if (response.ok) {
        const data = await response.json();
        if (data.nextId) {
          setFormData(prev => ({ ...prev, receiptNumber: data.nextId }));
        }
      }
    } catch (error) {
      console.error('Error fetching next receipt number:', error);
    }
  };

  const fetchSavedReceipts = async () => {
    setIsFetchingSaved(true);
    try {
      const response = await fetch('/api/cash-receipt?all=true');
      if (response.ok) {
        const data = await response.json();
        setSavedReceipts(data.receipts || []);
      }
    } catch (error) {
      console.error('Error fetching saved receipts:', error);
    } finally {
      setIsFetchingSaved(false);
    }
  };

  useEffect(() => {
    fetchNextReceiptNumber();
  }, []);

  useEffect(() => {
    if (activeTab === 'saved') {
      fetchSavedReceipts();
    }
  }, [activeTab]);

  const filteredReceipts = [...savedReceipts]
    .filter(r =>
      r.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.receivedFrom.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => b.receiptNumber.localeCompare(a.receiptNumber));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 shadow-sm no-print">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col items-center justify-center gap-2">
            <button
              onClick={handleBack}
              className="p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-xl transition-all group"
              title="Back to Home"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
            </button>
            <div className="flex items-center gap-3 text-black">
              <div className="p-2 bg-black rounded-lg">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight whitespace-nowrap">Cash Receipt</h1>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('new')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'new'
              ? 'bg-black text-white shadow-lg'
              : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            <PlusCircle className="w-5 h-5" />
            New Receipt
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'saved'
              ? 'bg-black text-white shadow-lg'
              : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            <List className="w-5 h-5" />
            Saved Receipts
          </button>

          {activeTab === 'saved' && (
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search receipts..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-black transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2 pb-10">
                {isFetchingSaved ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mb-2"></div>
                    <span className="text-xs text-gray-400">Load Cash Receipt Data...</span>
                  </div>
                ) : filteredReceipts.length > 0 ? (
                  filteredReceipts.map((receipt) => (
                    <button
                      key={receipt.receiptNumber}
                      onClick={() => setSelectedReceipt(receipt)}
                      className={`w-full text-left p-3 rounded-xl transition-all border ${selectedReceipt?.receiptNumber === receipt.receiptNumber
                        ? 'bg-black border-black shadow-md'
                        : 'bg-white border-transparent hover:border-gray-200'
                        }`}
                    >
                      <div className={`text-xs font-bold mb-1 ${selectedReceipt?.receiptNumber === receipt.receiptNumber ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                        {receipt.receiptNumber}
                      </div>
                      <div className={`text-sm font-bold truncate ${selectedReceipt?.receiptNumber === receipt.receiptNumber ? 'text-white' : 'text-gray-900'
                        }`}>
                        {receipt.receivedFrom}
                      </div>
                      <div className={`text-[10px] mt-1 ${selectedReceipt?.receiptNumber === receipt.receiptNumber ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                        {receipt.date} • AED {receipt.amount}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400">No receipts found</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 h-screen overflow-y-auto p-4 md:p-8 no-print custom-scrollbar">
        <div className="max-w-4xl mx-auto pb-20">
          {activeTab === 'new' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8 border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">CASH RECEIPT</h2>
                    <p className="text-gray-500 font-medium mt-1">Generate and save a new payment record</p>
                  </div>
                  <button
                    onClick={handlePrint}
                    disabled={loading}
                    className={`flex items-center justify-center gap-3 py-4 px-10 rounded-2xl font-black text-lg transition-all shadow-xl hover:-translate-y-1 active:translate-y-0 ${loading
                      ? 'bg-gray-200 cursor-not-allowed text-gray-400 shadow-none'
                      : 'bg-black text-white hover:bg-gray-800 hover:shadow-2xl'
                      }`}
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Printer className="w-6 h-6" />
                    )}
                    {loading ? 'Processing...' : 'Save & Print'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                  <div className="group">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 mb-3 transition-colors group-focus-within:text-black">
                      <Hash className="w-3.5 h-3.5" />
                      Receipt Number
                    </label>
                    <input
                      type="text"
                      name="receiptNumber"
                      value={formData.receiptNumber}
                      readOnly
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl font-mono text-lg font-bold text-gray-900 group-focus-within:bg-white group-focus-within:border-black transition-all outline-none"
                    />
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 mb-3 transition-colors group-focus-within:text-black">
                      <Calendar className="w-3.5 h-3.5" />
                      Date
                    </label>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-lg font-bold text-gray-900 focus:bg-white focus:border-black transition-all outline-none"
                    />
                  </div>

                  <div className="md:col-span-2 group">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 mb-3 transition-colors group-focus-within:text-black">
                      <User className="w-3.5 h-3.5" />
                      Received From
                    </label>
                    <input
                      type="text"
                      name="receivedFrom"
                      value={formData.receivedFrom}
                      onChange={handleChange}
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-lg font-bold text-gray-900 focus:bg-white focus:border-black transition-all outline-none"
                      placeholder="Enter payer full name"
                    />
                  </div>

                  <div className="md:col-span-2 group">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 mb-3 transition-colors group-focus-within:text-black">
                      <User className="w-3.5 h-3.5" />
                      Send By
                    </label>
                    <input
                      type="text"
                      name="sendBy"
                      value={formData.sendBy}
                      onChange={handleChange}
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-lg font-bold text-gray-900 focus:bg-white focus:border-black transition-all outline-none"
                      placeholder="Enter representative name"
                    />
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 mb-3 transition-colors group-focus-within:text-black">
                      <DollarSign className="w-3.5 h-3.5" />
                      Amount (AED)
                    </label>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleAmountChange}
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-2xl font-black text-gray-900 focus:bg-white focus:border-black transition-all outline-none"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="group">
                    <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3 block">
                      Amount in Words
                    </label>
                    <div className="w-full px-5 py-4 bg-gray-100 rounded-2xl text-sm font-bold text-gray-500 italic min-h-[60px] flex items-center">
                      {formData.amountInWords || 'Amount in words will appear here...'}
                    </div>
                  </div>

                  <div className="md:col-span-2 group">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 mb-3 transition-colors group-focus-within:text-black">
                      <FileText className="w-3.5 h-3.5" />
                      Payment Reason
                    </label>
                    <textarea
                      name="reason"
                      value={formData.reason}
                      onChange={handleChange}
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-lg font-bold text-gray-900 focus:bg-white focus:border-black transition-all outline-none"
                      placeholder="Specify the reason for payment"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {selectedReceipt ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-gray-100 sticky top-4 z-10">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gray-100 rounded-2xl">
                        <FileText className="w-6 h-6 text-black" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-gray-900">{selectedReceipt.receiptNumber}</h2>
                        <p className="text-sm font-medium text-gray-500">{selectedReceipt.date}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const originalFormData = { ...formData };
                        setFormData({
                          ...selectedReceipt,
                          amount: selectedReceipt.amount.toString()
                        });
                        setTimeout(async () => {
                          window.print();
                          setFormData(originalFormData);
                        }, 100);
                      }}
                      className="flex items-center gap-3 bg-black text-white px-8 py-4 rounded-2xl font-black hover:bg-gray-800 transition-all shadow-xl"
                    >
                      <Printer className="w-5 h-5" />
                      Reprint Receipt
                    </button>
                  </div>
                  <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform scale-[0.98] origin-top">
                    <ReceiptDocument data={selectedReceipt} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <FileText className="w-12 h-12 text-gray-300" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Select a Receipt</h3>
                  <p className="text-gray-500 font-medium max-w-xs">Select a record from the sidebar to view full details and options.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden container for global printing */}
      <div id="receipt" className="hidden-print m-0 p-0" style={{ width: '210mm', fontFamily: 'system-ui, sans-serif' }}>
        <ReceiptDocument data={formData} />
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
        
        @media screen {
          .hidden-print { position: absolute; left: -9999px; }
        }
        @media print {
          .no-print { display: none !important; }
          .hidden-print { display: block !important; position: static !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          #receipt { border: none !important; box-shadow: none !important; }
          @page { size: auto; margin: 0mm; }
        }
      `}</style>
    </div>
  );
}

function ReceiptDocument({ data }: { data: any }) {
  return (
    <div className="bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Original Header */}
      <div className="bg-gradient-to-r from-gray-900 to-black text-white p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            Al Marai Al Arabia Trading Sole Proprietorship L.L.C
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold">RECEIPT</div>
            <div className="text-xs tracking-widest opacity-75">CASH PAYMENT</div>
          </div>
        </div>
      </div>

      {/* Info Bar */}
      <div className="bg-gray-100 px-8 py-4 flex justify-between items-center border-b-2 border-gray-900">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-semibold">Receipt No:</span>
          <span className="font-mono text-lg font-bold">
            {data.receiptNumber || '---'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-semibold">Date:</span>
          <span className="font-mono font-bold">
            {data.date || '---'}
          </span>
        </div>
      </div>

      {/* Receipt Body */}
      <div className="p-8 space-y-6">

        {/* Received From */}
        <div className="grid grid-cols-3 gap-4 items-center pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-700">
            <User className="w-5 h-5" />
            <span className="font-semibold">Received From:</span>
          </div>
          <div className="col-span-2">
            <div className="text-xl font-bold text-gray-900 border-b-2 border-black pb-1 min-h-8">
              {data.receivedFrom}
            </div>
          </div>
        </div>

        {/* Send By */}
        <div className="grid grid-cols-3 gap-4 items-center pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-700">
            <User className="w-5 h-5" />
            <span className="font-semibold">Send By:</span>
          </div>
          <div className="col-span-2">
            <div className="text-xl font-bold text-gray-900 border-b-2 border-black pb-1 min-h-8">
              {data.sendBy}
            </div>
          </div>
        </div>

        {/* Amount Section */}
        <div className="bg-gray-50 p-6 rounded-lg border-2 border-gray-900">
          <div className="grid grid-cols-3 gap-4 items-center mb-4">
            <div className="flex items-center gap-2 text-gray-700">
              <DollarSign className="w-5 h-5" />
              <span className="font-semibold">Amount:</span>
            </div>
            <div className="col-span-2">
              <div className="text-3xl font-bold text-gray-900">
                {data.amount ? `AED ${parseFloat(data.amount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '0.00'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 items-center pt-4 border-t border-gray-300">
            <div className="text-sm font-semibold text-gray-700">
              Amount in Words:
            </div>
            <div className="col-span-2">
              <div className="text-sm font-medium text-gray-900 italic min-h-6">
                {data.amountInWords}
              </div>
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="grid grid-cols-3 gap-4 items-center pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-700">
            <FileText className="w-5 h-5" />
            <span className="font-semibold">Payment For:</span>
          </div>
          <div className="col-span-2">
            <div className="text-lg font-medium text-gray-900 border-b-2 border-black pb-1 min-h-8">
              {data.reason}
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="mt-12 pt-8 grid grid-cols-3 gap-8">
          <div className="text-center">
            <div className="mb-12 text-sm text-gray-600 font-semibold">Payer's Signature</div>
          </div>

          <div className="text-center">
            <div className="mb-2 text-sm text-gray-600 font-semibold">Witness</div>
            <div className="text-2xl font-bold text-gray-900 mb-4">
              Monai
            </div>
          </div>

          <div className="text-center">
            <div className="mb-2 text-sm text-gray-600 font-semibold">Received By</div>
            <div className="text-2xl font-bold text-gray-900 mb-4">
              Mohamed Sabry
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
