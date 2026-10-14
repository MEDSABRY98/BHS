'use client';

import { useMemo, useState } from 'react';
import { Landmark, Pencil, Plus, Search, Trash2, UserPlus, Users } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import ConfirmDialog from './ConfirmDialog';
import BankModal from './BankModal';
import BeneficiaryModal from './BeneficiaryModal';
import { deleteTransferBank, deleteTransferBeneficiary } from '../Service/TransferService';
import { formatIban, type TransferBank, type TransferBeneficiary } from '../Utils/TransferTypes';

interface BeneficiariesTabProps {
  banks: TransferBank[];
  beneficiaries: TransferBeneficiary[];
  onBankSaved: (bank: TransferBank) => void;
  onBankDeleted: (id: string) => void;
  onBeneficiarySaved: (b: TransferBeneficiary) => void;
  onBeneficiaryDeleted: (id: string) => void;
}

type DeleteTarget = { kind: 'bank'; item: TransferBank } | { kind: 'beneficiary'; item: TransferBeneficiary };

export default function BeneficiariesTab({ banks, beneficiaries, onBankSaved, onBankDeleted, onBeneficiarySaved, onBeneficiaryDeleted }: BeneficiariesTabProps) {
  const [view, setView] = useState<'beneficiaries' | 'banks'>('beneficiaries');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editBeneficiary, setEditBeneficiary] = useState<TransferBeneficiary | null | 'new'>(null);
  const [editBank, setEditBank] = useState<TransferBank | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const bankById = useMemo(() => new Map(banks.map((b) => [b.ID, b])), [banks]);

  const shownBeneficiaries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qNoSpace = q.replace(/\s/g, '');
    return beneficiaries.filter((b) => {
      if (!showInactive && !b.IS_ACTIVE) return false;
      if (!q) return true;
      return (
        b.NAME.toLowerCase().includes(q) ||
        String(b.IBAN || '').toLowerCase().includes(qNoSpace) ||
        String(b.ACCOUNT_NO || '').toLowerCase().includes(q) ||
        String(bankById.get(b.BANK_ID || '')?.NAME || '').toLowerCase().includes(q)
      );
    });
  }, [beneficiaries, search, showInactive, bankById]);

  const shownBanks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return banks.filter((b) => (showInactive || b.IS_ACTIVE) && (!q || b.NAME.toLowerCase().includes(q) || String(b.SWIFT_CODE || '').toLowerCase().includes(q)));
  }, [banks, showInactive, search]);

  const bankUse = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of beneficiaries) if (b.BANK_ID) m.set(b.BANK_ID, (m.get(b.BANK_ID) || 0) + 1);
    return m;
  }, [beneficiaries]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'bank') {
        await deleteTransferBank(deleteTarget.item.ID);
        onBankDeleted(deleteTarget.item.ID);
      } else {
        await deleteTransferBeneficiary(deleteTarget.item.ID);
        onBeneficiaryDeleted(deleteTarget.item.ID);
      }
      toast.success('Deleted');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Beneficiaries &amp; Banks</h1>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 self-start w-full sm:w-[340px]">
            {(
              [
                ['beneficiaries', 'Beneficiaries', Users, beneficiaries.length],
                ['banks', 'Banks', Landmark, banks.length],
              ] as const
            ).map(([v, l, Icon, n]) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  setSearch('');
                }}
                className={`flex items-center justify-center gap-2 px-4 h-9 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                  view === v ? 'bg-[#0a0f1d] text-white shadow' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${view === v ? 'text-[#D4AF37]' : ''}`} />
                {l}
                <span className={`px-1.5 rounded-md text-[11px] font-black ${view === v ? 'bg-white/15 text-[#D4AF37]' : 'bg-white text-slate-500'}`}>{n}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-500 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="w-4 h-4 accent-[#D4AF37]" />
          Show inactive
        </label>
      </div>

      <div>
        {/* Beneficiaries */}
        {view === 'beneficiaries' && (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-slate-100">
            <div className="flex items-center gap-2 mr-auto">
              <Users className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="text-lg font-black text-slate-900">Beneficiaries</h2>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-black text-slate-500">{shownBeneficiaries.length}</span>
            </div>
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, IBAN, bank…"
                dir="auto"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              />
            </div>
            <button onClick={() => setEditBeneficiary('new')} className="h-10 px-4 rounded-xl bg-[#0a0f1d] hover:bg-black text-white text-sm font-bold flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#D4AF37]" /> New Beneficiary
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 text-center">
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Bank</th>
                  <th className="py-3 px-3">IBAN</th>
                  <th className="py-3 px-3">Account No.</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shownBeneficiaries.length === 0 ? (
                  <NoData isTable colSpan={5} title={beneficiaries.length ? 'NO MATCHING BENEFICIARIES' : 'NO BENEFICIARIES YET'} />
                ) : (
                  shownBeneficiaries.map((b) => (
                    <tr key={b.ID} className={`text-center hover:bg-slate-50/70 ${b.IS_ACTIVE ? '' : 'opacity-50'}`}>
                      <td className="py-3 px-3 font-bold text-slate-800 max-w-[220px]">
                        <span className="block truncate" dir="auto" title={b.NAME}>
                          {b.NAME}
                        </span>
                        {!b.IS_ACTIVE && <span className="text-[10px] font-black uppercase text-slate-400">Inactive</span>}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-semibold max-w-[180px] truncate" dir="auto">
                        {bankById.get(b.BANK_ID || '')?.NAME || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-semibold tracking-wide whitespace-nowrap">{b.IBAN ? formatIban(b.IBAN) : '—'}</td>
                      <td className="py-3 px-3 text-slate-700 font-semibold whitespace-nowrap">{b.ACCOUNT_NO || '—'}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setEditBeneficiary(b)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ kind: 'beneficiary', item: b })}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {/* Banks */}
        {view === 'banks' && (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-slate-100">
            <Landmark className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-lg font-black text-slate-900 mr-auto">Banks</h2>
            <div className="relative hidden sm:block sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bank or SWIFT…"
                dir="auto"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              />
            </div>
            <button onClick={() => setEditBank('new')} className="h-10 px-4 rounded-xl bg-[#0a0f1d] hover:bg-black text-white text-sm font-bold flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#D4AF37]" /> New Bank
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 text-center">
                  <th className="py-3 px-3">Bank Name</th>
                  <th className="py-3 px-3">SWIFT Code</th>
                  <th className="py-3 px-3">Beneficiaries</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shownBanks.length === 0 ? (
                  <NoData isTable colSpan={5} title="NO BANKS YET" />
                ) : (
                  shownBanks.map((b) => (
                    <tr key={b.ID} className={`text-center hover:bg-slate-50/70 ${b.IS_ACTIVE ? '' : 'opacity-50'}`}>
                      <td className="py-3 px-3 font-bold text-slate-800" dir="auto">
                        {b.NAME}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-semibold tracking-wide">{b.SWIFT_CODE || '—'}</td>
                      <td className="py-3 px-3 text-slate-600 font-bold">{bankUse.get(b.ID) || 0}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black ${b.IS_ACTIVE ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {b.IS_ACTIVE ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setEditBank(b)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ kind: 'bank', item: b })}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}
      </div>

      {editBeneficiary && (
        <BeneficiaryModal
          beneficiary={editBeneficiary === 'new' ? null : editBeneficiary}
          banks={banks}
          onClose={() => setEditBeneficiary(null)}
          onSaved={onBeneficiarySaved}
          onBankCreated={onBankSaved}
        />
      )}
      {editBank && <BankModal bank={editBank === 'new' ? null : editBank} onClose={() => setEditBank(null)} onSaved={onBankSaved} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.kind === 'bank' ? 'Delete this bank?' : 'Delete this beneficiary?'}
        message={
          <>
            {deleteTarget?.item.NAME}
            <span className="block mt-2 text-xs text-slate-400">If it is used in requests it can&apos;t be deleted — edit it and set it to inactive instead.</span>
          </>
        }
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
