import React, { useState, useRef, useEffect } from 'react';
import { Hash, Calendar, User, DollarSign, FileText, CheckCircle2, X } from 'lucide-react';

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
  isEditing?: boolean;
  onCancel?: () => void;
  uniqueReceivedFrom?: string[];
  uniqueSendBy?: string[];
}

export default function NewReceiptForm({
  formData,
  handleChange,
  handleAmountChange,
  loading,
  onPrint,
  isEditing,
  onCancel,
  uniqueReceivedFrom = [],
  uniqueSendBy = [],
}: NewReceiptFormProps) {
  const [receivedFromFocus, setReceivedFromFocus] = useState(false);
  const [sendByFocus, setSendByFocus] = useState(false);

  const filteredReceivedFrom = uniqueReceivedFrom.filter(n => n.toLowerCase().includes(formData.receivedFrom.toLowerCase()) && n !== formData.receivedFrom);
  const filteredSendBy = uniqueSendBy.filter(n => n.toLowerCase().includes(formData.sendBy.toLowerCase()) && n !== formData.sendBy);

  const receivedFromRef = useRef<HTMLDivElement>(null);
  const sendByRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (receivedFromRef.current && !receivedFromRef.current.contains(event.target as Node)) {
        setReceivedFromFocus(false);
      }
      if (sendByRef.current && !sendByRef.current.contains(event.target as Node)) {
        setSendByFocus(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">CASH RECEIPT</h2>
          </div>
          <div className="flex items-center gap-3">
            {isEditing && (
              <button
                onClick={onCancel}
                disabled={loading}
                title="Cancel Edit"
                className="flex items-center justify-center p-3.5 bg-gray-100 text-gray-500 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            )}
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
                  <span>{isEditing ? 'Update Receipt' : 'Save & Print'}</span>
                </>
              )}
            </button>
          </div>
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

          <div className="md:col-span-2 group relative" ref={receivedFromRef}>
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 mb-3 transition-colors group-focus-within:text-black">
              <User className="w-3.5 h-3.5" />
              Received From
            </label>
            <input
              type="text"
              name="receivedFrom"
              value={formData.receivedFrom}
              onChange={handleChange}
              onFocus={() => setReceivedFromFocus(true)}
              className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-lg font-bold text-gray-900 focus:bg-white focus:border-black transition-all outline-none"
              placeholder="Enter payer full name"
              autoComplete="off"
            />
            {receivedFromFocus && filteredReceivedFrom.length > 0 && (
              <ul className="absolute z-50 w-full mt-2 max-h-60 overflow-y-auto bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 py-2 custom-scrollbar animate-in fade-in slide-in-from-top-2">
                {filteredReceivedFrom.map(name => (
                  <li
                    key={name}
                    onClick={() => {
                      handleChange({ target: { name: 'receivedFrom', value: name } } as any);
                      setReceivedFromFocus(false);
                    }}
                    className="px-5 py-3 text-sm font-bold text-gray-700 hover:bg-slate-50 hover:text-black cursor-pointer transition-colors flex items-center gap-3"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="md:col-span-2 group relative" ref={sendByRef}>
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 mb-3 transition-colors group-focus-within:text-black">
              <User className="w-3.5 h-3.5" />
              Send By
            </label>
            <input
              type="text"
              name="sendBy"
              value={formData.sendBy}
              onChange={handleChange}
              onFocus={() => setSendByFocus(true)}
              className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-lg font-bold text-gray-900 focus:bg-white focus:border-black transition-all outline-none"
              placeholder="Enter representative name"
              autoComplete="off"
            />
            {sendByFocus && filteredSendBy.length > 0 && (
              <ul className="absolute z-50 w-full mt-2 max-h-60 overflow-y-auto bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 py-2 custom-scrollbar animate-in fade-in slide-in-from-top-2">
                {filteredSendBy.map(name => (
                  <li
                    key={name}
                    onClick={() => {
                      handleChange({ target: { name: 'sendBy', value: name } } as any);
                      setSendByFocus(false);
                    }}
                    className="px-5 py-3 text-sm font-bold text-gray-700 hover:bg-slate-50 hover:text-black cursor-pointer transition-colors flex items-center gap-3"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {name}
                  </li>
                ))}
              </ul>
            )}
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
