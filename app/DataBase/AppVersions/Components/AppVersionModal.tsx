'use client';

import { X, Save, Loader2 } from 'lucide-react';

export interface AppVersionRow {
  APP_NAME: string;
  VERSION_NAME: string;
  FORCE_UPDATE: boolean;
  UPDATED_AT: string | null;
}

export interface AppVersionFormValues {
  appName: string;
  versionName: string;
  forceUpdate: boolean;
}

interface Props {
  isOpen: boolean;
  editing: AppVersionRow | null;
  values: AppVersionFormValues;
  isSaving: boolean;
  onChange: (values: AppVersionFormValues) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AppVersionModal({ isOpen, editing, values, isSaving, onChange, onClose, onSubmit }: Props) {
  if (!isOpen) return null;

  const set = <K extends keyof AppVersionFormValues>(key: K, val: AppVersionFormValues[K]) => onChange({ ...values, [key]: val });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between p-8 border-b border-gray-50">
          <h2 className="text-2xl font-black text-black tracking-tight">{editing ? 'Edit App Version' : 'New App'}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-50 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-8 space-y-5">
          <div>
            <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">App Name</label>
            <input
              value={values.appName}
              readOnly={!!editing}
              onChange={(e) => set('appName', e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              placeholder="e.g. CUSTOMERS"
              className={`w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-black/5 ${editing ? 'bg-gray-50 text-gray-500' : ''}`}
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Version Name</label>
            <input
              value={values.versionName}
              onChange={(e) => set('versionName', e.target.value.trim())}
              placeholder="e.g. 10.10.6+16"
              className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-black/5"
            />
            <p className="text-[11px] text-gray-400 mt-1.5 ml-1">Same as the version line in pubspec.yaml (version + build number).</p>
          </div>

          <label className="flex items-center justify-between gap-4 px-4 py-3 border border-gray-100 rounded-xl cursor-pointer">
            <div>
              <p className="text-sm font-black text-black">Force Update</p>
              <p className="text-[11px] text-gray-400">Users can't use the app until they update.</p>
            </div>
            <button
              type="button"
              onClick={() => set('forceUpdate', !values.forceUpdate)}
              className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${values.forceUpdate ? 'bg-red-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${values.forceUpdate ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-gray-50 text-black rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-gray-100">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-black text-[#D4AF37] rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
