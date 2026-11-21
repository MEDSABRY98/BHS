'use client';

import NoData from '@/app/Components/DataState/NoDataTab';
import { useState } from 'react';
import { Building2, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import Dropdown from './Dropdown';
import RegionField from './RegionField';
import { toast } from '@/app/Components/Notification';
import { deleteAnalyticType, saveAnalyticType } from '../Service/ReportService';
import type { AccountKind, AnalyticType } from '../Utils/ReportTypes';
import { BTN, CARD, INPUT, TD, TH, THEAD, TITLE } from './ui';

type Draft = { name: string; kind: AccountKind; region: string; channel: string };
const KIND_OPTIONS = [
  { value: 'location', label: 'Location', hint: 'Belongs to a region', icon: MapPin },
  { value: 'hq', label: 'HQ', hint: 'Not tied to a location', icon: Building2 },
];
const EMPTY: Draft = { name: '', kind: 'location', region: '', channel: '' };

export default function AccountsTab({ types, onChange }: { types: AnalyticType[]; onChange: () => Promise<void> | void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const regions = [...new Set(types.map((t) => t.region).filter((r): r is string => !!r))];

  const save = async (t: { id?: string; name: string; kind: AccountKind; region?: string | null; channel?: string | null; notes?: string | null }) => {
    await saveAnalyticType(t);
    await onChange();
  };

  const add = async () => {
    setAdding(true);
    try { await save(draft); setDraft(EMPTY); toast.success('Account added'); } catch (e: any) { toast.error(e?.message || 'Could not save'); } finally { setAdding(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className={TITLE}>Analytic Accounts</h1>
      <p className="text-xs font-semibold text-slate-500">A <b>Location</b> account belongs to a region (analysed in Regions). An <b>HQ</b> account is everything else (analysed in HQ / Central).</p>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3">
        <input className={`${INPUT} !text-left flex-1`} placeholder="Analytic account name (as in Odoo)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Dropdown className="lg:w-[220px] lg:shrink-0" value={draft.kind} options={KIND_OPTIONS} onChange={(v) => setDraft({ ...draft, kind: v as AccountKind })} />
        <RegionField className="lg:w-[220px] lg:shrink-0" disabled={draft.kind !== 'location'} value={draft.region} regions={regions} onChange={(v) => setDraft({ ...draft, region: v })} />
        <input className={INPUT} placeholder="Channel" value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value })} />
        <button className={BTN} disabled={adding || !draft.name.trim()} onClick={() => void add()}><Plus className="w-4 h-4" /> Add</button>
      </div>

      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr className={THEAD}>{['Analytic account', 'Type', 'Region', 'Channel', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {types.length === 0 && <NoData isTable colSpan={5} message="Add your first analytic account above" />}
              {types.map((t) => (
                <TypeRow regions={regions} key={`${t.id}|${t.kind}|${t.region}|${t.channel}`} t={t} onSave={save} onDelete={async () => { if (!confirm(`Delete ${t.name}?`)) return; try { await deleteAnalyticType(t.id); await onChange(); } catch (e: any) { toast.error(e?.message || 'Could not delete'); } }} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TypeRow({ t, regions, onSave, onDelete }: { regions: string[]; t: AnalyticType; onSave: (t: { id: string; name: string; kind: AccountKind; region: string | null; channel: string | null; notes: string | null }) => Promise<void>; onDelete: () => void }) {
  const [kind, setKind] = useState<AccountKind>(t.kind);
  const [region, setRegion] = useState(t.region || '');
  const [channel, setChannel] = useState(t.channel || '');
  const [saving, setSaving] = useState(false);
  const dirty = kind !== t.kind || region !== (t.region || '') || channel !== (t.channel || '');
  const small = `${INPUT} !h-9 w-full max-w-[200px]`;
  return (
    <tr className="hover:bg-amber-50/40">
      <td className={`${TD} font-bold text-slate-900`}>{t.name}</td>
      <td className={TD}><Dropdown size="sm" className="w-[220px] mx-auto" value={kind} options={KIND_OPTIONS} onChange={(v) => setKind(v as AccountKind)} /></td>
      <td className={TD}><RegionField size="sm" className="w-[220px] mx-auto" disabled={kind !== 'location'} value={kind === 'location' ? region : ''} regions={regions} onChange={setRegion} /></td>
      <td className={TD}><input className={small} value={channel} onChange={(e) => setChannel(e.target.value)} /></td>
      <td className={TD}>
        {dirty && (
          <button disabled={saving} title="Save" className="w-8 h-8 rounded-lg text-emerald-700 hover:bg-emerald-50 inline-flex items-center justify-center mr-1"
            onClick={async () => { setSaving(true); try { await onSave({ id: t.id, name: t.name, kind, region: kind === 'location' ? region : null, channel: channel || null, notes: t.notes }); toast.success('Saved'); } catch (e: any) { toast.error(e?.message || 'Could not save'); } finally { setSaving(false); } }}>
            <Save className="w-4 h-4" />
          </button>
        )}
        <button title="Delete" onClick={onDelete} className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
      </td>
    </tr>
  );
}
