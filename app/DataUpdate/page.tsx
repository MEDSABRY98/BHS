'use client';

// Data Update: one page where a normal user refreshes some database data from Excel.
// Each dataset is a row with two buttons: Template and Upload.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, DatabaseZap, Download, Loader2, Upload } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';
import ConfirmDialog from '@/app/Forms/Shared/ConfirmDialog';
import { applyInventory, getAllowedDataSets, getInventoryTemplateProducts, previewInventory } from './Service/DataUpdateService';
import { downloadInventoryTemplate, readInventoryFile } from './Utils/InventoryExcel';
import { DATA_SETS, type DataSetId, type InventoryLine, type InventoryPreview } from './Utils/DataUpdateTypes';

const fmtQty = (n: number) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

export default function DataUpdatePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);
  useModuleTabAudit('Data Update');

  const [allowed, setAllowed] = useState<DataSetId[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // `${id}-template` | `${id}-upload` | 'apply'
  const [pending, setPending] = useState<{ id: DataSetId; file: string; lines: InventoryLine[]; preview: InventoryPreview } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<DataSetId | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setAllowed(await getAllowedDataSets());
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load the page');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await restoreSessionUser();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          await load();
        }
      } finally {
        setIsChecking(false);
      }
    })();
  }, [load]);

  const template = async (id: DataSetId) => {
    setBusy(`${id}-template`);
    try {
      if (id === 'inventory') await downloadInventoryTemplate(await getInventoryTemplateProducts());
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the template');
    } finally {
      setBusy(null);
    }
  };

  const pick = (id: DataSetId) => {
    uploadFor.current = id;
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    const id = uploadFor.current;
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !id) return;
    setBusy(`${id}-upload`);
    try {
      if (id === 'inventory') {
        const lines = await readInventoryFile(file);
        if (!lines.length) throw new Error('No row with a product ID and a quantity in the file');
        const preview = await previewInventory(lines.map(({ ROW, PRODUCT_ID, QTY }) => ({ ROW, PRODUCT_ID, QTY })));
        if (!preview.updated) throw new Error('No product in the file matches the products database');
        setPending({ id, file: file.name, lines, preview });
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not read the file');
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    if (!pending) return;
    setBusy('apply');
    try {
      const r = await applyInventory(pending.lines.map(({ ROW, PRODUCT_ID, QTY }) => ({ ROW, PRODUCT_ID, QTY })));
      toast.success(`Stock updated · ${r.updated} products${r.zeroed ? ` · ${r.zeroed} set to 0` : ''}`);
      setPending(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not update the stock');
    } finally {
      setBusy(null);
    }
  };

  if (isChecking) return <MainLoader message="Loading Data Update..." />;
  if (!isAuthenticated)
    return (
      <Login
        onLogin={async (user: any) => {
          setIsAuthenticated(true);
          setCurrentUser(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
          await load();
        }}
      />
    );

  // still loading: the loader alone, in the same place as every module
  if (allowed === null && !loadError)
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full flex flex-col">
          <TabLoader className="!min-h-[70vh] flex-1" />
        </div>
      </div>
    );

  const sets = DATA_SETS.filter((d) => allowed?.includes(d.id));

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-black">
      <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => (window.location.href = '/')}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center transition-colors"
            title="Back Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="w-12 h-12 rounded-2xl bg-[#0a0f1d] text-[#D4AF37] flex items-center justify-center shadow-lg shadow-black/10">
            <DatabaseZap className="w-6 h-6" />
          </span>
          <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Data Update</h1>
        </div>

        {loadError ? (
          <TabFetchError message={loadError} onRetry={() => void load()} />
        ) : allowed === null ? (
          <TabLoader className="!min-h-[50vh]" />
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black text-[11px] font-black uppercase tracking-[0.15em] text-white text-center border-b-2 border-[#C4A052]">
                    <th className="py-4 px-3 w-12">#</th>
                    <th className="py-4 px-3">Data</th>
                    <th className="py-4 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sets.map((d, i) => (
                    <tr key={d.id} className="text-center align-middle">
                      <td className="py-4 px-3 text-xs font-bold text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="py-4 px-3 font-black text-slate-900">{d.title}</td>
                      <td className="py-4 px-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => void template(d.id)}
                            disabled={!!busy}
                            className="h-10 w-32 px-3 rounded-xl border border-slate-200 text-sm font-bold text-emerald-700 hover:bg-emerald-50 flex items-center justify-center gap-1.5 disabled:opacity-40"
                          >
                            {busy === `${d.id}-template` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Template
                          </button>
                          <button
                            onClick={() => pick(d.id)}
                            disabled={!!busy}
                            className="h-10 w-32 px-3 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
                          >
                            {busy === `${d.id}-upload` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!sets.length && <NoData isTable colSpan={3} title="NO DATA TO UPDATE" message="You don't have access to any data here" />}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pending}
        title="Update the stock?"
        confirmLabel="Update Stock"
        busy={busy === 'apply'}
        onCancel={() => setPending(null)}
        onConfirm={() => void apply()}
        message={
          pending && (
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-700 truncate">{pending.file}</p>
              <p>
                <b className="text-slate-900">{pending.preview.updated}</b> products take the file&apos;s quantity (total {fmtQty(pending.preview.totalQty)})
              </p>
              <p>
                <b className="text-red-600">{pending.preview.zeroed}</b> other products that have stock become 0
              </p>
              {pending.preview.unknown.length > 0 && (
                <p className="text-amber-700">
                  {pending.preview.unknown.length} ID{pending.preview.unknown.length === 1 ? '' : 's'} not found and skipped:{' '}
                  {pending.preview.unknown.slice(0, 6).map((u) => u.id).join(', ')}
                  {pending.preview.unknown.length > 6 ? ' …' : ''}
                </p>
              )}
            </div>
          )
        }
      />
    </div>
  );
}
