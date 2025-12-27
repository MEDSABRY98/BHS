'use client';

import React, { useState } from 'react';
import { Printer, Calendar, User, FileText, DollarSign, Hash, ArrowLeft } from 'lucide-react';

export default function CashReceiptTab() {
  const [formData, setFormData] = useState({
    receivedFrom: '',
    amount: '',
    amountInWords: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
    receiptNumber: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const numberToWords = (num: number): string => {
    if (!num || isNaN(num)) return '';
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const convertLessThanThousand = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) {
        return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      }
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertLessThanThousand(n % 100) : '');
    };
    
    const n = Math.floor(num);
    if (n === 0) return 'Zero';
    if (n < 1000) return convertLessThanThousand(n);
    if (n < 1000000) {
      return convertLessThanThousand(Math.floor(n / 1000)) + ' Thousand' + 
             (n % 1000 ? ' ' + convertLessThanThousand(n % 1000) : '');
    }
    return n.toString();
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const words = value ? numberToWords(parseFloat(value)) : '';
    setFormData(prev => ({
      ...prev,
      amount: value,
      amountInWords: words ? words + ' Dirhams Only' : ''
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="mb-6 flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors border border-gray-200 text-gray-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {/* Receipt Preview */}
        <div id="receipt" className="bg-white shadow-2xl mb-8 overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          
          {/* Modern Header with Gradient */}
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

          {/* Receipt Info Bar */}
          <div className="bg-gray-100 px-8 py-4 flex justify-between items-center border-b-2 border-gray-900">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              <span className="text-sm font-semibold">Receipt No:</span>
              <span className="font-mono text-lg font-bold">
                {formData.receiptNumber}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-semibold">Date:</span>
              <span className="font-mono font-bold">
                {formData.date}
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
                  {formData.receivedFrom}
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
                    {formData.amount ? `AED ${formData.amount}` : ''}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 items-center pt-4 border-t border-gray-300">
                <div className="text-sm font-semibold text-gray-700">
                  Amount in Words:
                </div>
                <div className="col-span-2">
                  <div className="text-sm font-medium text-gray-900 italic min-h-6">
                    {formData.amountInWords}
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
                  {formData.reason}
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
                  Mohammed Sabry
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-900 text-white text-center py-3 text-xs tracking-wide">
            {/* Footer content removed */}
          </div>
        </div>

        {/* Modern Input Form */}
        <div className="bg-white rounded-xl shadow-xl p-8 no-print">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Receipt Information</h3>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
            >
              <Printer className="w-5 h-5" />
              Print Receipt
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold mb-2 text-gray-700">
                <Hash className="w-4 h-4" />
                Receipt Number
              </label>
              <input
                type="text"
                name="receiptNumber"
                value={formData.receiptNumber}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black transition-colors"
                placeholder="e.g., RCP-001"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-bold mb-2 text-gray-700">
                <Calendar className="w-4 h-4" />
                Date
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-bold mb-2 text-gray-700">
                <User className="w-4 h-4" />
                Received From
              </label>
              <input
                type="text"
                name="receivedFrom"
                value={formData.receivedFrom}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black transition-colors"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-bold mb-2 text-gray-700">
                <DollarSign className="w-4 h-4" />
                Amount (AED)
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleAmountChange}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black transition-colors text-lg font-semibold"
                placeholder="0.00"
                step="0.01"
              />
            </div>

            <div>
              <label className="text-sm font-bold mb-2 text-gray-700 block">
                Amount in Words
              </label>
              <input
                type="text"
                name="amountInWords"
                value={formData.amountInWords}
                readOnly
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-600 italic"
                placeholder="Auto-generated"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-bold mb-2 text-gray-700">
                <FileText className="w-4 h-4" />
                Payment Reason
              </label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black transition-colors"
                placeholder="Enter payment description"
                rows={3}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt, #receipt * {
            visibility: visible;
          }
          #receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}

