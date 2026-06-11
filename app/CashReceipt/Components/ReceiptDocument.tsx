import React from 'react';
import { Hash, Calendar, User, DollarSign, FileText } from 'lucide-react';

interface ReceiptDocumentProps {
  data: {
    receiptNumber?: string;
    date?: string;
    receivedFrom?: string;
    sendBy?: string;
    amount?: string | number | null;
    amountInWords?: string;
    reason?: string;
  };
  isCopy?: boolean;
  receivedBySignature?: string;
}

export default function ReceiptDocument({ data, isCopy = false, receivedBySignature }: ReceiptDocumentProps) {
  return (
    <div className="bg-white relative overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '297mm' }}>
      {isCopy && (
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0 transform -rotate-45 select-none">
          <span className="text-[150px] font-black text-gray-900 leading-none" style={{ fontSize: '200px' }}>COPY</span>
        </div>
      )}
      <div className="relative z-10">
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
                  {data.amount ? `AED ${parseFloat(String(data.amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '0.00'}
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
          <div className="mt-12 pt-8 grid grid-cols-2 gap-8">
            {!isCopy ? (
              <div className="text-center">
                <div className="mb-2 text-sm text-gray-600 font-semibold">Payer's Signature</div>
                <div className="text-2xl font-bold text-gray-900 mb-4">
                  {data.receivedFrom}
                </div>
              </div>
            ) : (
              <div className="col-span-1"></div>
            )}

            <div className="text-center flex flex-col items-center">
              <div className="mb-2 text-sm text-gray-600 font-semibold">Received By</div>
              <div className="text-2xl font-bold text-gray-900 mb-2">
                Mohamed Sabry
              </div>
              {receivedBySignature ? (
                <img
                  src={receivedBySignature}
                  alt="Received By Signature"
                  className="h-16 object-contain"
                />
              ) : (
                <div className="h-16" />
              )}
            </div>
          </div>

          {isCopy && (
            <div className="mt-12 pt-4 border-t border-gray-200 text-center">
              <p className="text-sm font-bold text-gray-500">True Copy of Original</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
