'use client';

// Scheduled Reports → Reports: one card per report. Click a card to edit it.

import { useState } from 'react';
import { AlertTriangle, CalendarClock, Clock, Loader2, Mail, Plus, Search, Send, Trash2 } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import { daysLabel, formatTime12, periodLabel, reportTypeLabel, type ScheduledReport } from '../Utils/Types';
import { deleteScheduledReport, sendScheduledReportNow, setScheduledReportEnabled } from '../Service/ScheduledReportsService';
import ReportModal from './ReportModal';

interface Props {
  reports: ScheduledReport[];
  mailReady: boolean;
  mailFrom: string | null;
  cronReady: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onChange: (reports: ScheduledReport[]) => void;
  onSent: () => void;
}

export default function ReportsTab({ reports, mailReady, mailFrom, cronReady, canEdit, canDelete, onChange, onSent }: Props) {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ report: ScheduledReport | null } | null>(null);
  const [busy, setBusy] = useState<Record<number, 'send' | 'delete' | 'toggle'>>({});
  const [confirmDelete, setConfirmDelete] = useState<ScheduledReport | null>(null);

  const q = search.trim().toLowerCase();
  const list = reports.filter(
    (r) => !q || r.name.toLowerCase().includes(q) || reportTypeLabel(r.reportType).toLowerCase().includes(q) || r.emails.some((e) => e.includes(q)),
  );

  const setBusyFor = (id: number, v: 'send' | 'delete' | 'toggle' | null) =>
    setBusy((b) => {
      const next = { ...b };
      if (v) next[id] = v;
      else delete next[id];
      return next;
    });

  const upsert = (r: ScheduledReport) => onChange(reports.some((x) => x.id === r.id) ? reports.map((x) => (x.id === r.id ? r : x)) : [...reports, r]);

  const toggle = async (r: ScheduledReport) => {
    setBusyFor(r.id, 'toggle');
    try {
      upsert(await setScheduledReportEnabled(r.id, !r.enabled));
    } catch (err: any) {
      toast.error(err?.message || 'Could not change');
    } finally {
      setBusyFor(r.id, null);
    }
  };

  const send = async (r: ScheduledReport) => {
    setBusyFor(r.id, 'send');
    try {
      const res = await sendScheduledReportNow(r.id);
      if (res.status === 'sent') toast.success(`${r.name} sent`);
      else if (res.status === 'skipped') toast.warning(res.message || 'Nothing to send');
      else toast.error(res.message || 'Could not send');
      onSent();
    } catch (err: any) {
      toast.error(err?.message || 'Could not send');
    } finally {
      setBusyFor(r.id, null);
    }
  };

  const remove = async (r: ScheduledReport) => {
    setConfirmDelete(null);
    setBusyFor(r.id, 'delete');
    try {
      await deleteScheduledReport(r.id);
      onChange(reports.filter((x) => x.id !== r.id));
      toast.success('Report deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete');
    } finally {
      setBusyFor(r.id, null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white flex items-center justify-center shadow-lg shadow-[#D4AF37]/30 shrink-0">
              <CalendarClock className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-3xl font-normal text-black tracking-tighter">Scheduled Reports</h1>
              <p className="text-sm font-semibold text-slate-400">
                {reports.length} report{reports.length === 1 ? '' : 's'} · {reports.filter((r) => r.enabled).length} on
                {mailFrom ? ` · from ${mailFrom}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search report or email..."
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15"
              />
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setModal({ report: null })}
                className="h-11 px-4 rounded-xl bg-[#0a0f1d] text-[#D4AF37] text-sm font-black inline-flex items-center gap-2 shadow-lg hover:shadow-xl shrink-0"
              >
                <Plus className="w-4 h-4" /> New Report
              </button>
            )}
          </div>
        </div>
      </div>

      {(!mailReady || !cronReady) && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div className="text-sm font-semibold space-y-0.5">
            {!mailReady && <p>Email is not set up yet: add SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in Vercel → Settings → Environment Variables, then redeploy.</p>}
            {!cronReady && <p>The timer is not set up yet: add CRON_SECRET in Vercel and run the Scheduled Reports SQL in Supabase.</p>}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <NoData title={reports.length ? 'NO MATCHES' : 'NO SCHEDULED REPORTS'} message={reports.length ? 'No report matches your search' : canEdit ? 'Click "New Report" to schedule one' : undefined} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((r) => {
            const b = busy[r.id];
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => setModal({ report: r })}
                onKeyDown={(e) => e.key === 'Enter' && setModal({ report: r })}
                className={`group text-left bg-white rounded-3xl border shadow-sm p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col gap-4 cursor-pointer ${
                  r.enabled ? 'border-slate-200/60 hover:border-amber-200' : 'border-slate-200/60 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 truncate" dir="auto">
                      {r.name}
                    </p>
                    <p className="text-[11px] font-bold text-amber-700 mt-0.5 truncate">{reportTypeLabel(r.reportType)}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.enabled}
                    disabled={!canEdit || !!b}
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggle(r);
                    }}
                    title={r.enabled ? 'On — click to stop' : 'Off — click to turn on'}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:cursor-default ${r.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${r.enabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-2xl bg-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Time
                    </p>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{formatTime12(r.sendTime)}</p>
                    <p className="text-[11px] font-semibold text-slate-500 truncate">{daysLabel(r.days)}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Period</p>
                    <p className="text-sm font-black text-slate-900 mt-0.5 truncate">{periodLabel(r.period)}</p>
                    <p className="text-[11px] font-semibold text-slate-500 truncate">{r.lastRunDate ? `Last run ${r.lastRunDate}` : 'Not sent yet'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <p className="text-xs font-semibold text-slate-600 truncate flex-1" title={r.emails.join(', ')}>
                    {r.emails.slice(0, 2).join(', ')}
                    {r.emails.length > 2 ? ` +${r.emails.length - 2}` : ''}
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={!!b}
                      onClick={(e) => {
                        e.stopPropagation();
                        void send(r);
                      }}
                      title="Send now"
                      className="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-[#0a0f1d] hover:text-[#D4AF37] hover:border-[#0a0f1d] flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
                    >
                      {b === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      disabled={!!b}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(r);
                      }}
                      title="Delete"
                      className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
                    >
                      {b === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <ReportModal
          report={modal.report}
          canEdit={canEdit}
          onClose={() => setModal(null)}
          onSaved={(r) => {
            upsert(r);
            setModal(null);
          }}
          onSent={onSent}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[210] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
            <span className="w-12 h-12 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </span>
            <p className="mt-4 text-lg font-black text-slate-900">Delete this report?</p>
            <p className="mt-1 text-sm font-semibold text-slate-500" dir="auto">
              {confirmDelete.name}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="h-11 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">
                Cancel
              </button>
              <button type="button" onClick={() => void remove(confirmDelete)} className="h-11 rounded-xl text-sm font-black text-white bg-red-600 hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
