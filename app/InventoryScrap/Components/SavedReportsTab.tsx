'use client';

import React, { useState, useEffect } from 'react';
import { fetchSavedScrapReports } from '../Service/InventoryScrapService';
import { Download, Calendar, FileText, Search, Loader2, StickyNote } from 'lucide-react';
import { downloadInventoryScrapReportPDF } from '@/app/InventoryScrap/Pdf/InventoryScrapReportPdf';
import NoData from '@/app/Components/DataState/NoDataTab';

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
  createdAt: string;
  totalQty: number;
  itemCount: number;
  items: ReportItem[];
}

export default function SavedReportsTab() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [reportToDownload, setReportToDownload] = useState<SavedReport | null>(null);
  const [notes, setNotes] = useState('');

  const fetchSavedReports = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSavedScrapReports();

      const groupedMap: { [key: string]: SavedReport } = {};

      (data || []).forEach((row: any) => {
        const reportId = row.REPORT_ID;
        const createdAt = row.CREATED_AT;
        const qty = Number(row.QTY || 0);

        const item: ReportItem = {
          productId: row.PRODUCT_ID,
          barcode: row['PRODUCT BARCODE'] || '—',
          name: row['PRODUCT NAME'] || 'Unknown Product',
          qty,
          reason: row.REASON || 'UNSPECIFIED',
          unit: row.UNIT || 'PCS',
        };

        if (!groupedMap[reportId]) {
          groupedMap[reportId] = {
            reportId,
            createdAt,
            totalQty: 0,
            itemCount: 0,
            items: [],
          };
        }

        groupedMap[reportId].totalQty += qty;
        groupedMap[reportId].items.push(item);
        groupedMap[reportId].itemCount = groupedMap[reportId].items.length;
      });

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

  const openDownloadModal = (report: SavedReport) => {
    setReportToDownload(report);
    setNotes('');
  };

  const closeDownloadModal = () => {
    if (downloadingId) return;
    setReportToDownload(null);
    setNotes('');
  };

  const confirmDownloadPdf = async () => {
    if (!reportToDownload) return;

    setDownloadingId(reportToDownload.reportId);
    try {
      await downloadInventoryScrapReportPDF(
        reportToDownload.items,
        notes.trim(),
        reportToDownload.reportId,
      );
      setReportToDownload(null);
      setNotes('');
    } catch (err) {
      console.error('Error downloading scrap report PDF:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredReports = reports.filter((r) =>
    r.reportId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const fmt = (n: number) => String(n).padStart(2, '0');
      return `${fmt(date.getDate())}/${fmt(date.getMonth() + 1)}/${date.getFullYear()} ${fmt(date.getHours())}:${fmt(date.getMinutes())}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 select-none font-sans text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Saved Reports</h1>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search report ID..."
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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-[#D4AF37] shadow-sm">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 tracking-tight">{report.reportId}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Scrap Summary
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5 my-5 text-sm text-slate-600">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium">
                      Date:{' '}
                      <strong className="text-slate-800">{formatDateTime(report.createdAt)}</strong>
                    </span>
                  </div>

                  <div className="border-t border-slate-100 my-2 pt-2 grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-2xl">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Items
                      </div>
                      <div className="text-lg font-extrabold text-slate-800">{report.itemCount}</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-2xl">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Total Qty
                      </div>
                      <div className="text-lg font-extrabold text-slate-800">{report.totalQty}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-2">
                <button
                  onClick={() => openDownloadModal(report)}
                  disabled={downloadingId === report.reportId}
                  title={`Download ${report.reportId}.pdf`}
                  className="w-full py-3 px-4 flex items-center justify-center gap-2 bg-black hover:bg-zinc-800 text-[#D4AF37] font-bold rounded-2xl transition-all active:scale-[0.98] cursor-pointer text-xs shadow-sm disabled:opacity-60 disabled:pointer-events-none"
                >
                  {downloadingId === report.reportId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reportToDownload && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDownloadModal} />
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100/60 shadow-2xl relative w-full max-w-md z-10 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#D4AF37] mb-4">
              <StickyNote className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-black text-black">Report Notes</h4>
            <p className="text-sm text-gray-500 font-medium mt-2 leading-relaxed">
              Add optional notes for <strong className="text-black">{reportToDownload.reportId}</strong> before
              downloading the PDF.
            </p>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Write your remarks / notes here..."
              className="mt-5 w-full resize-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-black/5"
              autoFocus
            />

            <div className="flex gap-4 mt-6">
              <button
                type="button"
                onClick={closeDownloadModal}
                disabled={!!downloadingId}
                className="flex-1 py-3 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDownloadPdf}
                disabled={!!downloadingId}
                className="flex-1 py-3 bg-black text-[#D4AF37] hover:bg-zinc-800 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {downloadingId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
