'use client';

// Customer Statement: one row per customer — his saved emails and the attachment. Tick customers and press
// Send (next to the title) to email each one his statement. Filters (next to Send) hold the main settings
// (file, transactions, date) every customer uses unless his own attachment was changed.

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, Mail, Paperclip, Search, Send, SlidersHorizontal } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import Choice from './Choice';
import Modal from './Modal';
import { sendCustomerStatement } from '../Service/MailService';
import {
  FORMATS,
  SCOPES,
  formatAmount,
  formatDate,
  tagsOf,
  uaeToday,
  unwrap,
  type AttachmentFormat,
  type MailCustomer,
  type MailLogRow,
  type MailStatus,
  type StatementScope,
} from '../Utils/MailTypes';

type Setup = { format: AttachmentFormat; scope: StatementScope; dateTo: string };
type Group = 'normal' | 'tags' | 'lulu';

/** one row: a customer (normal / Lulu) or a tag (one group statement to all its customers) */
type Item = {
  key: string;
  name: string;
  sub: string;
  balance: number;
  emails: string[];
  cc: string[];
  lulu: boolean;
  customerId: string;
  tag: string | null;
  members: string[];
};

interface StatementsTabProps {
  status: MailStatus | null;
  customers: MailCustomer[] | null;
  onSent: (row: MailLogRow) => void;
  /** the page title row: Send and Filters go there (createPortal) */
  headerEl: HTMLDivElement | null;
  active: boolean;
}

const label = 'block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2';
const FORMAT_SHORT: Record<AttachmentFormat, string> = { pdf: 'PDF', excel: 'Excel', both: 'PDF + Excel' };
const describe = (s: Setup) => `${FORMAT_SHORT[s.format]} · ${s.scope === 'open' ? 'Open' : 'All'} · ${s.dateTo ? formatDate(s.dateTo) : 'Every date'}`;

function SetupFields({ value, onChange }: { value: Setup; onChange: (s: Setup) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <span className={label}>File</span>
        <Choice full value={value.format} options={FORMATS} onChange={(format) => onChange({ ...value, format })} />
      </div>
      <div>
        <span className={label}>Transactions</span>
        <Choice full value={value.scope} options={SCOPES} onChange={(scope) => onChange({ ...value, scope })} />
      </div>
      <div>
        <span className={label}>Up To Date</span>
        <input
          type="date"
          value={value.dateTo}
          onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
          className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]"
        />
        <p className="mt-1 text-[11px] font-semibold text-slate-400">Empty = every date.</p>
      </div>
    </div>
  );
}

export default function StatementsTab({ status, customers, onSent, headerEl, active }: StatementsTabProps) {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<Group>('normal');
  const [main, setMain] = useState<Setup>({ format: 'pdf', scope: 'open', dateTo: uaeToday() });
  const [mainDraft, setMainDraft] = useState<Setup | null>(null);
  const [own, setOwn] = useState<Record<string, Setup>>({}); // customers whose attachment was changed
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [emailsOf, setEmailsOf] = useState<Item | null>(null);
  const [editing, setEditing] = useState<{ customer: Item; setup: Setup } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [sent, setSent] = useState<Record<string, 'ok' | 'failed'>>({});

  const setupOf = (name: string): Setup => own[name] || main;

  // only customers with an email saved: Customers (no tag) · Groups (tagged, one group statement per tag) · Lulu
  const items = useMemo(() => {
    const list = customers || [];
    const one = (c: MailCustomer): Item => ({ key: `c:${c.name}`, name: c.name, sub: c.id, balance: c.balance, emails: c.emails, cc: c.cc || [], lulu: c.lulu, customerId: c.id, tag: null, members: [c.name] });
    const normal = list.filter((c) => !c.lulu && !c.tag && c.emails.length).map(one);
    const lulu = list.filter((c) => c.lulu && c.emails.length).map(one);
    const tags = tagsOf(list.filter((c) => !c.lulu))
      .filter((g) => g.emails.length)
      .map(
        (g): Item => ({
          key: `t:${g.tag}`,
          name: g.tag,
          sub: `${g.customers.length} customer${g.customers.length === 1 ? '' : 's'}`,
          balance: g.balance,
          emails: g.emails,
          cc: [],
          lulu: false,
          customerId: '',
          tag: g.tag,
          members: g.customers.map((c) => c.name),
        }),
      );
    return { normal, tags, lulu };
  }, [customers]);
  const all = useMemo(() => [...items.normal, ...items.tags, ...items.lulu], [items]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items[group].filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q) || c.members.some((m) => m.toLowerCase().includes(q)) || c.emails.some((e) => e.toLowerCase().includes(q)),
    );
  }, [items, group, search]);

  const sendable = rows;
  const allPicked = sendable.length > 0 && sendable.every((c) => picked.has(c.key));
  const toggleAll = () =>
    setPicked((p) => {
      const next = new Set(p);
      sendable.forEach((c) => (allPicked ? next.delete(c.key) : next.add(c.key)));
      return next;
    });
  const toggle = (name: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const chosen = all.filter((c) => picked.has(c.key));

  const run = async () => {
    setConfirm(false);
    setRunning(true);
    setDone(0);
    let ok = 0;
    for (let i = 0; i < chosen.length; i++) {
      const c = chosen[i];
      const s = setupOf(c.key);
      try {
        const row = unwrap(await sendCustomerStatement({ customerName: c.name, customerId: c.customerId || null, tag: c.tag, format: s.format, scope: s.scope, dateTo: s.dateTo || null }));
        onSent(row);
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
    active && headerEl && customers
      ? createPortal(
          <div className="flex items-center gap-2">
            <button
              onClick={() => (chosen.length ? setConfirm(true) : toast.error('Tick the customers first'))}
              disabled={running}
              className="h-11 px-5 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {running ? `Sending ${done} / ${chosen.length}` : `Send${chosen.length ? ` (${chosen.length})` : ''}`}
            </button>
            <button
              onClick={() => setMainDraft(main)}
              className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
              title="Main settings"
            >
              <SlidersHorizontal className="w-4 h-4" /> {describe(main)}
            </button>
          </div>,
          headerEl,
        )
      : null;

  if (!customers) return null; // the page shows the loader

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
              {l} <span className="opacity-60">({items[g].length})</span>
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
                <th className={th}>Balance</th>
                <th className={th}>Emails</th>
                <th className={th}>Attachment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 ? (
                <NoData isTable colSpan={6} title={search ? 'NO MATCHING CUSTOMERS' : group === 'lulu' ? 'NO LULU CUSTOMERS WITH EMAILS' : group === 'tags' ? 'NO GROUPS WITH EMAILS' : 'NO CUSTOMERS WITH EMAILS'} />
              ) : (
                rows.map((c, i) => {
                  const s = setupOf(c.key);
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
                        </p>
                        {c.sub && <p className="text-[11px] font-semibold text-slate-400">{c.sub}</p>}
                      </td>
                      <td className={`${td} font-black text-slate-900 whitespace-nowrap tabular-nums`}>{formatAmount(c.balance)}</td>
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
                      <td className={td}>
                        <button
                          onClick={() => setEditing({ customer: c, setup: s })}
                          className={`h-9 px-3 mx-auto flex items-center gap-1.5 rounded-lg border text-xs font-bold whitespace-nowrap hover:bg-slate-50 ${own[c.key] ? 'border-[#C4A052] text-slate-800' : 'border-slate-200 text-slate-500'}`}
                          title={own[c.key] ? 'Own settings for this customer' : 'Main settings'}
                        >
                          <Paperclip className="w-4 h-4 text-[#C4A052]" /> {describe(s)}
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

      {/* main settings (Filters) */}
      <Modal
        open={!!mainDraft}
        title="Main Settings"
        subtitle="Used by every customer whose own attachment was not changed"
        width="max-w-lg"
        onClose={() => setMainDraft(null)}
        footer={
          <div className="grid grid-cols-2 gap-3 w-full">
            <button onClick={() => setMainDraft(null)} className="h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={() => {
                if (mainDraft) setMain(mainDraft);
                setMainDraft(null);
              }}
              className="h-11 rounded-xl bg-black text-[#C4A052] text-sm font-bold"
            >
              Apply
            </button>
          </div>
        }
      >
        {mainDraft && <SetupFields value={mainDraft} onChange={setMainDraft} />}
      </Modal>

      {/* emails of the customer */}
      <Modal open={!!emailsOf} title={emailsOf?.name || ''} subtitle={emailsOf?.lulu ? 'Lulu emails' : emailsOf?.tag ? 'One email to all of them, with the group statement' : 'Saved emails'} width="max-w-md" onClose={() => setEmailsOf(null)}>
        {emailsOf && (
          <div className="space-y-4">
            {(
              [
                ['To', emailsOf.emails],
                ['CC', emailsOf.cc || []],
                ...(emailsOf.tag ? [['Customers in this group', emailsOf.members]] : []),
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
          </div>
        )}
      </Modal>

      {/* own attachment of one customer */}
      <Modal
        open={!!editing}
        title={editing?.customer.name || ''}
        subtitle="Attachment for this customer"
        width="max-w-lg"
        onClose={() => setEditing(null)}
        footer={
          <div className="grid grid-cols-3 gap-3 w-full">
            <button
              onClick={() => {
                if (!editing) return;
                setOwn((p) => {
                  const next = { ...p };
                  delete next[editing.customer.key];
                  return next;
                });
                setEditing(null);
              }}
              className="h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
              title="Use the main settings"
            >
              Reset
            </button>
            <button onClick={() => setEditing(null)} className="h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={() => {
                if (!editing) return;
                setOwn((p) => ({ ...p, [editing.customer.key]: editing.setup }));
                setEditing(null);
              }}
              className="h-11 rounded-xl bg-black text-[#C4A052] text-sm font-bold"
            >
              Save
            </button>
          </div>
        }
      >
        {editing && <SetupFields value={editing.setup} onChange={(setup) => setEditing({ ...editing, setup })} />}
      </Modal>

      {/* confirm */}
      <Modal
        open={confirm}
        title={`Send ${chosen.length} statement${chosen.length === 1 ? '' : 's'}?`}
        subtitle="One email per customer · one email per group with the group statement"
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
              <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">{describe(setupOf(c.key))}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
