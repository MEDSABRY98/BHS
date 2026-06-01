'use client';

import React, { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/supabase';
import { Printer, Trash2, Calendar, FileText, Search, Loader2, AlertTriangle, AlertCircle } from 'lucide-react';
import { generateInventoryScrapReportPDF } from '@/lib/pdf/InventoryScrapReportPdf';
import NoData from '@/components/01-Unified/NoDataTab';

interface ReportItem {
  productId: string;
  barcode: string;
  name: string;
  qty: number;
  reason: string;
  unit: string;
}

interface SavedReport {
  reportId: string;
  period: string;
  createdAt: string;
  totalQty: number;
  itemCount: number;
  items: ReportItem[];
}

export default function SavedReportsTab() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom Modal States
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSavedReports = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await app_lpos_supabase
        .from('web_INVENTORY_SCRAB_REPORT')
        .select(`
          ID,
          REPORT_ID,
          CREATED_AT,
          PERIOD,
          PRODUCT_ID,
          UNIT,
          QTY,
          REASON,
          bhs_PRODUCTS (
            "PRODUCT NAME",
            "PRODUCT BARCODE"
          )
        `)
        .order('CREATED_AT', { ascending: false });

      if (error) throw error;

      // Group by REPORT_ID in JavaScript
      const groupedMap: { [key: string]: SavedReport } = {};

      (data || []).forEach((row: any) => {
        const reportId = row.REPORT_ID;
        const period = row.PERIOD;
        const createdAt = row.CREATED_AT;
        const qty = Number(row.QTY || 0);

        const item: ReportItem = {
          productId: row.PRODUCT_ID,
          barcode: row.bhs_PRODUCTS?.['PRODUCT BARCODE'] || '—',
          name: row.bhs_PRODUCTS?.['PRODUCT NAME'] || 'Unknown Product',
          qty,
          reason: row.REASON || 'UNSPECIFIED',
          unit: row.UNIT || 'PCS'
        };

        if (!groupedMap[reportId]) {
          groupedMap[reportId] = {
            reportId,
            period,
            createdAt,
            totalQty: 0,
            itemCount: 0,
            items: []
          };
        }

        groupedMap[reportId].totalQty += qty;
        groupedMap[reportId].items.push(item);
        groupedMap[reportId].itemCount = groupedMap[reportId].items.length;
      });

      // Sort reports by creation date descending
      const sortedReports = Object.values(groupedMap).sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setReports(sortedReports);
    } catch (err) {
      console.error('Error fetching saved reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedReports();
  }, []);

  const handlePrint = (report: SavedReport) => {
    // Parse period to extract fromDate and toDate
    // E.g. "2026-06-01 to 2026-06-02"
    let fromDate = '';
    let toDate = '';
    const periodParts = report.period.split(' to ');
    if (periodParts.length === 2) {
      fromDate = periodParts[0];
      toDate = periodParts[1];
    } else {
      fromDate = report.period;
    }

    generateInventoryScrapReportPDF(fromDate, toDate, report.items, '', report.reportId);
  };

  const executeDelete = async () => {
    if (!reportToDelete) return;

    try {
      const { error } = await app_lpos_supabase
        .from('web_INVENTORY_SCRAB_REPORT')
        .delete()
        .eq('REPORT_ID', reportToDelete);

      if (error) throw error;

      // Update local state
      setReports(prev => prev.filter(r => r.reportId !== reportToDelete));
    } catch (err) {
      console.error('Error deleting report:', err);
      setErrorMessage('Failed to delete report from database.');
    } finally {
      setReportToDelete(null);
    }
  };

  // Filter reports by ID or Period
  const filteredReports = reports.filter(r => 
    r.reportId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.period.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const fmt = (n: number) => String(n).padStart(2, '0');
      return `${fmt(date.getDate())}/${fmt(date.getMonth() + 1)}/${date.getFullYear()} ${fmt(date.getHours())}:${fmt(date.getMinutes())}`;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 select-none font-sans text-black">
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Saved Reports</h1>
        </div>
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search report ID or period..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-black" />
          <p className="text-sm text-slate-500 font-medium">Loading saved reports...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <NoData title="No Saved Reports" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <div
              key={report.reportId}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300/80 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Card Title & Icon */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-[#D4AF37] shadow-sm">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 tracking-tight">{report.reportId}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scrap Summary</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5 my-5 text-sm text-slate-600">
                  {/* Date Period */}
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium truncate" title={report.period}>
                      Period: <strong className="text-slate-800">{report.period}</strong>
                    </span>
                  </div>

                  {/* Creation Date */}
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium">
                      Date: <strong className="text-slate-800">{formatDateTime(report.createdAt)}</strong>
                    </span>
                  </div>

                  {/* Stats Divider */}
                  <div className="border-t border-slate-100 my-2 pt-2 grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-2xl">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Items</div>
                      <div className="text-lg font-extrabold text-slate-800">{report.itemCount}</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-2xl">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Qty</div>
                      <div className="text-lg font-extrabold text-slate-800">{report.totalQty}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100 mt-2">
                <button
                  onClick={() => setReportToDelete(report.reportId)}
                  title="Delete Report"
                  className="flex-1 py-3 px-4 flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-2xl transition-all active:scale-[0.98] cursor-pointer text-xs"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={() => handlePrint(report)}
                  title="Print Report"
                  className="flex-1 py-3 px-4 flex items-center justify-center gap-2 bg-black hover:bg-zinc-800 text-[#D4AF37] font-bold rounded-2xl transition-all active:scale-[0.98] cursor-pointer text-xs shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {reportToDelete && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReportToDelete(null)} />
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100/60 shadow-2xl relative w-full max-w-md z-10 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-black text-black">Delete Saved Report?</h4>
            <p className="text-sm text-gray-500 font-bold mt-2 leading-relaxed">
              Are you sure you want to delete report <strong className="text-black">{reportToDelete}</strong>?
              This action cannot be undone and will remove it permanently.
            </p>
            
            <div className="flex gap-4 mt-8">
              <button
                type="button"
                onClick={() => setReportToDelete(null)}
                className="flex-1 py-3 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="flex-1 py-3 bg-rose-600 text-white hover:bg-rose-700 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
