'use client';

// New / edit scheduled report (popup).

import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Check, Clock, FileBarChart, Loader2, Mail, Send, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import {
  EMAIL_RE,
  REPORT_PERIODS,
  REPORT_TYPES,
  TIME_RE,
  WEEK_DAYS,
  type ReportPeriodId,
  type ScheduledReport,
  type ScheduledReportInput,
} from '../Utils/Types';
import { saveScheduledReport, sendScheduledReportNow } from '../Service/ScheduledReportsService';

interface Props {
  report: ScheduledReport | null; // null = new
  canEdit: boolean;
  onClose: () => void;
  onSaved: (r: ScheduledReport) => void;
  onSent: () => void;
}

const label = 'block text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2';
const input =
  'w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15 disabled:bg-slate-50';

export default function ReportModal({ report, canEdit, onClose, onSaved, onSent }: Props) {
  const [form, setForm] = useState<ScheduledReportInput>(() =>
    report
      ? { id: report.id, name: report.name, reportType: report.reportType, emails: report.emails, sendTime: report.sendTime, days: report.days, period: report.period, enabled: report.enabled }
      : { name: '', reportType: REPORT_TYPES[0].id, emails: [], sendTime: '09:00', days: [0, 1, 2, 3, 4, 6], period: 'yesterday', enabled: true },
  );
  const [emailDraft, setEmailDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const busy = saving || sending;
  const readOnly = !canEdit;

  useEffect(() => {
    if (!report) setTimeout(() => nameRef.current?.focus(), 50);
  }, [report]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const set = <K extends keyof ScheduledReportInput>(k: K, v: ScheduledReportInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  /** adds every email in the text (comma / space / ; / new line separated). Returns false if one is not valid. */
  const addEmails = (text: string): boolean => {
    const parts = text.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return true;
    const bad = parts.filter((p) => !EMAIL_RE.test(p));
    const good = parts.filter((p) => EMAIL_RE.test(p));
    if (good.length) setForm((f) => ({ ...f, emails: [...new Set([...f.emails, ...good])] }));
    if (bad.length) {
      toast.error(`Not a valid email: ${bad.join(', ')}`);
      setEmailDraft(bad.join(', '));
      return false;
    }
    setEmailDraft('');
    return true;
  };

  const toggleDay = (d: number) => set('days', form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d].sort());

  const save = async () => {
    if (busy || readOnly) return;
    if (emailDraft.trim() && !addEmails(emailDraft)) return;
    const emails = emailDraft.trim() ? [...new Set([...form.emails, ...emailDraft.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)])] : form.emails;
    if (!form.name.trim()) return toast.error('Enter a name for the report');
    if (!emails.length) return toast.error('Add at least one email');
    if (!TIME_RE.test(form.sendTime)) return toast.error('Pick the send time');
    if (!form.days.length) return toast.error('Pick at least one day');
    setSaving(true);
    try {
      const saved = await saveScheduledReport({ ...form, emails });
      toast.success(report ? 'Report updated' : 'Report scheduled');
      onSaved(saved);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    if (!report || busy) return;
    setSending(true);
    try {
      const res = await sendScheduledReportNow(report.id);
      if (res.status === 'sent') toast.success(`Sent — ${res.message || ''}`);
      else if (res.status === 'skipped') toast.warning(res.message || 'Nothing to send');
      else toast.error(res.message || 'Could not send');
      onSent();
    } catch (err: any) {
      toast.error(err?.message || 'Could not send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/50 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white flex items-center justify-center shadow-lg shadow-[#D4AF37]/30 shrink-0">
              <CalendarClock className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-black text-slate-900 truncate">{report ? report.name : 'New Scheduled Report'}</p>
              <p className="text-[11px] font-bold text-slate-400">Sent automatically by email · Dubai time</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div>
            <label className={label}>Name</label>
            <input ref={nameRef} value={form.name} disabled={readOnly} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Daily sales — managers" className={input} dir="auto" />
          </div>

          <div>
            <label className={label}>Report</label>
            <div className="grid gap-2">
              {REPORT_TYPES.map((t) => {
                const sel = form.reportType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => set('reportType', t.id)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all ${sel ? 'border-[#D4AF37] bg-amber-50/60 ring-4 ring-[#D4AF37]/10' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${sel ? 'bg-[#0a0f1d] text-[#D4AF37]' : 'bg-slate-100 text-slate-500'}`}>
                      <FileBarChart className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-black text-slate-900">{t.label}</span>
                      <span className="block text-[11px] font-bold text-amber-700">{t.module}</span>
                      <span className="block text-xs font-semibold text-slate-500 mt-0.5">{t.description}</span>
                    </span>
                    {sel && <Check className="w-5 h-5 text-[#B8860B] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Send time (Dubai)</label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="time" value={form.sendTime} disabled={readOnly} onChange={(e) => set('sendTime', e.target.value)} className={`${input} pl-9`} />
              </div>
            </div>
            <div>
              <label className={label}>Period</label>
              <select value={form.period} disabled={readOnly} onChange={(e) => set('period', e.target.value as ReportPeriodId)} className={input}>
                {REPORT_PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={label}>Days</label>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEK_DAYS.map((d) => {
                const on = form.days.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleDay(d.id)}
                    title={d.label}
                    className={`h-10 rounded-xl text-xs font-black transition-all ${on ? 'bg-[#0a0f1d] text-[#D4AF37] shadow-sm' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={label}>Send to ({form.emails.length})</label>
            <div className="min-h-[44px] p-1.5 rounded-xl border border-slate-200 bg-white flex flex-wrap items-center gap-1.5 focus-within:border-[#D4AF37] focus-within:ring-4 focus-within:ring-[#D4AF37]/15">
              {form.emails.map((e) => (
                <span key={e} className="inline-flex items-center gap-1 pl-2.5 pr-1 h-8 rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                  <Mail className="w-3 h-3 text-slate-400" />
                  {e}
                  {!readOnly && (
                    <button type="button" onClick={() => set('emails', form.emails.filter((x) => x !== e))} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-700" title="Remove">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {!readOnly && (
                <input
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (['Enter', ',', ';', ' ', 'Tab'].includes(e.key) && emailDraft.trim()) {
                      e.preventDefault();
                      addEmails(emailDraft);
                    } else if (e.key === 'Backspace' && !emailDraft && form.emails.length) {
                      set('emails', form.emails.slice(0, -1));
                    }
                  }}
                  onBlur={() => emailDraft.trim() && addEmails(emailDraft)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text');
                    if (/[\s,;]/.test(text.trim())) {
                      e.preventDefault();
                      addEmails(text);
                    }
                  }}
                  placeholder={form.emails.length ? 'Add another email...' : 'Type an email and press Enter'}
                  className="flex-1 min-w-[180px] h-8 px-2 bg-transparent text-sm font-semibold outline-none"
                />
              )}
            </div>
          </div>

          <label className={`flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200 ${readOnly ? '' : 'cursor-pointer'}`}>
            <span>
              <span className="block text-sm font-black text-slate-900">Enabled</span>
              <span className="block text-xs font-semibold text-slate-400">When off, the report is kept but not sent</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.enabled}
              disabled={readOnly}
              onClick={() => set('enabled', !form.enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${form.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.enabled ? 'translate-x-5' : ''}`} />
            </button>
          </label>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-2 rounded-b-3xl">
          {report && canEdit && (
            <button
              type="button"
              onClick={sendNow}
              disabled={busy}
              className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2 disabled:opacity-50"
              title="Send this report now to its emails"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send now
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="h-11 px-5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50">
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="h-11 px-6 rounded-xl bg-[#0a0f1d] text-[#D4AF37] text-sm font-black inline-flex items-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} {report ? 'Save' : 'Schedule'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
