import React, { useState, useEffect } from 'react';
import { Search, FileText, CheckCircle2, RotateCw } from 'lucide-react';
import { toast } from '@/app/Components/Notification';

interface Voucher {
  number: string;
  date: string;
  receiptName: string;
  amount: string;
  description: string;
}

interface VoucherTabProps {
  loading: boolean;
  nextVoucherNumber: string;
  voucherSubTab: 'add' | 'reprint';
  setVoucherSubTab: (tab: 'add' | 'reprint') => void;
  voucherHistory: Voucher[];
  onPrint: (formData: {
    date: string;
    amount: string;
    source: string;
    description: string;
  }) => Promise<boolean>;
  onReprint: (voucher: Voucher) => void;
}

export default function VoucherTab({
  loading,
  nextVoucherNumber,
  voucherSubTab,
  setVoucherSubTab,
  voucherHistory,
  onPrint,
  onReprint
}: VoucherTabProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    source: '',
    description: ''
  });

  const [searchQuery, setSearchQuery] = useState('');

  const handlePrint = async () => {
    if (!formData.amount || !formData.source || !formData.description) {
      toast.warning('Please fill all fields');
      return;
    }
    const success = await onPrint(formData);
    if (success) {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        source: '',
        description: ''
      });
    }
  };

  const filteredVouchers = voucherHistory.filter(v => {
    const q = searchQuery.toLowerCase();
    return (
      (v.number && v.number.toLowerCase().includes(q)) ||
      (v.receiptName && v.receiptName.toLowerCase().includes(q)) ||
      (v.description && v.description.toLowerCase().includes(q)) ||
      (v.amount && v.amount.toString().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto no-print">
      {voucherSubTab === 'add' ? (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-cyan-100">
            <div className="flex items-center gap-4 mb-8 border-b pb-6">
              <div className="bg-cyan-600 text-white p-3 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Print Voucher</h2>
              </div>
            </div>

            <div className="mb-6">
              <label className="block font-bold mb-2 text-sm text-gray-700">Voucher Number</label>
              <input
                type="text"
                value={nextVoucherNumber}
                disabled
                className="w-full border-2 border-gray-100 rounded-xl p-4 bg-gray-100 focus:outline-none font-black text-gray-500 text-center"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block font-bold mb-2 text-sm text-gray-700">Payment Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-cyan-600 focus:outline-none transition-all bg-gray-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block font-bold mb-2 text-sm text-gray-700">Amount (AED)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-cyan-600 focus:outline-none transition-all bg-gray-50 focus:bg-white text-cyan-600 font-bold"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-6 mb-10">
              <div>
                <label className="block font-bold mb-2 text-sm text-gray-700">Paid To</label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-cyan-600 focus:outline-none transition-all bg-gray-50 focus:bg-white font-bold"
                  placeholder="Enter name of person or company"
                />
              </div>
              <div>
                <label className="block font-bold mb-2 text-sm text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-cyan-600 focus:outline-none transition-all bg-gray-50 focus:bg-white resize-none"
                  rows={3}
                  placeholder="What is this payment for?"
                />
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={handlePrint}
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-slate-900 text-white min-w-[220px] py-4 rounded-2xl font-bold text-sm hover:bg-black hover:translate-y-[-1px] transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
              >
                {loading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>SAVING...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    <span>SAVE VOUCHER</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Search Box */}
          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-gray-400 group-focus-within:text-cyan-600 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search by Voucher Number or Recipient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-12 pr-4 py-5 bg-white border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-cyan-50 focus:border-cyan-600 transition-all text-lg shadow-sm"
              />
            </div>
          </div>

          {/* Grid of Vouchers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredVouchers.map((v, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 p-6 hover:border-cyan-400 hover:shadow-xl hover:scale-[1.02] transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-black text-cyan-600 text-lg">{v.number}</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded">{v.date}</span>
                  </div>
                  <h4 className="font-bold text-gray-900 uppercase truncate mb-1" title={v.receiptName}>{v.receiptName}</h4>
                  <p className="text-xs text-gray-500 line-clamp-2 h-8" title={v.description}>{v.description}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-lg font-black text-gray-900">{parseFloat(v.amount).toFixed(2)} <span className="text-xs">AED</span></span>
                  <button
                    type="button"
                    onClick={() => onReprint(v)}
                    className="bg-gray-100 text-gray-600 p-3 rounded-xl hover:bg-cyan-600 hover:text-white transition-all transform active:scale-95 shadow-sm"
                    title="Reprint"
                  >
                    <RotateCw className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredVouchers.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
              <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">No Vouchers Found</h3>
              <p className="text-gray-500">Try adjusting your search criteria</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
