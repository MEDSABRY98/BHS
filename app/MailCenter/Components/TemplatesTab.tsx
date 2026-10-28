'use client';

// Ready emails: subject, message and the attachment settings (filled for each customer when used).

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import Modal from './Modal';
import Choice from './Choice';
import { deleteMailTemplate, saveMailTemplate } from '../Service/MailService';
import {
  ATTACHMENT_KINDS,
  DATE_MODES,
  DEFAULT_BODY,
  FORMATS,
  SCOPES,
  VARIABLES,
  type AttachmentKind,
  type MailTemplate,
  type TemplateAttachment,
} from '../Utils/MailTypes';

interface TemplatesTabProps {
  templates: MailTemplate[];
  onChange: (next: MailTemplate[]) => void;
  /** the page title row: New Template goes there (createPortal) */
  headerEl: HTMLDivElement | null;
  active: boolean;
}

type Draft = { ID?: string; NAME: string; SUBJECT: string; BODY: string; ATTACHMENT: TemplateAttachment | null };
const EMPTY: Draft = { NAME: '', SUBJECT: 'Statement of Account – {Name}', BODY: DEFAULT_BODY, ATTACHMENT: { kind: 'customer-statement', format: 'pdf', scope: 'open', dateMode: 'today' } };
const label = 'block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2';
const field = 'w-full rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]';
const byName = (a: MailTemplate, b: MailTemplate) => a.NAME.localeCompare(b.NAME, 'en', { sensitivity: 'base' });

const attachmentText = (a: TemplateAttachment | null) =>
  a
    ? `${ATTACHMENT_KINDS.find((k) => k.id === a.kind)?.label} · ${FORMATS.find((f) => f.id === a.format)?.label} · ${SCOPES.find((s) => s.id === a.scope)?.label} · ${DATE_MODES.find((d) => d.id === a.dateMode)?.label}`
    : 'No attachment';

export default function TemplatesTab({ templates, onChange, headerEl, active }: TemplatesTabProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<MailTemplate | null>(null);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await saveMailTemplate(draft);
      onChange([...templates.filter((t) => t.ID !== saved.ID), saved].sort(byName));
      toast.success(`${saved.NAME} saved`);
      setDraft(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteMailTemplate(deleting.ID);
      onChange(templates.filter((t) => t.ID !== deleting.ID));
      toast.success(`${deleting.NAME} deleted`);
      setDeleting(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete');
    } finally {
      setSaving(false);
    }
  };

  const a = draft?.ATTACHMENT;
  const setA = (patch: Partial<TemplateAttachment> | null) =>
    draft && setDraft({ ...draft, ATTACHMENT: patch === null ? null : { ...(draft.ATTACHMENT || EMPTY.ATTACHMENT!), ...patch } });

  return (
    <div className="space-y-5">
      {active &&
        headerEl &&
        createPortal(
          <button onClick={() => setDraft({ ...EMPTY })} className="ml-auto h-10 px-4 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" /> New Template
          </button>,
          headerEl,
        )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.ID} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-black text-slate-900" dir="auto">{t.NAME}</p>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setDraft({ ID: t.ID, NAME: t.NAME, SUBJECT: t.SUBJECT, BODY: t.BODY, ATTACHMENT: t.ATTACHMENT })} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-black hover:bg-slate-100" title="Edit">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleting(t)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-600 truncate" dir="auto">{t.SUBJECT}</p>
            <p className="text-xs text-slate-400 line-clamp-3 whitespace-pre-line" dir="auto">{t.BODY}</p>
            <p className="mt-auto text-[11px] font-bold text-[#B8860B] flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" /> {attachmentText(t.ATTACHMENT)}
            </p>
          </div>
        ))}
      </div>
      {!templates.length && <NoData title="NO TEMPLATES YET" message="Make the first one with New Template" />}

      <Modal
        open={!!draft}
        title={draft?.ID ? draft.NAME || 'Template' : 'New Template'}
        width="max-w-3xl"
        onClose={() => !saving && setDraft(null)}
        footer={
          <>
            <button onClick={() => setDraft(null)} disabled={saving} className="h-11 px-5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={() => void save()} disabled={saving || !draft?.NAME.trim() || !draft?.SUBJECT.trim()} className="h-11 px-6 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-2 disabled:opacity-40">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
            </button>
          </>
        }
      >
        {draft && (
          <div className="space-y-5">
            <div>
              <span className={label}>Name</span>
              <input value={draft.NAME} onChange={(e) => setDraft({ ...draft, NAME: e.target.value })} dir="auto" placeholder="e.g. Monthly Statement" className={`${field} h-11 px-4`} />
            </div>
            <div>
              <span className={label}>Subject</span>
              <input value={draft.SUBJECT} onChange={(e) => setDraft({ ...draft, SUBJECT: e.target.value })} dir="auto" maxLength={250} className={`${field} h-11 px-4`} />
            </div>
            <div>
              <span className={label}>Message</span>
              <textarea value={draft.BODY} onChange={(e) => setDraft({ ...draft, BODY: e.target.value })} rows={10} dir="auto" className={`${field} px-4 py-3 leading-relaxed resize-y font-medium`} />
              <p className="mt-1.5 text-[11px] font-semibold text-slate-400">{VARIABLES.join('  ')} · **text** = bold</p>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={!!a} onChange={(e) => setA(e.target.checked ? {} : null)} className="w-4 h-4 accent-black" /> Attachment
              </label>
              {a && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                  <div className="sm:col-span-2">
                    <span className={label}>Statement</span>
                    <Choice value={a.kind} options={ATTACHMENT_KINDS} full onChange={(kind: AttachmentKind) => setA({ kind })} />
                  </div>
                  <div className="sm:col-span-2">
                    <span className={label}>File</span>
                    <Choice value={a.format} options={FORMATS} full onChange={(format) => setA({ format })} />
                  </div>
                  <div>
                    <span className={label}>Transactions</span>
                    <Choice value={a.scope} options={SCOPES} onChange={(scope) => setA({ scope })} />
                  </div>
                  <div>
                    <span className={label}>Up To</span>
                    <select value={a.dateMode} onChange={(e) => setA({ dateMode: e.target.value as TemplateAttachment['dateMode'] })} className={`${field} h-10 px-3`}>
                      {DATE_MODES.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!deleting}
        title={`Delete "${deleting?.NAME || ''}"?`}
        width="max-w-md"
        onClose={() => !saving && setDeleting(null)}
        footer={
          <>
            <button onClick={() => setDeleting(null)} disabled={saving} className="h-11 px-5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={() => void remove()} disabled={saving} className="h-11 px-6 rounded-xl bg-red-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-40">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-500">Emails already sent are not changed.</p>
      </Modal>
    </div>
  );
}
