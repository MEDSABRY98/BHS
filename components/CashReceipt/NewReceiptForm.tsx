import React from 'react';
import { Hash, Calendar, User, DollarSign, FileText, CheckCircle2 } from 'lucide-react';

interface FormData {
  receiptNumber: string;
  date: string;
  receivedFrom: string;
  sendBy: string;
  amount: string;
  amountInWords: string;
  reason: string;
}

interface NewReceiptFormProps {
  formData: FormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
  onPrint: () => void;
}

export default function NewReceiptForm({
  formData,
  handleChange,
  handleAmountChange,
  loading,
  onPrint,
}: NewReceiptFormProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">CASH RECEIPT</h2>
          </div>
          <button
            onClick={onPrint}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-slate-900 text-white min-w-[220px] py-3 rounded-xl font-bold text-base hover:bg-black hover:translate-y-[-1px] transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Save & Print</span>
              </>
            )}
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
              className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl font-mono text-lg font-bold text-gray-900 transition-all outline-none"
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

          <div className="md:col-span-2 group">
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
  );
}
