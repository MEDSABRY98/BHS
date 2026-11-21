'use client';

// Tax Rebate: customers with a discount (Customers Discounts) whose past months are still Pending.
// Same split as Customer Statement: Customers · Groups (tag, one email with every customer's months) · Lulu.
// Tick the rows and press Send: each one gets the email asking for the invoices of his pending months.

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CalendarClock, Loader2, Mail, Search, Send } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import Modal from './Modal';
import { sendRebateRequest } from '../Service/MailService';
import { MONTH_NAMES, unwrap, type MailLogRow, type MailStatus, type RebateItem } from '../Utils/MailTypes';

type Group = 'normal' | 'tags' | 'lulu';

interface RebatesTabProps {
  status: MailStatus | null;
  items: RebateItem[] | null;
  onSent: (row: MailLogRow) => void;
  /** the page title row: Send goes there (createPortal) */
  headerEl: HTMLDivElement | null;
  active: boolean;
}

const label = 'block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2';
const SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

/** every different month of the row (a group: of all its customers), oldest first */
function monthsOf(item: RebateItem) {
  const seen = new Map<string, { month: number; year: number }>();
  item.sections.forEach((s) => s.periods.forEach((p) => seen.set(`${p.year}-${p.month}`, p)));
  return Array.from(seen.values()).sort((a, b) => a.year - b.year || a.month - b.month);
}
const shortLabel = (p: { month: number; year: number }) => `${SHORT[p.month - 1]}-${String(p.year).slice(-2)}`;

export default function RebatesTab({ status, items, onSent, headerEl, active }: RebatesTabProps) {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<Group>('normal');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [emailsOf, setEmailsOf] = useState<RebateItem | null>(null);
  const [monthsFor, setMonthsFor] = useState<RebateItem | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [sent, setSent] = useState<Record<string, 'ok' | 'failed'>>({});

  const split = useMemo(() => {
    const list = items || [];
    return {
      normal: list.filter((i) => !i.tag && !i.lulu),
      tags: list.filter((i) => !!i.tag),
      lulu: list.filter((i) => i.lulu),
    };
  }, [items]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return split[group].filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q) || c.sections.some((s) => s.customerName.toLowerCase().includes(q) || s.customerId.toLowerCase().includes(q)) || c.emails.some((e) => e.toLowerCase().includes(q)),
    );
  }, [split, group, search]);

  const sendable = rows.filter((c) => c.emails.length);
  const allPicked = sendable.length > 0 && sendable.every((c) => picked.has(c.key));
  const toggleAll = () =>
    setPicked((p) => {
      const next = new Set(p);
      sendable.forEach((c) => (allPicked ? next.delete(c.key) : next.add(c.key)));
      return next;
    });
  const toggle = (key: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const chosen = (items || []).filter((c) => picked.has(c.key));

  const run = async () => {
    setConfirm(false);
    setRunning(true);
    setDone(0);
    let ok = 0;
    for (let i = 0; i < chosen.length; i++) {
      const c = chosen[i];
      try {
        onSent(unwrap(await sendRebateRequest({ key: c.key })));
        ok++;
        setSent((p) => ({ ...p, [c.key]: 'ok' }));
        setPicked((p) => {
          const next = new Set(p);
          next.delete(c.key);
          return next;
        });
      } catch (e: any) {
        setSent((p) => ({ ...p, [c.key]: 'failed' }));
        toast.error(`${c.name}: ${e?.message || 'Could not send'}`);
      }
      setDone(i + 1);
    }
    setRunning(false);
    if (ok) toast.success(`${ok} of ${chosen.length} sent`);
  };

  const header =
    active && headerEl && items
      ? createPortal(
          <button
            onClick={() => (chosen.length ? setConfirm(true) : toast.error('Tick the customers first'))}
            disabled={running}
            className="h-11 px-5 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {running ? `Sending ${done} / ${chosen.length}` : `Send${chosen.length ? ` (${chosen.length})` : ''}`}
          </button>,
          headerEl,
        )
      : null;

  if (!items) return null; // the page shows the loader

  const th = 'py-4 px-3 text-center';
  const td = 'py-3 px-3 text-center align-middle';

  return (
    <div className="space-y-5">
      {header}

      {status && (status.problem || !status.connected) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {status.problem || 'The finance mailbox is not connected yet. The admin connects it from Settings.'}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col md:flex-row gap-3">
        <div className="grid grid-cols-3 gap-1 w-full md:w-[30rem] rounded-xl bg-slate-100 p-1 shrink-0">
          {(
            [
              ['normal', 'Customers'],
              ['tags', 'Groups'],
              ['lulu', 'Lulu'],
            ] as [Group, string][]
          ).map(([g, l]) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={`w-full min-w-0 h-9 px-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${group === g ? 'bg-black text-[#C4A052] shadow' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {l} <span className="opacity-60">({split[g].length})</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, tag, ID, email…"
            dir="auto"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0a0f1d] text-[11px] font-black uppercase tracking-[0.15em] text-[#C4A052]">
                <th className={`${th} w-12`}>
                  <input type="checkbox" checked={allPicked} onChange={toggleAll} disabled={running || !sendable.length} className="w-4 h-4 accent-[#C4A052] align-middle" title="Tick all with an email" />
                </th>
                <th className={`${th} w-14`}>#</th>
                <th className={th}>{group === 'tags' ? 'Group (Tag)' : 'Customer'}</th>
                <th className={th}>Pending Months</th>
                <th className={th}>Emails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 ? (
                <NoData isTable colSpan={5} title={search ? 'NO MATCHING CUSTOMERS' : group === 'lulu' ? 'NO LULU CUSTOMERS WITH PENDING MONTHS' : group === 'tags' ? 'NO GROUPS WITH PENDING MONTHS' : 'NO CUSTOMERS WITH PENDING MONTHS'} />
              ) : (
                rows.map((c, i) => {
                  const months = monthsOf(c);
                  const state = sent[c.key];
                  return (
                    <tr key={c.key} className={`hover:bg-slate-50/70 transition-colors ${picked.has(c.key) ? 'bg-amber-50/40' : ''}`}>
                      <td className={td}>
                        <input
                          type="checkbox"
                          checked={picked.has(c.key)}
                          onChange={() => toggle(c.key)}
                          disabled={running || !c.emails.length}
                          className="w-4 h-4 accent-black align-middle disabled:opacity-30"
                          title={c.emails.length ? '' : 'No email saved'}
                        />
                      </td>
                      <td className={`${td} font-bold text-slate-400 tabular-nums`}>{i + 1}</td>
                      <td className={td}>
                        <p className="font-bold text-slate-800" dir="auto">
                          {c.name}
                          {state === 'ok' && <span className="ml-2 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-black align-middle">SENT</span>}
                          {state === 'failed' && <span className="ml-2 px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-black align-middle">FAILED</span>}
                          {!c.emails.length && <span className="ml-2 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-black align-middle">NO EMAIL</span>}
                        </p>
                        {c.sub && <p className="text-[11px] font-semibold text-slate-400">{c.sub}</p>}
                      </td>
                      <td className={td}>
                        <button
                          onClick={() => setMonthsFor(c)}
                          className="h-9 px-3 mx-auto flex items-center gap-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                          title="Show the months"
                        >
                          <CalendarClock className="w-4 h-4 text-[#C4A052]" />
                          {months.slice(0, 3).map(shortLabel).join(', ')}
                          {months.length > 3 && <span className="text-slate-400">+{months.length - 3}</span>}
                        </button>
                      </td>
                      <td className={td}>
                        <button
                          onClick={() => setEmailsOf(c)}
                          className={`relative w-9 h-9 mx-auto flex items-center justify-center rounded-lg ${c.emails.length ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-300 hover:bg-slate-100'}`}
                          title={c.emails.length ? c.emails.join(', ') : 'No email saved'}
                        >
                          <Mail className="w-4 h-4" />
                          {c.emails.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center">{c.emails.length}</span>}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* the months the email asks for */}
      <Modal open={!!monthsFor} title={monthsFor?.name || ''} subtitle="Pending months the email asks the invoices for" width="max-w-md" onClose={() => setMonthsFor(null)}>
        {monthsFor && (
          <div className="space-y-4">
            {monthsFor.sections.map((s) => (
              <div key={s.customerId}>
                <span className={label} dir="auto">
                  {s.customerName}
                </span>
                <ul className="space-y-2">
                  {s.periods.map((p) => (
                    <li key={`${p.year}-${p.month}`} className="px-4 py-2.5 rounded-xl bg-red-50 text-sm font-bold text-red-600">
                      {MONTH_NAMES[p.month - 1]} {p.year}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* emails of the customer */}
      <Modal open={!!emailsOf} title={emailsOf?.name || ''} subtitle={emailsOf?.lulu ? 'Lulu emails' : emailsOf?.tag ? 'One email to all of them, with every customer of the group' : 'Saved emails'} width="max-w-md" onClose={() => setEmailsOf(null)}>
        {emailsOf && (
          <div className="space-y-4">
            {(
              [
                ['To', emailsOf.emails],
                ['CC', emailsOf.cc || []],
                ...(emailsOf.tag ? [['Customers in this group', emailsOf.sections.map((s) => s.customerName)]] : []),
              ] as [string, string[]][]
            )
              .filter(([, list]) => list.length)
              .map(([title, list]) => (
                <div key={title}>
                  <span className={label}>{title}</span>
                  <ul className="space-y-2">
                    {list.map((e) => (
                      <li key={e} className="px-4 py-2.5 rounded-xl bg-slate-50 text-sm font-semibold text-slate-700 break-all">
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            {!emailsOf.emails.length && <p className="text-sm font-semibold text-slate-400">No email saved for this customer.</p>}
          </div>
        )}
      </Modal>

      {/* confirm */}
      <Modal
        open={confirm}
        title={`Send ${chosen.length} request${chosen.length === 1 ? '' : 's'}?`}
        subtitle="One email per customer · one email per group listing every customer's months"
        width="max-w-lg"
        onClose={() => setConfirm(false)}
        footer={
          <div className="grid grid-cols-2 gap-3 w-full">
            <button onClick={() => setConfirm(false)} className="h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={() => void run()} className="h-11 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center justify-center gap-2">
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        }
      >
        <ul className="divide-y divide-slate-100 text-sm">
          {chosen.map((c) => (
            <li key={c.key} className="py-2.5 flex items-center justify-between gap-3">
              <span className="font-bold text-slate-800 truncate" dir="auto">
                {c.name}
              </span>
              <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                {monthsOf(c).length} month{monthsOf(c).length === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
