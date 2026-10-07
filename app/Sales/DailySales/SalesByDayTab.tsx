import React, { useMemo, useState } from 'react';
import { Calendar, ChevronLeft } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';

interface SalesByDayTabProps {
  salesByDayData: any[];
}

export default function SalesByDayTab({ salesByDayData }: SalesByDayTabProps) {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  // Group salesByDayData by Month & Year
  const groupedByMonth = useMemo(() => {
    const monthsMap = new Map<string, { monthKey: string; monthName: string; year: number; totalAmount: number; days: any[] }>();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    salesByDayData.forEach(item => {
      if (!item.date) return;
      const [dayStr, monthStr, yearStr] = item.date.split('/');
      if (!dayStr || !monthStr || !yearStr) return;
      const monthIndex = parseInt(monthStr, 10) - 1;
      const year = parseInt(yearStr, 10);
      const monthKey = `${year}-${monthStr.padStart(2, '0')}`;
      const monthName = monthNames[monthIndex] || monthStr;

      const existing = monthsMap.get(monthKey) || {
        monthKey,
        monthName,
        year,
        totalAmount: 0,
        days: [] as any[]
      };

      existing.totalAmount += item.amount;
      existing.days.push(item);
      monthsMap.set(monthKey, existing);
    });

    return Array.from(monthsMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [salesByDayData]);

  // Max day amount for heatmap calibration in selected month
  const maxDayAmount = useMemo(() => {
    if (!selectedMonthKey) return 0;
    const monthData = groupedByMonth.find(m => m.monthKey === selectedMonthKey);
    if (!monthData) return 0;
    const amounts = monthData.days.map(d => Math.abs(d.amount));
    return amounts.length > 0 ? Math.max(...amounts) : 0;
  }, [selectedMonthKey, groupedByMonth]);

  // Calculate calendar days grid for selected month
  const calendarGridDays = useMemo(() => {
    if (!selectedMonthKey) return [];
    const [yearStr, monthStr] = selectedMonthKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const firstDay = new Date(year, month - 1, 1);
    const startOffset = firstDay.getDay(); // 0: Sun, 1: Mon, etc.

    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();

    const days = [];

    // Empty offset slots
    for (let i = 0; i < startOffset; i++) {
      days.push({ type: 'empty', dayNum: null, dateStr: '' });
    }

    // Actual calendar days
    for (let d = 1; d <= totalDays; d++) {
      const dStr = String(d).padStart(2, '0');
      const mStr = String(month).padStart(2, '0');
      const dateStr = `${dStr}/${mStr}/${year}`;
      
      const dayData = salesByDayData.find(item => item.date === dateStr);
      days.push({
        type: 'day',
        dayNum: d,
        dateStr,
        dayData
      });
    }

    return days;
  }, [selectedMonthKey, salesByDayData]);

  return (
    <div className="space-y-6">
      {selectedMonthKey ? (
        /* Month Calendar View */
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 animate-in fade-in duration-300">
          {/* Calendar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedMonthKey(null);
                }}
                className="flex items-center justify-center p-2 rounded-xl bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all border border-slate-100 cursor-pointer"
                title="Back to Month List"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {groupedByMonth.find(m => m.monthKey === selectedMonthKey)?.monthName} {groupedByMonth.find(m => m.monthKey === selectedMonthKey)?.year}
                </h2>
                <p className="text-xs text-slate-400 font-bold tracking-wide uppercase">Daily Sales Calendar</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
              <span className="text-[10px] font-black uppercase tracking-wider">Total Month Sales:</span>
              <span className="text-lg font-black leading-none">
                {groupedByMonth.find(m => m.monthKey === selectedMonthKey)?.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] font-black">AED</span>
            </div>
          </div>

          {/* Calendar Grid Days Header */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-xs font-black text-slate-400 uppercase tracking-widest py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-2">
            {calendarGridDays.map((cell, idx) => {
              if (cell.type === 'empty') {
                return <div key={`empty-${idx}`} className="bg-slate-50/20 border border-transparent rounded-2xl h-20 sm:h-24 opacity-40" />;
              }

              const hasSales = cell.dayData && cell.dayData.amount !== 0;
              
              let boxClass = "bg-white border border-slate-100";
              let textColor = "text-slate-800";
              
              if (hasSales) {
                const amt = cell.dayData.amount;
                if (amt < 0) {
                  boxClass = "bg-red-50/50 border-red-100";
                  textColor = "text-red-600";
                } else {
                  const ratio = maxDayAmount > 0 ? amt / maxDayAmount : 0;
                  if (ratio < 0.25) {
                    boxClass = "bg-emerald-50/20 border-emerald-50";
                  } else if (ratio < 0.5) {
                    boxClass = "bg-emerald-50/60 border-emerald-100";
                  } else if (ratio < 0.75) {
                    boxClass = "bg-emerald-100/50 border-emerald-200";
                  } else {
                    boxClass = "bg-emerald-500/10 border-emerald-300";
                  }
                  textColor = "text-emerald-700";
                }
              }

              return (
                <div
                  key={cell.dateStr}
                  className={`flex flex-col justify-between p-3 rounded-2xl h-24 sm:h-28 text-left transition-all duration-200 shadow-sm ${boxClass}`}
                >
                  <span className="text-[11px] font-black text-slate-400">{cell.dayNum}</span>
                  {cell.dayData ? (
                    <div className="flex flex-col items-start w-full">
                      <span className={`text-[13px] sm:text-base font-black tracking-tight leading-none truncate w-full ${textColor}`}>
                        {cell.dayData.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-[8px] text-slate-400 mt-1 font-bold truncate leading-none">
                        {cell.dayData.salInvoicesCount} Invs | {cell.dayData.qty} Pcs
                      </span>
                    </div>
                  ) : (
                    <span className="text-[8px] text-slate-300 italic">No Sales</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Months Grid View */
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Sales BY Month</h2>
              <p className="text-xs text-slate-400 font-medium">Select a month card to view daily sales in a calendar layout.</p>
            </div>
          </div>

          {groupedByMonth.length === 0 ? (
            <NoData />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6 pt-0">
              {groupedByMonth.map((monthData) => (
                <button
                  key={monthData.monthKey}
                  onClick={() => {
                    setSelectedMonthKey(monthData.monthKey);
                  }}
                  className="group bg-white border border-slate-100 hover:border-[#D4AF37] hover:shadow-md rounded-2xl p-5 text-left transition-all duration-300 cursor-pointer flex flex-col justify-between h-36"
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-[#D4AF37]/10 group-hover:text-[#D4AF37] flex items-center justify-center transition-all duration-300">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 tracking-wider uppercase">{monthData.monthKey}</span>
                  </div>
                  
                  <div className="mt-4">
                    <h3 className="text-base font-black text-slate-800 group-hover:text-[#D4AF37] transition-colors">
                      {monthData.monthName} {monthData.year}
                    </h3>
                    <p className="text-lg font-black text-emerald-600 mt-1 leading-none">
                      {monthData.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      <span className="text-[10px] ml-1 text-slate-400 font-bold uppercase">AED</span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
