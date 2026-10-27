'use client';

// Add an attachment to an email (shown in the page, no popup): which statement, for whom,
// PDF / Excel, all / open, up to which date.

import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Paperclip } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NiceSelect from '@/app/ScheduledReports/Components/NiceSelect';
import Choice from './Choice';
import { downloadFiles } from './Download';
import { previewAttachment } from '../Service/MailService';
import {
  ATTACHMENT_KINDS,
  FORMATS,
  SCOPES,
  formatAmount,
  tagsOf,
  uaeToday,
  type AttachmentFormat,
  type AttachmentKind,
  type AttachmentSpec,
  type MailCustomer,
  type MailSupplier,
  type StatementScope,
} from '../Utils/MailTypes';

interface AttachmentFormProps {
  customers: MailCustomer[] | null;
  suppliers: MailSupplier[] | null;
  onAdd: (spec: AttachmentSpec) => void;
  /** settings to start with (from the chosen template) */
  defaults?: { kind: AttachmentKind; format: AttachmentFormat; scope: StatementScope; dateTo: string | null } | null;
}

const label = 'block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2';

export default function AttachmentForm({ customers, suppliers, onAdd, defaults }: AttachmentFormProps) {
  const [kind, setKind] = useState<AttachmentKind>('customer-statement');
  const [party, setParty] = useState('');
  const [format, setFormat] = useState<AttachmentFormat>('pdf');
  const [scope, setScope] = useState<StatementScope>('all');
  const [dateTo, setDateTo] = useState(uaeToday());
  const [busy, setBusy] = useState(false);

  // a template with attachment settings: start from them
  useEffect(() => {
    if (defaults) {
      setKind(defaults.kind);
      setFormat(defaults.format);
      setScope(defaults.scope);
      setDateTo(defaults.dateTo || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults?.kind, defaults?.format, defaults?.scope, defaults?.dateTo]);

  const spec = (): AttachmentSpec | null => {
    if (!party) return null;
    if (kind === 'customer-statement') {
      const c = customers?.find((x) => x.name === party);
      return { kind, customerName: party, customerId: c?.id || null, format, scope, dateTo: dateTo || null };
    }
    if (kind === 'group-statement') return { kind, tag: party, format, scope, dateTo: dateTo || null };
    const s = suppliers?.find((x) => x.id === party);
    return s ? { kind, supplierId: s.id, supplierName: s.name, format, scope, dateTo: dateTo || null } : null;
  };

  const preview = async () => {
    const s = spec();
    if (!s) return toast.error('Choose who the statement is for');
    setBusy(true);
    try {
      downloadFiles(await previewAttachment(s));
    } catch (e: any) {
      toast.error(e?.message || 'Could not make the file');
    } finally {
      setBusy(false);
    }
  };

  const tags = useMemo(() => tagsOf(customers || []), [customers]);
  const list = kind === 'supplier-statement' ? suppliers : customers;
  const options =
    kind === 'customer-statement'
      ? (customers || []).map((c) => ({ value: c.name, label: c.name, hint: formatAmount(c.balance) }))
      : kind === 'group-statement'
        ? tags.map((t) => ({ value: t.tag, label: t.tag, hint: `${t.customers.length} customers · ${formatAmount(t.balance)}` }))
        : (suppliers || []).map((s) => ({ value: s.id, label: s.name, hint: s.id }));
  const who = kind === 'customer-statement' ? 'Customer' : kind === 'group-statement' ? 'Tag' : 'Supplier';

  return (
    <div className="space-y-4">
      <Choice
        value={kind}
        options={ATTACHMENT_KINDS}
        width="w-48"
        onChange={(k) => {
          setKind(k);
          setParty('');
        }}
      />
      <div>
        <span className={label}>{who}</span>
        <NiceSelect
          value={party}
          onChange={setParty}
          disabled={!list}
          searchPlaceholder={`Search ${who.toLowerCase()}...`}
          options={[...(!list ? [{ value: '', label: 'Loading...' }] : !party ? [{ value: '', label: `Choose a ${who.toLowerCase()}` }] : []), ...options]}
        />
        {list && !list.length && <p className="mt-1.5 text-xs font-semibold text-slate-400">You don&apos;t have access to this data.</p>}
      </div>
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
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
        <p className="mt-1 text-[11px] font-semibold text-slate-400">Empty = every date.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void preview()} disabled={busy || !party} className="h-10 rounded-xl border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Check File
        </button>
        <button
          type="button"
          onClick={() => {
            const s = spec();
            if (!s) return toast.error('Choose who the statement is for');
            onAdd(s);
            setParty('');
          }}
          disabled={!party}
          className="h-10 rounded-xl bg-[#182E56] text-[#C4A052] text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <Paperclip className="w-4 h-4" /> Add
        </button>
      </div>
    </div>
  );
}
