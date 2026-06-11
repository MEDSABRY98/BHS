import React from 'react';

interface VoucherDocumentProps {
  data: {
    voucherNumber: string;
    date: string;
    amount: string;
    source: string;
    description: string;
  };
}

export default function VoucherDocument({ data }: VoucherDocumentProps) {
  return (
    <div className="bg-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="max-w-none w-full p-10 relative overflow-hidden">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
          <span className="text-9xl font-black rotate-[-45deg] whitespace-nowrap uppercase">PAID</span>
        </div>

        {/* Header */}
        <div className="text-center mb-6 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase tracking-widest text-gray-900 mb-2">Al Marai Al Arabia Trading Sole Proprietorship L.L.C</h1>
          <p className="text-lg font-bold text-gray-700 decoration-double underline underline-offset-4">PAYMENT VOUCHER</p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-10 mb-6">
          <div className="space-y-4">
            <div className="flex items-end gap-2 border-b border-gray-300 pb-1">
              <span className="font-bold text-sm uppercase text-gray-500 min-w-[100px]">Voucher No:</span>
              <span className="text-lg font-bold text-red-600">{data.voucherNumber}</span>
            </div>
            <div className="flex items-end gap-2 border-b border-gray-300 pb-1">
              <span className="font-bold text-sm uppercase text-gray-500 min-w-[100px]">Date:</span>
              <span className="text-lg font-bold">{data.date}</span>
            </div>
            <div className="flex items-end gap-2 border-b border-gray-300 pb-1">
              <span className="font-bold text-sm uppercase text-gray-500 min-w-[100px]">Amount:</span>
              <span className="text-lg font-bold italic underline">{(parseFloat(data.amount) || 0).toFixed(2)} AED</span>
            </div>
          </div>
          <div className="flex flex-col justify-center items-center bg-gray-50 p-6 rounded-lg border-2 border-black">
            <span className="text-xs font-black uppercase text-gray-500 mb-1">Total Amount</span>
            <span className="text-4xl font-black text-gray-900">{(parseFloat(data.amount) || 0).toFixed(2)} <span className="text-xl">AED</span></span>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 mb-6 mt-4">
          <div className="flex items-end gap-2 border-b-2 border-gray-200 pb-2">
            <span className="font-black text-sm uppercase text-gray-400 min-w-[100px]">Paid to:</span>
            <span className="text-2xl font-bold uppercase">{data.source}</span>
          </div>
          <div className="flex flex-col gap-4 border-b-2 border-gray-200 pb-2">
            <span className="font-black text-sm uppercase text-gray-400">Description:</span>
            <p className="text-2xl font-medium leading-relaxed pr-10">{data.description}</p>
          </div>
        </div>

        {/* Signature Section */}
        <div className="grid grid-cols-2 gap-16 pt-6">
          <div className="text-center border-t-2 border-black pt-4">
            <p className="text-xs font-black uppercase text-gray-500 mb-1">Authorized Signature</p>
            <div className="h-10"></div>
            <p className="font-bold text-gray-900 mt-2">Mohamed Sabry</p>
          </div>
          <div className="text-center border-t-2 border-black pt-4">
            <p className="text-xs font-black uppercase text-gray-500 mb-1">Receiver's Signature</p>
            <div className="h-10"></div>
            <p className="font-bold text-gray-900 mt-2">{data.source}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
