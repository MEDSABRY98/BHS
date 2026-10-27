'use client';

// Bulk send, one email per customer (to his saved emails, with his statement) or per tag
// (to the saved emails of all its customers, with the group statement: every customer in one file).
// The page sends them one after the other and shows what was sent and what failed.

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Search, Send, Square, XCircle } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import NiceSelect from '@/app/ScheduledReports/Components/NiceSelect';
import Choice from './Choice';

type Mode = 'customer' | 'tag';
const MODES: { id: Mode; label: string }[] = [
  { id: 'customer', label: 'Each Customer' },
  { id: 'tag', label: 'Each Tag (Group)' },
];
import EmailInput from './EmailInput';
import Modal from './Modal';
import { sendBulkOne } from '../Service/MailService';
import {
  DEFAULT_BODY,
  FORMATS,
  SCOPES,
  VARIABLES,
  formatAmount,
  tagsOf,
  resolveDateMode,
  uaeToday,
  type AttachmentFormat,
  type MailCustomer,
  type MailLogRow,
  type MailStatus,
  type MailTemplate,
  type StatementScope,
} from '../Utils/MailTypes';

interface BulkTabProps {
  status: MailStatus | null;
  customers: MailCustomer[] | null;
  templates: MailTemplate[];
  onSent: (rows: MailLogRow[]) => void;
}

type Result = { name: string; emails: string; ok: boolean; message: string };

const label = 'block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2';
const field = 'w-full rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]';

export default function BulkTab({ status, customers, templates, onSent }: BulkTabProps) {
  const [mode, setMode] = useState<Mode>('customer');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('Statement of Account – {Name}');
  const [body, setBody] = useState(DEFAULT_BODY);
  const [attach, setAttach] = useState(true);
  const [format, setFormat] = useState<AttachmentFormat>('pdf');
  const [scope, setScope] = useState<StatementScope>('open');
  const [dateTo, setDateTo] = useState(uaeToday());
  const [cc, setCc] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [withEmail, setWithEmail] = useState(true);
  const [withBalance, setWithBalance] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const [confirm, setConfirm] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const stop = useRef(false);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.ID === id);
    if (!t) return;
    setSubject(t.SUBJECT);
    setBody(t.BODY);
    if (t.ATTACHMENT && t.ATTACHMENT.kind !== 'supplier-statement') {
      setAttach(true);
      switchMode(t.ATTACHMENT.kind === 'group-statement' ? 'tag' : 'customer');
      setFormat(t.ATTACHMENT.format);
      setScope(t.ATTACHMENT.scope);
      setDateTo(resolveDateMode(t.ATTACHMENT.dateMode) || '');
    }
  };

  const groups = useMemo(() => tagsOf(customers || []), [customers]);
  const tags = useMemo(() => groups.map((g) => g.tag), [groups]);
  /** one row per email to send: a customer, or a tag with its customers */
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list =
      mode === 'customer'
        ? (customers || []).map((c) => ({ key: c.name, name: c.name, id: c.id, tag: c.tag, count: 1, emails: c.emails, balance: c.balance, names: [c.name] }))
        : groups.map((g) => ({ key: g.tag, name: g.tag, id: '', tag: g.tag, count: g.customers.length, emails: g.emails, balance: g.balance, names: g.customers.map((c) => c.name) }));
    return list.filter(
      (r) =>
        (!withEmail || r.emails.length > 0) &&
        (!withBalance || Math.abs(r.balance) > 0.01) &&
        (mode === 'tag' || !tag || r.tag === tag) &&
        (!q || r.name.toLowerCase().includes(q) || r.names.some((n) => n.toLowerCase().includes(q)) || r.emails.some((e) => e.toLowerCase().includes(q))),
    );
  }, [customers, groups, mode, search, tag, withEmail, withBalance]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setPicked(new Set());
    setTag('');
  };

  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.key));
  const toggleAll = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => (allPicked ? next.delete(r.key) : next.add(r.key)));
      return next;
    });
  const toggle = (name: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const chosen =
    mode === 'customer'
      ? (customers || []).filter((c) => picked.has(c.name)).map((c) => ({ key: c.name, name: c.name, id: c.id, emails: c.emails }))
      : groups.filter((g) => picked.has(g.tag)).map((g) => ({ key: g.tag, name: g.tag, id: '', emails: g.emails }));

  const run = async () => {
    setConfirm(false);
    setRunning(true);
    setDone(0);
    setResults([]);
    stop.current = false;
    const batchId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
    const sent: MailLogRow[] = [];
    for (let i = 0; i < chosen.length; i++) {
      if (stop.current) break;
      const c = chosen[i];
      try {
        const row = await sendBulkOne({
          batchId,
          customerName: c.name,
          customerId: c.id || null,
          tag: mode === 'tag' ? c.name : null,
          subject,
          body,
          attachment: attach ? { kind: mode === 'tag' ? 'group-statement' : 'customer-statement', format, scope, dateMode: 'none' } : null,
          dateTo: dateTo || null,
          cc,
        });
        sent.push(row);
        setResults((p) => [...p, { name: c.name, emails: row.TO_EMAILS.join(', '), ok: true, message: 'Sent' }]);
      } catch (e: any) {
        setResults((p) => [...p, { name: c.name, emails: c.emails.join(', '), ok: false, message: e?.message || 'Failed' }]);
      }
      setDone(i + 1);
    }
    setRunning(false);
    if (sent.length) onSent(sent);
    toast.success(`${sent.length} of ${chosen.length} sent`);
  };

  const ok = results.filter((r) => r.ok).length;

  return (
    <div className="space-y-5">
      {status && !status.connected && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> The finance mailbox is not connected yet. The admin connects it from Settings.
        </div>
      )}

      {/* 1 · the email */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-7 space-y-5">
        <div>
          <span className={label}>Send To</span>
          <Choice value={mode} options={MODES} width="w-44" onChange={switchMode} />
          <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
            {mode === 'customer' ? 'One email per customer, with his statement.' : 'One email per tag, to all its customers, with one group statement (Customer column; landscape when 2+ customers).'}
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <span className={label}>Template</span>
            <NiceSelect value={templateId} onChange={applyTemplate} searchPlaceholder="Search template..." options={[{ value: '', label: templates.length ? 'No template' : 'No templates yet' }, ...templates.map((t) => ({ value: t.ID, label: t.NAME }))]} />
          </div>
          <div>
            <span className={label}>CC (every email)</span>
            <EmailInput value={cc} onChange={setCc} placeholder="optional" />
          </div>
        </div>
        <div>
          <span className={label}>Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} dir="auto" maxLength={250} className={`${field} h-11 px-4`} />
        </div>
        <div>
          <span className={label}>Message</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} dir="auto" className={`${field} px-4 py-3 leading-relaxed resize-y font-medium`} />
          <p className="mt-1.5 text-[11px] font-semibold text-slate-400">{VARIABLES.join('  ')} are filled for each customer · **text** = bold</p>
        </div>
        <div className="flex flex-wrap items-end gap-5 pt-1">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer h-10">
            <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} className="w-4 h-4 accent-black" /> {mode === 'tag' ? 'Attach the group statement' : 'Attach his statement'}
          </label>
          {attach && (
            <>
              <div>
                <span className={label}>File</span>
                <Choice value={format} options={FORMATS} onChange={setFormat} />
              </div>
              <div>
                <span className={label}>Transactions</span>
                <Choice value={scope} options={SCOPES} onChange={setScope} />
              </div>
              <div>
                <span className={label}>Up To Date</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-semibold" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2 · the customers */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer or email…" dir="auto" className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
        </div>
        {mode === 'customer' && (
          <div className="w-full lg:w-56">
            <NiceSelect value={tag} onChange={setTag} searchPlaceholder="Search tag..." options={[{ value: '', label: 'All tags' }, ...tags.map((t) => ({ value: t, label: t }))]} />
          </div>
        )}
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={withEmail} onChange={(e) => setWithEmail(e.target.checked)} className="w-4 h-4 accent-black" /> With email
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={withBalance} onChange={(e) => setWithBalance(e.target.checked)} className="w-4 h-4 accent-black" /> Balance not zero
        </label>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-black text-[11px] font-black uppercase tracking-[0.15em] text-white text-center border-b-2 border-[#C4A052]">
                <th className="py-4 px-3 w-12">
                  <input type="checkbox" checked={allPicked} onChange={toggleAll} className="w-4 h-4 accent-[#C4A052]" title="Select all shown" />
                </th>
                <th className="py-4 px-3">{mode === 'customer' ? 'Customer' : 'Tag'}</th>
                <th className="py-4 px-3">{mode === 'customer' ? 'Tag' : 'Customers'}</th>
                <th className="py-4 px-3">Emails</th>
                <th className="py-4 px-3">Balance (AED)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r) => (
                <tr key={r.key} onClick={() => toggle(r.key)} className={`text-center cursor-pointer ${picked.has(r.key) ? 'bg-[#C4A052]/10' : 'hover:bg-slate-50/70'}`}>
                  <td className="py-2.5 px-3">
                    <input type="checkbox" checked={picked.has(r.key)} onChange={() => toggle(r.key)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 accent-black" />
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-800 text-left" dir="auto">{r.name}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-500 max-w-[260px] truncate" title={mode === 'tag' ? r.names.join(' • ') : undefined} dir="auto">
                    {mode === 'customer' ? r.tag || '-' : `${r.count} · ${r.names.join(' • ')}`}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-500 max-w-[320px] truncate" title={r.emails.join(', ')}>{r.emails.length ? r.emails.join(', ') : <span className="text-red-500 font-bold">No email</span>}</td>
                  <td className="py-2.5 px-3 font-bold tabular-nums">{formatAmount(r.balance)}</td>
                </tr>
              ))}
              {!customers ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto" />
                  </td>
                </tr>
              ) : (
                !rows.length && <NoData isTable colSpan={5} title={mode === 'customer' ? 'NO CUSTOMERS' : 'NO TAGS'} message="Change the filters" />
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-slate-600">{picked.size} selected</span>
          {picked.size > 0 && (
            <button type="button" onClick={() => setPicked(new Set())} className="text-xs font-bold text-slate-400 hover:text-slate-700">
              Clear selection
            </button>
          )}
          <div className="flex-1" />
          {running ? (
            <button type="button" onClick={() => (stop.current = true)} className="h-11 px-5 rounded-xl border border-red-200 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2">
              <Square className="w-4 h-4" /> Stop ({done}/{chosen.length})
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!status?.connected) return toast.error('The mailbox is not connected yet — Settings');
                if (!picked.size) return toast.error('Select the customers first');
                if (!subject.trim()) return toast.error('Write the subject');
                setConfirm(true);
              }}
              className="h-11 px-6 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> Send to {picked.size}
            </button>
          )}
        </div>
      </div>

      {/* 3 · results */}
      {(running || results.length > 0) && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-3">
            {running && <Loader2 className="w-5 h-5 animate-spin text-[#C4A052]" />}
            <p className="font-black text-slate-900">
              {done} / {chosen.length} · <span className="text-emerald-600">{ok} sent</span>
              {results.length - ok > 0 && <span className="text-red-600"> · {results.length - ok} failed</span>}
            </p>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#B8860B] to-[#C4A052] transition-all" style={{ width: `${chosen.length ? (done / chosen.length) * 100 : 0}%` }} />
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-50">
            {results.map((r, i) => (
              <div key={i} className="py-2 flex items-start gap-3 text-sm">
                {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  <p className="font-bold text-slate-800" dir="auto">{r.name}</p>
                  <p className={`text-xs ${r.ok ? 'text-slate-400' : 'text-red-600 font-semibold'}`}>{r.ok ? r.emails : r.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={confirm}
        title={`Send ${picked.size} emails?`}
        subtitle={mode === 'customer' ? 'Each customer gets his own email, to his saved emails' : 'Each tag gets one email, to the saved emails of its customers'}
        onClose={() => setConfirm(false)}
        width="max-w-lg"
        footer={
          <>
            <button type="button" onClick={() => setConfirm(false)} className="h-11 px-5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={() => void run()} className="h-11 px-6 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-2">
              <Send className="w-4 h-4" /> Send Now
            </button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <p>
            <b>From:</b> {status?.from}
          </p>
          <p dir="auto">
            <b>Subject:</b> {subject}
          </p>
          <p>
            <b>Attachment:</b>{' '}
            {attach ? `${FORMATS.find((f) => f.id === format)?.label} · ${SCOPES.find((s) => s.id === scope)?.label}${dateTo ? ` · up to ${dateTo.split('-').reverse().join('/')}` : ''}` : 'none'}
          </p>
          {cc.length > 0 && (
            <p>
              <b>CC:</b> {cc.join(', ')}
            </p>
          )}
          <p>
            <b>Each email:</b> {mode === 'customer' ? 'one customer, his statement' : 'one tag, all its customers, the group statement'}
          </p>
          {chosen.some((c) => !c.emails.length) && (
            <p className="text-amber-700 font-semibold">{chosen.filter((c) => !c.emails.length).length} of them have no saved email and will fail.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
