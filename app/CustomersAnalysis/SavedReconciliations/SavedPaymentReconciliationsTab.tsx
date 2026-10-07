'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Loader2,
  Printer,
  Search,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { InvoiceRow } from '@/types';
import {
  deletePaymentReconciliationSession,
  fetchPaymentReconciliationSession,
  fetchPaymentReconciliationSessions,
  getDebitCustomersSummary,
  type PaymentReconciliationLoadedLine,
  type PaymentReconciliationSessionSummary,
} from '../Service/debit_service';
import { generatePaymentReconciliationPDF } from '../PaymentReconciliationTab/Pdf/PaymentReconciliationUtils';
import DeletePaymentReconciliationSessionModal from './DeletePaymentReconciliationSessionModal';

interface SavedPaymentReconciliationsTabProps {
  data?: InvoiceRow[];
  refreshKey?: number;
  onOpenSession: (session: PaymentReconciliationSessionSummary) => void;
  onSessionsChanged?: () => void;
}

type ViewMode = 'customers' | 'sessions' | 'detail';

interface CustomerGroup {
  customerId: string;
  customerName: string;
  sessions: PaymentReconciliationSessionSummary[];
  sessionCount: number;
  lastSavedAt: string;
  totalPaymentAmount: number;
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSavedAt(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupSessionsByCustomer(
  sessions: PaymentReconciliationSessionSummary[],
  nameById: Map<string, string>,
): CustomerGroup[] {
  const map = new Map<string, CustomerGroup>();

  sessions.forEach((session) => {
    session.customersId.forEach((customerId) => {
      const key = normalize(customerId);
      if (!key) return;

      const existing =
        map.get(key) ||
        ({
          customerId,
          customerName: nameById.get(key) || customerId,
          sessions: [],
          sessionCount: 0,
          lastSavedAt: '',
          totalPaymentAmount: 0,
        } satisfies CustomerGroup);

      if (!existing.sessions.some((item) => item.sessionId === session.sessionId)) {
        existing.sessions.push(session);
      }

      map.set(key, existing);
    });
  });

  return Array.from(map.values())
    .map((group) => {
      const sortedSessions = [...group.sessions].sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
      );
      return {
        ...group,
        sessions: sortedSessions,
        sessionCount: sortedSessions.length,
        lastSavedAt: sortedSessions[0]?.savedAt || '',
        totalPaymentAmount: sortedSessions.reduce((sum, session) => sum + session.paymentAmount, 0),
      };
    })
    .sort((a, b) => a.customerName.localeCompare(b.customerName));
}

export default function SavedPaymentReconciliationsTab({
  data = [],
  refreshKey = 0,
  onOpenSession,
  onSessionsChanged,
}: SavedPaymentReconciliationsTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('customers');
  const [sessions, setSessions] = useState<PaymentReconciliationSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [namesLoading, setNamesLoading] = useState(false);
  const [nameById, setNameById] = useState<Map<string, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerGroup | null>(null);
  const [selectedSession, setSelectedSession] = useState<PaymentReconciliationSessionSummary | null>(null);
  const [sessionLines, setSessionLines] = useState<PaymentReconciliationLoadedLine[]>([]);
  const [sessionRemainderNote, setSessionRemainderNote] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<PaymentReconciliationSessionSummary | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const invoiceDateByKey = useMemo(() => {
    const map = new Map<string, string>();
    const safeData = Array.isArray(data) ? data : [];
    safeData.forEach((row) => {
      const customerId = row.customerId?.trim();
      const invoiceNumber = row.number?.trim();
      const date = row.date?.trim();
      if (!customerId || !invoiceNumber || !date) return;
      const key = `${normalize(customerId)}|${invoiceNumber}`;
      if (!map.has(key)) map.set(key, date);
    });
    return map;
  }, [data]);

  const customerGroups = useMemo(
    () => groupSessionsByCustomer(sessions, nameById),
    [sessions, nameById],
  );

  const filteredCustomerGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customerGroups;
    return customerGroups.filter((group) => group.customerName.toLowerCase().includes(q));
  }, [customerGroups, searchQuery]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPaymentReconciliationSessions();
      if (!res.success) {
        throw new Error(res.error || 'Failed to load saved sessions');
      }
      setSessions(res.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load saved sessions';
      toast.error(message);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    const loadCustomerNames = async () => {
      setNamesLoading(true);
      try {
        const res = await getDebitCustomersSummary();
        if (cancelled || !res.success) return;

        const map = new Map<string, string>();
        res.data.forEach((customer) => {
          const id = customer.customerId?.trim();
          const name = customer.customerName?.trim();
          if (!id || !name) return;
          map.set(normalize(id), name);
        });
        setNameById(map);
      } finally {
        if (!cancelled) setNamesLoading(false);
      }
    };

    void loadCustomerNames();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCustomer || viewMode === 'customers') return;
    const updated = customerGroups.find(
      (group) => normalize(group.customerId) === normalize(selectedCustomer.customerId),
    );
    if (!updated) {
      setSelectedCustomer(null);
      setSelectedSession(null);
      setViewMode('customers');
      return;
    }
    if (updated.sessions !== selectedCustomer.sessions) {
      setSelectedCustomer(updated);
    }
  }, [customerGroups, selectedCustomer, viewMode]);

  const loadSessionDetail = async (session: PaymentReconciliationSessionSummary) => {
    setDetailLoading(true);
    setSelectedSession(session);
    setViewMode('detail');
    setSessionLines([]);
    setSessionRemainderNote('');

    try {
      const res = await fetchPaymentReconciliationSession(session.sessionId);
      if (!res.success || !res.lines) {
        throw new Error(res.error || 'Failed to load session details');
      }
      setSessionLines(res.lines);
      setSessionRemainderNote(res.remainderNote || '');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load session details';
      toast.error(message);
      setViewMode('sessions');
      setSelectedSession(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteClick = (event: React.MouseEvent, session: PaymentReconciliationSessionSummary) => {
    event.stopPropagation();
    setSessionToDelete(session);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;

    const sessionId = sessionToDelete.sessionId;
    setDeletingId(sessionId);
    try {
      const res = await deletePaymentReconciliationSession(sessionId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to delete session');
      }
      toast.success('Session deleted');

      if (selectedSession?.sessionId === sessionId) {
        setSelectedSession(null);
        setSessionLines([]);
        setViewMode(selectedCustomer ? 'sessions' : 'customers');
      }

      setSessionToDelete(null);
      await loadSessions();
      onSessionsChanged?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleBack = () => {
    if (viewMode === 'detail') {
      setSelectedSession(null);
      setSessionLines([]);
      setViewMode('sessions');
      return;
    }
    if (viewMode === 'sessions') {
      setSelectedCustomer(null);
      setViewMode('customers');
    }
  };

  const handlePdf = async (print: boolean) => {
    if (!selectedSession || sessionLines.length === 0) {
      toast.warning('No invoice lines to export.');
      return;
    }

    setPdfBusy(true);
    try {
      const customers = selectedSession.customersId.map(
        (id) => nameById.get(normalize(id)) || id,
      );
      const lines = sessionLines.map((line) => {
        const dateKey = `${normalize(line.customerId)}|${line.invoiceNumber.trim()}`;
        return {
          customerName: nameById.get(normalize(line.customerId)) || line.customerId,
          date: invoiceDateByKey.get(dateKey) || '',
          number: line.invoiceNumber,
          totalAmount: line.openAmount,
          appliedAmount: line.appliedAmount,
          openAmount: line.remainingAmount,
          matching: '',
        };
      });
      const totalApplied = lines.reduce((sum, line) => sum + line.appliedAmount, 0);
      const selectedOpenTotal = lines.reduce((sum, line) => sum + line.totalAmount, 0);

      await generatePaymentReconciliationPDF(
        {
          paymentAmount: selectedSession.paymentAmount,
          paymentDate: selectedSession.paymentDate || undefined,
          paymentReference: selectedSession.paymentReference || undefined,
          customers: customers.length > 0 ? customers : selectedCustomer ? [selectedCustomer.customerName] : [],
          lines,
          totalApplied,
          remainder: selectedSession.paymentAmount - selectedOpenTotal,
          remainderNote: sessionRemainderNote || undefined,
        },
        { print, download: !print },
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate PDF';
      toast.error(message);
    } finally {
      setPdfBusy(false);
    }
  };

  const renderSessionRow = (session: PaymentReconciliationSessionSummary) => (
    <div
      key={session.sessionId}
      className="flex items-center gap-1 rounded-2xl border border-slate-100 bg-slate-50/80 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all"
    >
      <button
        type="button"
        onClick={() => void loadSessionDetail(session)}
        className="flex-1 text-left px-4 py-3.5 min-w-0"
      >
        <p className="text-sm font-black text-slate-800 truncate">{session.sessionId}</p>
        <p className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">
          {session.paymentDate || 'No date'}
          {` · ${formatAmount(session.paymentAmount)} AED`}
        </p>
        <p className="text-[10px] font-medium text-slate-400 mt-0.5">
          Saved {formatSavedAt(session.savedAt)}
        </p>
      </button>
      <button
        type="button"
        onClick={(e) => handleDeleteClick(e, session)}
        disabled={deletingId === session.sessionId}
        title="Delete session"
        className="p-2.5 mr-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
      >
        {deletingId === session.sessionId ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </div>
  );

  const detailTotalApplied = useMemo(
    () => sessionLines.reduce((sum, line) => sum + line.appliedAmount, 0),
    [sessionLines],
  );
  const detailSelectedOpenTotal = useMemo(
    () => sessionLines.reduce((sum, line) => sum + line.openAmount, 0),
    [sessionLines],
  );
  const detailTotalRemaining = useMemo(
    () => sessionLines.reduce((sum, line) => sum + line.remainingAmount, 0),
    [sessionLines],
  );
  // Remainder = payment − sum of open amounts on selected (saved) lines
  const detailRemainder = selectedSession
    ? selectedSession.paymentAmount - detailSelectedOpenTotal
    : 0;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {viewMode !== 'customers' && (
              <button
                type="button"
                onClick={handleBack}
                className="p-2 rounded-xl border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 transition-colors shrink-0"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                <h2 className="text-lg font-bold text-slate-800 truncate">
                  {viewMode === 'customers' && 'Saved Reconciliations by Customer'}
                  {viewMode === 'sessions' && selectedCustomer?.customerName}
                  {viewMode === 'detail' && selectedSession?.sessionId}
                </h2>
              </div>
              {viewMode === 'sessions' && selectedCustomer && (
                <p className="text-sm text-slate-500 mt-1">
                  {selectedCustomer.sessionCount} saved session
                  {selectedCustomer.sessionCount === 1 ? '' : 's'}
                </p>
              )}
            </div>
          </div>

          {viewMode === 'customers' && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm"
              />
            </div>
          )}

          {viewMode === 'detail' && selectedSession && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenSession(selectedSession)}
                className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
                title="Open in Reconcile"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => void handlePdf(false)}
                disabled={pdfBusy || detailLoading || sessionLines.length === 0}
                className="p-2.5 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 text-red-700 transition-all shadow-sm disabled:opacity-50"
                title="Download PDF"
              >
                {pdfBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={() => void handlePdf(true)}
                disabled={pdfBusy || detailLoading || sessionLines.length === 0}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 transition-all shadow-sm disabled:opacity-50"
                title="Print PDF"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteClick(e, selectedSession)}
                disabled={deletingId === selectedSession.sessionId}
                className="p-2.5 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-all shadow-sm disabled:opacity-50"
                title="Delete Session"
              >
                {deletingId === selectedSession.sessionId ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && viewMode === 'customers' && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400 font-semibold">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading saved reconciliations...
        </div>
      )}

      {namesLoading && !loading && viewMode === 'customers' && customerGroups.length > 0 && (
        <p className="text-xs font-medium text-slate-400 text-center -mt-2">Resolving customer names...</p>
      )}

      {!loading && viewMode === 'customers' && filteredCustomerGroups.length === 0 && (
        <NoData
          title={
            searchQuery.trim()
              ? 'NO CUSTOMERS MATCH YOUR SEARCH'
              : 'NO SAVED RECONCILIATIONS YET'
          }
        />
      )}

      {viewMode === 'customers' && filteredCustomerGroups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredCustomerGroups.map((group) => (
            <button
              key={group.customerId}
              type="button"
              onClick={() => {
                setSelectedCustomer(group);
                setViewMode('sessions');
              }}
              className="group text-left bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-200 hover:shadow-md hover:bg-indigo-50/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Users className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 mt-1 shrink-0" />
              </div>
              <h3 className="mt-4 text-base font-black text-slate-800 line-clamp-2 min-h-[3rem]">
                {group.customerName}
              </h3>
              <div className="mt-3 space-y-1.5 text-xs font-semibold text-slate-500">
                <p>
                  {group.sessionCount} session{group.sessionCount === 1 ? '' : 's'}
                </p>
                <p>{formatAmount(group.totalPaymentAmount)} AED total payments</p>
                {group.lastSavedAt && (
                  <p className="text-[11px] font-medium text-slate-400">
                    Last saved {formatSavedAt(group.lastSavedAt)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {viewMode === 'sessions' && selectedCustomer && (
        <div className="space-y-3">
          {selectedCustomer.sessions.length === 0 ? (
            <NoData title="NO SAVED SESSIONS FOR THIS CUSTOMER" />
          ) : (
            selectedCustomer.sessions.map(renderSessionRow)
          )}
        </div>
      )}

      {viewMode === 'detail' && selectedSession && (
        <div className="space-y-4">
          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400 font-semibold">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading session details...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Payment Amount</p>
                  <p className="mt-1 text-lg font-black text-slate-800">
                    {formatAmount(selectedSession.paymentAmount)} AED
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Applied</p>
                  <p className="mt-1 text-lg font-black text-emerald-700">
                    {formatAmount(detailTotalApplied)} AED
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Remainder</p>
                  <p className="mt-1 text-lg font-black text-slate-800">
                    {formatAmount(detailRemainder)} AED
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Reconcile Date</p>
                  <p className="mt-1 text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{selectedSession.paymentDate || 'No date'}</span>
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Reference</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700 truncate" title={selectedSession.paymentReference || undefined}>
                    {selectedSession.paymentReference || '—'}
                  </p>
                </div>
              </div>

              {sessionRemainderNote && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Remainder Note</p>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{sessionRemainderNote}</p>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-700">
                    Invoice Lines ({sessionLines.length})
                  </h3>
                </div>
                {sessionLines.length === 0 ? (
                  <NoData title="NO INVOICE LINES IN THIS SESSION" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-center">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-600">#</th>
                          <th className="px-4 py-3 font-semibold text-slate-600">Customer</th>
                          <th className="px-4 py-3 font-semibold text-slate-600">Invoice</th>
                          <th className="px-4 py-3 font-semibold text-slate-600">Open Amount</th>
                          <th className="px-4 py-3 font-semibold text-slate-600">Applied</th>
                          <th className="px-4 py-3 font-semibold text-slate-600">Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionLines.map((line) => (
                          <tr key={`${line.lineNo}-${line.invoiceNumber}`} className="border-b border-slate-100">
                            <td className="px-4 py-2.5 text-slate-500 font-bold">{line.lineNo}</td>
                            <td className="px-4 py-2.5">
                              {nameById.get(normalize(line.customerId)) || line.customerId}
                            </td>
                            <td className="px-4 py-2.5 font-medium">{line.invoiceNumber}</td>
                            <td className="px-4 py-2.5 font-mono tabular-nums">{formatAmount(line.openAmount)}</td>
                            <td className="px-4 py-2.5 font-mono tabular-nums text-emerald-700 font-semibold">
                              {formatAmount(line.appliedAmount)}
                            </td>
                            <td className="px-4 py-2.5 font-mono tabular-nums">{formatAmount(line.remainingAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                          <td className="px-4 py-3" colSpan={3}>
                            <span className="font-black text-slate-700 uppercase tracking-wide text-xs">
                              Total
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums font-black text-slate-800">
                            {formatAmount(detailSelectedOpenTotal)}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums font-black text-emerald-700">
                            {formatAmount(detailTotalApplied)}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums font-black text-slate-800">
                            {formatAmount(detailTotalRemaining)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {sessionToDelete && (
        <DeletePaymentReconciliationSessionModal
          session={sessionToDelete}
          isDeleting={deletingId === sessionToDelete.sessionId}
          onClose={() => {
            if (deletingId) return;
            setSessionToDelete(null);
          }}
          onConfirm={confirmDeleteSession}
        />
      )}
    </div>
  );
}
