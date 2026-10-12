'use client';

// App Versions DB — edits the app_VERSIONS table that the Flutter apps read on start-up
// (latest version + force update). UPDATED_AT is set by the database trigger.

import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Smartphone } from 'lucide-react';
import { bhs_supabase } from '@/lib/secureDb';
import { ConfirmModal } from '@/app/LPOs/Components/ConfirmModal';
import { usePermissions } from '@/app/LPOs/Hooks/usePermissions';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import AppVersionModal, { type AppVersionFormValues, type AppVersionRow } from './Components/AppVersionModal';
import TabLoader from '@/app/Components/Loading/TabLoader';

const TABLE = 'app_VERSIONS';
const VERSION_PATTERN = /^\d+(\.\d+)*\+\d+$/;

const emptyForm = (): AppVersionFormValues => ({ appName: '', versionName: '', forceUpdate: false });

function FormatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AppVersionsPage() {
  const { canEdit, canDelete } = usePermissions();
  const [rows, setRows] = useState<AppVersionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppVersionRow | null>(null);
  const [formValues, setFormValues] = useState<AppVersionFormValues>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);

  useEffect(() => {
    void fetchRows();
  }, []);

  async function fetchRows() {
    try {
      setIsLoading(true);
      const { data, error } = await bhs_supabase.from(TABLE).select('*').order('APP_NAME');
      if (error) throw error;
      setRows((data || []) as AppVersionRow[]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load app versions');
    } finally {
      setIsLoading(false);
    }
  }

  const openModal = (row: AppVersionRow | null = null) => {
    setEditing(row);
    setFormValues(row ? { appName: row.APP_NAME, versionName: row.VERSION_NAME, forceUpdate: !!row.FORCE_UPDATE } : emptyForm());
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const appName = formValues.appName.trim().toUpperCase();
    const versionName = formValues.versionName.trim();
    if (!appName) return toast.warning('App Name is required');
    if (!VERSION_PATTERN.test(versionName)) return toast.warning('Version must look like 10.10.6+16');
    if (!editing && rows.some((r) => r.APP_NAME === appName)) return toast.warning('This app already exists');

    setIsSaving(true);
    try {
      if (editing) {
        const { error } = await bhs_supabase
          .from(TABLE)
          .update({ VERSION_NAME: versionName, FORCE_UPDATE: formValues.forceUpdate })
          .eq('APP_NAME', editing.APP_NAME);
        if (error) throw error;
        toast.success('App version updated');
      } else {
        const { error } = await bhs_supabase
          .from(TABLE)
          .insert({ APP_NAME: appName, VERSION_NAME: versionName, FORCE_UPDATE: formValues.forceUpdate });
        if (error) throw error;
        toast.success('App added');
      }
      setIsModalOpen(false);
      void fetchRows();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save app version');
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!toDelete) return;
    setIsSaving(true);
    try {
      const { error } = await bhs_supabase.from(TABLE).delete().eq('APP_NAME', toDelete);
      if (error) throw error;
      toast.success('App deleted');
      void fetchRows();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete app');
    } finally {
      setIsSaving(false);
      setToDelete(null);
    }
  };

  // Loader only (no header / search) until the first load finishes
  const [firstLoad, setFirstLoad] = useState(true);
  useEffect(() => {
    if (!isLoading) setFirstLoad(false);
  }, [isLoading]);
  if (firstLoad) return <TabLoader />;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-4xl font-normal text-black tracking-tighter flex items-center gap-3">
          App Versions DB
          <span className="text-lg font-black text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">{rows.length}</span>
        </h1>
        {canEdit && (
          <button type="button" onClick={() => openModal()} className="p-4 bg-black text-[#D4AF37] rounded-2xl shadow-xl hover:scale-[1.02] transition-all" title="Add App">
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      {isLoading ? (
        <TabLoader className="!min-h-[60vh]" />
      ) : rows.length === 0 ? (
        <NoData title="NO APPS FOUND" />
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-center">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                <th className="text-center px-6 py-4">App</th>
                <th className="text-center px-6 py-4">Version</th>
                <th className="text-center px-6 py-4">Force Update</th>
                <th className="text-center px-6 py-4">Updated At</th>
                {(canEdit || canDelete) && <th className="text-center px-6 py-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.APP_NAME} className="border-t border-gray-50 hover:bg-gray-50/60">
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-black text-[#D4AF37] flex items-center justify-center shrink-0">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <span className="font-black text-black font-mono">{row.APP_NAME}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-black">{row.VERSION_NAME}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${row.FORCE_UPDATE ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                      {row.FORCE_UPDATE ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{FormatDate(row.UPDATED_AT)}</td>
                  {(canEdit || canDelete) && (
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        {canEdit && (
                          <button type="button" onClick={() => openModal(row)} className="p-2 rounded-xl text-gray-400 hover:text-black hover:bg-gray-100" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" onClick={() => setToDelete(row.APP_NAME)} className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AppVersionModal
        isOpen={isModalOpen}
        editing={editing}
        values={formValues}
        isSaving={isSaving}
        onChange={setFormValues}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSave}
      />

      <ConfirmModal
        isOpen={!!toDelete}
        onConfirm={executeDelete}
        onCancel={() => setToDelete(null)}
        isLoading={isSaving}
        title="Delete App"
        message={`Are you sure you want to delete ${toDelete} from App Versions?`}
      />
    </div>
  );
}
