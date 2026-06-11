'use client';

import { useState, useEffect } from 'react';
import { Trash2, Calendar, Loader2, Database } from 'lucide-react';
import { usePermissions } from '../../LPOs/Hooks/usePermissions';
import { ConfirmModal } from '../../LPOs/Components/ConfirmModal';
import NoData from '@/app/Components/NoDataTab';
import { toast } from '@/app/Components/Notification';

const englishMonths: Record<number, string> = {
  1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
  7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December"
};

interface SalesMonth {
  year: number;
  month: number;
  count: number;
}

export default function SalesDBPage() {
  const { canDelete, isLoaded } = usePermissions();
  const [salesMonths, setSalesMonths] = useState<SalesMonth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [targetMonth, setTargetMonth] = useState<{ year: number; month: number } | null>(null);

  useEffect(() => {
    fetchSalesMonths();
  }, []);

  async function fetchSalesMonths(forceRefresh = false) {
    setIsLoading(true);
    try {
      const response = await fetch('/api/Sales?action=months');
      const resData = await response.json();
      if (resData.error) throw new Error(resData.error);
      setSalesMonths(resData.data || []);
    } catch (err: any) {
      console.error(err);
      triggerMessage('error', err.message || 'Failed to load sales months');
    } finally {
      setIsLoading(false);
    }
  }

  const handleDeleteClick = (year: number, month: number) => {
    setTargetMonth({ year, month });
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!targetMonth) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/Sales?year=${targetMonth.year}&month=${targetMonth.month}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      triggerMessage('success', `Deleted sales data for ${englishMonths[targetMonth.month]} ${targetMonth.year} successfully!`);
      // Refetch the sales months (this will regenerate the cache on GET)
      await fetchSalesMonths();
    } catch (err: any) {
      console.error(err);
      triggerMessage('error', err.message || 'Failed to delete sales data');
    } finally {
      setIsDeleting(false);
      setIsConfirmOpen(false);
      setTargetMonth(null);
    }
  };

  const triggerMessage = (type: 'success' | 'error', text: string) => {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">BHS DATABASE</span>
          </div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">Sales DB</h1>
        </div>
      </div>

      {/* Grid of Months */}
      {isLoading && salesMonths.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-3xl p-6 border border-gray-100 h-[180px] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                <div className="h-6 bg-gray-100 rounded w-3/4"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
              </div>
              <div className="h-10 bg-gray-100 rounded-xl w-full"></div>
            </div>
          ))}
        </div>
      ) : salesMonths.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-12 border border-gray-100 shadow-sm flex items-center justify-center">
          <NoData title="NO SALES DATA FOUND" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {salesMonths.map((m) => (
            <div
              key={`${m.year}-${m.month}`}
              className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-black/5 transition-all duration-300 flex flex-col justify-between h-[180px]"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-gray-400 tracking-wider font-mono">{m.year}</span>
                  <h3 className="text-xl font-black text-black mt-1 leading-none">{englishMonths[m.month]}</h3>
                </div>
                <div className="bg-gray-50 border border-gray-100/50 px-3 py-1.5 rounded-2xl text-center shrink-0">
                  <span className="text-sm font-black text-black">{m.count.toLocaleString()}</span>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider mt-0.5">Rows</p>
                </div>
              </div>

              <div className="flex justify-between items-center mt-6">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <Calendar className="w-3.5 h-3.5 text-gray-300" />
                  <span>Sales Invoices</span>
                </div>
                {canDelete && (
                  <button
                    onClick={() => handleDeleteClick(m.year, m.month)}
                    className="p-2.5 bg-red-50 hover:bg-red-500 rounded-xl text-red-500 hover:text-white transition-all border border-transparent hover:border-red-100"
                    title="Delete Month Sales Data"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {targetMonth && (
        <ConfirmModal
          isOpen={isConfirmOpen}
          onConfirm={executeDelete}
          onCancel={() => {
            setIsConfirmOpen(false);
            setTargetMonth(null);
          }}
          isLoading={isDeleting}
          title="Confirm Month Deletion"
          message={`Are you sure you want to delete all sales data for ${englishMonths[targetMonth.month]} ${targetMonth.year}? This will remove all transactions for this month and cannot be undone.`}
        />
      )}

    </div>
  );
}
