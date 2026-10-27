'use client';

// One email in three tabs next to the page title: Recipients · Message · Attachments, with Clear / Send there too.

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, FileText, Loader2, Paperclip, Send, Trash2, Users, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NiceSelect from '@/app/ScheduledReports/Components/NiceSelect';
import EmailInput from './EmailInput';
import AttachmentForm from './AttachmentForm';
import Modal from './Modal';
import { sendMailDraft } from '../Service/MailService';
import {
  DEFAULT_BODY,
  VARIABLES,
  describeAttachment,
  kindLabel,
  tagsOf,
  resolveDateMode,
  unwrap,
  type AttachmentSpec,
  type MailCustomer,
  type MailLogRow,
  type MailStatus,
  type MailSupplier,
  type MailTemplate,
} from '../Utils/MailTypes';

interface ComposeTabProps {
  status: MailStatus | null;
  customers: MailCustomer[] | null;
  suppliers: MailSupplier[] | null;
  templates: MailTemplate[];
  onSent: (row: MailLogRow) => void;
  /** the page title row: the three tabs and Clear / Send go there (createPortal) */
  headerEl: HTMLDivElement | null;
  active: boolean;
}

type Section = 'recipients' | 'message' | 'attachments';

const label = 'block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2';
const card = 'bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden';
const SECTIONS: { id: Section; label: string; icon: typeof Users }[] = [
  { id: 'recipients', label: 'Recipients', icon: Users },
  { id: 'message', label: 'Message', icon: FileText },
  { id: 'attachments', label: 'Attachments', icon: Paperclip },
];
const field = 'w-full rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]';

export default function ComposeTab({ status, customers, suppliers, templates, onSent, headerEl, active }: ComposeTabProps) {
  const [section, setSection] = useState<Section>('recipients');
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(DEFAULT_BODY);
  const [attachments, setAttachments] = useState<AttachmentSpec[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  const template = templates.find((t) => t.ID === templateId) || null;
  const suggestions = useMemo(
    () => (customers || []).flatMap((c) => c.emails.map((email) => ({ email: email.toLowerCase(), label: c.name }))),
    [customers],
  );

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.ID === id);
    if (!t) return;
    setSubject(t.SUBJECT);
    setBody(t.BODY);
  };

  const addAttachment = (spec: AttachmentSpec) => {
    setAttachments((prev) => [...prev, spec]);
    // first customer / group statement: the saved emails go to To when To is empty
    if (spec.kind === 'customer-statement' && !to.length) {
      const c = customers?.find((x) => x.name === spec.customerName);
      if (c?.emails.length) setTo(c.emails.map((e) => e.toLowerCase()));
      else toast.warning(`${spec.customerName} has no saved email — type it in To`);
    }
    if (spec.kind === 'group-statement' && !to.length) {
      const g = tagsOf(customers || []).find((t) => t.tag === spec.tag);
      if (g?.emails.length) setTo(g.emails);
      else toast.warning(`No saved email for the customers of ${spec.tag} — type it in To`);
    }
  };

  const clear = () => {
    setTo([]);
    setCc([]);
    setBcc([]);
    setTemplateId('');
    setSubject('');
    setBody(DEFAULT_BODY);
    setAttachments([]);
  };

  const check = () => {
    if (!status?.connected) return toast.error('The mailbox is not connected yet — Settings'), false;
    if (!to.length) return toast.error('Add at least one email in To'), false;
    if (!subject.trim()) return toast.error('Write the subject'), false;
    return true;
  };

  const send = async () => {
    setSending(true);
    try {
      const row = unwrap(await sendMailDraft({ to, cc, bcc, subject, body, attachments, templateId: templateId || null }));
      toast.success(`Sent to ${row.TO_EMAILS.join(', ')}`);
      onSent(row);
      setConfirm(false);
      clear();
    } catch (e: any) {
      toast.error(e?.message || 'Could not send');
    } finally {
      setSending(false);
    }
  };

  const ta = template?.ATTACHMENT;
  const defaults = ta ? { kind: ta.kind, format: ta.format, scope: ta.scope, dateTo: resolveDateMode(ta.dateMode) } : null;

  return (
    <div className="space-y-5">
      {status && (status.problem || !status.connected) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {status?.problem || 'The finance mailbox is not connected yet. The admin connects it from Settings.'}
        </div>
      )}

      {active &&
        headerEl &&
        createPortal(
          <>
            <div className="inline-flex flex-wrap gap-1 p-1 rounded-2xl bg-white border border-slate-200 shadow-sm">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const on = section === s.id;
                const count = s.id === 'recipients' ? to.length + cc.length + bcc.length : s.id === 'attachments' ? attachments.length : 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    className={`h-10 w-44 px-3 rounded-xl text-sm font-black inline-flex items-center justify-center gap-2 transition-all ${on ? 'bg-black text-[#C4A052] shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                  >
                    <Icon className="w-4 h-4" /> {s.label}
                    {count > 0 && <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] flex items-center justify-center ${on ? 'bg-[#C4A052] text-black' : 'bg-slate-200 text-slate-700'}`}>{count}</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button type="button" onClick={clear} disabled={sending} className="h-10 w-32 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-1.5" title="Clear everything">
                <X className="w-4 h-4" /> Clear
              </button>
              <button type="button" onClick={() => check() && setConfirm(true)} disabled={sending} className="h-10 w-32 rounded-xl bg-black text-[#C4A052] text-sm font-black flex items-center justify-center gap-2 shadow-sm disabled:opacity-40">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
              </button>
            </div>
          </>,
          headerEl,
        )}

      <div>
        {/* recipients */}
        <section className={`${card} ${section === 'recipients' ? '' : 'hidden'}`}>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <span className={label}>From</span>
              <div className="h-11 px-4 rounded-xl bg-[#F5F7FB] border border-slate-100 flex items-center text-sm font-black text-slate-900 truncate">{status?.from || '—'}</div>
            </div>
            <div>
              <span className={label}>Template</span>
              <NiceSelect
                value={templateId}
                onChange={applyTemplate}
                searchPlaceholder="Search template..."
                options={[{ value: '', label: templates.length ? 'No template' : 'No templates yet' }, ...templates.map((t) => ({ value: t.ID, label: t.NAME }))]}
              />
            </div>
            <div className="lg:col-span-2">
              <span className={label}>To</span>
              <EmailInput value={to} onChange={setTo} suggestions={suggestions} />
            </div>
            <div>
              <span className={label}>CC</span>
              <EmailInput value={cc} onChange={setCc} suggestions={suggestions} placeholder="optional" />
            </div>
            <div>
              <span className={label}>BCC</span>
              <EmailInput value={bcc} onChange={setBcc} suggestions={suggestions} placeholder="optional" />
            </div>
          </div>
        </section>

        {/* message */}
        <section className={`${card} ${section === 'message' ? '' : 'hidden'}`}>
          <div className="p-6 space-y-4">
            <div>
              <span className={label}>Subject</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} dir="auto" maxLength={250} placeholder="Statement of Account – {Name}" className={`${field} h-11 px-4`} />
            </div>
            <div>
              <span className={label}>Message</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} dir="auto" className={`${field} px-4 py-3 leading-relaxed resize-y font-medium`} />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {VARIABLES.map((v) => (
                  <button key={v} type="button" onClick={() => setBody((b) => `${b}${b.endsWith(' ') || !b ? '' : ' '}${v}`)} className="px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-black text-slate-600 hover:bg-[#C4A052]/15">
                    {v}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] font-semibold text-slate-400">Filled from the first attachment · **text** = bold</p>
            </div>
          </div>
        </section>

        {/* attachments */}
        <section className={`${card} ${section === 'attachments' ? '' : 'hidden'}`}>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <AttachmentForm customers={customers} suppliers={suppliers} defaults={defaults} onAdd={addAttachment} />
            <div className="space-y-2 lg:border-l lg:border-slate-100 lg:pl-8">
              <span className={label}>Attached ({attachments.length})</span>
              {attachments.length ? (
                attachments.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[#F5F7FB] border border-slate-100">
                    <Paperclip className="w-4 h-4 text-[#C4A052] shrink-0 mt-0.5" />
                    <span className="flex-1 min-w-0 text-xs font-bold text-slate-700 break-words" dir="auto">
                      {kindLabel(a.kind)} · {describeAttachment(a)}
                    </span>
                    <button type="button" onClick={() => setAttachments((p) => p.filter((_, k) => k !== i))} className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs font-semibold text-slate-400">No attachment.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={confirm}
        title="Send this email?"
        onClose={() => !sending && setConfirm(false)}
        width="max-w-lg"
        footer={
          <>
            <button type="button" onClick={() => setConfirm(false)} disabled={sending} className="h-11 px-5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={() => void send()} disabled={sending} className="h-11 px-6 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-2 disabled:opacity-40">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Now
            </button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <p>
            <b>From:</b> {status?.from}
          </p>
          <p className="break-words">
            <b>To:</b> {to.join(', ')}
          </p>
          {cc.length > 0 && (
            <p className="break-words">
              <b>CC:</b> {cc.join(', ')}
            </p>
          )}
          {bcc.length > 0 && (
            <p className="break-words">
              <b>BCC:</b> {bcc.join(', ')}
            </p>
          )}
          <p dir="auto">
            <b>Subject:</b> {subject}
          </p>
          <p>
            <b>Attachments:</b> {attachments.length ? attachments.map(describeAttachment).join(' | ') : 'none'}
          </p>
        </div>
      </Modal>
    </div>
  );
}
