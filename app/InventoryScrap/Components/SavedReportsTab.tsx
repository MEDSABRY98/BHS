'use client';

import React, { useState, useEffect } from 'react';
import { fetchSavedScrapReports, deleteScrapReport, updateProductCosts } from '../Service/InventoryScrapService';
import { Download, Calendar, FileText, Search, Loader2, StickyNote, FileSpreadsheet, Trash2 } from 'lucide-react';
import { downloadInventoryScrapReportPDF } from '@/app/InventoryScrap/Pdf/InventoryScrapReportPdf';
import { exportInventoryScrapExcel } from '../Export/ExcelExport';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { getCurrentUserFromStorage, parseUserPermissions, isUnrestrictedAdminUser } from '@/app/AdminControl/AdminControlTab';

interface ReportItem {
  productId: string;
  barcode: string;
  name: string;
  qty: number;
  cost: number;
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

interface SavedReportsTabProps {
  refreshTrigger?: number;
}

export default function SavedReportsTab({ refreshTrigger = 0 }: SavedReportsTabProps = {}) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingExcelId, setDownloadingExcelId] = useState<string | null>(null);
  const [reportToDownload, setReportToDownload] = useState<SavedReport | null>(null);
  const [notes, setNotes] = useState('');
  const [disposalMethod, setDisposalMethod] = useState('');
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Missing Costs State
  const [missingCostsItems, setMissingCostsItems] = useState<ReportItem[] | null>(null);
  const [pendingDownloadTarget, setPendingDownloadTarget] = useState<'pdf' | 'excel' | null>(null);
  const [reportPendingDownload, setReportPendingDownload] = useState<SavedReport | null>(null);
  const [inputCosts, setInputCosts] = useState<Record<string, string>>({});
  const [isSavingCosts, setIsSavingCosts] = useState(false);

  const currentUser = getCurrentUserFromStorage();
  const perms = currentUser ? parseUserPermissions(currentUser) : {};
  const hasDeletePermission =
    isUnrestrictedAdminUser(currentUser) ||
    (perms['inventory-scrap-actions'] && perms['inventory-scrap-actions'].includes('delete'));

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
          cost: Number(row['PRODUCT COST'] || 0),
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
  }, [refreshTrigger]);

  const openDownloadModal = (report: SavedReport) => {
    setReportToDownload(report);
    setNotes('');
    setDisposalMethod('');
  };

  const closeDownloadModal = () => {
    if (downloadingId) return;
    setReportToDownload(null);
    setNotes('');
    setDisposalMethod('');
  };

  const confirmDownloadPdf = async () => {
    if (!reportToDownload) return;

    setDownloadingId(reportToDownload.reportId);
    try {
      await downloadInventoryScrapReportPDF(
        reportToDownload.items,
        notes.trim(),
        reportToDownload.reportId,
        disposalMethod.trim()
      );
      setReportToDownload(null);
      setNotes('');
      setDisposalMethod('');
    } catch (err) {
      console.error('Error downloading scrap report PDF:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadExcel = async (report: SavedReport) => {
    setDownloadingExcelId(report.reportId);
    try {
      const excelData = report.items.map((item, index) => ({
        '#': index + 1,
        'Product ID': item.productId,
        'Barcode': item.barcode,
        'Name': item.name,
        'Reason': item.reason,
        'Quantity': item.qty,
        'Unit': item.unit,
        'Unit Cost': item.cost,
        'Total Cost': Number((item.qty * item.cost).toFixed(2))
      }));
      await exportInventoryScrapExcel(excelData, `ScrapReport_${report.reportId}.xlsx`);
    } catch (err) {
      console.error('Error downloading Excel:', err);
    } finally {
      setDownloadingExcelId(null);
    }
  };

  const handleDownloadClick = (report: SavedReport, target: 'pdf' | 'excel') => {
    const missing = report.items.filter(item => !item.cost || item.cost === 0);
    if (missing.length > 0) {
      setMissingCostsItems(missing);
      setPendingDownloadTarget(target);
      setReportPendingDownload(report);
      
      const initialInputs: Record<string, string> = {};
      missing.forEach(m => {
        initialInputs[m.productId] = '';
      });
      setInputCosts(initialInputs);
    } else {
      if (target === 'pdf') {
        openDownloadModal(report);
      } else {
        handleDownloadExcel(report);
      }
    }
  };

  const handleSaveCostsAndDownload = async () => {
    if (!reportPendingDownload || !missingCostsItems || !pendingDownloadTarget) return;
    
    for (const item of missingCostsItems) {
      const val = parseFloat(inputCosts[item.productId]);
      if (isNaN(val) || val <= 0) {
        toast.error(`Please enter a valid cost for ${item.productId}`);
        return;
      }
    }

    setIsSavingCosts(true);
    try {
      const costsToUpdate = missingCostsItems.map(item => ({
        productId: item.productId,
        cost: parseFloat(inputCosts[item.productId])
      }));
      await updateProductCosts(costsToUpdate);

      const updatedReport = {
        ...reportPendingDownload,
        items: reportPendingDownload.items.map(item => {
          const updated = costsToUpdate.find(c => c.productId === item.productId);
          if (updated) {
            return { ...item, cost: updated.cost };
          }
          return item;
        })
      };

      setReports(prev => prev.map(r => r.reportId === updatedReport.reportId ? updatedReport : r));
      toast.success('Costs updated successfully');
      setMissingCostsItems(null);

      if (pendingDownloadTarget === 'pdf') {
        openDownloadModal(updatedReport);
      } else {
        await handleDownloadExcel(updatedReport);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update costs');
    } finally {
      setIsSavingCosts(false);
    }
  };

  const confirmDelete = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);
    try {
      await deleteScrapReport(reportToDelete);
      toast.success('Report deleted successfully');
      setReports((prev) => prev.filter((r) => r.reportId !== reportToDelete));
      setReportToDelete(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to delete report');
    } finally {
      setIsDeleting(false);
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


                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-2 flex gap-3">
                <button
                  onClick={() => handleDownloadClick(report, 'pdf')}
                  disabled={downloadingId === report.reportId}
                  title={`Download ${report.reportId}.pdf`}
                  className="flex-1 py-3 px-2 flex items-center justify-center gap-2 bg-black hover:bg-zinc-800 text-[#D4AF37] font-bold rounded-2xl transition-all active:scale-[0.98] cursor-pointer text-xs shadow-sm disabled:opacity-60 disabled:pointer-events-none"
                >
                  {downloadingId === report.reportId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  PDF
                </button>
                <button
                  onClick={() => handleDownloadClick(report, 'excel')}
                  disabled={downloadingExcelId === report.reportId}
                  title={`Download ${report.reportId}.xlsx`}
                  className="flex-1 py-3 px-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all active:scale-[0.98] cursor-pointer text-xs shadow-sm disabled:opacity-60 disabled:pointer-events-none"
                >
                  {downloadingExcelId === report.reportId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                  Excel
                </button>
                {hasDeletePermission && (
                  <button
                    onClick={() => setReportToDelete(report.reportId)}
                    title={`Delete ${report.reportId}`}
                    className="flex-1 py-3 px-2 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl transition-all active:scale-[0.98] cursor-pointer text-xs shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
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
            <h4 className="text-xl font-black text-black mb-6">Report Notes</h4>

            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-800 mb-2">
                How will you dispose of these goods? <span className="text-red-500">*</span>
              </label>
              <textarea
                value={disposalMethod}
                onChange={(e) => setDisposalMethod(e.target.value)}
                rows={2}
                placeholder="E.g., Sent to recycling, destroyed in warehouse..."
                className="w-full resize-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-black/5"
                autoFocus
              />
            </div>

            <div className="mb-2">
              <label className="block text-sm font-bold text-slate-800 mb-2">
                Optional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Write your remarks / notes here..."
                className="w-full resize-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-black/5"
              />
            </div>

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
                disabled={!!downloadingId || !disposalMethod.trim()}
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

      {/* Delete Confirmation Modal */}
      {reportToDelete && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isDeleting && setReportToDelete(null)} />
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100/60 shadow-2xl relative w-full max-w-sm z-10 animate-in zoom-in-95 duration-200">
            <h4 className="text-xl font-black text-black">Confirm Deletion</h4>
            <p className="text-sm text-gray-500 font-bold mt-2 leading-relaxed">
              Are you sure you want to delete <strong className="text-black">{reportToDelete}</strong>? This action cannot be undone.
            </p>

            <div className="flex gap-4 mt-6">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setReportToDelete(null)}
                className="flex-1 py-3 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white hover:bg-red-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Missing Costs Modal */}
      {missingCostsItems && missingCostsItems.length > 0 && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isSavingCosts && setMissingCostsItems(null)} />
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100/60 shadow-2xl relative w-full max-w-2xl z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <h4 className="text-xl font-black text-black">Missing Product Costs</h4>

            <div className="mt-6 flex-1 overflow-y-auto pr-2 space-y-4 min-h-[100px]">
              {missingCostsItems.map(item => (
                <div key={item.productId} className="flex flex-col gap-2 p-4 bg-slate-50 rounded-2xl">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate" title={item.name}>{item.name}</div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">{item.productId}</div>
                    </div>
                    <div className="w-32 shrink-0">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">AED</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={inputCosts[item.productId] || ''}
                          onChange={(e) => setInputCosts(prev => ({ ...prev, [item.productId]: e.target.value }))}
                          placeholder="0.00"
                          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-6 pt-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                disabled={isSavingCosts}
                onClick={() => setMissingCostsItems(null)}
                className="flex-1 py-3 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingCosts}
                onClick={handleSaveCostsAndDownload}
                className="flex-1 py-3 bg-black text-[#D4AF37] hover:bg-zinc-800 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSavingCosts ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Save & Download
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
