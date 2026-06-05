'use client';

import React, { useState, useEffect } from 'react';
import { bhs_supabas } from '@/lib/supabase';
import { FileText, Calendar, Printer, Loader2, Eye, AlertCircle } from 'lucide-react';
import { generateInventoryScrapReportPDF } from '@/lib/pdf/InventoryScrapReportPdf';
import NoData from '@/components/01-Unified/NoDataTab';

interface AggregatedItem {
  productId: string;
  barcode: string;
  name: string;
  qty: number;
  reason: string;
  unit: string;
}

export default function InventoryScrapReportTab() {
  // Get date strings for default range (from start of current month to today)
  const getTodayStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const getStartOfMonthStr = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  };

  const [fromDate, setFromDate] = useState(getStartOfMonthStr());
  const [toDate, setToDate] = useState(getTodayStr());
  const [notes, setNotes] = useState('');
  const [entries, setEntries] = useState<AggregatedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAndAggregateScrap = async () => {
    if (!fromDate || !toDate) return;

    setIsLoading(true);
    try {
      const { data, error } = await bhs_supabas
        .from('web_INVENTORY_SCRAB')
        .select(`
          ID,
          "PRODUCT ID",
          QTY,
          REASON,
          CREATED_AT,
          SESSION_ID,
          bhs_PRODUCTS (
            "PRODUCT NAME",
            "PRODUCT BARCODE"
          )
        `)
        .gte('CREATED_AT', `${fromDate}T00:00:00`)
        .lte('CREATED_AT', `${toDate}T23:59:59`);

      if (error) throw error;

      // Aggregate by Product Barcode & Reason
      const aggregatedMap: { [key: string]: AggregatedItem } = {};

      (data || []).forEach((item: any) => {
        const productId = item['PRODUCT ID'] || '';
        const barcode = item.bhs_PRODUCTS?.['PRODUCT BARCODE'] || '';
        const name = item.bhs_PRODUCTS?.['PRODUCT NAME'] || 'Unknown Product';
        const qty = Number(item.QTY || 0);
        const reason = item.REASON || 'UNSPECIFIED';
        const key = `${barcode}_${reason}`;

        if (!aggregatedMap[key]) {
          aggregatedMap[key] = {
            productId,
            barcode,
            name,
            qty: 0,
            reason,
            unit: 'PCS'
          };
        }
        aggregatedMap[key].qty += qty;
      });

      // Convert to array and sort:
      // 1. By total quantity (descending)
      // 2. By name (ascending)
      const sortedList = Object.values(aggregatedMap).sort((a, b) => {
        if (b.qty !== a.qty) {
          return b.qty - a.qty;
        }
        return a.name.localeCompare(b.name);
      });

      setEntries(sortedList);
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setIsLoading(false);
      setIsFirstLoad(false);
    }
  };

  useEffect(() => {
    fetchAndAggregateScrap();
  }, []);

  const handlePrint = async () => {
    if (entries.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const currentYear = new Date().getFullYear();
      
      // 1. Fetch max row ID
      const { data: maxIdData } = await bhs_supabas
        .from('web_INVENTORY_SCRAB_REPORT_MAX_ID')
        .select('ID')
        .maybeSingle();
        
      let maxIdNum = 0;
      if (maxIdData && maxIdData.ID) {
        const match = maxIdData.ID.match(/^R-(\d+)$/);
        if (match) {
          maxIdNum = parseInt(match[1]);
        }
      }
      
      // 2. Fetch max report ID for the current year
      const { data: maxReportData } = await bhs_supabas
        .from('web_INVENTORY_SCRAB_REPORT')
        .select('REPORT_ID')
        .like('REPORT_ID', `SCR-${currentYear}-%`)
        .order('REPORT_ID', { ascending: false })
        .limit(1);
        
      let maxReportNum = 0;
      if (maxReportData && maxReportData.length > 0) {
        const reportId = maxReportData[0].REPORT_ID;
        const match = reportId.match(/^SCR-\d{4}-(\d+)$/);
        if (match) {
          maxReportNum = parseInt(match[1]);
        }
      }
      
      const nextReportNum = maxReportNum + 1;
      const nextReportId = `SCR-${currentYear}-${String(nextReportNum).padStart(4, '0')}`;
      
      const periodStr = `${fromDate || '—'} to ${toDate || '—'}`;
      
      const insertPayload = entries.map((item, index) => {
        const nextIdNum = maxIdNum + 1 + index;
        const rowId = `R-${String(nextIdNum).padStart(4, '0')}`;
        return {
          ID: rowId,
          REPORT_ID: nextReportId,
          PERIOD: periodStr,
          PRODUCT_ID: item.productId,
          UNIT: item.unit || 'PCS',
          QTY: item.qty,
          REASON: item.reason
        };
      });
      
      const { error: insertError } = await bhs_supabas
        .from('web_INVENTORY_SCRAB_REPORT')
        .insert(insertPayload);
        
      if (insertError) throw insertError;
      
      // Now print with the generated report ID!
      generateInventoryScrapReportPDF(fromDate, toDate, entries, notes, nextReportId);
    } catch (err) {
      console.error('Error saving scrap report:', err);
      setErrorMessage('Failed to save scrap report to the tracking system.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalQty = entries.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="space-y-8 select-none font-sans text-black">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Scrap Reports</h1>
        </div>
        <button
          onClick={handlePrint}
          disabled={entries.length === 0 || isSaving}
          title="Print / Export PDF"
          className="w-12 h-12 flex items-center justify-center bg-black hover:bg-zinc-800 text-[#D4AF37] rounded-2xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Printer className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
        <div>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>

        <div>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Remarks & Notes
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Type any custom remarks to show on the printed document..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-grow bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 min-w-0"
            />
            <button
              onClick={fetchAndAggregateScrap}
              disabled={isLoading}
              title="Generate Preview"
              className="w-12 h-12 shrink-0 flex items-center justify-center bg-black hover:bg-zinc-800 text-white rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Container */}
      <div className="flex flex-col items-center pt-8 bg-zinc-100 rounded-[2.5rem] border border-zinc-200/60 overflow-x-auto min-h-[500px]">
        <div className="text-center mb-6">
          <span className="bg-black/5 px-4 py-1.5 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            Live Document Preview
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#B8922A]" />
            <p className="text-sm font-medium">Loading report records...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-20">
            <NoData title="No Scrap Records" />
          </div>
        ) : (
          /* Styled A4-like Document Preview Box */
          <div
            className="w-[210mm] min-h-[297mm] bg-white p-[14mm_16mm_14mm_16mm] shadow-2xl border border-zinc-200 flex flex-col mb-12 select-text font-serif text-black"
            style={{ fontFamily: "'Barlow', sans-serif" }}
          >
            {/* Top Rule */}
            <div
              className="w-full h-1 mb-[4mm]"
              style={{
                background: 'linear-gradient(90deg, #111111 0%, #B8922A 50%, #111111 100%)'
              }}
            ></div>

            {/* Header */}
            <div className="text-center mb-[2mm]">
              <div
                className="text-[12pt] font-bold tracking-[0.05em] uppercase text-black"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Al Marai Al Arabia Trading — Sole Proprietorship L.L.C
              </div>
              <div
                className="inline-block text-[#C0392B] text-[9pt] tracking-[0.2em] uppercase font-bold my-[2mm] px-4 py-0.5"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Inventory Scrap Report
              </div>
              <div className="flex justify-center gap-[10mm] text-[8pt] text-[#555555]">
                <div className="flex gap-1.5 items-center">
                  Report No.: <span className="text-black font-semibold">SCR-AUTO</span>
                </div>
                <div className="flex gap-1.5 items-center">
                  Date: <span className="text-black font-semibold">{new Date().toLocaleDateString('en-GB')}</span>
                </div>
                <div className="flex gap-1.5 items-center">
                  Period:{' '}
                  <span className="text-black font-semibold">
                    {fromDate ? new Date(fromDate).toLocaleDateString('en-GB') : '—'} -{' '}
                    {toDate ? new Date(toDate).toLocaleDateString('en-GB') : '—'}
                  </span>
                </div>
                <div className="flex gap-1.5 items-center">
                  Department: <span className="text-black font-semibold">Warehouse</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div
              className="w-full h-[1px] my-[2mm]"
              style={{
                background: 'linear-gradient(90deg, transparent, #B8922A, #B8922A, transparent)'
              }}
            ></div>

            {/* Report Title Band */}

            {/* Table */}
            <div className="mb-[7mm] flex-1">
              <table className="w-full border-collapse text-[8.5pt]">
                <thead>
                  <tr className="bg-black text-[#D4A93A] text-center uppercase text-[7.5pt] tracking-[0.12em]">
                    <th className="py-2 px-2 text-center w-[30px] font-semibold">#</th>
                    <th className="py-2 px-2 text-center w-[120px] font-semibold">Barcode</th>
                    <th className="py-2 px-2 text-center font-semibold">Product Name</th>
                    <th className="py-2 px-2 text-center w-[60px] font-semibold">Qty</th>
                    <th className="py-2 px-2 text-center w-[50px] font-semibold">Unit</th>
                    <th className="py-2 px-2 text-center w-[100px] font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE5CC]">
                  {entries.map((item, idx) => (
                    <tr
                      key={idx}
                      className={idx % 2 === 0 ? 'bg-[#FDFBF5]' : 'bg-white'}
                    >
                      <td className="py-2 px-2 text-center text-zinc-400 text-[7.5pt]">{idx + 1}</td>
                      <td className="py-2 px-2 text-center font-mono text-[8pt] tracking-wider text-black">
                        {item.barcode || '—'}
                      </td>
                      <td className="py-2 px-2 text-center font-medium text-zinc-800">{item.name}</td>
                      <td className="py-2 px-2 text-center font-bold text-black text-[9pt]">{item.qty}</td>
                      <td className="py-2 px-2 text-center text-zinc-500 text-[8pt]">{item.unit}</td>
                      <td className="py-2 px-2 text-center text-zinc-500 text-[8pt]">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F0E8D0] border-t-2 border-[#B8922A] text-black text-[8.5pt]">
                    <td
                      colSpan={3}
                      className="py-2 px-3 text-right font-bold text-zinc-500 text-[8pt] tracking-[0.08em]"
                    >
                      Total
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-black text-[9pt]">{totalQty}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Notes Section */}
            <div className="mb-[8mm] break-inside-avoid">
              <div className="text-[7pt] font-semibold tracking-[0.2em] uppercase text-[#B8922A] mb-1 flex items-center gap-2">
                Remarks & Notes
                <div className="flex-1 h-[1px] bg-[#E0D0A0]"></div>
              </div>
              <div className="border border-[#E0D0A0] min-h-[18mm] p-2.5 text-[8.5pt] text-[#555555] bg-[#FDFCF8] whitespace-pre-wrap">
                {notes || <span className="opacity-40 italic">No notes provided.</span>}
              </div>
            </div>

            {/* Signature Section */}
            <div className="mt-auto break-inside-avoid">
              <div className="text-[7pt] font-semibold tracking-[0.2em] uppercase text-[#B8922A] mb-4 flex items-center gap-2">
                Authorized Signatures
                <div className="flex-1 h-[1px] bg-[#E0D0A0]"></div>
              </div>
              <div className="flex gap-[8mm]">
                {/* Warehouse Manager */}
                <div className="flex-1 flex flex-col items-center">
                  <div className="text-[7pt] tracking-[0.15em] uppercase text-[#555555] mb-1 font-medium">
                    Warehouse Manager
                  </div>
                  <div className="text-[8pt] font-semibold text-black mb-3 min-h-[12px]">&nbsp;</div>
                  <div className="h-[22mm]"></div>
                  <div className="w-full border-b border-black mb-1"></div>
                  <div className="text-[7pt] text-zinc-400 tracking-[0.1em]">Signature & Date</div>
                </div>

                {/* Finance Manager */}
                <div className="flex-1 flex flex-col items-center">
                  <div className="text-[7pt] tracking-[0.15em] uppercase text-[#555555] mb-1 font-medium">
                    Finance & Admin Manager
                  </div>
                  <div className="text-[8pt] font-semibold text-black mb-3 min-h-[12px]">&nbsp;</div>
                  <div className="h-[22mm]"></div>
                  <div className="w-full border-b border-black mb-1"></div>
                  <div className="text-[7pt] text-zinc-400 tracking-[0.1em]">Signature & Date</div>
                </div>
              </div>
            </div>

            {/* Bottom Rule */}
            <div
              className="w-full h-[3px] mt-[8mm]"
              style={{
                background: 'linear-gradient(90deg, #111111 0%, #B8922A 50%, #111111 100%)'
              }}
            ></div>

          </div>
        )}
      </div>

      {/* Alert Error Modal */}
      {errorMessage && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setErrorMessage(null)} />
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100/60 shadow-2xl relative w-full max-w-md z-10 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-black text-black">Process Failed</h4>
            <p className="text-sm text-gray-500 font-bold mt-2 leading-relaxed">
              {errorMessage}
            </p>
            
            <div className="flex gap-4 mt-8">
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="w-full py-3 bg-black text-[#D4AF37] hover:bg-zinc-800 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer text-center"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
